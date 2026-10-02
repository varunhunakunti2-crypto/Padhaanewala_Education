"""DPDP Act compliance endpoints: the age gate, parental consent, and the
data-principal request channel.

Three surfaces, deliberately in one router, because they share one authority —
`app.services.compliance_service.decide_processing` — and splitting them would
mean three places that each have to remember to call it.

Route shape:

    GET    /api/v1/compliance/status                     the whole gate, one call
    POST   /api/v1/compliance/age                       declare an age band
    GET    /api/v1/compliance/parental-consent          current consent state
    POST   /api/v1/compliance/parental-consent/request  ask a guardian, send a code
    POST   /api/v1/compliance/parental-consent/verify   read the code back
    POST   /api/v1/compliance/parental-consent/withdraw stop processing now

    GET    /api/v1/compliance/requests                  my requests
    POST   /api/v1/compliance/requests                  raise one (s.8(5)-(6))
    GET    /api/v1/compliance/requests/{id}             one of mine

    GET    /api/v1/compliance/admin/requests            the staff queue
    PATCH  /api/v1/compliance/admin/requests/{id}       move one along
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import ConsentRecord, DataRequest, GuardianConsent, User
from app.models.data_request import (
    DATA_REQUEST_SLA_DAYS,
    OPEN_STATUSES,
    REQUEST_TYPES,
    TERMINAL_STATUSES,
    sla_due_at,
)
from app.roles import ADMIN_ROLES
from app.schemas.compliance import (
    AgeDeclareRequest,
    AgeDeclareResponse,
    ComplianceStatusResponse,
    DataRequestCreate,
    DataRequestResponse,
    DataRequestUpdate,
    GuardianConsentRequest,
    GuardianConsentResponse,
    GuardianConsentVerifyBody,
)
from app.services import compliance_service as compliance
from app.services import otp_service, sms_service
from app.utils import audit
from app.utils.client_ip import client_ip

logger = logging.getLogger("padhaanewala.compliance")

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _consent_response(consent: GuardianConsent) -> GuardianConsentResponse:
    return GuardianConsentResponse(
        id=consent.id,
        status=consent.status,
        verification_channel=consent.verification_channel,
        requested_at=consent.requested_at,
        verified_at=consent.verified_at,
        withdrawn_at=consent.withdrawn_at,
        expires_at=consent.expires_at,
        consent_version=consent.consent_version,
    )


def _request_response(row: DataRequest, *, now: datetime | None = None) -> DataRequestResponse:
    moment = now or _now()
    due = _as_utc(row.due_at)
    remaining = due - moment
    seconds = remaining.total_seconds()
    if seconds >= 0:
        # Rounded *up*, not truncated. A request with 2.4 days left reading as
        # "2 days remaining" invites treating it as comfortable when it is not,
        # and this number decides what the staff queue works on first.
        days_remaining = -(-int(seconds) // 86400)
    else:
        # Rounded *down* in magnitude, so an overdue request never claims to be
        # more overdue than it is.
        days_remaining = -int(-seconds // 86400)
    return DataRequestResponse(
        id=row.id,
        request_type=row.request_type,
        status=row.status,
        subject=row.subject,
        details=row.details,
        received_at=row.received_at,
        acknowledged_at=row.acknowledged_at,
        due_at=row.due_at,
        completed_at=row.completed_at,
        resolution=row.resolution,
        days_remaining=days_remaining,
        overdue=bool(row.status in OPEN_STATUSES and seconds < 0),
    )


# ------------------------------------------------------------------ the gate


@router.get("/status", response_model=ComplianceStatusResponse)
def compliance_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Everything the client needs to render the right gate, in one round trip.

    One call rather than three: a gate that has to ask "is the age answered?"
    before it knows whether to ask "is consent verified?" shows a wrong state on
    first paint, and a modal that flashes is worse than one that is late.
    """
    snapshot = compliance.gate_snapshot(db, user)
    return ComplianceStatusResponse(**snapshot, sla_days=DATA_REQUEST_SLA_DAYS)


@router.post("/age", response_model=AgeDeclareResponse)
def declare_age(
    payload: AgeDeclareRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Declare an age band, or correct a previous declaration.

    Overwriting silently is a deliberate choice and worth stating: a child who
    mis-ticked "under 18" is not harmed by the stricter treatment, whereas a
    child who could only ever move *towards* adulthood without verification would
    be able to escalate their own consent state with one request. So the write is
    allowed in both directions, the previous value is written to the audit log,
    and the consent ledger records the change as its own `age_verification` row.
    """
    previous = user.age_band
    compliance.apply_age_band(user, payload.age_band)

    db.add(
        ConsentRecord(
            user_id=user.id,
            consent_type="age_verification",
            consent_version=compliance.GUARDIAN_CONSENT_VERSION,
            consent_text=(
                "The user declared themselves to be "
                f"{'under 18' if user.is_minor else '18 or older'}."
            ),
            granted=True,
            ip_address=client_ip(request),
        )
    )
    audit.record(
        db,
        request=request,
        action="declare_age",
        entity_type="user",
        entity_id=user.id,
        actor=user,
        old_value={"age_band": previous},
        new_value={"age_band": user.age_band, "is_minor": user.is_minor},
    )
    db.commit()
    db.refresh(user)

    decision = compliance.decide_processing(db, user)
    return AgeDeclareResponse(
        age_band=user.age_band,
        is_minor=user.is_minor,
        processing_allowed=decision.allowed,
        blocked_reason=None if decision.allowed else decision.code,
        blocked_message=None if decision.allowed else decision.message,
    )


# --------------------------------------------------------- parental consent


@router.get("/parental-consent", response_model=GuardianConsentResponse | None)
def get_parental_consent(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consent = compliance.latest_consent(db, user.id)
    return None if consent is None else _consent_response(consent)


@router.post(
    "/parental-consent/request",
    response_model=GuardianConsentResponse,
    status_code=status.HTTP_201_CREATED,
)
def request_parental_consent(
    payload: GuardianConsentRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record the guardian's details and send them a verification code.

    The code is the whole point. Section 9(2) requires *verifiable* consent, and
    a form a child fills in asserting that their parent agrees is not that — so
    nothing about this request authorises anything until `verify` succeeds.

    SMS is preferred over email when both are given: it proves control of a
    handset, which is the only possession evidence available for someone who is
    not the account holder, and it does not depend on the parent's address being
    one the child controls.
    """
    if not user.is_minor:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Parental consent is only collected from users declared under 18",
        )

    channel = "sms" if payload.guardian_mobile else "email"
    target = payload.guardian_mobile or str(payload.guardian_email)

    # Supersede any earlier pending row for this user so the "latest" lookup the
    # gate uses cannot land on a dead request while a live one waits.
    for stale in db.scalars(
        select(GuardianConsent).where(
            GuardianConsent.user_id == user.id,
            GuardianConsent.status == "pending",
        )
    ):
        stale.status = "denied"

    now = _now()
    consent = GuardianConsent(
        user_id=user.id,
        guardian_name=payload.guardian_name,
        guardian_email=payload.guardian_email,
        guardian_mobile=payload.guardian_mobile,
        verification_channel=channel,
        verification_target=target,
        status="pending",
        consent_version=compliance.GUARDIAN_CONSENT_VERSION,
        consent_text=compliance.GUARDIAN_CONSENT_TEXT,
        requested_at=now,
        expires_at=now + timedelta(days=settings.GUARDIAN_CONSENT_VALIDITY_DAYS),
        request_ip=client_ip(request),
        created_at=now,
    )
    db.add(consent)
    db.flush()

    try:
        issued = otp_service.issue(
            db,
            purpose=otp_service.GUARDIAN_CONSENT,
            identifier=target,
            user_id=user.id,
            request_ip=client_ip(request),
        )
    except otp_service.OtpRateLimited as exc:
        db.rollback()
        # 429 rather than 400: the caller did nothing wrong and the wait is a
        # property of the send cap, not of their input.
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

    if channel == "sms":
        # Best-effort, same reasoning as the registration OTPs: a provider outage
        # must not 500 the request, and the row stays `pending` so the guardian
        # can be asked again rather than the request silently vanishing.
        try:
            sms_service.send_otp(payload.guardian_mobile, issued.secret)
        except sms_service.SmsDeliveryError:
            logger.warning(
                "Guardian consent code for user_id=%s was not delivered; "
                "the consent row stays pending",
                user.id,
                exc_info=True,
            )

    audit.record(
        db,
        request=request,
        action="request_parental_consent",
        entity_type="guardian_consent",
        entity_id=consent.id,
        actor=user,
        new_value={"channel": channel, "status": "pending"},
    )
    db.commit()
    db.refresh(consent)
    return _consent_response(consent)


@router.post("/parental-consent/verify", response_model=GuardianConsentResponse)
def verify_parental_consent(
    payload: GuardianConsentVerifyBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Read back the code and, on success, mark the consent verified.

    `otp_service` owns every rule that makes this safe — the secret is hashed, a
    resend supersedes, sends are capped per identifier, attempts are capped per
    code and it expires — so this function only has to decide what a correct code
    *means*.
    """
    consent = compliance.latest_consent(db, user.id)
    if consent is None or consent.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There is no consent request awaiting verification",
        )

    try:
        otp_service.verify(
            db,
            purpose=otp_service.GUARDIAN_CONSENT,
            identifier=consent.verification_target,
            secret=payload.code,
        )
    except otp_service.OtpError as exc:
        # The OTP layer distinguishes not-found / expired / locked / invalid on
        # purpose so it can log precisely. Echoing that distinction here would
        # turn this into an oracle for whether a guardian request exists, so the
        # client gets one message and the log gets the detail.
        logger.info(
            "Guardian consent verification failed for user_id=%s: %s",
            user.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That code is not correct or has expired. Ask for a new one.",
        ) from exc

    now = _now()
    consent.status = "verified"
    consent.verified_at = now
    consent.expires_at = now + timedelta(days=settings.GUARDIAN_CONSENT_VALIDITY_DAYS)

    db.add(
        ConsentRecord(
            user_id=user.id,
            consent_type="parental_consent",
            consent_version=consent.consent_version,
            consent_text=consent.consent_text,
            granted=True,
            ip_address=client_ip(request),
        )
    )
    audit.record(
        db,
        request=request,
        action="verify_parental_consent",
        entity_type="guardian_consent",
        entity_id=consent.id,
        actor=user,
        old_value={"status": "pending"},
        new_value={"status": "verified", "expires_at": consent.expires_at},
    )
    db.commit()
    db.refresh(consent)
    return _consent_response(consent)


@router.post("/parental-consent/withdraw", response_model=GuardianConsentResponse)
def withdraw_parental_consent(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stop processing this user's personal data, now.

    DPDP s.9(4)-(5): a guardian may withdraw consent at any time, and the
    withdrawal must be as easy as the grant was. So this needs no code, no
    confirmation token and no contact with the guardian — whoever holds the
    account can stop the processing, and the erasure that follows is 9.5's job.

    The row is not deleted and the flag is not flipped in place. `withdrawn_at`
    plus `status` leaves the record that consent was once given, which is what
    answers "on what basis did you process this in March".
    """
    consent = compliance.latest_consent(db, user.id)
    if consent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="There is no parental consent to withdraw",
        )
    if consent.status == "withdrawn":
        # Idempotent. A double-click must not 500, and must not overwrite the
        # original withdrawal timestamp.
        return _consent_response(consent)

    old_status = consent.status
    now = _now()
    consent.status = "withdrawn"
    consent.withdrawn_at = now

    db.add(
        ConsentRecord(
            user_id=user.id,
            consent_type="parental_consent",
            consent_version=consent.consent_version,
            consent_text="Consent withdrawn by the account holder or their guardian.",
            granted=False,
            ip_address=client_ip(request),
        )
    )
    audit.record(
        db,
        request=request,
        action="withdraw_parental_consent",
        entity_type="guardian_consent",
        entity_id=consent.id,
        actor=user,
        old_value={"status": old_status},
        new_value={"status": "withdrawn"},
    )
    db.commit()
    db.refresh(consent)
    return _consent_response(consent)


# --------------------------------------------------- data-principal requests


@router.get("/requests", response_model=list[DataRequestResponse])
def list_my_requests(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(DataRequest)
        .where(DataRequest.user_id == user.id)
        .order_by(DataRequest.id.desc())
    ).all()
    return [_request_response(row) for row in rows]


@router.post(
    "/requests",
    response_model=DataRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_data_request(
    payload: DataRequestCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Raise a s.8(5)-(6) request and start the 90-day clock.

    `due_at` is fixed here, at intake. Deriving it on read would let the deadline
    move every time the row was touched, which is not a deadline.
    """
    if payload.request_type not in REQUEST_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported request type. Allowed: {sorted(REQUEST_TYPES)}",
        )

    now = _now()
    row = DataRequest(
        user_id=user.id,
        request_type=payload.request_type,
        status="received",
        subject=payload.subject,
        details=payload.details,
        received_at=now,
        due_at=sla_due_at(now),
        created_at=now,
    )
    db.add(row)
    db.flush()

    audit.record(
        db,
        request=request,
        action="create_data_request",
        entity_type="data_request",
        entity_id=row.id,
        actor=user,
        new_value={
            "request_type": row.request_type,
            "due_at": row.due_at,
        },
    )
    db.commit()
    db.refresh(row)
    return _request_response(row, now=now)


@router.get("/requests/{request_id}", response_model=DataRequestResponse)
def get_data_request(
    request_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.scalar(
        select(DataRequest).where(
            DataRequest.id == request_id,
            DataRequest.user_id == user.id,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )
    return _request_response(row)


# ---------------------------------------------------------------- staff queue


@router.get("/admin/requests", response_model=list[DataRequestResponse])
def list_all_requests(
    _: User = Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """The staff queue, soonest deadline first.

    Ordering by `due_at` rather than `received_at` is the point of the view: the
    requests nearest to breaching the DPDP Rules 2025 90-day deadline are the ones
    that need attention today, and they are not the ones that arrived most
    recently.
    """
    rows = db.scalars(
        select(DataRequest).order_by(DataRequest.due_at.asc(), DataRequest.id.asc())
    ).all()
    return [_request_response(row) for row in rows]


@router.patch("/admin/requests/{request_id}", response_model=DataRequestResponse)
def update_data_request(
    request_id: int,
    payload: DataRequestUpdate,
    request: Request,
    handler: User = Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    row = db.scalar(select(DataRequest).where(DataRequest.id == request_id))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    old_status = row.status
    now = _now()

    # A terminal status cannot be reopened. Reopening would move `due_at`-based
    # reporting backwards and make the SLA history unreadable; a new request is
    # the honest way to ask again.
    if old_status in TERMINAL_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Request is already {old_status}. Raise a new request rather than "
                "reopening a closed one."
            ),
        )

    row.status = payload.status
    row.resolution = payload.resolution or row.resolution
    row.handled_by_user_id = handler.id
    if payload.status == "acknowledged" and row.acknowledged_at is None:
        row.acknowledged_at = now
    if payload.status in TERMINAL_STATUSES:
        row.completed_at = now

    audit.record(
        db,
        request=request,
        action="update_data_request",
        entity_type="data_request",
        entity_id=row.id,
        actor=handler,
        old_value={"status": old_status},
        new_value={"status": row.status},
    )
    db.commit()
    db.refresh(row)
    return _request_response(row, now=now)
