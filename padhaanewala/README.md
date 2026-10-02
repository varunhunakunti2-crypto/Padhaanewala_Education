# Padhaanewala Education Technology Platform

India-wide education discovery, AI assistance, examination, counselling and lead-management platform for **padhaanewala.in**.

| Field | Detail |
|---|---|
| Scale | India-wide (50-100M+ users, millions concurrent during exam season) |
| Region | AWS ap-south-1 (Mumbai) |
| Status | In development — Phase 1 |

## Tech Stack

Verified against the code on 30 September 2026. Several rows below used to
describe planned components rather than installed ones; the corrections matter
because each one is a thing a new contributor will otherwise go looking for.

| Component | Technology |
|---|---|
| Frontend | Next.js 16.3 (App Router), React 19.2, TypeScript, Tailwind CSS 4 |
| Backend | Python 3.11+ (3.14.7 verified), FastAPI 0.141, SQLAlchemy 2.0, Alembic 1.19 |
| Database | PostgreSQL. Search is full-text (`to_tsvector` + a GIN index) — there is **no pgvector** and no embedding column |
| Cache / rate limiting | Redis. There is **no Celery and no queue worker** |
| Storage | **Not implemented.** No S3/R2 client and no `boto3`. A `media` row stores a URL string an admin pastes in; no bytes are ever accepted |
| AI / LLM | OpenAI, called from the **Next.js** route handler at `app/api/ai`, not from the backend. No key set ⇒ a canned offline reply |
| Auth | JWT access token (30 min) + rotating refresh token in an HttpOnly cookie, bcrypt (12 rounds), SMS/email OTP |
| Tests | pytest + httpx (backend), Vitest + jsdom (frontend) |

## Prerequisites

- Node.js 18+ (verified: v24.14.0)
- Python 3.11+ (the project venv is 3.14.7)
- Git (verified: 2.52.0)
- Docker Desktop (verified: 29.4.1)
- PostgreSQL 15+ (the dev box runs 16 natively; the Docker dev stack publishes 15)

## Project Structure

```
padhaanewala/
├── frontend/            → Next.js app
│   ├── frontend/        → components/ ONLY. See "The doubled path" below
│   ├── app/             → routes (App Router)
│   ├── lib/             → api.ts, api-server.ts, content.ts, mappers.ts, nav.ts
│   └── tests/           → Vitest
├── backend/             → FastAPI app
│   ├── app/             → routers, models, schemas, services, middleware
│   ├── alembic/         → migrations (single linear chain)
│   ├── scripts/         → seed_*.py, bootstrap_test_db.py, purge_demo_data.py
│   └── tests/           → pytest
├── docker/              → Caddyfile, db init
├── docs/                → specification, phase checklists, RBAC ruleset
└── docker-compose.{dev,localtest,prod}.yml
```

`.github/workflows/` lives at the **repository root**, one level above this
directory, not inside it. There is no `proctoring-service/` — it is a Phase 47
item that has not been started.

### The doubled path

`frontend/frontend/components/` is intentional. `tsconfig.json` maps
`"@/*": ["./frontend/*", "./*"]`, and 255 imports resolve through the first
entry. Do not "tidy" it into `"@/*": ["./*"]` — that breaks the build.
`frontend/AGENTS.md` has the full explanation.

## Quick Start

### 1. Environment Variables

`.env.example` sits at this directory's root, but **`Settings` loads
`.env.development` relative to the process working directory** — and the backend
runs from `backend/`. A `.env.development` created here is therefore read by
nothing:

```bash
cp .env.example backend/.env.development
```

Override the filename with `PADHAANEWALA_ENV_FILE` if you need to. Both files
are gitignored; only `.env.example` is tracked.

### 2. PostgreSQL (dev database)

A local PostgreSQL install is used for development (Option A). Database/user are already provisioned:

```bash
# Ensures: DB padhaanewala_dev, user padhaanewala / dev_password_123
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE ROLE padhaanewala WITH LOGIN PASSWORD 'dev_password_123' CREATEDB;"
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE padhaanewala_dev OWNER padhaanewala;"
```

Connection string (see `.env.development`):

```
postgresql+psycopg2://padhaanewala:dev_password_123@localhost:5432/padhaanewala_dev
```

The driver must match `requirements.txt`, which pins `psycopg2-binary`. An
`asyncpg` URL will fail at startup with a `ModuleNotFoundError` on a machine
that installed only the declared dependencies, even though asyncpg may happen
to be importable on a dev box that pulled it in transitively.

Alternatively, run PostgreSQL via Docker:

```bash
docker compose -f docker-compose.dev.yml up -d db
```

> **Port trap.** The two database options are on **different ports**, and the
> connection string above is only right for the native one. Native PostgreSQL
> holds 5432; `docker-compose.dev.yml` publishes 5433 (`"5433:5432"`) because
> 5432 is already taken on this machine. Whichever you choose, `DB_PORT` and
> `DATABASE_URL` in `backend/.env.development` must agree with it — the shipped
> `config.py` default is 5433, so a stale `.env.development` pointing at 5432
> will silently override it and you will be reading the wrong database.

### 3. Redis (rate limiting)

```bash
docker compose -f docker-compose.dev.yml up -d redis
docker exec padhaanewala-redis-1 redis-cli ping   # → PONG
```

Redis backs the rate limiter only. It is not a Celery broker, because there is no
Celery. If Redis is down the limiter fails **closed** on `/api/v1/auth/*` (503)
and fails open everywhere else.

> `docker-compose.dev.yml` runs **dependencies only** — the database and Redis.
> The API and the frontend always run natively: `uvicorn` in step 4, and
> `npm run dev` for the frontend. There is no containerised backend, so
> `docker compose up` will never serve the API on :8000.

### 4. Backend (FastAPI)

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health check: http://localhost:8000/health → `{"status":"ok"}`

Migrations and seed data (run once per database):

```bash
python -m alembic upgrade head
python scripts/seed_roles.py
python scripts/seed_locations.py
python scripts/seed_universities.py
python scripts/seed_colleges_courses.py
python scripts/seed_scholarships.py
python scripts/seed_exams.py
python scripts/seed_mock_tests.py
```

Order matters: locations before scholarships (which need states), exams before
mock tests. `bootstrap_test_db.py` does all of it in one command if you would
rather not track the sequence:

```bash
python scripts/bootstrap_test_db.py
```

`purge_demo_data.py` removes seed and test residue from a dev database.

`seed_mock_tests.py` loads the papers and questions from
`frontend/lib/data/mockTests.json` — the same file the frontend imports, so the
two cannot drift. It is idempotent: an existing paper is left alone. `--refresh`
rebuilds the questions of a paper that already exists, and is destructive,
because deleting questions cascades to `test_answers` and so voids the saved
answers of every attempt taken on it. Run `seed_exams.py` first; a paper whose
exam is missing is still loaded, just without the `exam_id` link.

### 4b. Bootstrap an admin account

`/admin` is gated on the `admin` / `super_admin` role, and self-registration only
ever assigns `student`, so the first admin has to be seeded. `seed_admin.py` is
idempotent and deliberately hard to misuse: it refuses to touch an email that is
not in `ADMIN_EMAIL_ALLOWLIST`, never re-hashes an existing account without
`--reset-password`, and refuses to escalate an account that already holds
`student` without `--promote-existing`.

```bash
# PowerShell — ADMIN_PASSWORD is required, the script refuses to run without it
$env:ADMIN_EMAIL="contact@padhaanewala.in"
$env:ADMIN_EMAIL_ALLOWLIST="contact@padhaanewala.in"
$env:ADMIN_PASSWORD="<strong-password>"
python scripts/seed_roles.py     # must run first: creates the roles
python scripts/seed_admin.py
# rotate the password later:
python scripts/seed_admin.py --reset-password
```

Role names come from `app/roles.py` (the single source of truth) — see
`docs/rbac-compliance-checklist.md` for the full authorization ruleset.

`users.mobile` is NOT NULL and UNIQUE, so an admin needs a mobile even though the
login form does not ask for one — set `ADMIN_MOBILE` if `9999999999` is taken.

### 5. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Website: http://localhost:3000

## Git Workflow

- `main` — production (protected, deploys require approval)
- `develop` — development (default working branch during early phases)
- `feature/*` — feature branches
- No direct commits to `main`
- Conventional commit messages

## Tests

```bash
cd backend && python -m pytest        # needs a reachable PostgreSQL (see step 2)
cd frontend && npm test               # Vitest, no database needed
```

`npm run typecheck` and `npm run lint` are the other two frontend gates. CI runs
all four — see `.github/workflows/` at the repository root.

## Documentation

| Document | What it is |
|---|---|
| `docs/padhaanewala-complete.md` | The master product specification and implementation plan (V5.0), 105 phases |
| `docs/Pending-phases.md` | The authoritative status tracker for taking this to deployable. **Supersedes the two below.** |
| `docs/padhaanewala-phase-checklist.md` | Per-phase checklist. Predates the code it describes; several rows are wrong |
| `docs/rbac-compliance-checklist.md` | The authorization ruleset, keyed to `app/roles.py` |
| `docs/phase-verification.md`, `docs/session-log-2026-09-27.md` | Point-in-time records. Useful as history, not as status |

## References

- Website: https://padhaanewala.in
- Company: Padhaanewala Edutech Services, Bengaluru - 560100