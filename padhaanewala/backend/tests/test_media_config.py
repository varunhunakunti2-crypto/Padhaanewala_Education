"""Production configuration guards for uploaded media.

## Why these assertions exist

Uploaded files are written to `MEDIA_ROOT` and served back from the
application's **own origin** by `GET /media/files/{id}`. That makes the root
part of the trusted computing base, and it means a wrong value is not a
cosmetic misconfiguration — it decides which files exist inside the origin the
browser trusts.

Two failure modes are guarded, and they fail in opposite directions:

  * A **relative** root (`var/media`, the development default) resolves against
    the process working directory. Inside a container that is inside the image's
    writable layer, so every upload succeeds and is silently destroyed by the
    next rebuild. The operator sees working uploads and no files, which is the
    worst shape of failure because nothing raises.
  * A **system** root (`/`, `/etc`, `/var`) would place every readable file in
    the app's origin under the serving route's path.

The original guard got the first one backwards — it rejected absolute paths and
its own error message told the operator to set one — so the value it recommended
was the value it refused.
"""

from __future__ import annotations

import pytest

from app.config import settings


def _production_baseline(monkeypatch, **overrides) -> None:
    """Put `settings` in an otherwise-valid production state.

    Mirrors the baseline in `test_otp.py`: each guard is asserted on its own, so
    the pre-existing JWT/database/provider checks must already pass or they trip
    first and the assertion would be testing the wrong thing.
    """
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "a-real-access-secret")
    monkeypatch.setattr(settings, "JWT_REFRESH_SECRET_KEY", "a-different-refresh-secret")
    monkeypatch.setattr(settings, "DB_PASSWORD", "a-real-db-password")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg2://u:p@localhost/db")
    monkeypatch.setattr(settings, "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 30)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "sendgrid")
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "a-real-sendgrid-key")
    monkeypatch.setattr(settings, "SMS_PROVIDER", "msg91")
    monkeypatch.setattr(settings, "SMS_API_KEY", "a-real-msg91-key")
    monkeypatch.setattr(settings, "SMS_DLT_TEMPLATE_ID", "a-registered-dlt-template")
    # The media guards have to be neutral here, or they trip first and shadow
    # whichever guard a test is actually about. The test process sets
    # MEDIA_ROOT=var/test-media, which the relative-root guard would refuse.
    monkeypatch.setattr(settings, "MEDIA_ROOT", "/var/lib/padhaanewala/media")
    monkeypatch.setattr(settings, "MEDIA_URL_PREFIX", "/api/v1/media/files")
    for name, value in overrides.items():
        monkeypatch.setattr(settings, name, value)


class TestMediaRoot:
    def test_production_refuses_a_relative_root(self, monkeypatch):
        """The dev default is the exact value that loses files on rebuild.

        This test fails against the original guard, which accepted the relative
        default in production and rejected the absolute path it recommended.
        """
        for root in ("var/media", "media", "./media", "../media"):
            _production_baseline(monkeypatch, MEDIA_ROOT=root)
            with pytest.raises(ValueError) as excinfo:
                settings._guard_production_defaults()
            assert "absolute" in str(excinfo.value), root

    def test_the_absolute_check_reads_a_posix_path_on_any_host(self, monkeypatch):
        """`/var/lib/...` is absolute for the container, whichever host runs the tests.

        `os.path.isabs` answers for the machine running the check. On Windows it
        reports `/var/lib/padhaanewala/media` as relative, so a guard built on it
        passes the whole suite on a Windows dev box and then refuses to boot in
        the Linux container it was written for — the guard would be absent in
        production and misfire everywhere else.
        """
        _production_baseline(monkeypatch, MEDIA_ROOT="/var/lib/padhaanewala/media")

        settings._guard_production_defaults()  # must not raise

    def test_a_windows_drive_path_is_also_absolute(self, monkeypatch):
        _production_baseline(monkeypatch, MEDIA_ROOT=r"D:\padhaanewala\media")

        settings._guard_production_defaults()  # must not raise

    @pytest.mark.parametrize(
        "root",
        [
            "/",          # the filesystem root
            "/etc",       # a system directory
            "/var",       # a system directory
            "/var/lib",   # one below a system directory
            "/usr/share",
            "/app",       # not a system directory, still too shallow
            "/app/media",
            "/data/uploads",
        ],
    )
    def test_production_refuses_a_shallow_path(self, monkeypatch, root):
        """Every value a human types by mistake is shallower than three levels.

        The rule is depth, not a blocklist, because no prefix rule separates
        `/var/lib` (refuse) from `/var/lib/padhaanewala/media` (accept) honestly.
        """
        _production_baseline(monkeypatch, MEDIA_ROOT=root)
        with pytest.raises(ValueError) as excinfo:
            settings._guard_production_defaults()
        assert "too shallow" in str(excinfo.value), root

    @pytest.mark.parametrize(
        "root",
        [
            "/var/lib/padhaanewala/media",
            "/srv/uploads/images",
            "/app/var/media",
        ],
    )
    def test_production_accepts_a_dedicated_path(self, monkeypatch, root):
        _production_baseline(monkeypatch, MEDIA_ROOT=root)

        settings._guard_production_defaults()  # must not raise

    def test_a_deep_system_path_is_outside_this_guard_reach(self, monkeypatch):
        """Documents the limit rather than implying the guard has none.

        This is a guard against gross mistakes, not a containment control: it
        accepts a deep path that is still shared. The actual bound is that
        `GET /media/files/{id}` only reads a path derived from a `media` row's
        own id, so a file that is not in the table is not reachable.
        """
        _production_baseline(monkeypatch, MEDIA_ROOT="/usr/local/bin/images")

        settings._guard_production_defaults()  # accepted, and known to be so

    def test_production_accepts_a_path_below_a_system_root(self, monkeypatch):
        """The rule is depth, not membership — `/var` is refused, `/var/lib/x/y` is not.

        Both are inside a system directory, so a membership test would have to
        reject the recommended volume path too.
        """
        _production_baseline(monkeypatch, MEDIA_ROOT="/srv/uploads/images")

        settings._guard_production_defaults()  # must not raise

    def test_production_accepts_a_dedicated_volume_path(self, monkeypatch):
        """The documented value must actually be the accepted value.

        A guard whose own recommended value is rejected is worse than no guard,
        because the operator cannot satisfy it and the only way past is to
        remove the check.
        """
        _production_baseline(monkeypatch, MEDIA_ROOT="/var/lib/padhaanewala/media")

        settings._guard_production_defaults()  # must not raise

    def test_the_size_ceiling_is_bounded(self, monkeypatch):
        for value in (0, -1, 51 * 1024 * 1024):
            _production_baseline(monkeypatch, MEDIA_MAX_BYTES=value)
            with pytest.raises(ValueError) as excinfo:
                settings._guard_production_defaults()
            assert "MEDIA_MAX_BYTES" in str(excinfo.value), value

    def test_development_keeps_the_relative_default(self, monkeypatch):
        """Only production is guarded.

        Local development is expected to work with no volume mounted, which is
        what the relative default is for.
        """
        monkeypatch.setattr(settings, "APP_ENV", "development")
        monkeypatch.setattr(settings, "MEDIA_ROOT", "var/media")

        settings._guard_production_defaults()  # must not raise


class TestUrlPrefix:
    @pytest.mark.parametrize(
        "prefix",
        ["media/files", "/api/v1/media/files/", "/api/v1/../media/files", "files"],
    )
    def test_production_refuses_a_malformed_prefix(self, monkeypatch, prefix):
        """The prefix is the only test of whether a row's file is ours to serve.

        `path_for_row` compares `media.url` against it to decide "we wrote this
        file" vs "an admin pasted an external URL". A prefix with a trailing
        slash or a `..` makes that comparison disagree with the actual route, so
        a file could be treated as foreign (404 forever) or an external URL as
        local.
        """
        _production_baseline(monkeypatch, MEDIA_URL_PREFIX=prefix)

        with pytest.raises(ValueError) as excinfo:
            settings._guard_production_defaults()
        assert "MEDIA_URL_PREFIX" in str(excinfo.value), prefix
