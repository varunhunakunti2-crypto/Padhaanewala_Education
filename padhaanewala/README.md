# Padhaanewala Education Technology Platform

India-wide education discovery, AI assistance, examination, counselling and lead-management platform for **padhaanewala.in**.

| Field | Detail |
|---|---|
| Scale | India-wide (50-100M+ users, millions concurrent during exam season) |
| Region | AWS ap-south-1 (Mumbai) |
| Status | In development — Phase 1 |

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), React 18+, TypeScript, Tailwind CSS |
| Backend | Python 3.11+, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL 15+ (pgvector for embeddings) |
| Cache / Queue | Redis 7+, Celery |
| Storage | AWS S3 / Cloudflare R2 |
| AI / LLM | OpenAI / Anthropic (backend only) |
| Auth | JWT + refresh tokens, bcrypt (12 rounds) |

## Prerequisites

- Node.js 18+ (verified: v24.14.0)
- Python 3.11+ (verified: 3.14.5)
- Git (verified: 2.52.0)
- Docker Desktop (verified: 29.4.1)
- PostgreSQL 15+ (verified: 18.4, running as Windows service)

## Project Structure

```
padhaanewala/
├── frontend/            → Next.js app
├── backend/             → FastAPI app
├── proctoring-service/  → ML proctoring (Phase 47)
├── docs/                → documentation
├── scripts/             → helper scripts
├── .github/workflows/   → CI/CD (Phase 86)
├── docker-compose.dev.yml
├── .env.example
├── .env.development
└── .gitignore
```

## Quick Start

### 1. Environment Variables

Copy the template and edit values:

```bash
cp .env.example .env.development
```

Never commit `.env.development` or any real secrets. Only `.env.example` is tracked.

### 2. PostgreSQL (dev database)

A local PostgreSQL install is used for development (Option A). Database/user are already provisioned:

```bash
# Ensures: DB padhaanewala_dev, user padhaanewala / dev_password_123
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE ROLE padhaanewala WITH LOGIN PASSWORD 'dev_password_123' CREATEDB;"
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE padhaanewala_dev OWNER padhaanewala;"
```

Connection string (see `.env.development`):

```
postgresql+asyncpg://padhaanewala:dev_password_123@localhost:5432/padhaanewala_dev
```

Alternatively, run PostgreSQL via Docker:

```bash
docker compose -f docker-compose.dev.yml up -d db
```

### 3. Redis (cache + Celery broker)

```bash
docker compose -f docker-compose.dev.yml up -d redis
docker exec padhaanewala-redis-1 redis-cli ping   # → PONG
```

### 4. Backend (FastAPI)

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health check: http://localhost:8000/health → `{"status":"ok"}`

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

## Documentation

The full product specification, architecture and implementation plan lives in `../padhaanewala-complete.md` (Master Document V5.0). Development follows its 105 phases in strict order.

## References

- Website: https://padhaanewala.in
- Company: Padhaanewala Edutech Services, Bengaluru - 560100