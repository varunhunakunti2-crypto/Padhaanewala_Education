"""Restore the local development catalogue into a remote Postgres (Render).

`RUN_SEEDS=false` in render.yaml is deliberate: the catalogue is the 331 hand-
collected colleges and the 405-question mock-test bank, which exist nowhere
except this machine. Migrations alone will not produce them -- `alembic upgrade
head` creates an empty schema and the deploy comes up serving nothing.

So the sequence is:

    1. dump this machine's catalogue        (pg_dump, custom format)
    2. restore it into the remote database  (pg_restore)
    3. prove the row counts match           (verification, not optimism)

Step 3 is the point of this script. A restore that half-fails leaves a schema
that looks correct and returns empty lists, which reads as an application bug
rather than an incomplete step. This exits non-zero instead.

WHY THIS IS A SCRIPT AND NOT A psql LINE
    Two things about this project make a hand-typed restore unreliable:

    * VERSION. The source is PostgreSQL 18.4. A dump can only be restored into
      a server at least as new as the one it came from, so the target must be
      18+. Restoring an 18 archive into 16 or 17 fails partway through with
      catalog errors that leave the database in a mixed state. Checked up front
      so you find out before anything is written.

    * WHICH SOURCE. There are two Postgres servers on this machine and they are
      not interchangeable:

          port 5432  native Windows PostgreSQL 18.4   <-- the real catalogue
          port 5433  Docker container, PostgreSQL 15  <-- a different, older db

      `.env.development` points at 5432. `config.py`'s default DATABASE_URL and
      `docker-compose.dev.yml` point at 5433. Dumping from the container gives a
      PG 15 archive of a database that does not have the catalogue in it.

USAGE
    Render's *internal* hostname (dpg-xxx.aws.internal) is unreachable from a
    laptop, so use the external hostname from the Render dashboard:

        $env:RENDER_DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/padhaanewala"
        venv\\Scripts\\python.exe scripts/restore_catalog_to_render.py

    Then review the row counts it prints and only then trigger the frontend
    redeploy. If the backend was already deployed, wake it first: Render's free
    tier sleeps after ~15 minutes and a cold service answers a health check with
    a failed connection, not a slow one.

    --dry-run  report versions and row counts, write nothing
    --force    restore even if the target already holds rows (it --cleans first)

The target is destroyed by `--clean --if-exists`, which is how a restore into a
non-empty schema is made repeatable. On a free-tier database that is disposable,
so this is safe -- but it is not safe against a database you care about, which
is why the script stops when the target has data unless you pass --force.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

BACKEND_ROOT = Path(__file__).resolve().parent.parent

#: The catalogue tables worth proving arrived, in the order they appear in the
#: admin UI. A restore is only trustworthy if these all match the source.
VERIFY_TABLES = (
    "colleges",
    "courses",
    "exams",
    "mock_tests",
    "test_questions",
)

#: Native PostgreSQL on 5432, i.e. the server `.env.development` uses. Not the
#: Docker container on 5433, which is a different and older database.
DEFAULT_SOURCE_DSN = "postgresql://padhaanewala:dev_password_123@localhost:5432/padhaanewala_dev"


class RestoreError(RuntimeError):
    """Anything that should stop the restore with an explanation, not a traceback."""


def mask_dsn(dsn: str) -> str:
    """Render a DSN with its password replaced, so it is safe to log.

    Everything in this script may be printed to a Render build log or pasted
    into a chat window. A credential must never survive that.
    """
    return re.sub(r"://([^:/@]+):[^@]*@", r"://\1:***@", dsn)


def server_version(dsn: str) -> tuple[int, ...]:
    """Return the server's numeric version, e.g. (18, 4) for PostgreSQL 18.4.

    Deliberately parsed out of `SHOW server_version` rather than
    `SELECT version()`, whose string embeds the compiler and the platform and
    changes shape between releases.
    """
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute("SHOW server_version")
        raw = cur.fetchone()[0]
    match = re.match(r"(\d+)(?:\.(\d+))?", raw)
    if not match:
        raise RestoreError(f"could not parse a version out of {raw!r}")
    major = int(match.group(1))
    return (major, int(match.group(2) or 0))


def row_counts(dsn: str) -> dict[str, int]:
    """Count rows in each verification table, skipping any that do not exist.

    A missing table means the target is at a different migration level, which is
    worth reporting rather than crashing on -- the version check may already
    have explained it.
    """
    counts: dict[str, int] = {}
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        for table in VERIFY_TABLES:
            cur.execute("SELECT to_regclass(%s) IS NOT NULL", (f"public.{table}",))
            if not cur.fetchone()[0]:
                counts[table] = -1
                continue
            cur.execute(f'SELECT count(*) FROM public."{table}"')
            counts[table] = cur.fetchone()[0]
    return counts


def find_pg_tool(name: str, minimum_major: int = 18) -> str:
    """Locate pg_dump / pg_restore, preferring the newest version on the box.

    A 15-era client cannot dump an 18 server at all -- it aborts with
    "server version mismatch" -- so the version floor is enforced here rather
    than surfacing as a confusing failure three steps later.
    """
    on_path = shutil.which(name)
    if on_path:
        return on_path

    if sys.platform == "win32":
        root = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "PostgreSQL"
        candidates = sorted(root.glob(f"*/bin/{name}.exe"), reverse=True)
    else:
        candidates = sorted(Path(p).parent / name for p in ([
            "/usr/lib/postgresql/*/bin",
            "/opt/homebrew/opt/postgresql*/bin",
            "/usr/local/opt/postgresql*/bin",
        ]) for _ in [0] if Path(p).parent.exists())

    for candidate in candidates:
        result = subprocess.run(
            [str(candidate), "--version"], capture_output=True, text=True, check=False
        )
        match = re.search(r"(\d+)\.", result.stdout)
        if match and int(match.group(1)) >= minimum_major:
            return str(candidate)

    raise RestoreError(
        f"could not find {name} >= {minimum_major}. Install PostgreSQL client "
        "tools, or put them on PATH."
    )


def run(cmd: list[str], what: str) -> None:
    """Run a subprocess, turning a non-zero exit into an explained failure."""
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise RestoreError(f"{what} failed (exit {result.returncode}):\n{detail}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Restore the local catalogue into a remote Postgres.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dsn",
        default=os.environ.get("RENDER_DATABASE_URL"),
        help="target DSN. Defaults to $RENDER_DATABASE_URL.",
    )
    parser.add_argument(
        "--source-dsn",
        default=DEFAULT_SOURCE_DSN,
        help=f"source DSN. Defaults to the local dev server ({DEFAULT_SOURCE_DSN!r}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report versions and row counts without writing anything.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="restore even if the target already has rows. It will be cleaned first.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.dsn:
        print(
            "No target DSN.\n\n"
            "  $env:RENDER_DATABASE_URL = "
            '"postgresql://USER:PASSWORD@HOST:PORT/padhaanewala"\n\n'
            "Use the EXTERNAL hostname from the Render dashboard -- the internal\n"
            "dpg-xxx.aws.internal one is not reachable from this machine.",
            file=sys.stderr,
        )
        return 2

    try:
        source_version = server_version(args.source_dsn)
        target_version = server_version(args.dsn)
    except psycopg2.Error as exc:
        print(f"Could not reach a database:\n{exc}", file=sys.stderr)
        return 2

    print(f"source  {mask_dsn(args.source_dsn)}  PostgreSQL {'.'.join(map(str, source_version))}")
    print(f"target  {mask_dsn(args.dsn)}  PostgreSQL {'.'.join(map(str, target_version))}")

    # The check that justifies this script existing. A dump from server N cannot
    # be restored into a server older than N, and the failure is partial and
    # confusing, so it is worth refusing before a single byte is written.
    if target_version < source_version:
        print(
            f"\nABORT: the dump will come from PostgreSQL "
            f"{'.'.join(map(str, source_version))} and the target is "
            f"{'.'.join(map(str, target_version))}.\n"
            "A dump can only be restored into a server at least as new as its "
            "source.\nOn Render: delete this database and create the replacement "
            "at a newer version.",
            file=sys.stderr,
        )
        return 1

    source_counts = row_counts(args.source_dsn)
    target_counts = row_counts(args.dsn)

    print("\nsource rows:")
    for table, count in source_counts.items():
        print(f"  {table:<15} {count if count >= 0 else '(table missing)'}")

    # Order matters here. "You are pointed at the wrong source" is a more
    # fundamental mistake than "the target has data", so it is checked first --
    # otherwise a wrong-source run against a populated target reports the
    # harmless problem and hides the real one. `--dry-run` reports both without
    # aborting, because a dry run that refuses to describe the situation is not
    # much of a dry run.

    # Two distinct ways to be pointing at the wrong database, both of which
    # produce a deploy that looks fine and serves the wrong content.
    #
    #   colleges == 0
    #       An empty or brand-new server. Nothing to restore.
    #
    #   colleges > 0 but mock_tests == 0 and test_questions == 0
    #       The signature of the stale Docker database on 5433, which holds a
    #       14-college snapshot from before the mock-test import and no question
    #       bank at all. A `colleges == 0` check misses this entirely, which is
    #       how an early version of this script restored the wrong catalogue.
    wrong_source = source_counts["colleges"] == 0 or (
        source_counts["colleges"] > 0
        and source_counts["mock_tests"] == 0
        and source_counts["test_questions"] == 0
    )
    if wrong_source:
        print(
            f"\nWRONG SOURCE: the source does not look like the catalogue: {source_counts}\n"
            "If colleges > 0 but mock_tests and test_questions are both 0, this is\n"
            "the stale Docker database on port 5433, not the real one. The\n"
            f"catalogue is on 5432:\n\n    --source-dsn {DEFAULT_SOURCE_DSN!r}",
            file=sys.stderr,
        )

    populated = {t: c for t, c in target_counts.items() if c > 0}
    if populated:
        print(
            f"\nNOTE: the target already holds data: {populated}\n"
            "Restoring will DROP those tables and replace them."
        )

    # A dry run describes the situation and stops. It must not refuse, because
    # "the target has data" is exactly the thing you dry-run to find out.
    if args.dry_run:
        print("\ndry run: nothing was written.")
        return 0

    # Abort order is deliberate: a wrong source is the more fundamental mistake,
    # so reporting it takes precedence over the harmless populated target.
    if wrong_source and not args.force:
        print("\nABORTED. Pass --force to restore it anyway.", file=sys.stderr)
        return 1

    if populated and not args.force:
        print("ABORTED. Re-run with --force if that is what you want.", file=sys.stderr)
        return 1

    pg_dump = find_pg_tool("pg_dump", minimum_major=source_version[0])
    pg_restore = find_pg_tool("pg_restore", minimum_major=source_version[0])
    print(f"\npg_dump    {pg_dump}\npg_restore {pg_restore}")

    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / "catalog.dump"
        print(f"\ndumping {source_counts['colleges']} colleges from the source...")

        # Custom format (-Fc) rather than plain SQL: it is a pg_restore archive,
        # so the restore can be selective and resumable with --clean, which a
        # plain SQL dump cannot do.
        run(
            [
                pg_dump,
                "--format=custom",
                "--file", str(archive),
                "--no-owner",
                # Keep the dump free of cluster-local roles. Restoring
                # OWNER TO padhaanewala onto a server where that role does not
                # exist fails every object it touches.
                "--no-privileges",
                "--dbname", args.source_dsn,
            ],
            "pg_dump",
        )
        size_mb = archive.stat().st_size / 1_048_576
        print(f"dumped {size_mb:.1f} MB")

        print("restoring into the target...")
        restore_cmd = [
            pg_restore,
            # --clean --if-exists is what makes this repeatable. The entrypoint
            # has already run `alembic upgrade head`, so every table in the
            # archive already exists and a plain restore fails on the first one.
            "--clean",
            "--if-exists",
            # The target's role name is not the source's. Without these, the
            # archive's SET OWNER and GRANT statements reference roles that do
            # not exist there.
            "--no-owner",
            "--no-privileges",
            # NOTE: there is deliberately no --continue-on-error here, because
            # pg_restore has no such option and exits 1 with "illegal option"
            # if given one. Continuing past a bad object is already the
            # default; `--exit-on-error` is the flag that would stop at the
            # first one, and we do not want that, since one unavailable
            # extension should not abandon the other 200 tables.
            "--dbname", args.dsn,
            str(archive),
        ]
        result = subprocess.run(restore_cmd, capture_output=True, text=True, check=False)
        # Match on the exit code as well as the text. A pg_restore that dies on
        # a bad command line says nothing resembling "ERROR" on stderr, so a
        # text-only filter reports a clean run for a total failure -- which is
        # precisely the bug this script's verification step exists to catch.
        stderr = result.stderr or ""
        errors = [
            line for line in stderr.splitlines()
            if re.search(r"\b(ERROR|FATAL)\b|illegal option|error:", line, re.IGNORECASE)
        ]
        if result.returncode != 0 and not errors:
            errors = [f"pg_restore exited {result.returncode} without a message"]
        if errors:
            print(f"\nrestore reported {len(errors)} error(s):", file=sys.stderr)
            for line in errors[:20]:
                print(f"  {line}", file=sys.stderr)
            if len(errors) > 20:
                print(f"  ... and {len(errors) - 20} more", file=sys.stderr)

    final_counts = row_counts(args.dsn)
    print("\nverification:")
    mismatches = []
    for table in VERIFY_TABLES:
        want, got = source_counts[table], final_counts.get(table, -1)
        if want < 0:
            print(f"  {table:<15} skipped (missing on source)")
            continue
        ok = want == got
        print(f"  {table:<15} {got:>6}  {'ok' if ok else f'MISMATCH, expected {want}'}")
        if not ok:
            mismatches.append(table)

    if mismatches:
        print(
            f"\nFAILED: {', '.join(mismatches)} did not match the source.\n"
            "The database is not in the state the deploy expects.",
            file=sys.stderr,
        )
        return 1

    print("\nOK: catalogue restored and verified.")
    print(
        "Next: the backend must be awake before the frontend calls it, or every\n"
        "server-side fetch falls back to bundled data. curl the Render /health,\n"
        "then trigger the Vercel redeploy."
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RestoreError as error:
        print(f"\n{error}", file=sys.stderr)
        sys.exit(1)
