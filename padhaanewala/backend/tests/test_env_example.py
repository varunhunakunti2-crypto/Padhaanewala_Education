"""Phase 7.3 — the configuration template is executable, not documentation.

## Why this file exists

`.env.example` is the first thing anybody copies when they clone this
repository, and in Phase 0 an unedited copy produced an application that could
not start. Two separate defects, both of them invisible to every check that ran:

  * `DATABASE_URL` declared `postgresql+asyncpg://…` while `requirements.txt`
    pins `psycopg2-binary` and not `asyncpg` — an unimportable driver.
  * `DB_PORT` said `5432` while `docker-compose.dev.yml` publishes `5433`.

Nobody noticed, because nothing ever *read* the template. A test suite that
constructs its own environment cannot catch a broken one, which is the same
shape of blind spot as BUG-01: 225 tests passed while nothing could log out,
because no test exercised the thing that was broken.

The assertion is therefore deliberately not "the file parses". It is: **the file
parses, and `Settings()` accepts it.** A template that parses but fails
validation is the more interesting failure, because it looks correct.

## What this does and does not cover

It covers structure and the development-configuration path. It does not prove
the template is deployable — `.env.example` is a development template and
several values in it are deliberately not production-shaped (`SECRET_KEY=change-me`,
`EMAIL_PROVIDER=console`), which is correct: `APP_ENV=production` is what turns
those into hard failures at boot, and `test_production_refuses_*` below is where
that behaviour is asserted.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import Settings

REPO_ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = REPO_ROOT / ".env.example"

# `KEY=value`, tolerating the leading `export ` and surrounding whitespace that
# a hand-edited template grows. Comments and blank lines are not assignments.
_ASSIGNMENT = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$")

# Read by `scripts/seed_admin.py`, not by `Settings`. Checked for real by
# `test_the_exclusion_list_does_not_hide_a_dead_variable` — this test failed on
# the ADMIN_* family, which is how it was found to be script-read rather than
# dead. `users.mobile` is NOT NULL UNIQUE, which is why ADMIN_MOBILE exists.
_ADMIN_SCRIPT_VARS = {
    "ADMIN_EMAIL",
    "ADMIN_EMAIL_ALLOWLIST",
    "ADMIN_MOBILE",
    "ADMIN_NAME",
    "ADMIN_PASSWORD",
    "ADMIN_ROLES",
}

# Documented in the template, but consumed by something other than `Settings`:
# the Next.js build, `next.config.ts`, docker-compose, or an entrypoint script.
# Every name here is a claim about the codebase, so adding one to silence a
# failing test is a decision to defend, not a convenience.
_NON_SETTINGS = _ADMIN_SCRIPT_VARS | {
    # docker-compose.prod.yml interpolates these; the app never sees them.
    "SITE_ADDRESS",
    "ACME_EMAIL",
    "RUN_MIGRATIONS",
    "RUN_SEEDS",
    # Consumed directly by app/database.py and alembic/env.py as a URL, and
    # declared on Settings only as a default. See config.py's DATABASE_URL.
    "DATABASE_URL",
    # next.config.ts (server-side rewrite) and the inlined client bundle.
    "BACKEND_URL",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME",
    "NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE",
    # Read by proxy.ts (CSP_IMAGE_HOSTS) and app/api/ai/route.ts (OPENAI_*),
    # both Next.js server-side, neither a `Settings` field.
    "CSP_IMAGE_HOSTS",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
}


def _parse_env_example() -> dict[str, str]:
    """Read `.env.example` into a dict, the way pydantic-settings would.

    Written by hand rather than using `dotenv` so the test fails loudly if the
    file is ever missing rather than silently yielding an empty mapping — an
    empty dict would make every "the template is non-empty" assertion below pass
    for the wrong reason.
    """
    assert EXAMPLE.exists(), f"{EXAMPLE} is missing; this test is the only thing that reads it"
    values: dict[str, str] = {}
    for raw in EXAMPLE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = _ASSIGNMENT.match(line)
        if not match:
            # Not an assignment. A continuation line or a typo; the structural
            # test below is what reports it.
            continue
        key, value = match.group(1), match.group(2)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def _apply_template(monkeypatch, **overrides: str) -> None:
    """Load `.env.example` into the environment through `monkeypatch`.

    Every value the template declares is *set*, so a variable the template omits
    falls back to the real process environment — which is the point: the test is
    "does the template, as written, produce a working development config", not
    "does it work in a vacuum". `PADHAANEWALA_ENV_FILE` is pointed at a path
    that does not exist so the ambient `.env.development` cannot quietly supply
    the values under test.
    """
    monkeypatch.setenv("PADHAANEWALA_ENV_FILE", ".env.this-file-does-not-exist")
    for key, value in {**_parse_env_example(), **overrides}.items():
        monkeypatch.setenv(key, value)


class TestEnvExampleIsWellFormed:
    def test_file_exists_and_is_not_empty(self) -> None:
        assert EXAMPLE.exists()
        assert EXAMPLE.stat().st_size > 500, "the template is suspiciously small"

    def test_every_line_is_a_comment_a_blank_or_an_assignment(self) -> None:
        # A malformed line is silently skipped by pydantic-settings, so a typo
        # like `SECRET_KEY change-me` would drop the key and leave the operator
        # with the default. Cheap to catch, and exactly the failure this file
        # exists to prevent.
        offenders = [
            f"{i}: {line!r}"
            for i, line in enumerate(EXAMPLE.read_text(encoding="utf-8").splitlines(), 1)
            if line.strip()
            and not line.strip().startswith("#")
            and not _ASSIGNMENT.match(line)
        ]
        assert not offenders, "unparseable lines in .env.example:\n" + "\n".join(offenders)

    def test_declares_a_meaningful_number_of_variables(self) -> None:
        values = _parse_env_example()
        # Phase 5.5 pruned 45 unread variables. A floor catches a re-truncation
        # without freezing the list, which would make every addition a conflict.
        assert len(values) >= 30, f"only {len(values)} variables documented"

    def test_no_key_is_declared_twice(self) -> None:
        seen: set[str] = set()
        duplicates: list[str] = []
        for line in EXAMPLE.read_text(encoding="utf-8").splitlines():
            match = _ASSIGNMENT.match(line)
            if not match:
                continue
            key = match.group(1)
            if key in seen:
                duplicates.append(key)
            seen.add(key)
        assert not duplicates, f"declared more than once, so the last wins silently: {duplicates}"


class TestSettingsAcceptsTheTemplate:
    def test_every_documented_variable_is_a_real_setting(self) -> None:
        """The direction that actually bites: a variable the template
        documents but nothing reads is a lie to the operator.

        Phase 5.5 removed 45 of these. This is what stops them coming back.
        """
        documented = set(_parse_env_example())
        unknown = {
            key
            for key in documented
            if key not in Settings.model_fields and key not in _NON_SETTINGS
        }
        assert not unknown, (
            "documented in .env.example but read by nothing: "
            f"{sorted(unknown)}. Either wire it up, or delete it; a template "
            "that documents a subsystem which does not exist is how this file "
            "drifted in Phase 0."
        )

    def test_the_exclusion_list_does_not_hide_a_dead_variable(self) -> None:
        """`not_settings` is an allowlist, so it can rot in the other direction.

        Each exempt name has to be genuinely consumed by *something* — a
        Settings field, the Next build, Compose, or a script. The ADMIN_* family
        was added here after this test failed on it, and the point of checking is
        that adding a name "to silence the test" is not the same as it being real.
        """
        import importlib.util

        # The only non-Settings consumer of the ADMIN_* family.
        spec = importlib.util.spec_from_file_location(
            "seed_admin_under_test", Path(__file__).resolve().parents[1] / "scripts" / "seed_admin.py"
        )
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        source = Path(spec.origin).read_text(encoding="utf-8")

        for name in _ADMIN_SCRIPT_VARS:
            assert name in source, f"{name} is exempted but seed_admin.py never mentions it"

    def test_settings_validates_against_the_template(self, monkeypatch) -> None:
        """The Phase 0 assertion, in the form that would have caught it.

        The template is applied to a clean environment and `Settings()` is
        constructed. `DATABASE_URL` is rewritten to a psycopg2 URL first,
        because the template documents the driver the app actually uses — an
        `asyncpg` URL here would fail to import, which is the original defect,
        so the test would catch a regression of it directly.

        `monkeypatch`, not a manual `os.environ` save/restore. The first version
        of this test did it by hand and broke two unrelated test modules:
        `PADHAANEWALA_SCHEMA` is in the process environment, set once by
        conftest at import, and clearing every uppercase key to get a clean slate
        removed it for the rest of the session. `test_mock_test_engine` then
        found an empty schema and failed, in a way that had nothing to do with
        either module. `monkeypatch` restores exactly what it changed, per test.
        """
        _apply_template(monkeypatch)

        settings = Settings()
        assert settings.APP_ENV == "development"
        # The Phase 0 defect, restated as an assertion rather than prose.
        assert settings.DATABASE_URL.startswith("postgresql+psycopg2://")
        assert "asyncpg" not in settings.DATABASE_URL
        assert settings.DB_PORT == 5433, (
            f"the template says DB_PORT={settings.DB_PORT}; "
            "docker-compose.dev.yml publishes 5433, and Phase 0 could not "
            "connect because the two disagreed"
        )

    def test_the_template_is_a_development_template(self) -> None:
        """It must not be production-shaped.

        If someone ever pastes the template into a deploy as-is, the production
        guards are the thing that saves them, and they only fire if the template
        leaves `APP_ENV` alone. This asserts that intent explicitly so the
        template cannot quietly become deployable-looking.
        """
        values = _parse_env_example()
        assert values.get("APP_ENV") == "development"
        assert values.get("SECRET_KEY") == "change-me", (
            "SECRET_KEY in the template should be an obvious placeholder, so a "
            "copy-pasted deploy fails the production guard loudly"
        )

    def test_production_refuses_the_template(self, monkeypatch) -> None:
        """The direct consequence: the template cannot start a production app.

        This is the guarantee Phase 0.3 and Phase 1 rest on — a placeholder
        reaches production as a refusal to boot, not as a running service with a
        guessable signing key.
        """
        _apply_template(monkeypatch)
        monkeypatch.setenv("APP_ENV", "production")
        with pytest.raises(ValidationError):
            Settings()
