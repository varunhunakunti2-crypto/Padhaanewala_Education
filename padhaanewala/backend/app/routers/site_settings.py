from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import SiteSetting, User
from app.roles import ADMIN_ROLES
from app.schemas.settings import SiteSettingsResponse, SiteSettingsUpdate
from app.utils import audit

# The module and this router's prefix are deliberately 1:1 with `adminApi.settings`
# in `frontend/lib/api.ts`, which is asserted by
# `frontend/tests/api-endpoints.test.ts`. The file is named `site_settings.py`
# rather than `settings.py` because `app/main.py` already binds the name
# `settings` to `app.config.Settings`; importing a router of the same name would
# shadow it and break `settings.allowed_host_list` at import time.
router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

#: The single row every read and write addresses. See `SiteSetting` for why it
#: is pinned rather than merely conventional.
_SINGLETON_ID = 1


def _load(db: Session) -> SiteSetting:
    row = db.get(SiteSetting, _SINGLETON_ID)
    if row is None:
        # Safety net, not the normal path: the migration seeds this row, so in a
        # migrated database this branch never runs. It exists for a database
        # built with `Base.metadata.create_all` (a scratch schema or a test
        # fixture), where the defaults still have to come from somewhere.
        row = SiteSetting(id=_SINGLETON_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get(
    "",
    response_model=SiteSettingsResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def read_site_settings(db: Session = Depends(get_db)) -> SiteSetting:
    """The stored configuration, for the console to seed its form with."""
    return _load(db)


@router.put("", response_model=SiteSettingsResponse)
def update_site_settings(
    payload: SiteSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*ADMIN_ROLES)),
) -> SiteSetting:
    """Apply the changed fields and return the whole row.

    ``PUT`` with ``exclude_unset`` semantics, matching ``update_banner``: a field
    the panel did not send is left alone, so a one-field save cannot blank the
    rest. The old values are read *before* the ``setattr`` loop so the audit row
    records the edit and not its result.
    """
    row = _load(db)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        # Nothing to write, so nothing to audit. Returning the row unchanged
        # keeps the contract "the response is the saved state" true.
        return row

    audit.record(
        db,
        request=request,
        action="update_site_settings",
        entity_type="site_settings",
        entity_id=row.id,
        actor=user,
        old_value={field: getattr(row, field) for field in changes},
        new_value=changes,
    )
    for field, value in changes.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row
