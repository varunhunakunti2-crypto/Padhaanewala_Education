from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Role, User
from app.roles import CONTENT_ROLES
from app.utils.security import decode_token

bearer_scheme = HTTPBearer(auto_error=True)
bearer_scheme_optional = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    # `InvalidTokenError` is PyJWT's base class for every token failure, the
    # direct counterpart to python-jose's `JWTError`. It replaced `JWTError` in
    # Phase 7.2, when python-jose was dropped to remove the unpatchable
    # `ecdsa` advisory — see app/utils/security.py. The ordering matters:
    # `ExpiredSignatureError` subclasses it, so it has to be caught first or
    # every expired token would be reported as "Invalid token".
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def get_current_user_roles(user: User) -> set[str]:
    return {role.name for role in user.roles}


def can_view_inactive(user: User | None) -> bool:
    """Whether ``user`` may ask a public list endpoint for unpublished rows.

    The ``include_inactive`` query parameter exists so the admin console can see
    deactivated content. Without a gate it would hand draft colleges, courses,
    exams, scholarships, banners and FAQs to anonymous callers, since these list
    routes are public by design. Every one of them therefore has to answer this
    question the same way, which is why it lives here rather than being
    open-coded per router.

    It was open-coded five times before (``colleges.py``, twice in ``banners.py``,
    twice in ``faqs.py``) as ``set(CONTENT_ROLES) & {role.name for role in
    user.roles}``. Five copies of an authorization predicate is five chances to
    widen it by accident, and the failure mode is publishing draft content.

    Anonymous is ``False`` rather than an error: the caller decides whether to
    403 or to ignore the flag, and the flagless public read must keep working.
    """
    if user is None:
        return False
    return bool(set(CONTENT_ROLES) & get_current_user_roles(user))


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme_optional),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def require_role(*allowed_roles: str):
    # Fail closed (R4.1). An empty allowlist is always a programming error, never
    # "allow everyone". Raising here turns a silent authorization bypass into an
    # import-time crash, which no reviewer can miss.
    if not allowed_roles:
        raise RuntimeError("require_role() called with no roles")

    allowed = frozenset(allowed_roles)

    def checker(user: User = Depends(get_current_user)) -> User:
        if allowed & get_current_user_roles(user):
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    return checker


def require_processing_consent(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Refuse the write unless DPDP processing of this user's data is permitted.

    Phase 9.1. Drop this on any endpoint that *writes* personal data — a profile
    update, a saved college, an enquiry tied to the account. Read endpoints are
    deliberately not gated: the right to access your own data (s.8(5)) has to
    survive the withdrawal of consent, because the way a subject finds out what is
    held about them is by asking for it.

    403 rather than 401, with a machine-readable `code`. The distinction matters
    to the client: 401 would send it round the refresh loop, while a `code` of
    `parental_consent_required` is what tells the age gate to open. It is the same
    shape as the `email_not_verified` 403 that Phase 3 introduced, and for the
    same reason.
    """
    # Imported here rather than at module scope: `compliance_service` imports the
    # models and `app.roles`, and this module is imported by those models'
    # consumers. A top-level import would close a cycle through `get_db`.
    from app.services.compliance_service import decide_processing

    decision = decide_processing(db, user)
    if not decision.allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": decision.code,
                "message": decision.message,
                "status_endpoint": "/api/v1/compliance/status",
            },
        )
    return user