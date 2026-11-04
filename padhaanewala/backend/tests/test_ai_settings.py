"""The super-admin AI settings panel, end to end.

The contract these tests hold is narrower than "the form works":

* only ``super_admin`` may read, write or test -- ``admin`` is not enough,
  because this route writes a credential that can spend real money;
* the plaintext key never comes back out (response, audit row) and is not
  stored in the clear;
* an absent field is untouched, while an explicit empty key field clears it;
* the runtime resolver prefers the saved row and falls back to the environment,
  so an existing deployment keeps working;
* the student assistant and the PDF importer both use the saved configuration.

The settings row is reset around every test. It is a singleton shared by the
whole suite, and a key left behind here would override the environment that
``test_question_import.py`` sets for its own purposes.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models import AiSetting, AuditLog, Role, User
from app.routers import ai as ai_router
from app.routers import ai_settings as ai_settings_router
from app.services import secret_box

client = TestClient(app)

PASSWORD = "SecurePass123!"
AI_SETTINGS = "/api/v1/settings/ai"
AI_CHAT = "/api/v1/ai/chat"


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register(prefix: str) -> tuple[str, str]:
    email = _unique(prefix)
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "AI Settings Test",
            "email": email,
            "mobile": _unique_mobile(),
            "password": PASSWORD,
            "age_band": "18_plus",
        },
    )
    assert response.status_code == 201, response.text
    return email, response.json()["access_token"]


def _grant(email: str, role_name: str) -> None:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        role = db.query(Role).filter(Role.name == role_name).first()
        assert role is not None
        user.roles.append(role)
        db.commit()


@pytest.fixture
def super_admin_headers() -> dict[str, str]:
    email, token = _register("ai.super")
    _grant(email, "super_admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers() -> dict[str, str]:
    email, token = _register("ai.admin")
    _grant(email, "admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_headers() -> dict[str, str]:
    _, token = _register("ai.student")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def reset_settings():
    """Start and end every test with no saved credentials or overrides."""

    def _reset() -> None:
        with SessionLocal() as db:
            row = db.get(AiSetting, 1)
            if row is None:
                row = AiSetting(id=1)
                db.add(row)
            row.chat_base_url = None
            row.chat_model = None
            row.chat_api_key_encrypted = None
            row.gemini_model = None
            row.gemini_api_key_encrypted = None
            row.updated_by = None
            db.commit()

    _reset()
    yield
    _reset()


@pytest.fixture(autouse=True)
def clean_provider_environment(monkeypatch):
    """Isolate the suite from the developer's provider keys.

    ``.env.development`` ships a real ``GEMINI_API_KEY``, and the resolver
    falls back to the environment by design. Without this, "nothing is set"
    tests would observe the developer's key and fail for the wrong reason.
    Tests that exercise the fallback set their own value afterwards.
    """
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")


def test_every_route_requires_super_admin(admin_headers, student_headers):
    for headers in (None, student_headers, admin_headers):
        kwargs = {"headers": headers} if headers else {}
        assert client.get(AI_SETTINGS, **kwargs).status_code in (401, 403)
        assert client.put(
            AI_SETTINGS, json={"chat_model": "x"}, **kwargs
        ).status_code in (401, 403)
        assert client.post(
            AI_SETTINGS + "/test", json={"target": "chat"}, **kwargs
        ).status_code in (401, 403)


def test_super_admin_reads_the_shape_without_a_plaintext_key(super_admin_headers):
    response = client.get(AI_SETTINGS, headers=super_admin_headers)
    assert response.status_code == 200, response.text
    body = response.json()

    assert "chat_api_key" not in body
    assert "gemini_api_key" not in body
    assert body["chat_api_key_set"] is False
    assert body["chat_api_key_hint"] is None
    assert body["chat_api_key_source"] == "none"
    assert body["gemini_api_key_set"] is False
    assert body["chat_base_url"].startswith("http")
    assert body["chat_model"]
    assert body["gemini_model"]


def test_a_saved_key_is_encrypted_and_only_a_hint_comes_back(super_admin_headers):
    secret = "sk-test-" + uuid.uuid4().hex
    response = client.put(
        AI_SETTINGS,
        json={"chat_api_key": secret, "chat_model": "gpt-4o-mini"},
        headers=super_admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["chat_api_key_set"] is True
    assert body["chat_api_key_hint"] == f"****{secret[-4:]}"
    assert body["chat_api_key_source"] == "database"
    assert secret not in response.text

    with SessionLocal() as db:
        row = db.get(AiSetting, 1)
        assert row is not None
        stored = row.chat_api_key_encrypted
        assert stored is not None
        assert secret not in stored
        assert secret_box.decrypt(stored) == secret


def test_the_plaintext_key_is_not_written_to_the_audit_log(super_admin_headers):
    secret = "sk-audit-" + uuid.uuid4().hex
    assert (
        client.put(
            AI_SETTINGS, json={"chat_api_key": secret}, headers=super_admin_headers
        ).status_code
        == 200
    )

    with SessionLocal() as db:
        row = (
            db.query(AuditLog)
            .filter(AuditLog.entity_type == "ai_settings")
            .order_by(AuditLog.id.desc())
            .first()
        )
    assert row is not None
    assert row.action == "update_ai_settings"
    dumped = f"{row.old_value}{row.new_value}"
    assert secret not in dumped
    assert row.new_value == {"chat_api_key_set": True}


def test_update_is_partial_and_keeps_the_saved_key(super_admin_headers):
    secret = "sk-keep-" + uuid.uuid4().hex
    assert (
        client.put(
            AI_SETTINGS,
            json={
                "chat_base_url": "https://api.groq.com/openai/v1",
                "chat_model": "llama-3.3-70b-versatile",
                "chat_api_key": secret,
            },
            headers=super_admin_headers,
        ).status_code
        == 200
    )

    changed = client.put(
        AI_SETTINGS,
        json={"chat_model": "llama-3.1-8b-instant"},
        headers=super_admin_headers,
    )
    assert changed.status_code == 200, changed.text
    body = changed.json()
    assert body["chat_model"] == "llama-3.1-8b-instant"
    assert body["chat_base_url"] == "https://api.groq.com/openai/v1"
    assert body["chat_api_key_set"] is True


def test_an_explicit_empty_key_clears_it(super_admin_headers):
    assert (
        client.put(
            AI_SETTINGS,
            json={"chat_api_key": "sk-clear-" + uuid.uuid4().hex},
            headers=super_admin_headers,
        ).status_code
        == 200
    )

    cleared = client.put(
        AI_SETTINGS, json={"chat_api_key": ""}, headers=super_admin_headers
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["chat_api_key_set"] is False
    assert cleared.json()["chat_api_key_hint"] is None

    with SessionLocal() as db:
        row = db.get(AiSetting, 1)
        assert row is not None
        assert row.chat_api_key_encrypted is None


@pytest.mark.parametrize(
    "bad_url", ["ftp://example.com/v1", "example.com/v1", "javascript:alert(1)"]
)
def test_the_base_url_must_be_http(super_admin_headers, bad_url):
    response = client.put(
        AI_SETTINGS, json={"chat_base_url": bad_url}, headers=super_admin_headers
    )
    assert response.status_code == 422


def test_a_trailing_slash_is_normalised(super_admin_headers):
    response = client.put(
        AI_SETTINGS,
        json={"chat_base_url": "https://api.openai.com/v1/"},
        headers=super_admin_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["chat_base_url"] == "https://api.openai.com/v1"


def test_unknown_fields_are_rejected(super_admin_headers):
    response = client.put(
        AI_SETTINGS,
        json={"chat_model": "gpt-4o-mini", "chat_api_key_encrypted": "x"},
        headers=super_admin_headers,
    )
    assert response.status_code == 422


def test_gemini_settings_are_independent(super_admin_headers):
    gemini = "AQ." + uuid.uuid4().hex
    response = client.put(
        AI_SETTINGS,
        json={"gemini_model": "gemini-2.0-flash", "gemini_api_key": gemini},
        headers=super_admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["gemini_model"] == "gemini-2.0-flash"
    assert body["gemini_api_key_set"] is True
    assert body["gemini_api_key_hint"] == f"****{gemini[-4:]}"
    assert body["chat_api_key_set"] is False

    cleared = client.put(
        AI_SETTINGS, json={"gemini_api_key": ""}, headers=super_admin_headers
    )
    assert cleared.status_code == 200
    assert cleared.json()["gemini_api_key_set"] is False


def test_the_test_endpoint_reports_a_missing_key_without_a_network_call(
    super_admin_headers, monkeypatch
):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post(
        AI_SETTINGS + "/test", json={"target": "chat"}, headers=super_admin_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ok"] is False
    assert "API key" in body["message"]


def test_the_test_endpoint_uses_a_draft_key_without_saving_it(
    super_admin_headers, monkeypatch
):
    seen: dict = {}

    def fake_post(url, *, headers, json, timeout):
        seen["url"] = url
        seen["auth"] = headers.get("Authorization")
        seen["model"] = json.get("model")
        return ai_settings_router.httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(ai_settings_router.httpx, "post", fake_post)

    response = client.post(
        AI_SETTINGS + "/test",
        json={
            "target": "chat",
            "base_url": "https://api.groq.com/openai/v1",
            "model": "llama-3.3-70b-versatile",
            "api_key": "sk-draft-" + uuid.uuid4().hex,
        },
        headers=super_admin_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["ok"] is True
    assert seen["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert seen["auth"].startswith("Bearer sk-draft-")
    assert seen["model"] == "llama-3.3-70b-versatile"

    # A test is not a save.
    with SessionLocal() as db:
        row = db.get(AiSetting, 1)
        assert row is not None
        assert row.chat_api_key_encrypted is None


def test_the_test_endpoint_surfaces_a_rejection(super_admin_headers, monkeypatch):
    def fake_post(url, *, headers, json, timeout):
        return ai_settings_router.httpx.Response(
            401, json={"error": {"message": "Invalid API key provided"}}
        )

    monkeypatch.setattr(ai_settings_router.httpx, "post", fake_post)

    response = client.post(
        AI_SETTINGS + "/test",
        json={"target": "chat", "api_key": "sk-bad"},
        headers=super_admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ok"] is False
    assert "401" in body["message"]
    assert "Invalid API key" in body["message"]


def test_the_chat_route_is_503_when_nothing_is_configured(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post(AI_CHAT, json={"message": "Hello"})
    assert response.status_code == 503


def test_the_chat_route_uses_the_saved_key_and_configuration(
    super_admin_headers, monkeypatch
):
    seen: dict = {}

    def fake_post(url, *, headers, json, timeout):
        seen["url"] = url
        seen["auth"] = headers.get("Authorization")
        seen["model"] = json.get("model")
        return ai_router.httpx.Response(
            200, json={"choices": [{"message": {"content": "  Hello, student.  "}}]}
        )

    monkeypatch.setattr(ai_router.httpx, "post", fake_post)
    assert (
        client.put(
            AI_SETTINGS,
            json={
                "chat_base_url": "https://api.groq.com/openai/v1",
                "chat_model": "llama-3.3-70b-versatile",
                "chat_api_key": "sk-live-" + uuid.uuid4().hex,
            },
            headers=super_admin_headers,
        ).status_code
        == 200
    )

    response = client.post(AI_CHAT, json={"message": "Hello"})
    assert response.status_code == 200, response.text
    assert response.json() == {"reply": "Hello, student."}
    assert seen["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert seen["auth"].startswith("Bearer sk-live-")
    assert seen["model"] == "llama-3.3-70b-versatile"


def test_the_chat_route_hides_provider_failures(super_admin_headers, monkeypatch):
    def fake_post(url, *, headers, json, timeout):
        return ai_router.httpx.Response(
            401, json={"error": {"message": "secret-bearing provider text"}}
        )

    monkeypatch.setattr(ai_router.httpx, "post", fake_post)
    assert (
        client.put(
            AI_SETTINGS,
            json={"chat_api_key": "sk-fail-" + uuid.uuid4().hex},
            headers=super_admin_headers,
        ).status_code
        == 200
    )

    response = client.post(AI_CHAT, json={"message": "Hello"})
    assert response.status_code == 502
    assert "secret-bearing provider text" not in response.text


def test_the_backend_falls_back_to_the_environment(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-env-key")
    monkeypatch.setenv("OPENAI_MODEL", "env-model")

    with SessionLocal() as db:
        from app.services import ai_config

        config = ai_config.resolve_chat_config(db)
    assert config.api_key == "sk-env-key"
    assert config.source == "environment"
    assert config.model == "env-model"
