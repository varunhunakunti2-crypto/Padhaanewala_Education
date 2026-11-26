"""H-07 regression tests: signing-key entropy, independence and rotation.

No secret value is hardcoded here. Keys used by these tests are generated at
runtime with a CSPRNG and are never printed. The only fingerprints in source are
one-way SHA-256 digests of development keys, defined in ``app.config``.
"""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient

from app import config
from app.config import Settings, settings
from app.main import app
from app.utils.security import (
    ALGORITHM,
    decode_access_token,
    decode_refresh_token,
    generate_signing_key,
)

client = TestClient(app)

PASSWORD = "SecurePass123!"
_BACKEND_DIR = Path(__file__).resolve().parents[1]


def _strong_pair():
    return generate_signing_key(), generate_signing_key()


def _dev_key_fingerprints_from_workspace():
    """Read ignored local env material without ever emitting its values."""
    path = _BACKEND_DIR / ".env.development"
    if not path.exists():
        return set()
    found = set()
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith(("JWT_SECRET_KEY=", "JWT_REFRESH_SECRET_KEY=", "SECRET_KEY=")):
            value = line.split("=", 1)[1].strip()
            found.add(hashlib.sha256(value.encode("utf-8")).hexdigest())
    return found


# --------------------------------------------------------------- config guards


@pytest.mark.parametrize(
    "access,refresh,reason",
    [
        ("change-me", "another-change-me", "placeholder"),
        ("short", "another-sufficiently-long-key-value-123", "short"),
        ("a" * 64, "b" * 64, "low variety"),
        ("c" * 64, "c" * 64, "shared"),
    ],
)
def test_deployed_environments_reject_unsafe_keys(access, refresh, reason):
    with pytest.raises(ValueError):
        Settings(APP_ENV="staging", JWT_SECRET_KEY=access, JWT_REFRESH_SECRET_KEY=refresh)


def test_known_development_fingerprints_are_denied(monkeypatch):
    key = "f" * 64
    fingerprint = hashlib.sha256(key.encode("utf-8")).hexdigest()
    monkeypatch.setattr(config, "_KNOWN_DEV_KEY_FINGERPRINTS", frozenset({fingerprint}))
    other = generate_signing_key()
    with pytest.raises(ValueError):
        Settings(APP_ENV="production", JWT_SECRET_KEY=key, JWT_REFRESH_SECRET_KEY=other)


def test_workspace_dev_keys_are_covered_by_denylist():
    fingerprints = _dev_key_fingerprints_from_workspace()
    if not fingerprints:
        pytest.skip("local .env.development is absent (expected in CI)")
    assert fingerprints.issubset(config._KNOWN_DEV_KEY_FINGERPRINTS)


def test_rotation_slots_must_not_reuse_another_slot():
    access, refresh = _strong_pair()
    with pytest.raises(ValueError):
        Settings(
            APP_ENV="staging",
            JWT_SECRET_KEY=access,
            JWT_REFRESH_SECRET_KEY=refresh,
            JWT_PREVIOUS_SECRET_KEY=refresh,
        )


def test_development_env_remains_permissive_for_local_work():
    # Local checkout must still boot with the template placeholder values.
    cfg = Settings(APP_ENV="development", JWT_SECRET_KEY="change-me", JWT_REFRESH_SECRET_KEY="change-me")
    assert cfg.JWT_SECRET_KEY == "change-me"


def test_generated_keys_are_independent_and_strong():
    keys = [generate_signing_key() for _ in range(4)]
    assert len(set(keys)) == 4
    for key in keys:
        assert len(key) == 64
        assert int(key, 16) >= 0
        assert len(set(key)) >= config._MIN_KEY_CHAR_VARIETY


# --------------------------------------------------------------- token behaviour


def test_expired_token_is_rejected_by_both_decoders():
    now = datetime.now(UTC)
    claims = {
        "sub": "1",
        "type": "access",
        "iat": now - timedelta(minutes=10),
        "exp": now - timedelta(minutes=5),
    }
    token = jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token)

    claims["type"] = "refresh"
    token = jwt.encode(claims, settings.JWT_REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_refresh_token(token)


def test_invalid_signature_and_cross_type_tokens_are_rejected(monkeypatch):
    current = generate_signing_key()
    foreign = generate_signing_key()
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", current)
    monkeypatch.setattr(settings, "JWT_PREVIOUS_SECRET_KEY", "")
    claims = {"sub": "1", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)}
    assert decode_access_token(jwt.encode(claims, current, algorithm=ALGORITHM))["sub"] == "1"
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(jwt.encode(claims, foreign, algorithm=ALGORITHM))

    claims["type"] = "refresh"
    refresh = jwt.encode(claims, settings.JWT_REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(refresh)


def test_retired_key_verifies_during_grace_and_is_rejected_after(monkeypatch):
    retired = generate_signing_key()
    current = generate_signing_key()
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", current)
    monkeypatch.setattr(settings, "JWT_PREVIOUS_SECRET_KEY", retired)

    claims = {"sub": "1", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)}
    old_token = jwt.encode(claims, retired, algorithm=ALGORITHM)
    assert decode_access_token(old_token)["sub"] == "1"

    # A retired key cannot mint a token that verifies under the current key.
    monkeypatch.setattr(settings, "JWT_PREVIOUS_SECRET_KEY", "")
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(old_token)


def test_unrelated_old_key_is_rejected_even_while_a_grace_slot_exists(monkeypatch):
    retired = generate_signing_key()
    current = generate_signing_key()
    unrelated_old = generate_signing_key()
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", current)
    monkeypatch.setattr(settings, "JWT_PREVIOUS_SECRET_KEY", retired)
    claims = {"sub": "1", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)}
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(jwt.encode(claims, unrelated_old, algorithm=ALGORITHM))


# --------------------------------------------------------------- API flows


def _register():
    payload = {
        "name": "H07 Student",
        "email": f"h07.{uuid.uuid4().hex[:10]}@example.com",
        "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
        "password": PASSWORD,
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return payload


def _login(payload):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert response.status_code == 200, response.text
    return response.json(), client.cookies.get(settings.REFRESH_COOKIE_NAME)


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_login_access_protected_route_logout_refresh_and_reuse_detection():
    user = _register()
    login, refresh_cookie = _login(user)
    access = login["access_token"]
    assert refresh_cookie

    assert client.get("/api/v1/users/me", headers=_bearer(access)).status_code == 200

    # Expired and invalid-signature access tokens get an opaque 401.
    now = datetime.now(UTC)
    expired = jwt.encode(
        {"sub": "1", "type": "access", "exp": now - timedelta(minutes=1)},
        settings.JWT_SECRET_KEY,
        algorithm=ALGORITHM,
    )
    forged = jwt.encode(
        {"sub": "1", "type": "access", "exp": now + timedelta(minutes=5)},
        generate_signing_key(),
        algorithm=ALGORITHM,
    )
    assert client.get("/api/v1/users/me", headers=_bearer(expired)).status_code == 401
    assert client.get("/api/v1/users/me", headers=_bearer(forged)).status_code == 401

    # Refresh rotates the presented token and issues a fresh access token.
    first = client.post("/api/v1/auth/refresh", json={})
    assert first.status_code == 200, first.text
    rotated_cookie = client.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert rotated_cookie and rotated_cookie != refresh_cookie
    rotated_access = first.json()["access_token"]
    assert client.get("/api/v1/users/me", headers=_bearer(rotated_access)).status_code == 200

    # Reusing the consumed token revokes the whole family and returns 401.
    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_cookie})
    assert replay.status_code == 401
    after_reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": rotated_cookie})
    assert after_reuse.status_code == 401

    # Logout on a fresh login is uniform and clears the cookie family.
    _login(user)
    response = client.post("/api/v1/auth/logout", json={})
    assert response.status_code == 200
    assert response.json()["data"]["revoked_tokens"] >= 1


def test_refresh_token_signed_with_retired_key_rotates_during_grace(monkeypatch):
    user = _register()
    _, refresh_cookie = _login(user)
    assert refresh_cookie

    retired_refresh = settings.JWT_REFRESH_SECRET_KEY
    new_refresh = generate_signing_key()
    monkeypatch.setattr(settings, "JWT_REFRESH_SECRET_KEY", new_refresh)
    monkeypatch.setattr(settings, "JWT_PREVIOUS_REFRESH_SECRET_KEY", retired_refresh)

    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_cookie})
    assert rotated.status_code == 200, rotated.text
    new_cookie = client.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert new_cookie
    assert decode_refresh_token(new_cookie)["type"] == "refresh"

    # Closing the grace window rejects the retired token, even if it was valid.
    monkeypatch.setattr(settings, "JWT_PREVIOUS_REFRESH_SECRET_KEY", "")
    with pytest.raises(jwt.InvalidTokenError):
        decode_refresh_token(refresh_cookie)


def test_deployed_config_accepts_independently_generated_keys():
    # Staging is a deployed environment and exercises the H-07 guard without
    # dragging in unrelated production-only provider guards (which the suite's
    # global conftest deliberately disables). No value is echoed on failure.
    key = generate_signing_key()
    other = generate_signing_key()
    try:
        cfg = Settings(
            _env_file=None,
            APP_ENV="staging",
            JWT_SECRET_KEY=key,
            JWT_REFRESH_SECRET_KEY=other,
        )
    except Exception:
        pytest.fail("deployed configuration rejected generated keys")
    assert cfg.jwt_access_keys[0] == key
    assert cfg.jwt_refresh_keys[0] == other
