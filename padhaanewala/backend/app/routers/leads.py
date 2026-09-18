from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user_roles, require_role
from app.models import Counsellor, Enquiry, LeadNote, LeadStatusHistory, User
from app.schemas.engagement import (
    LEAD_STATUSES,
    AddLeadNoteRequest,
    AssignLeadRequest,
    LeadDetailResponse,
    LeadListItem,
    LeadNoteResponse,
    LeadStatusHistoryResponse,
    SetFollowUpRequest,
    UpdateLeadStatusRequest,
)

router = APIRouter(prefix="/api/v1/leads", tags=["leads"])

_LEAD_ROLES = ("admin", "super_admin", "counsellor")


def _is_admin(user: User) -> bool:
    return bool({"admin", "super_admin"} & get_current_user_roles(user))


def _counsellor_for_user(db: Session, user: User) -> Counsellor | None:
    return db.scalar(select(Counsellor).where(Counsellor.user_id == user.id))


def _to_list_item(enquiry: Enquiry) -> LeadListItem:
    return LeadListItem(
        id=enquiry.id,
        name=enquiry.name,
        mobile=enquiry.mobile,
        email=enquiry.email,
        course_name=enquiry.course.name if enquiry.course else None,
        college_name=enquiry.college.name if enquiry.college else None,
        state_name=enquiry.state.name if enquiry.state else None,
        city=enquiry.city,
        qualification=enquiry.qualification,
        message=enquiry.message,
        source=enquiry.source,
        status=enquiry.status,
        assigned_counsellor=enquiry.counsellor.name if enquiry.counsellor else None,
        follow_up_date=enquiry.follow_up_date,
        created_at=enquiry.created_at,
    )


def _lead_query():
    return select(Enquiry).options(
        selectinload(Enquiry.course),
        selectinload(Enquiry.college),
        selectinload(Enquiry.state),
        selectinload(Enquiry.counsellor),
        selectinload(Enquiry.lead_notes),
        selectinload(Enquiry.status_history),
    )


def _get_enquiry(db: Session, enquiry_id: int) -> Enquiry | None:
    return db.scalar(_lead_query().where(Enquiry.id == enquiry_id))


def _can_access(db: Session, user: User, enquiry_id: int) -> bool:
    if _is_admin(user):
        return True
    counsellor = _counsellor_for_user(db, user)
    if counsellor is None:
        return False
    enquiry = db.get(Enquiry, enquiry_id)
    return enquiry is not None and enquiry.assigned_counsellor_id == counsellor.id


def _to_detail(enquiry: Enquiry) -> LeadDetailResponse:
    item = _to_list_item(enquiry)
    return LeadDetailResponse(
        **item.model_dump(),
        notes=[
            LeadNoteResponse(id=n.id, note=n.note, created_at=n.created_at)
            for n in enquiry.lead_notes
        ],
        status_history=[
            LeadStatusHistoryResponse(
                id=h.id,
                old_status=h.old_status,
                new_status=h.new_status,
                created_at=h.created_at,
            )
            for h in enquiry.status_history
        ],
    )


@router.get("", response_model=list[LeadListItem])
def list_leads(
    status: str | None = None,
    assigned_counsellor_id: int | None = None,
    college_id: int | None = None,
    search: str | None = Query(None, max_length=255),
    due_today: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role(*_LEAD_ROLES)),
    db: Session = Depends(get_db),
):
    query = _lead_query().order_by(Enquiry.created_at.desc())

    if not _is_admin(user):
        counsellor = _counsellor_for_user(db, user)
        if counsellor is None:
            return []
        query = query.where(Enquiry.assigned_counsellor_id == counsellor.id)

    if status:
        query = query.where(Enquiry.status == status)
    if assigned_counsellor_id:
        query = query.where(Enquiry.assigned_counsellor_id == assigned_counsellor_id)
    if college_id:
        query = query.where(Enquiry.college_id == college_id)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Enquiry.name.ilike(term),
                Enquiry.mobile.ilike(term),
                Enquiry.email.ilike(term),
            )
        )
    if due_today:
        query = query.where(Enquiry.follow_up_date <= date.today())

    enquiries = db.scalars(query.limit(limit).offset(offset)).all()
    return [_to_list_item(e) for e in enquiries]


@router.get("/{enquiry_id}", response_model=LeadDetailResponse)
def get_lead(
    enquiry_id: int,
    user: User = Depends(require_role(*_LEAD_ROLES)),
    db: Session = Depends(get_db),
):
    if not _can_access(db, user, enquiry_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    enquiry = _get_enquiry(db, enquiry_id)
    if enquiry is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return _to_detail(enquiry)


@router.post("/{enquiry_id}/notes", response_model=LeadNoteResponse, status_code=201)
def add_lead_note(
    enquiry_id: int,
    payload: AddLeadNoteRequest,
    user: User = Depends(require_role(*_LEAD_ROLES)),
    db: Session = Depends(get_db),
):
    if not _can_access(db, user, enquiry_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    enquiry = db.get(Enquiry, enquiry_id)
    if enquiry is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    note = LeadNote(enquiry_id=enquiry_id, user_id=user.id, note=payload.note)
    db.add(note)
    db.commit()
    db.refresh(note)
    return LeadNoteResponse(id=note.id, note=note.note, created_at=note.created_at)


@router.patch("/{enquiry_id}/status", response_model=LeadDetailResponse)
def update_lead_status(
    enquiry_id: int,
    payload: UpdateLeadStatusRequest,
    user: User = Depends(require_role(*_LEAD_ROLES)),
    db: Session = Depends(get_db),
):
    if payload.status not in LEAD_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status. Allowed: {sorted(LEAD_STATUSES)}",
        )
    if not _can_access(db, user, enquiry_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    enquiry = _get_enquiry(db, enquiry_id)
    if enquiry is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    if enquiry.status != payload.status:
        db.add(
            LeadStatusHistory(
                enquiry_id=enquiry_id,
                old_status=enquiry.status,
                new_status=payload.status,
                changed_by=user.id,
            )
        )
        enquiry.status = payload.status
        db.commit()

    return _to_detail(_get_enquiry(db, enquiry_id))


@router.patch(
    "/{enquiry_id}/assign",
    response_model=LeadDetailResponse,
    dependencies=[Depends(require_role("admin", "super_admin"))],
)
def assign_lead(
    enquiry_id: int,
    payload: AssignLeadRequest,
    db: Session = Depends(get_db),
):
    enquiry = db.get(Enquiry, enquiry_id)
    if enquiry is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    if payload.counsellor_id is not None:
        counsellor = db.get(Counsellor, payload.counsellor_id)
        if counsellor is None or not counsellor.is_active:
            raise HTTPException(
                status_code=404, detail="Counsellor not found or inactive"
            )
        active = db.scalar(
            select(func.count(Enquiry.id)).where(
                Enquiry.assigned_counsellor_id == counsellor.id,
                Enquiry.status.notin_(["won", "lost", "closed"]),
            )
        )
        if (active or 0) >= counsellor.max_leads:
            raise HTTPException(
                status_code=409, detail="Counsellor has reached the lead limit"
            )
        enquiry.assigned_counsellor_id = counsellor.id
    else:
        enquiry.assigned_counsellor_id = None

    db.commit()
    return _to_detail(_get_enquiry(db, enquiry_id))


@router.patch("/{enquiry_id}/follow-up", response_model=LeadDetailResponse)
def set_follow_up(
    enquiry_id: int,
    payload: SetFollowUpRequest,
    user: User = Depends(require_role(*_LEAD_ROLES)),
    db: Session = Depends(get_db),
):
    if not _can_access(db, user, enquiry_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    enquiry = db.get(Enquiry, enquiry_id)
    if enquiry is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    enquiry.follow_up_date = payload.follow_up_date
    db.commit()
    return _to_detail(_get_enquiry(db, enquiry_id))