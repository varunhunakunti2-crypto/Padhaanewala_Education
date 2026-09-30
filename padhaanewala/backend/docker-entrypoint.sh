#!/bin/sh
# Container entrypoint.
#
# Migrations run here, before the server starts, so that a fresh deploy brings a
# schema that matches the code that is about to query it. Doing it by hand
# against the VPS is how a deploy ends up serving 500s from a column that was
# never added.
#
# Single-replica assumption, stated rather than hidden: two containers starting at
# once would both attempt `alembic upgrade head`. Alembic takes a lock on
# `alembic_version` for the duration of a migration, so the loser waits and then
# sees the revision already applied — the common case is safe. Two containers
# migrating genuinely different revisions at the same moment is not, which is why
# scaling out is done by adding replicas *after* one is healthy, never by letting
# them race.
#
# `set -e` is the point: if the migration fails, the container must die rather
# than start serving against a schema it does not understand.

set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "[entrypoint] running database migrations"
    # `sqlalchemy.url` in alembic.ini is a placeholder; env.py overrides it from
    # Settings, which reads DATABASE_URL/DB_* — supplied as Compose environment.
    # No wait loop here: Compose already gates the backend on db being
    # `service_healthy`, so a retry loop would only hide a genuine failure.
    alembic upgrade head
    echo "[entrypoint] migrations complete"
else
    echo "[entrypoint] skipping migrations (RUN_MIGRATIONS=${RUN_MIGRATIONS:-})"
fi

# Migrations create the *schema*. They do not create reference data, and without
# it the application is up but unusable in a way that looks healthy:
#
#   * `POST /auth/register` is fail-closed on a missing student role and returns
#     503, so nobody can create an account;
#   * every authenticated request 403s, because authorization reads roles from
#     the database and finds none;
#   * `GET /health` still returns 200, because a `SELECT 1` round trip says
#     nothing about whether the rows a query needs are there.
#
# That last point is why this cannot be left to an operator to remember. It is
# off by default because the loaders are idempotent but not free, and a container
# that re-seeds on every restart is a container that will eventually re-seed while
# somebody is looking at it. Set RUN_SEEDS=true for the first deploy on a host,
# then set it back.
if [ "${RUN_SEEDS:-false}" = "true" ]; then
    echo "[entrypoint] seeding reference data"
    # Order matters: roles gate registration, locations and colleges reference
    # states, and courses are attached to colleges. Each script is idempotent.
    for script in \
        seed_roles.py \
        seed_locations.py \
        seed_colleges_courses.py \
        seed_universities.py \
        seed_exams.py \
        seed_scholarships.py
    do
        echo "[entrypoint]   $script"
        python "scripts/$script"
    done
    echo "[entrypoint] seeds complete"
    echo "[entrypoint] bootstrap the first admin with: python scripts/seed_admin.py"
else
    echo "[entrypoint] skipping seeds (RUN_SEEDS=${RUN_SEEDS:-false})"
fi

# exec so the server becomes PID 1 and receives SIGTERM directly. Without the
# exec, a shell sits in front of uvicorn, Docker's SIGTERM stops the shell, and
# uvicorn is killed at the 10-second grace period instead of draining.
exec "$@"
