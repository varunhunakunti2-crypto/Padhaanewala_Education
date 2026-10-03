from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import Counsellor
from app.roles import ADMIN_ROLES
from app.schemas.engagement import CounsellorListItem
from app.services.lead_handoff import counsellor_loads

router = APIRouter(prefix="/api/v1/counsellors", tags=["counsellors"])


@router.get("", response_model=list[CounsellorListItem])
def list_counsellors(
    include_inactive: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: object = Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> list[CounsellorListItem]:
    """Active counsellors with their current workload.

    This is the roster the lead assign dropdown reads. It is admin-only, not
    counsellor-only, on purpose: a counsellor has no business browsing the
    team, and `PATCH /leads/{id}/assign` — which is what actually hands work
    over — is already admin-only, so the roster needs no wider access than the
    action it enables.

    `active_leads` counts enquiries still in play (anything not won/lost/closed)
    against the same rule `services.lead_handoff` balances on, so what the admin
    sees here is exactly what the round-robin balancer sees.
    """
    query = select(Counsellor).order_by(Counsellor.name)
    if not include_inactive:
        query = query.where(Counsellor.is_active.is_(True))

    counsellors = db.scalars(query.limit(limit).offset(offset)).all()
    loads = counsellor_loads(db)
    return [
        CounsellorListItem(
            id=c.id,
            name=c.name,
            specialization=c.specialization,
            max_leads=c.max_leads,
            is_active=c.is_active,
            active_leads=loads.get(c.id, 0),
        )
        for c in counsellors
    ]
