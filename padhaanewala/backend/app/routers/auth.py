from datetime import datetime, timezone

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Role, StudentProfile, User
from app.roles import RoleName
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MobileOtpSendRequest,
    MobileOtpVerifyRequest,
    OtpChallengeResponse,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.schemas.common import StandardResponse, TokenResponse
from app.services import email_service, otp_service, session_service, sms_service
from app.utils.client_ip import client_ip
from app.utils.security import (
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

logger = logging.getLogger(__name__)


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Issue the session's refresh token as an HttpOnly cookie.

    The 30-day credential never appears in a response body, so no script in the
    origin — including an XSS payload — can read it. `Secure` is derived from
    APP_ENV rather than a separate flag so a production deployment cannot
    report development and silently ship a cookie that travels in cleartext.
    """
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=settings.APP_ENV == "production",
        samesite="strict",
        path=settings.REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH
    )


def _issue_session(
    db: Session,
    user: User,
    request: Request | None,
    response: Response,
    family: str | None = None,
) -> TokenResponse:
    """Mint a refresh-ledger row, set its cookie, return the body token.

    The access token is the only credential in the response body; the refresh
    token travels as an HttpOnly cookie. The caller commits.
    """
    role_names = ",".join(role.name for role in user.roles) or RoleName.STUDENT.value
    tokens = session_service.issue(db, user, role_names, request=request, family=family)
    _set_refresh_cookie(response, tokens["refresh"].token)
    return TokenResponse(
        access_token=tokens["access"], refresh_token=None, token_type="bearer"
    )

#: One opaque message for every way a mobile OTP or email link can fail. The
#: underlying reason is logged server-side, but a caller must not be able to
#: tell "no such account" from "wrong code" from "expired", because that
#: difference is an account-existence oracle.
_OTP_GENERIC_FAILURE = "That code is not valid. Request a new one and try again."
_OTP_GENERIC_SEND = "If that mobile is registered, an OTP is on its way."


def _user_display_name(db: Session, user: User) -> str:
    """Best-effort first name for email salutation."""
    profile = db.get(StudentProfile, user.id)
    return (profile.name if profile else "") or user.email.split("@")[0]


def _dispatch_email_verification(
    db: Session, user: User, request: Request | None
) -> otp_service.IssuedSecret | None:
    """Issue and send an address-confirmation link. Never raises.

    Returns the issued secret so tests can assert on the flow, or None if it was
    suppressed (already verified) or the provider refused.
    """
    if user.is_email_verified:
        return None

    try:
        issued = otp_service.issue(
            db,
            purpose=otp_service.EMAIL_VERIFICATION,
            identifier=user.email,
            user_id=user.id,
            request_ip=client_ip(request),
        )
    except otp_service.OtpRateLimited:
        # Registering again quickly is legitimate; the previous link still works
        # until it expires, so there is nothing useful to tell the caller.
        return None

    subject, text, html = email_service.build_verification_email(
        user.email, _user_display_name(db, user), issued.secret
    )
    try:
        email_service.send_email(user.email, subject, text, html)
    except email_service.EmailDeliveryError:
        # Burn the link rather than leaving a record that claims delivery.
        issued.record.is_used = True
        issued.record.consumed_at = datetime.now(timezone.utc)
        db.commit()
        return None
    return issued


def _dispatch_mobile_verification(
    db: Session, user: User, request: Request | None
) -> otp_service.IssuedSecret | None:
    """Issue and send the mobile OTP. Never raises. Returns None if suppressed."""
    if user.is_mobile_verified:
        return None

    try:
        issued = otp_service.issue(
            db,
            purpose=otp_service.MOBILE_VERIFICATION,
            identifier=user.mobile,
            user_id=user.id,
            request_ip=client_ip(request),
        )
    except otp_service.OtpRateLimited:
        return None

    try:
        sms_service.send_otp(user.mobile, issued.secret)
    except sms_service.SmsDeliveryError:
        issued.record.is_used = True
        issued.record.consumed_at = datetime.now(timezone.utc)
        db.commit()
        return None
    return issued




@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(User).where((User.email == payload.email) | (User.mobile == payload.mobile))
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or mobile already registered",
        )

    user = User(
        email=payload.email,
        mobile=payload.mobile,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_email_verified=False,
        is_mobile_verified=False,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or mobile already registered",
        )

    role = db.scalar(select(Role).where(Role.name == RoleName.STUDENT.value))
    # R2.4 — fail closed. Previously this was `if role is not None`, which
    # silently created a user with zero roles and still returned 201 when
    # seed_roles.py had not run. A roleless account is a broken account.
    if role is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration is unavailable: the student role is not provisioned",
        )
    user.roles.append(role)

    profile = StudentProfile(user_id=user.id, name=payload.name)
    db.add(profile)
    db.commit()
    db.refresh(user)

    # Phase 3: issue the address-confirmation link and a mobile OTP. Both are
    # best-effort — a provider outage must not turn a successful registration
    # into a 500, and the user can always ask for a resend afterwards.
    _dispatch_email_verification(db, user, request=None)
    _dispatch_mobile_verification(db, user, request=None)

    # NOTE: this still returns tokens even when EMAIL_VERIFICATION_REQUIRED is
    # on, because `register` predates Phase 3 and its 201+TokenResponse contract
    # is depended on by the existing suite and client. The gate is applied at
    # `login`. If the intent is that unverified accounts hold no usable session
    # at all, `register` must also withhold tokens — that is a breaking change
    # and a deliberate decision, not something to slip in here.
    body = _issue_session(db, user, request=None, response=response)
    db.commit()
    return body



def _email_not_verified(user: User) -> HTTPException:
    """The 403 raised when a confirmed address is required and missing.

    Shared by the password and OTP login paths so the two cannot drift — the
    frontend's `isEmailNotVerified` guard keys off `code`, and it would quietly
    stop offering "resend the email" on one path if the shape diverged.

    403 rather than 401 on purpose: the credentials were right, and saying so is
    what lets the client offer a resend instead of making the user retype a
    password they already entered correctly.
    """
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "email_not_verified",
            "message": "Confirm your email address before signing in.",
            "email": user.email,
            "resend_endpoint": "/api/v1/auth/verify-email/resend",
        },
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    # Phase 3 gate. Deliberately placed *after* the password check so an
    # unverified address cannot be used to probe for valid credentials, and
    # before `last_login_at` is touched so a blocked attempt is not recorded as
    # a successful sign-in.
    if settings.EMAIL_VERIFICATION_REQUIRED and not user.is_email_verified:
        raise _email_not_verified(user)

    user.last_login_at = datetime.now(timezone.utc)
    body = _issue_session(db, user, request, response)
    db.commit()

    return body



@router.post("/refresh", response_model=TokenResponse)
def refresh(
    payload: RefreshRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    # R3.7 — SameSite=strict is the primary CSRF defence on the cookie path;
    # refusing a cross-origin `Origin` outright is the independent backup, so
    # relaxing the cookie flag later cannot silently re-open the session to a
    # forced cross-site POST.
    origin = request.headers.get("origin")
    if origin and origin not in settings.cors_origin_list:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-origin refresh is not allowed",
        )

    # The body token wins over the ambient cookie: a client presenting token A
    # while a stale cookie for token B is attached has asked for A and must get
    # A rotated, not B.
    presented = payload.refresh_token or request.cookies.get(
        settings.REFRESH_COOKIE_NAME
    )
    if not presented:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    try:
        claims = decode_token(presented, settings.JWT_REFRESH_SECRET_KEY)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if claims.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    try:
        user_id = int(claims.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    record = session_service.find_by_jti(db, claims.get("jti"))
    # A token with a valid signature but no ledger row is evidence of a token
    # minted before the ledger existed, or a forgery under a leaked key. Both
    # get the same opaque 401.
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Reuse detection first. A rotation-consumed token presented again means it
    # was copied, so the whole family dies before the 401 — the attacker keeps
    # nothing usable and the victim is forced to re-authenticate.
    if record.used_at is not None:
        session_service.revoke_family(
            db, record.user_id, record.family, "detected reuse"
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if not session_service.is_live(record):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    role_names = ",".join(role.name for role in user.roles) or RoleName.STUDENT.value
    tokens = session_service.rotate(db, record, user, role_names, request)
    _set_refresh_cookie(response, tokens["refresh"].token)
    db.commit()
    return TokenResponse(
        access_token=tokens["access"], refresh_token=None, token_type="bearer"
    )


@router.post("/logout", response_model=StandardResponse)
def logout(
    payload: LogoutRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """End the presented session: revoke its whole rotation family.

    Always 200 with a uniform body, whether the token did not exist, was already
    revoked, or had a whole live family to kill — an endpoint that answers
    differently for "real token" and "garbage token" hands out a session oracle
    to anyone probing with stolen strings.
    """
    presented = payload.refresh_token or request.cookies.get(
        settings.REFRESH_COOKIE_NAME
    )
    revoked = 0
    if presented:
        try:
            claims = decode_token(presented, settings.JWT_REFRESH_SECRET_KEY)
        except Exception:
            claims = {}
        if claims.get("type") == "refresh":
            record = session_service.find_by_jti(db, claims.get("jti"))
            if record is not None:
                revoked = session_service.revoke_family(
                    db, record.user_id, record.family, "logout"
                )
                db.commit()

    _clear_refresh_cookie(response)
    return StandardResponse(
        success=True,
        message="Logged out successfully",
        data={
            "revoked_tokens": revoked,
            "received_refresh_token": bool(presented),
        },
    )


# =========================================================== Phase 3: OTP/email
# Enumeration discipline for this whole block: any endpoint that takes a
# user-supplied email or mobile returns the *same* status and body whether or not
# it matched an account. The only endpoint permitted to differ is
# `login/otp/verify`, which is already authenticated by possession of a code
# that was only ever sent to the number in question.


@router.post("/verify-email", response_model=StandardResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    try:
        record = otp_service.verify_link_token(
            db, purpose=otp_service.EMAIL_VERIFICATION, token=payload.token
        )
    except otp_service.OtpError:
        # A single opaque 400 for absent/expired/already-used/wrong, so the link
        # cannot be used to learn whether an address is registered.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That confirmation link is invalid or has expired. Request a new one.",
        )

    user = db.get(User, record.user_id) if record.user_id else None
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That confirmation link is invalid or has expired. Request a new one.",
        )

    user.is_email_verified = True
    db.commit()

    return StandardResponse(
        success=True,
        message="Email address confirmed. You can sign in now.",
        data={"email": user.email, "is_email_verified": True},
    )


@router.post("/verify-email/resend", response_model=StandardResponse)
def resend_verification(
    payload: ResendVerificationRequest, request: Request, db: Session = Depends(get_db)
):
    # Always 202 with an identical body. Whether an account exists is never
    # disclosed — otherwise this becomes a free email-enumeration oracle.
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is not None and not user.is_email_verified and user.is_active:
        _dispatch_email_verification(db, user, request)

    return StandardResponse(
        success=True,
        message="If that address needs confirming, a new link is on its way.",
        data={},
    )


@router.post("/login/otp/send", response_model=OtpChallengeResponse)
def send_login_otp(
    payload: MobileOtpSendRequest, request: Request, db: Session = Depends(get_db)
):
    """Start an OTP login. Every outcome returns the identical body.

    This endpoint is unauthenticated, so *any* difference in status code,
    message or `expires_in_seconds` is an oracle. Three things used to leak here
    and no longer do:

    * an unverified address used to answer with a distinct "confirm your email"
      message, which told a prober the number was registered *and* unconfirmed;
    * an unknown number used to answer 200 while a rate-limited registered number
      answered 429 — over four probes that separates "registered" from "not",
      because OTP records only ever exist for numbers that are registered;
    * the email gate itself is no longer expressed here at all.

    The email gate moved to `verify_login_otp`, where a caller must already hold a
    code that was delivered to the real handset. Probing is therefore impossible:
    the attacker never receives the code and never reaches the branch.
    """
    generic = OtpChallengeResponse(
        message=_OTP_GENERIC_SEND,
        expires_in_seconds=settings.SMS_OTP_TTL_SECONDS,
    )

    user = db.scalar(select(User).where(User.mobile == payload.mobile))
    if user is None or not user.is_active:
        # The (small) timing difference is accepted here rather than solved with a
        # decoy SMS send, which would cost money on every probe and could
        # rate-limit a real user.
        return generic

    try:
        issued = otp_service.issue(
            db,
            purpose=otp_service.LOGIN,
            identifier=user.mobile,
            user_id=user.id,
            request_ip=client_ip(request),
        )
    except otp_service.OtpRateLimited:
        # Suppressed rather than reported as 429, because a 429 here is only
        # reachable for an identifier that already has records — i.e. one that is
        # registered. The honest cost is a rate-limited user being told a code is
        # on its way when none was; the cap is 3 per 10 minutes per number, and
        # the alternative is handing out a registration oracle.
        logger.warning("OTP login send suppressed: rate limit for user_id=%s", user.id)
        return generic

    try:
        sms_service.send_otp(user.mobile, issued.secret)
    except sms_service.SmsDeliveryError:
        # Burn the code so a record never claims a delivery that failed.
        issued.record.is_used = True
        issued.record.consumed_at = datetime.now(timezone.utc)
        db.commit()
        # Not surfaced as 502: a provider rejection (bad DLT template, unapproved
        # sender id) would then answer 502 for registered numbers and 200 for
        # everyone else, which is the same oracle by another route. Logged at
        # ERROR so a real outage is still visible to monitoring.
        logger.error("OTP login send failed for user_id=%s", user.id, exc_info=True)
        return generic

    if settings.EMAIL_VERIFICATION_REQUIRED and not user.is_email_verified:
        # The code is sent anyway and the gate is applied at verify, so the owner
        # is not left waiting on a message that will never come. Re-issue the
        # confirmation link as well: this request is the most likely moment for a
        # real user to need it, and it goes to the account owner, not the caller.
        _dispatch_email_verification(db, user, request)

    return generic


@router.post("/login/otp/verify", response_model=TokenResponse)
def verify_login_otp(
    payload: MobileOtpVerifyRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.mobile == payload.mobile))
    # Same 401 whether the number is unknown or the code is wrong: the caller
    # cannot use the endpoint to test which mobiles are registered.
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail=_OTP_GENERIC_FAILURE
    )

    if user is None or not user.is_active:
        raise invalid

    try:
        otp_service.verify(
            db,
            purpose=otp_service.LOGIN,
            identifier=user.mobile,
            secret=payload.otp,
        )
    except otp_service.OtpRateLimited:
        raise invalid
    except otp_service.OtpError as exc:
        # The distinct reason is kept in the server log; the client gets the
        # generic message so a wrong code is indistinguishable from an expired
        # one, which is what stops an attacker from learning "5 tries left".
        logger.info("login OTP rejected for user_id=%s: %s", user.id, exc)
        raise invalid from exc

    # Possession of a code sent to this mobile is proof of control, so this is
    # the natural moment to settle the flag rather than asking for it twice.
    if not user.is_mobile_verified:
        user.is_mobile_verified = True
    user.last_login_at = datetime.now(timezone.utc)
    body = _issue_session(db, user, request, response)
    db.commit()

    # The email gate belongs here, not on `send`. Reaching this line requires a
    # valid code that was delivered to this mobile, so the 403 cannot be used to
    # probe for registrations — a prober never gets the code. Applying it on
    # `send` instead (where it used to live) both leaked existence and was
    # trivially bypassed by calling this endpoint directly, because nothing here
    # checked the flag at all.
    if settings.EMAIL_VERIFICATION_REQUIRED and not user.is_email_verified:
        raise _email_not_verified(user)

    return body


@router.post("/verify-mobile/send", response_model=OtpChallengeResponse)
def send_mobile_otp(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.is_mobile_verified:
        return OtpChallengeResponse(
            message="Your mobile number is already verified.",
            expires_in_seconds=settings.SMS_OTP_TTL_SECONDS,
        )

    try:
        issued = otp_service.issue(
            db,
            purpose=otp_service.MOBILE_VERIFICATION,
            identifier=user.mobile,
            user_id=user.id,
            request_ip=client_ip(request),
        )
    except otp_service.OtpRateLimited as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc))

    try:
        sms_service.send_otp(user.mobile, issued.secret)
    except sms_service.SmsDeliveryError:
        issued.record.is_used = True
        issued.record.consumed_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We could not send the OTP right now. Please try again shortly.",
        )

    return OtpChallengeResponse(
        message=f"An OTP has been sent to your registered mobile ending {user.mobile[-4:]}.",
        expires_in_seconds=settings.SMS_OTP_TTL_SECONDS,
    )


@router.post("/verify-mobile/verify", response_model=StandardResponse)
def verify_mobile(
    payload: MobileOtpVerifyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # The code is looked up against the *authenticated* user's mobile, never the
    # submitted one, so this cannot be used to verify an arbitrary number.
    if payload.mobile != user.mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That mobile number does not match your account.",
        )

    try:
        otp_service.verify(
            db,
            purpose=otp_service.MOBILE_VERIFICATION,
            identifier=user.mobile,
            secret=payload.otp,
        )
    except otp_service.OtpError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc)) from exc

    user.is_mobile_verified = True
    db.commit()

    return StandardResponse(
        success=True,
        message="Mobile number verified.",
        data={"mobile": user.mobile, "is_mobile_verified": True},
    )


@router.post("/forgot-password", response_model=StandardResponse)
def forgot_password(
    payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)
):
    # Uniform response, always. No 404 for an unknown address, no 429 when
    # rate limited — this endpoint is the most attractive one to probe, so it
    # gives nothing away at all.
    user = db.scalar(select(User).where(User.email == payload.email))

    if user is not None and user.is_active:
        try:
            issued = otp_service.issue(
                db,
                purpose=otp_service.PASSWORD_RESET,
                identifier=user.email,
                user_id=user.id,
                request_ip=client_ip(request),
                ttl_seconds=settings.EMAIL_PASSWORD_RESET_TOKEN_TTL_MINUTES * 60,
            )
        except otp_service.OtpRateLimited:
            issued = None

        if issued is not None:
            subject, text, html = email_service.build_password_reset_email(
                user.email, _user_display_name(db, user), issued.secret
            )
            try:
                email_service.send_email(user.email, subject, text, html)
            except email_service.EmailDeliveryError:
                issued.record.is_used = True
                issued.record.consumed_at = datetime.now(timezone.utc)
                db.commit()

    return StandardResponse(
        success=True,
        message="If an account exists for that address, a reset link is on its way.",
        data={},
    )


@router.post("/reset-password", response_model=StandardResponse)
def reset_password(
    payload: ResetPasswordRequest, db: Session = Depends(get_db)
):
    try:
        record = otp_service.verify_link_token(
            db, purpose=otp_service.PASSWORD_RESET, token=payload.token
        )
    except otp_service.OtpError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That reset link is invalid or has expired. Request a new one.",
        ) from exc

    user = db.get(User, record.user_id) if record.user_id else None
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That reset link is invalid or has expired. Request a new one.",
        )

    user.password_hash = hash_password(payload.new_password)
    # A password reset happens because the owner believes somebody else has
    # access; every existing session dies with it (R3.6).
    session_service.revoke_all_sessions(db, user.id, reason="password_reset")
    db.commit()

    return StandardResponse(
        success=True,
        message="Your password has been changed. You can sign in now.",
        data={},
    )