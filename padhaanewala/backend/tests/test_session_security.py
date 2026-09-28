"""Session security: rotation, reuse detection, logout revocation, cookie flags.

Every test here corresponds to a behaviour that was verified broken by driving
the running application on 28 September 2026 and reading the HTTP responses,
while the then-existing 225-test suite passed throughout. BUG-01, in full:

    refresh #1            200
    REUSE old token       200   <- a replayed refresh token is accepted
    logout                200   {"success":true,...}
    refresh post-logout   200   <- a new token pair is still minted
    access post-logout    200   <- the access token is still accepted

The suite passed because it never logged out. The tests below are the ones that
would have caught it, and they are deliberately written against the *HTTP
surface* rather than against handler internals, because the original failure was
in the space between the endpoints.

Cookie handling: these tests use a per-test `TestClient` with an isolated cookie
jar, since a module-level client would share one jar across every test and let a
cookie from one test authenticate a request in another.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models import RefreshToken, User

COOKIE = settings.REFRESH_COOKIE_NAME


def _unique_email(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


@pytest.fixture
def client():
    """A client with its own cookie jar, closed after the test."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def account(client):
    """Register a fresh account and return its credentials plus client state."""
    payload = {
        "name": "Session Test",
        "email": _unique_email("session"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return {**payload, "body": response.json(), "client": client}


def _login(client, email: str, password: str = "SecurePass123!"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


def _cookie_value(client, name: str = COOKIE) -> str | None:
    return client.cookies.get(name)


@pytest.fixture
def thief():
    """A client with no cookie jar — i.e. somebody holding only a stolen token.

    A replay test that reuses the victim's client cannot work: after a rotation
    the jar holds the *new*, valid token, and the cookie is preferred over the
    body, so the "replay" would silently refresh the legitimate session and
    return 200 for the wrong reason. The attacker presents a token with no
    cookie, which is what a stolen token actually looks like on the wire.
    """
    with TestClient(app) as c:
        c.cookies.clear()
        yield c


def _rows_for(email: str) -> list[RefreshToken]:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        return (
            db.query(RefreshToken)
            .filter(RefreshToken.user_id == user.id)
            .order_by(RefreshToken.id)
            .all()
        )


# --------------------------------------------------------------------------- #
# 3.2 — the refresh token is delivered as an HttpOnly cookie, not in the body
# --------------------------------------------------------------------------- #


def test_refresh_token_is_not_in_the_response_body(account):
    """A response body is readable by any script in the origin.

    Returning the 30-day credential here would hand an XSS payload the same thing
    the cookie is meant to withhold, so the default configuration omits it.
    """
    body = account["body"]
    assert body["access_token"]
    assert body["refresh_token"] is None


def test_refresh_cookie_is_httponly_samesite_and_scoped(account):
    """The three flags, asserted on the wire rather than in the handler."""
    raw = account["client"].post(
        "/api/v1/auth/login",
        json={"email": account["email"], "password": account["password"]},
    ).headers.get_list("set-cookie")
    refresh_cookie = next(h for h in raw if h.startswith(f"{COOKIE}="))

    assert "HttpOnly" in refresh_cookie
    assert "SameSite=strict" in refresh_cookie.replace("SameSite=Strict", "SameSite=strict")
    assert f"Path={settings.REFRESH_COOKIE_PATH}" in refresh_cookie
    # Secure is intentionally off in development: the site is served over http
    # there, and a Secure cookie would never be sent back, which would look like
    # a broken login rather than a deliberate setting.
    assert settings.APP_ENV != "production"


def test_refresh_cookie_is_secure_in_production(account, monkeypatch):
    """`Secure` must not be conditional on something the operator forgets.

    Pinned directly because the flag is derived from APP_ENV, and a production
    deployment that somehow reports development would otherwise set a
    non-Secure cookie that travels in cleartext.
    """
    monkeypatch.setattr(settings, "APP_ENV", "production")
    raw = account["client"].post(
        "/api/v1/auth/login",
        json={"email": account["email"], "password": account["password"]},
    ).headers.get_list("set-cookie")
    refresh_cookie = next(h for h in raw if h.startswith(f"{COOKIE}="))
    assert "Secure" in refresh_cookie


def test_login_issues_exactly_one_ledger_row(account):
    _login(account["client"], account["email"])
    rows = _rows_for(account["email"])
    assert len(rows) == 2, "register + login each issue one refresh token"
    assert all(row.used_at is None and row.revoked_at is None for row in rows)
    # Each login starts its own rotation chain.
    assert len({row.family for row in rows}) == 2


# --------------------------------------------------------------------------- #
# 3.3 — rotation
# --------------------------------------------------------------------------- #


def test_refresh_rotates_the_token(account):
    """Rotation is the mechanism; without it logout has nothing to act on."""
    client = account["client"]
    before = _cookie_value(client)

    response = client.post("/api/v1/auth/refresh", json={})
    assert response.status_code == 200, response.text

    after = _cookie_value(client)
    assert after and after != before, "the presented token must be replaced"

    rows = _rows_for(account["email"])
    consumed = [r for r in rows if r.used_at is not None]
    assert len(consumed) == 1
    # The consumed row points at its successor, so a compromised lineage can be
    # walked backwards.
    assert consumed[0].rotated_to_jti == rows[-1].jti
    # Successor inherits the family, which is what makes a later reuse revokable
    # as a unit.
    assert rows[-1].family == rows[0].family


def test_previous_refresh_token_is_rejected_after_rotation(account, thief):
    """The exact replay that returned 200 under BUG-01."""
    client = account["client"]
    original = _cookie_value(client)

    assert client.post("/api/v1/auth/refresh", json={}).status_code == 200

    replay = thief.post("/api/v1/auth/refresh", json={"refresh_token": original})
    assert replay.status_code == 401, replay.text


def test_refresh_keeps_rotating_indefinitely(account):
    """A legitimate long-lived session must not lock itself out."""
    client = account["client"]
    seen = set()
    for _ in range(5):
        response = client.post("/api/v1/auth/refresh", json={})
        assert response.status_code == 200, response.text
        token = _cookie_value(client)
        assert token not in seen, "each rotation must mint a distinct token"
        seen.add(token)
    assert len(seen) == 5


# --------------------------------------------------------------------------- #
# 3.4 — reuse detection
# --------------------------------------------------------------------------- #


def test_replaying_a_rotated_token_revokes_the_whole_family(account, thief):
    """Reuse of a rotated-away token is treated as theft, not user error.

    The response to both is the same: the entire chain dies and the user must
    authenticate again. Anything softer leaves the attacker's token alive
    alongside the victim's, which is the only outcome that does not end the
    compromise.
    """
    client = account["client"]
    original = _cookie_value(client)
    assert client.post("/api/v1/auth/refresh", json={}).status_code == 200

    # The attacker replays the copy they stole, with no cookie of their own.
    assert (
        thief.post(
            "/api/v1/auth/refresh", json={"refresh_token": original}
        ).status_code
        == 401
    )

    # The victim's own legitimately-rotated token is now dead too. This is the
    # assertion that matters: a fix which only rejects the replayed token would
    # leave the intruder holding a live session.
    assert client.post("/api/v1/auth/refresh", json={}).status_code == 401

    rows = _rows_for(account["email"])
    live = [r for r in rows if r.revoked_at is None and r.used_at is None]
    assert not live, "no token in the family may survive detected reuse"


def test_reuse_detection_does_not_leak_which_tokens_are_real(account, thief):
    """Every rejection reason must be indistinguishable from the outside.

    A caller that can tell "already rotated" from "never existed" can use this
    unauthenticated endpoint as an oracle for which token strings are genuine.
    """
    client = account["client"]
    real = _cookie_value(client)
    client.post("/api/v1/auth/refresh", json={})

    known_rotated = thief.post(
        "/api/v1/auth/refresh", json={"refresh_token": real}
    )
    never_existed = thief.post(
        "/api/v1/auth/refresh", json={"refresh_token": "x" * 64}
    )

    assert known_rotated.status_code == never_existed.status_code == 401
    assert known_rotated.json() == never_existed.json()


def test_reuse_in_one_family_does_not_kill_another(account, thief):
    """A second device is a separate family and must survive a replay elsewhere."""
    client = account["client"]
    original = _cookie_value(client)

    with TestClient(app) as other:
        _login(other, account["email"])
        other_token = _cookie_value(other)

        assert client.post("/api/v1/auth/refresh", json={}).status_code == 200
        assert (
            thief.post(
                "/api/v1/auth/refresh", json={"refresh_token": original}
            ).status_code
            == 401
        )

        # The untouched device keeps working.
        assert other.post("/api/v1/auth/refresh", json={}).status_code == 200
        assert _cookie_value(other) != other_token


# --------------------------------------------------------------------------- #
# 3.5 — logout actually ends the session
# --------------------------------------------------------------------------- #


def test_logout_revokes_the_family_so_the_token_cannot_be_reused(account):
    """`refresh post-logout -> 200` was the second half of BUG-01."""
    client = account["client"]
    token = _cookie_value(client)

    response = client.post("/api/v1/auth/logout", json={})
    assert response.status_code == 200, response.text
    assert response.json()["success"] is True

    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": token})
    assert replay.status_code == 401, replay.text


def test_logout_clears_the_cookie(account):
    client = account["client"]
    assert _cookie_value(client) is not None

    client.post("/api/v1/auth/logout", json={})

    assert _cookie_value(client) is None


def test_logout_is_idempotent_and_never_leaks(account, thief):
    """A logout that can fail is a logout the user retries.

    Retrying is what would tell an attacker holding a token whether it is real.
    """
    client = account["client"]
    token = _cookie_value(client)

    first = client.post("/api/v1/auth/logout", json={})
    second = client.post("/api/v1/auth/logout", json={})
    # Same client, no cookie left, but presenting the revoked token explicitly.
    after = thief.post("/api/v1/auth/logout", json={"refresh_token": token})
    never_existed = thief.post("/api/v1/auth/logout", json={"refresh_token": "x" * 64})

    assert first.status_code == second.status_code == 200
    assert after.status_code == never_existed.status_code == 200
    assert after.json() == never_existed.json()
    # Only the first had a live family to revoke.
    assert first.json()["data"]["revoked_tokens"] >= 1
    assert second.json()["data"]["revoked_tokens"] == 0
    assert after.json()["data"]["revoked_tokens"] == 0
    assert never_existed.json()["data"]["revoked_tokens"] == 0


def test_logout_does_not_kill_a_different_family(account):
    """Signing out on the phone must not sign the user out on their laptop."""
    client = account["client"]
    with TestClient(app) as other:
        _login(other, account["email"])

        assert client.post("/api/v1/auth/logout", json={}).status_code == 200
        assert other.post("/api/v1/auth/refresh", json={}).status_code == 200


def test_presented_body_token_wins_over_an_ambient_cookie(account):
    """An explicit parameter must not be ignored in favour of ambient state.

    A client that deliberately presents token A while a stale cookie for token B
    is still attached would otherwise have B rotated and be handed a session it
    never asked for. Browsers send no body token, so this ordering is invisible
    to the browser flow.
    """
    client = account["client"]
    cookie_token = _cookie_value(client)

    # Mint a second, independent session and present its token explicitly.
    other = TestClient(app)
    try:
        _login(other, account["email"])
        other_token = _cookie_value(other)
    finally:
        other.close()

    response = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": other_token}
    )
    assert response.status_code == 200, response.text

    # Rotation mints a *successor*, so the cookie now holds a new token. What
    # identifies the bug is which row got consumed: the presented token's, and
    # not the ambient cookie's.
    from app.utils.security import decode_token

    def jti_of(token: str) -> str:
        return decode_token(token, settings.JWT_REFRESH_SECRET_KEY)["jti"]

    rows = {row.jti: row for row in _rows_for(account["email"])}
    assert rows[jti_of(other_token)].used_at is not None, "presented token was rotated"
    assert rows[jti_of(cookie_token)].used_at is None, "ambient cookie was not the credential"
    assert _cookie_value(client) not in (cookie_token, other_token)


# --------------------------------------------------------------------------- #
# Credential changes end every session
# --------------------------------------------------------------------------- #


def test_password_change_revokes_existing_sessions(account, thief):
    """A reset left to preserve sessions is only half a reset.

    The user changes a password precisely because they believe somebody else has
    access, and that somebody is holding exactly one of these tokens.
    """
    client = account["client"]
    token = _cookie_value(client)
    access = account["body"]["access_token"]

    changed = client.put(
        "/api/v1/users/me/password",
        headers={"Authorization": f"Bearer {access}"},
        json={"current_password": "SecurePass123!", "new_password": "NewPass456!"},
    )
    assert changed.status_code == 200, changed.text

    # Every family on the account is dead, including for a thief holding a copy.
    assert thief.post(
        "/api/v1/auth/refresh", json={"refresh_token": token}
    ).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={}).status_code == 401

    # The access token is stateless and survives until it expires. That is the
    # documented containment window, not a defect in this change — pinning it
    # here so that a future "fix" which shortens the TTL is not mistaken for one.
    assert (
        client.get(
            "/api/v1/users/me", headers={"Authorization": f"Bearer {access}"}
        ).status_code
        == 200
    )


# --------------------------------------------------------------------------- #
# 3.7 — CSRF: the Origin check on cookie-authenticated writes
# --------------------------------------------------------------------------- #


def test_cross_origin_refresh_is_refused(account):
    """`SameSite=strict` is the primary defence; this is the independent second.

    Pinned because a future change that relaxes SameSite, or a browser that
    weakens its default, would otherwise silently remove the only remaining
    barrier to a cross-site POST driving the user's session.
    """
    client = account["client"]
    response = client.post(
        "/api/v1/auth/refresh",
        json={},
        headers={"Origin": "https://evil.example.com"},
    )
    assert response.status_code == 403, response.text


def test_same_origin_refresh_is_allowed(account):
    client = account["client"]
    response = client.post(
        "/api/v1/auth/refresh", json={}, headers={"Origin": settings.APP_URL}
    )
    assert response.status_code == 200, response.text


def test_absent_origin_is_allowed(account):
    """A missing `Origin` is not a cross-site request.

    Native clients and server-to-server callers never send one, and the cookie
    path they use is not browser-controlled at all.
    """
    client = account["client"]
    response = client.post("/api/v1/auth/refresh", json={})
    assert response.status_code == 200, response.text


# --------------------------------------------------------------------------- #
# Ledger hygiene
# --------------------------------------------------------------------------- #


def test_revoked_rows_are_retained_for_audit(account):
    """Revocation is a flag, not a delete.

    Deleting the row would make a stolen token's status unanswerable, and would
    restore the exact failure mode this table exists to remove.
    """
    client = account["client"]
    before = len(_rows_for(account["email"]))

    client.post("/api/v1/auth/logout", json={})

    after = _rows_for(account["email"])
    assert len(after) == before
    assert any(r.revoked_at is not None for r in after)


def test_rotation_alone_never_trips_the_session_ceiling(account, monkeypatch):
    """One device refreshing forever is one session, not many.

    Rotation writes a row per refresh by design, so a client that refreshes every
    25 minutes accumulates ~1,700 rows over its 30-day life. If the ceiling
    counted rows it would revoke the user's own family and sign them out of their
    own account — the ceiling bounds *concurrent sessions*, not rotation volume.
    """
    monkeypatch.setattr(settings, "MAX_ACTIVE_REFRESH_TOKENS", 2)
    client = account["client"]

    for _ in range(8):
        assert client.post("/api/v1/auth/refresh", json={}).status_code == 200

    rows = _rows_for(account["email"])
    assert len({r.family for r in rows}) == 1
    assert all(r.revoked_at is None for r in rows)


def test_session_ceiling_revokes_the_oldest_device(account, monkeypatch):
    """An attacker accumulating stolen logins is the case the ceiling exists for.

    The newest session survives — signing in on a new device must never sign you
    out of the one you are using — and the oldest is the one that goes.
    """
    monkeypatch.setattr(settings, "MAX_ACTIVE_REFRESH_TOKENS", 2)
    devices = []
    for _ in range(4):
        device = TestClient(app)
        _login(device, account["email"])
        devices.append(device)

    try:
        first, last = devices[0], devices[-1]
        assert first.post("/api/v1/auth/refresh", json={}).status_code == 401
        assert last.post("/api/v1/auth/refresh", json={}).status_code == 200

        # A stolen copy of the evicted device is dead as well.
        stale = _cookie_value(devices[1])
        assert (
            devices[0].post(
                "/api/v1/auth/refresh", json={"refresh_token": stale}
            ).status_code
            == 401
        )
    finally:
        for device in devices:
            device.close()


def test_expired_token_is_refused(account):
    """Expiry is enforced against the ledger column, not only the JWT claim."""
    client = account["client"]
    token = _cookie_value(client)

    with SessionLocal() as db:
        row = (
            db.query(RefreshToken)
            .join(User, User.id == RefreshToken.user_id)
            .filter(User.email == account["email"], RefreshToken.used_at.is_(None))
            .order_by(RefreshToken.id.desc())
            .first()
        )
        assert row is not None
        from datetime import datetime, timedelta, timezone

        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()

    assert client.post("/api/v1/auth/refresh", json={"refresh_token": token}).status_code == 401
