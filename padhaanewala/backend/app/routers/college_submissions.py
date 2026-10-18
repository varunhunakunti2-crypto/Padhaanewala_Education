"""The public "suggest a college" submission workflow and its admin review queue.

The whole point of this module is the guarantee stated at the top of
`CollegeSubmission`: a public submission never becomes a published college by
itself. That guarantee is enforced here in three places, and it is worth reading
them together:

1. `POST ""` refuses (409) a proposal whose normalised name already matches an
   active college, and stores a *fuzzy* match as an advisory
   `possible_duplicate_college_id` so a reviewer sees the near-miss without the
   system acting on it.
2. The `approve` path is the only writer that touches `colleges`, and it does so
   explicitly — either linking the pre-existing college (an exact match appeared
   between submit and review, whether it is live or archived) or creating a new
   one. It re-checks the exact duplicate under a row lock, so a submission cannot
   create a second college for a name that already holds the slug — a unique
   index the `is_active` flag does not exempt.
3. Approval runs inside `SELECT ... FOR UPDATE` and re-reads `status`, so two
   reviewers clicking "approve" at the same moment cannot both act: the second
   blocks on the lock, sees `approved`, and gets a 409 rather than a duplicate
   college.

Role gates mirror the existing `CollegesSection` read/write asymmetry: reading
the queue is `CONTENT_ROLES`, the review actions that mutate `colleges` are
`ADMIN_ROLES`. A public submitter can only ever see and edit their *own* rows.
"""

import re
from collections.abc import Sequence
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import (
    get_current_user,
    get_current_user_roles,
    require_processing_consent,
    require_role,
)
from app.models import College, CollegeSubmission, State, University, User
from app.roles import ADMIN_ROLES, CONTENT_ROLES
from app.schemas.submissions import (
    CollegeSubmissionCreate,
    CollegeSubmissionResponse,
    CollegeSubmissionUpdate,
    SubmissionReview,
)
from app.utils import audit

router = APIRouter(prefix="/api/v1/college-submissions", tags=["college-submissions"])

#: Statuses a submitter may still edit or withdraw. A reviewed row is frozen for
#: the owner the moment a human has acted on it — reopening it would silently
#: discard the reviewer's decision.
REVISABLE_STATUSES = frozenset({"pending", "changes_requested"})

#: Words too generic to signal a duplicate on their own ("college", "institute").
_NOISE_TOKEN = frozenset(
    {"college", "institute", "university", "school", "of", "the", "and", "for"}
)


def _slugify(text: str) -> str:
    """Same normalisation `colleges.py` uses to build `College.slug`.

    Reusing it — rather than inventing a second one — is what makes the exact
    duplicate check trustworthy: a name that would collide as a `slug` on create
    is exactly the name that already exists, because both paths normalise the
    same way.
    """
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def _find_exact_duplicate(
    db: Session, name: str, *, include_inactive: bool = False
) -> College | None:
    """A college whose normalised name equals ``name``'s.

    Archived (`is_active = False`) rows are skipped by default, so a student can
    still suggest a college that was removed from the catalogue — it is not in
    the list they were told to check against.

    The approve path passes `include_inactive=True`, and it is the only caller
    that must: `colleges.slug` carries a **unique** index with no regard for the
    flag, so an archived row invisible here would not be a missing duplicate but
    a live one that `_create_college_from_submission` then violates — the insert
    dies on the index and the reviewer gets a 500 with the row still pending.
    Linking instead is what turns that into the review action it should be.
    """
    slug = _slugify(name)
    if not slug:
        return None
    stmt = select(College).where(College.slug == slug)
    if not include_inactive:
        stmt = stmt.where(College.is_active)
    return db.scalar(stmt)


def _find_possible_duplicate(db: Session, name: str) -> College | None:
    """Best-effort near-match, stored as a reviewer hint only.

    Advisory, never authoritative: an `ilike` over the significant tokens of the
    proposed name is deliberately loose, because a false *hint* costs a reviewer
    one glance while a false *block* would stop a genuinely distinct college from
    ever being added. The decision stays human.

    Archived colleges are included in the sweep, which is deliberate rather than
    an oversight: approval links one instead of creating a duplicate slug (see
    `_find_exact_duplicate`), so a reviewer who never sees the near-miss here is
    one who approves expecting a new record to appear and gets a link to a
    college that is not published.
    """
    tokens = [
        t
        for t in re.split(r"[^a-z0-9]+", name.lower())
        if len(t) >= 4 and t not in _NOISE_TOKEN
    ]
    if not tokens:
        return None
    conditions = [College.name.ilike(f"%{t}%") for t in tokens[:5]]
    return db.scalar(
        select(College)
        .where(or_(*conditions))
        # Live matches first: an archived near-miss is worth showing, but not at
        # the cost of hiding the published college a reviewer should compare to.
        .order_by(College.is_active.desc(), College.id)
        .limit(1)
    )


def _require_state(db: Session, state_id: int | None) -> None:
    """Refuse an unknown `proposed_state_id` rather than let the FK decide.

    `proposed_state_id` is a real foreign key and the value arrives as an id the
    form resolved from a separately fetched list — so a state removed between the
    page loading and the POST landing (or a hand-built body) would otherwise
    insert against a missing parent. PostgreSQL answers that with an
    IntegrityError, which is a 500 for what is a client-side validation miss; a
    422 is the status the API's own contract uses and the one the frontend maps
    back onto the field.
    """
    if state_id is not None and db.get(State, state_id) is None:
        raise HTTPException(
            status_code=422,
            detail="That state is not on the list any more — choose one from the dropdown.",
        )


def _serialize(
    sub: CollegeSubmission,
    users: dict[int, User],
    colleges: dict[int, College],
) -> CollegeSubmissionResponse:
    """Build one response from parents already resolved in bulk.

    Split out from `_to_response` so the list endpoints can share one bulk
    resolve across every row instead of a fresh `db.get` per column per row.
    """
    submitter = users.get(sub.submitted_by) if sub.submitted_by else None
    reviewer = users.get(sub.reviewer_id) if sub.reviewer_id else None
    college = colleges.get(sub.college_id) if sub.college_id else None
    dup = (
        colleges.get(sub.possible_duplicate_college_id)
        if sub.possible_duplicate_college_id
        else None
    )
    return CollegeSubmissionResponse(
        id=sub.id,
        submitted_by=sub.submitted_by,
        submitter_name=submitter.display_name if submitter else None,
        proposed_name=sub.proposed_name,
        proposed_official_name=sub.proposed_official_name,
        proposed_college_type=sub.proposed_college_type,
        proposed_ownership=sub.proposed_ownership,
        proposed_university_name=sub.proposed_university_name,
        proposed_state_id=sub.proposed_state_id,
        proposed_state_name=sub.proposed_state_name,
        proposed_city=sub.proposed_city,
        proposed_address=sub.proposed_address,
        proposed_website=sub.proposed_website,
        proposed_email=sub.proposed_email,
        proposed_phone=sub.proposed_phone,
        proposed_overview=sub.proposed_overview,
        submitter_notes=sub.submitter_notes,
        status=sub.status,
        reviewer_id=sub.reviewer_id,
        reviewer_name=reviewer.display_name if reviewer else None,
        reviewer_notes=sub.reviewer_notes,
        reviewed_at=sub.reviewed_at,
        college_id=sub.college_id,
        college_name=college.name if college else None,
        college_slug=college.slug if college else None,
        college_is_active=college.is_active if college else None,
        possible_duplicate_college_id=sub.possible_duplicate_college_id,
        possible_duplicate_college_name=dup.name if dup else None,
        created_at=sub.created_at,
        updated_at=sub.updated_at,
    )


def _resolve_parents(
    db: Session, subs: Sequence[CollegeSubmission]
) -> tuple[dict[int, User], dict[int, College]]:
    """Resolve every user and college ``subs`` reference in two queries.

    `submitter_name`, `reviewer_name`, `college_name`/`college_slug`/
    `college_is_active` and the advisory duplicate name all read from these maps,
    so the two list endpoints issue two queries total instead of up to four *per
    row* — the N+1 a queue page otherwise pays for every submission it renders.
    """
    user_ids = {
        i for s in subs for i in (s.submitted_by, s.reviewer_id) if i is not None
    }
    college_ids = {
        i
        for s in subs
        for i in (s.college_id, s.possible_duplicate_college_id)
        if i is not None
    }
    users: dict[int, User] = {}
    if user_ids:
        users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids)))}
    colleges: dict[int, College] = {}
    if college_ids:
        colleges = {
            c.id: c
            for c in db.scalars(select(College).where(College.id.in_(college_ids)))
        }
    return users, colleges


def _to_response(db: Session, sub: CollegeSubmission) -> CollegeSubmissionResponse:
    users, colleges = _resolve_parents(db, [sub])
    return _serialize(sub, users, colleges)


def _to_responses(
    db: Session, subs: Sequence[CollegeSubmission]
) -> list[CollegeSubmissionResponse]:
    users, colleges = _resolve_parents(db, subs)
    return [_serialize(s, users, colleges) for s in subs]


def _create_college_from_submission(
    db: Session, sub: CollegeSubmission
) -> College:
    """Materialise a submission into a real, active, unverified college.

    Created *active* and `unverified`: approval is the publish step, and an
    inactive college would be invisible to the public `GET /colleges` filter with
    no admin control to lift it. The university is resolved by exact, case-insensitive
    name match; an unrecognised name is left as `None` rather than guessed, since
    `College` links a university by id, not by the free text the submitter typed.
    """
    slug = _slugify(sub.proposed_name)
    next_id = (db.scalar(select(func.max(College.id))) or 0) + 1

    university_id = None
    if sub.proposed_university_name:
        university_id = db.scalar(
            select(University.id).where(
                func.lower(University.name)
                == sub.proposed_university_name.strip().lower()
            )
        )

    college = College(
        college_id=f"COLLEGE{next_id:06d}",
        name=sub.proposed_name,
        official_name=sub.proposed_official_name,
        slug=slug,
        college_type=sub.proposed_college_type,
        ownership=sub.proposed_ownership,
        university_id=university_id,
        state_id=sub.proposed_state_id,
        city=sub.proposed_city,
        address=sub.proposed_address,
        website=sub.proposed_website,
        email=sub.proposed_email,
        phone=sub.proposed_phone,
        overview=sub.proposed_overview,
        is_featured=False,
        is_active=True,
        verification_status="unverified",
    )
    db.add(college)
    db.flush()
    return college


@router.post("", response_model=CollegeSubmissionResponse, status_code=201)
def submit_college_suggestion(
    payload: CollegeSubmissionCreate,
    request: Request,
    db: Session = Depends(get_db),
    #: The submission is tied to the account and can carry contact details and
    #: notes, so it is a personal-data write and is gated the same way as the
    #: rest of the write surface (DPDP).
    user: User = Depends(require_processing_consent),
):
    if _find_exact_duplicate(db, payload.proposed_name) is not None:
        raise HTTPException(
            status_code=409,
            detail="A college with this name already exists — check the list before suggesting it.",
        )
    _require_state(db, payload.proposed_state_id)

    duplicate = _find_possible_duplicate(db, payload.proposed_name)
    submission = CollegeSubmission(
        submitted_by=user.id,
        proposed_name=payload.proposed_name,
        proposed_official_name=payload.proposed_official_name,
        proposed_college_type=payload.proposed_college_type,
        proposed_ownership=payload.proposed_ownership,
        proposed_university_name=payload.proposed_university_name,
        proposed_state_id=payload.proposed_state_id,
        proposed_state_name=payload.proposed_state_name,
        proposed_city=payload.proposed_city,
        proposed_address=payload.proposed_address,
        proposed_website=payload.proposed_website,
        proposed_email=payload.proposed_email,
        proposed_phone=payload.proposed_phone,
        proposed_overview=payload.proposed_overview,
        submitter_notes=payload.submitter_notes,
        status="pending",
        possible_duplicate_college_id=duplicate.id if duplicate else None,
    )
    db.add(submission)
    db.flush()
    audit.record(
        db,
        request=request,
        action="submit_college_suggestion",
        entity_type="college_submission",
        entity_id=submission.id,
        actor=user,
        new_value={"proposed_name": submission.proposed_name},
    )
    db.commit()
    db.refresh(submission)
    return _to_response(db, submission)


@router.get("/my", response_model=list[CollegeSubmissionResponse])
def my_submissions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    submissions = db.scalars(
        select(CollegeSubmission)
        .where(CollegeSubmission.submitted_by == user.id)
        .order_by(CollegeSubmission.created_at.desc())
    ).all()
    return _to_responses(db, submissions)


@router.get("", response_model=list[CollegeSubmissionResponse])
def list_submissions(
    status: str = Query("pending", pattern="^(pending|approved|rejected|changes_requested)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(*CONTENT_ROLES)),
):
    submissions = db.scalars(
        select(CollegeSubmission)
        .where(CollegeSubmission.status == status)
        .order_by(CollegeSubmission.created_at.asc())
        .limit(limit)
        .offset(offset)
    ).all()
    return _to_responses(db, submissions)


@router.get("/{submission_id}", response_model=CollegeSubmissionResponse)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    submission = db.get(CollegeSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    is_owner = submission.submitted_by == user.id
    is_staff = bool(set(CONTENT_ROLES) & get_current_user_roles(user))
    # 404 rather than 403 for a stranger: a submission id is not something we
    # confirm the existence of to callers who may not see it.
    if not (is_owner or is_staff):
        raise HTTPException(status_code=404, detail="Submission not found")
    return _to_response(db, submission)


@router.put("/{submission_id}", response_model=CollegeSubmissionResponse)
def update_submission(
    submission_id: int,
    payload: CollegeSubmissionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    #: An edit re-writes the contact details the submitter originally sent
    #: (`proposed_email`, `proposed_phone`, the notes), so it is the same
    #: personal-data write `POST` is — and gating only the first of the two left
    #: a withdrawn-consent account able to keep writing its own record. Reads and
    #: the DELETE below stay ungated: access to, and erasure of, your own data
    #: are the rights that have to survive a withdrawal.
    user: User = Depends(require_processing_consent),
):
    submission = db.scalar(
        select(CollegeSubmission).where(
            CollegeSubmission.id == submission_id,
            CollegeSubmission.submitted_by == user.id,
        )
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status not in REVISABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="This submission has been reviewed and can no longer be edited.",
        )

    data = payload.model_dump(exclude_unset=True)

    # Both refusals run before any mutation, so a rejected update leaves the row
    # untouched and writes no audit diff for a change that never happened — the
    # same ordering `colleges.update_college` uses.
    if "proposed_name" in data and data["proposed_name"] is not None:
        if _find_exact_duplicate(db, data["proposed_name"]) is not None:
            raise HTTPException(
                status_code=409,
                detail="A college with this name already exists.",
            )
    _require_state(db, data.get("proposed_state_id"))

    before = {field: getattr(submission, field) for field in data if hasattr(submission, field)}
    changed = {
        field: {"from": before[field], "to": value}
        for field, value in data.items()
        if field in before and before[field] != value
    }
    for field, value in data.items():
        setattr(submission, field, value)

    if "proposed_name" in data:
        duplicate = _find_possible_duplicate(db, submission.proposed_name)
        submission.possible_duplicate_college_id = duplicate.id if duplicate else None

    # Re-queue for review: an edit after a change request must go back to pending
    # so the reviewer is not left looking at a row they already acted on.
    submission.status = "pending"

    if changed:
        audit.record(
            db,
            request=request,
            action="update_college_submission",
            entity_type="college_submission",
            entity_id=submission.id,
            actor=user,
            old_value={f: pair["from"] for f, pair in changed.items()},
            new_value={f: pair["to"] for f, pair in changed.items()},
        )
    db.commit()
    db.refresh(submission)
    return _to_response(db, submission)


@router.delete("/{submission_id}", status_code=204)
def delete_submission(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    submission = db.get(CollegeSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    is_owner = submission.submitted_by == user.id
    is_admin = bool(set(ADMIN_ROLES) & get_current_user_roles(user))
    if is_admin:
        pass  # an admin may withdraw any row
    elif is_owner:
        if submission.status not in REVISABLE_STATUSES:
            raise HTTPException(
                status_code=409,
                detail="Only pending or change-requested submissions can be withdrawn.",
            )
    else:
        raise HTTPException(status_code=404, detail="Submission not found")

    audit.record(
        db,
        request=request,
        action="delete_college_submission",
        entity_type="college_submission",
        entity_id=submission.id,
        actor=user,
        old_value={
            "proposed_name": submission.proposed_name,
            "status": submission.status,
            "submitted_by": submission.submitted_by,
        },
    )
    db.delete(submission)
    db.commit()


def _review(
    db: Session,
    request: Request,
    submission_id: int,
    payload: SubmissionReview,
    reviewer: User,
    *,
    target_status: str,
) -> CollegeSubmissionResponse:
    """Shared tail for the three review actions.

    The row is locked with ``FOR UPDATE`` and ``status`` re-checked *after* the
    lock is held. That ordering is the concurrency guarantee: two reviewers
    acting on the same submission serialise here, and the one who loses the race
    sees the committed terminal status and is refused with a 409 instead of
    double-acting. Rejecting and requesting changes share the lock because the
    same race applies to them.
    """
    submission = db.scalar(
        select(CollegeSubmission)
        .where(CollegeSubmission.id == submission_id)
        .with_for_update()
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    # `approved` and `rejected` are terminal; `pending` and `changes_requested`
    # are still reviewable. This re-check is what makes the row lock meaningful:
    # a concurrent reviewer's committed decision is visible here the moment we
    # hold the lock, so the loser of the race is refused rather than double-acting.
    if submission.status in ("approved", "rejected"):
        raise HTTPException(
            status_code=409,
            detail=f"Submission already reviewed ({submission.status})",
        )

    submission.status = target_status
    submission.reviewer_id = reviewer.id
    submission.reviewer_notes = payload.reviewer_notes
    submission.reviewed_at = datetime.now(UTC)

    new_value: dict = {"status": target_status}
    if target_status == "approved":
        # Link *anything* that already holds this name — live or archived — and
        # create only when nothing does. The archived case is not a nicety: the
        # slug index is unique either way, so creating alongside one is an
        # IntegrityError the reviewer would meet as a 500.
        college = _find_exact_duplicate(
            db, submission.proposed_name, include_inactive=True
        )
        created = None
        if college is None:
            college = _create_college_from_submission(db, submission)
            created = college.id
        submission.college_id = college.id
        new_value["college_id"] = college.id
        if created is not None:
            new_value["created_college_id"] = created

    audit.record(
        db,
        request=request,
        action=f"{target_status}_college_submission",
        entity_type="college_submission",
        entity_id=submission.id,
        actor=reviewer,
        old_value=None,
        new_value=new_value,
    )
    db.commit()
    db.refresh(submission)
    return _to_response(db, submission)


@router.post(
    "/{submission_id}/approve",
    response_model=CollegeSubmissionResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def approve_submission(
    submission_id: int,
    payload: SubmissionReview,
    request: Request,
    db: Session = Depends(get_db),
    reviewer: User = Depends(get_current_user),
):
    return _review(
        db, request, submission_id, payload, reviewer, target_status="approved"
    )


@router.post(
    "/{submission_id}/reject",
    response_model=CollegeSubmissionResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def reject_submission(
    submission_id: int,
    payload: SubmissionReview,
    request: Request,
    db: Session = Depends(get_db),
    reviewer: User = Depends(get_current_user),
):
    return _review(
        db, request, submission_id, payload, reviewer, target_status="rejected"
    )


@router.post(
    "/{submission_id}/request-changes",
    response_model=CollegeSubmissionResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def request_changes_submission(
    submission_id: int,
    payload: SubmissionReview,
    request: Request,
    db: Session = Depends(get_db),
    reviewer: User = Depends(get_current_user),
):
    return _review(
        db, request, submission_id, payload, reviewer, target_status="changes_requested"
    )
