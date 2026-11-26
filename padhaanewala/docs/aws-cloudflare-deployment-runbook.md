# Padhaanewala — AWS + Cloudflare Deployment Runbook

**Canonical domain:** `padhaanewala.com`  
**Also served:** `www.padhaanewala.com`  
**Legacy redirect:** `padhaanewala.in` → `padhaanewala.com`  
**Target:** Staging first, then production after sign-off  
**AWS region:** `ap-south-1` (Mumbai)  
**Deployment model:** EC2 + Docker Compose with Caddy ingress  
**Secrets:** AWS Secrets Manager or SSM Parameter Store

> This runbook is a deployment plan and command reference. It does **not** deploy anything by itself. No live AWS, Cloudflare, DNS, production database, or secret change has been performed.

---

## 1. Current local readiness

Verified locally:

| Check | Result |
|---|---|
| Docker | `Docker version 29.9.3, build 5457199` |
| Docker Compose | `v5.7.1` |
| AWS CLI | **not installed** on this Windows machine |
| Current branch | `security/H-08-pii-encryption` |
| Current HEAD | `5049ab1425a00bd31382ab21af472d36bf21ee57` |
| Alembic head | `f4a1c6d8e902` |

Before I can provision AWS resources from this machine, install/configure AWS CLI locally, or you can run the AWS steps from AWS CloudShell / an EC2 instance role.

Do **not** paste AWS keys, JWT keys, DB passwords, SMS/email API keys, or admin passwords into chat.

---

## 2. Important production-readiness warning

The current repository passes its backend suites, including:

```text
920 passed, 1 skipped, 3 warnings
```

But Fix 02 remains incomplete:

| Phase | Status |
|---|---|
| T0 / T0.1 / T1 | `COMPLETE` |
| T2 / T3 / T4 / T5 | `BLOCKED` |

Therefore:

- field-level PII encryption is not integrated;
- restricted search/HMAC is not implemented;
- backfill, read cutover, plaintext removal, and production verification are not done;
- backup/restore rehearsal is not yet proven;
- production deployment is not authorised by the Fix 02 gate evidence.

**Staging deployment is reasonable now. Production deployment should wait until the security gates are resolved or formally risk-accepted by the responsible stakeholders.**

---

## 3. Deployment topology

```text
Cloudflare DNS / WAF
        |
        | HTTPS
        v
EC2 Elastic IP in ap-south-1
        |
        v
Caddy (:80/:443 only published port)
        |
        +--> Next.js frontend:3000
        |       |
        |       +--> FastAPI backend:8000 via internal rewrite
        |
        +--> /health directly to backend:8000

Internal-only Compose network:
backend <--> db:5432
backend <--> redis:6379
```

Security properties already encoded in `docker-compose.prod.yml`:

- only Caddy publishes ports;
- backend, PostgreSQL, Redis, and frontend are not publicly exposed;
- Next.js proxies `/api/v1/*` internally, keeping browser calls same-origin;
- refresh cookie can remain `HttpOnly` and `SameSite=strict`;
- backend runs with `--no-proxy-headers`;
- client IP is resolved by `TRUSTED_PROXY_HOPS`.

---

## 4. Cloudflare handling — required decision before orange-cloud

### 4.1 Safe first-boot option: DNS-only

For the first staging deploy, use Cloudflare **DNS-only** / grey cloud:

```text
Type  Name                   Value        Proxy
A     staging                 <EC2-EIP>    DNS only
```

This lets Caddy see the real client IP and complete Let’s Encrypt HTTP-01 cleanly.

### 4.2 Before enabling Cloudflare proxy/orange cloud

The current Caddyfile sets `X-Forwarded-For` from `{remote_host}`. With Cloudflare proxy enabled, `{remote_host}` is a Cloudflare edge IP, not the real visitor. That will make all users appear to share one IP and will break rate limiting and audit attribution.

Before orange-cloud, update the edge config so that:

1. only requests from official Cloudflare IP ranges are trusted;
2. `X-Forwarded-For` is set from `CF-Connecting-IP`;
3. client-supplied forwarding headers are discarded;
4. AWS Security Group allows inbound 80/443 only from Cloudflare IP ranges;
5. a break-glass path exists if Cloudflare IP ranges change.

Fetch current ranges at deploy time:

```powershell
Invoke-WebRequest -Uri 'https://www.cloudflare.com/ips-v4' -UseBasicParsing
Invoke-WebRequest -Uri 'https://www.cloudflare.com/ips-v6' -UseBasicParsing
```

Do not hardcode stale ranges permanently without a review process.

---

## 5. AWS resources to create

### 5.1 EC2 instance

Recommended staging size:

```text
AMI:      Ubuntu 24.04 LTS
Type:     t3.medium
Region:   ap-south-1
Storage:  40 GB gp3 encrypted
Network:  default VPC or dedicated VPC
IAM role: SSM + Secrets Manager read-only for /padhaanewala/*
```

Use AWS Systems Manager Session Manager where possible. Avoid SSH inbound if SSM is available.

### 5.2 Elastic IP

Allocate an Elastic IP in `ap-south-1` and associate it with the staging instance. DNS records point to this Elastic IP, not to the instance’s transient public IP.

### 5.3 Security group

Inbound:

| Port | Source | Purpose |
|---|---|---|
| 22 | your IP only, if SSH is used | Break-glass admin |
| 80 | Cloudflare ranges, or `0.0.0.0/0` during DNS-only ACME bootstrap | ACME + redirect |
| 443 | Cloudflare ranges, or `0.0.0.0/0` during DNS-only bootstrap | HTTPS |

Outbound: HTTPS for package installs, Let’s Encrypt, AWS APIs, email/SMS providers, and LLM APIs.

### 5.4 Secrets Manager

Create one JSON secret per environment:

```text
/padhaanewala/staging/env
/padhaanewala/production/env
```

The JSON keys must match Compose environment variables. Store the secret JSON in a local file outside the repository, for example:

```text
C:\Secure\padhaanewala\staging-env.json
```

Never place this file inside the Git working tree.

---

## 6. Required secret keys

The staging/production secret JSON must contain real values for the variables consumed by `docker-compose.prod.yml`.

At minimum:

```text
APP_ENV
APP_URL
API_URL
ALLOWED_HOSTS
CORS_ORIGINS
TRUSTED_PROXY_HOPS
SECRET_KEY
JWT_SECRET_KEY
JWT_REFRESH_SECRET_KEY
JWT_PREVIOUS_SECRET_KEY
JWT_PREVIOUS_REFRESH_SECRET_KEY
DB_NAME
DB_USER
DB_PASSWORD
EMAIL_PROVIDER
EMAIL_API_KEY
EMAIL_SMTP_HOST
EMAIL_SMTP_PORT
EMAIL_SMTP_USER
EMAIL_SMTP_PASSWORD
EMAIL_FROM_EMAIL
EMAIL_FROM_NAME
EMAIL_VERIFICATION_REQUIRED
SMS_PROVIDER
SMS_API_KEY
SMS_SENDER_ID
SMS_DLT_TEMPLATE_ID
RUN_MIGRATIONS
RUN_SEEDS
SITE_ADDRESS
ACME_EMAIL
NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME
NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE
NEXT_PUBLIC_SITE_URL
GEMINI_API_KEY
OPENAI_API_KEY
OPENAI_BASE_URL
ADMIN_EMAIL
ADMIN_EMAIL_ALLOWLIST
ADMIN_PASSWORD
ADMIN_NAME
ADMIN_MOBILE
ADMIN_ROLES
```

Generate JWT and DB secrets locally with strong independent values, for example:

```powershell
openssl rand -hex 32
openssl rand -hex 24
```

Do not print or paste those values into chat.

`NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` is a statutory production build requirement in `frontend/next.config.ts`; a placeholder will fail the image build.

---

## 7. Release artifact

The current working tree contains modified TestSprite reports and untracked Fix 02 files. Do **not** deploy the working tree as-is.

Deploy from a clean committed release ref. Current verified baseline:

```text
5049ab1425a00bd31382ab21af472d36bf21ee57
```

If the untracked T1 primitive must be included in the release, that requires an explicit commit/tag authorisation first. It is not needed for current application behaviour because no application code imports it.

---

## 8. Local AWS CLI setup

On the Windows machine:

```powershell
winget install --id Amazon.AWSCLI -e
aws configure --profile padhaanewala
```

Enter region:

```text
ap-south-1
```

Do not paste credentials into this chat.

Verify identity without revealing secrets:

```powershell
aws sts get-caller-identity --profile padhaanewala
```

---

## 9. Create the staging secret

From the secure local JSON file:

```powershell
aws secretsmanager create-secret `
  --name /padhaanewala/staging/env `
  --secret-string file:///C:/Secure/padhaanewala/staging-env.json `
  --region ap-south-1 `
  --profile padhaanewala
```

Update later with:

```powershell
aws secretsmanager put-secret-value `
  --secret-id /padhaanewala/staging/env `
  --secret-string file:///C:/Secure/padhaanewala/staging-env.json `
  --region ap-south-1 `
  --profile padhaanewala
```

---

## 10. EC2 bootstrap

Run on the EC2 instance via SSM or SSH.

```bash
sudo apt-get update
sudo apt-get install -y docker.io git curl jq unzip awscli
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
```

If using an IAM role, do not store AWS access keys on the server.

Create application directory:

```bash
sudo mkdir -p /opt/padhaanewala
sudo chown ubuntu:ubuntu /opt/padhaanewala
```

Clone the release commit:

```bash
cd /opt/padhaanewala
git clone <REPOSITORY_URL> app
cd app
git checkout 5049ab1425a00bd31382ab21af472d36bf21ee57
```

Replace `<REPOSITORY_URL>` with the real repository URL. If the repo is private, use a deploy key or token injected through the CI/CD system, not a hardcoded credential.

Fetch secrets into a root-readable env file:

```bash
aws secretsmanager get-secret-value \
  --secret-id /padhaanewala/staging/env \
  --region ap-south-1 \
  --query SecretString \
  --output text \
  | sudo tee /opt/padhaanewala/.env >/dev/null

sudo chmod 600 /opt/padhaanewala/.env
sudo chown root:root /opt/padhaanewala/.env
```

This does not print secret values.

---

## 11. Staging DNS

Create the staging DNS record only:

```text
Type: A
Name: staging
Value: <EC2-EIP>
Proxy: DNS only for first boot
```

Do not point production apex/www at the staging host yet.

---

## 12. First staging deploy

Ensure the secret has:

```text
SITE_ADDRESS=staging.padhaanewala.com
APP_URL=https://staging.padhaanewala.com
API_URL=https://staging.padhaanewala.com
CORS_ORIGINS=https://staging.padhaanewala.com
ALLOWED_HOSTS=staging.padhaanewala.com
NEXT_PUBLIC_SITE_URL=https://staging.padhaanewala.com
TRUSTED_PROXY_HOPS=0
RUN_MIGRATIONS=true
RUN_SEEDS=true
```

For DNS-only staging, `TRUSTED_PROXY_HOPS=0` is correct because Caddy sees the real client.

Deploy:

```bash
cd /opt/padhaanewala/app
sudo docker compose -f docker-compose.prod.yml \
  --env-file /opt/padhaanewala/.env \
  up -d --build
```

Watch startup:

```bash
sudo docker compose -f docker-compose.prod.yml \
  --env-file /opt/padhaanewala/.env \
  ps

sudo docker compose -f docker-compose.prod.yml \
  --env-file /opt/padhaanewala/.env \
  logs --tail=200
```

Do not paste logs into chat; inspect locally for errors and sensitive output.

After the first successful deploy, update the secret to:

```text
RUN_SEEDS=false
```

Refetch the env file and redeploy. Seeds must not run on every deploy.

---

## 13. Staging smoke tests

From a browser and from the server:

```bash
curl -fsS http://127.0.0.1/healthz
curl -fsS https://staging.padhaanewala.com/healthz
curl -fsS https://staging.padhaanewala.com/health
```

Application checks:

- homepage loads with correct CSS/JS;
- `/legal/grievance` shows the real named officer, not a placeholder;
- student registration works;
- email verification works;
- SMS OTP works;
- login/logout works;
- refresh cookie is present and `HttpOnly`;
- college/course/scholarship/exam pages load;
- mock test flow works;
- admin login works;
- admin media upload persists after container restart;
- API calls succeed through same-origin `/api/v1`;
- unauthorized admin routes return 403/redirect;
- no plaintext secrets or PII appear in logs.

---

## 14. Backups before any production promotion

### 14.1 EBS snapshot

```powershell
aws ec2 create-snapshot `
  --volume-id <EBS_VOLUME_ID> `
  --description "padhaanewala staging pre-promotion" `
  --region ap-south-1 `
  --profile padhaanewala
```

### 14.2 Database dump

On EC2:

```bash
set -a
. /opt/padhaanewala/.env
set +a

sudo docker compose -f /opt/padhaanewala/app/docker-compose.prod.yml \
  --env-file /opt/padhaanewala/.env \
  exec -T db \
  pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > /opt/padhaanewala/backups/staging-db.sql.gz

sudo chmod 600 /opt/padhaanewala/backups/staging-db.sql.gz
```

Upload the encrypted dump to S3 with SSE-KMS or another secure off-host store. Do not print its contents.

### 14.3 Restore rehearsal

Before production, prove restore on a separate host or separate Compose project:

- create fresh EC2/volume;
- deploy same release commit;
- restore the dump into the fresh DB;
- run `alembic current`;
- run `/health`;
- sign in with a synthetic test account;
- verify seeded reference data.

No production promotion until restore is demonstrated.

---

## 15. Monitoring and alerting

Set up before production:

- CloudWatch agent for CPU, memory, disk, and inode metrics;
- alarms for disk > 80%, CPU sustained > 80%, memory pressure;
- health checks for `/healthz` and `/health`;
- alert SNS topic/email;
- container restart alerts;
- backup failure alerts;
- log retention policy that respects PII risk;
- on-call/owner contact.

Do not send raw application logs to third-party observability tools until PII redaction is verified.

---

## 16. Cloudflare production DNS

Only after staging sign-off and the Caddy Cloudflare-IP fix:

```text
Type  Name   Value        Proxy
A     @      <EC2-EIP>    Proxied
A     www    <EC2-EIP>    Proxied
A     staging <EC2-EIP>   Proxied or DNS-only
```

Cloudflare SSL/TLS mode:

```text
Full (Strict)
```

Caddy continues to manage Let’s Encrypt certificates. Keep ports 80 and 443 open to the required sources.

Security settings to enable:

- WAF managed rules;
- bot fight mode where compatible;
- rate limiting for login/OTP endpoints, in addition to app-level limits;
- security headers review, avoiding duplicate conflicting policies;
- origin IP hidden behind proxy;
- origin restricted to Cloudflare IP ranges.

---

## 17. Production promotion

Secret values for production:

```text
SITE_ADDRESS=padhaanewala.com, www.padhaanewala.com
APP_URL=https://padhaanewala.com
API_URL=https://padhaanewala.com
CORS_ORIGINS=https://padhaanewala.com,https://www.padhaanewala.com
ALLOWED_HOSTS=padhaanewala.com,www.padhaanewala.com
NEXT_PUBLIC_SITE_URL=https://padhaanewala.com
TRUSTED_PROXY_HOPS=1
RUN_MIGRATIONS=true
RUN_SEEDS=false
```

Important:

- production keys must be independent of staging keys;
- DB password must be URL-safe;
- seed scripts must not run against production unless explicitly required and verified;
- `RUN_SEEDS=false` is the normal state.

Promotion deploy:

```bash
cd /opt/padhaanewala/app
git checkout <APPROVED_PRODUCTION_RELEASE>
aws secretsmanager get-secret-value \
  --secret-id /padhaanewala/production/env \
  --region ap-south-1 \
  --query SecretString \
  --output text \
  | sudo tee /opt/padhaanewala/.env >/dev/null

sudo chmod 600 /opt/padhaanewala/.env

sudo docker compose -f docker-compose.prod.yml \
  --env-file /opt/padhaanewala/.env \
  up -d --build
```

Production smoke tests:

```bash
curl -fsS https://padhaanewala.com/healthz
curl -fsS https://padhaanewala.com/health
curl -fsSI https://padhaanewala.com/
curl -fsSI https://www.padhaanewala.com/
```

Browser checks:

- canonical domain is `padhaanewala.com`;
- `www` resolves correctly;
- `padhaanewala.in` redirects to `.com`;
- login, OTP, admin, mock tests, enquiries, counsellor flows;
- no secrets/PII in logs;
- no browser console errors;
- image/media loading works.

---

## 18. Rollback

Application rollback:

```bash
cd /opt/padhaanewala/app
git checkout <PREVIOUS_WORKING_RELEASE>

sudo docker compose -f docker-compose.prod.yml \
  --env-file /opt/padhaanewala/.env \
  up -d --build
```

Database rollback:

- test `alembic downgrade` on staging first;
- never assume a migration is reversible;
- if schema rollback is unsafe, restore the pre-deploy DB dump into a fresh database and repoint the app;
- verify `/health` and smoke tests after rollback.

Infrastructure rollback:

- keep previous EBS snapshot;
- keep Elastic IP association stable;
- revert Cloudflare DNS record if needed;
- disable Cloudflare proxy temporarily if origin diagnostics require direct access.

---

## 19. Known limitations

This EC2 + Compose setup is **not** highly scalable by itself.

It is acceptable for:

- staging;
- MVP launch with controlled traffic;
- internal demos;
- early users.

It is not enough for:

- exam-season spikes;
- millions of concurrent users;
- no-downtime maintenance;
- multi-AZ failover;
- large media volumes.

Future scaling path:

```text
ECS Fargate or EKS
RDS PostgreSQL Multi-AZ
ElastiCache Redis
S3 + CloudFront for media
Secrets Manager injection
CloudWatch + X-Ray/OpenTelemetry
```

Media is currently stored in a Docker named volume on EC2. The repository has no S3 client. For durable large-scale storage, S3/CloudFront integration is required.

---

## 20. Go / no-go checklist

Production is **no-go** until all are true:

- [ ] Fix 02 gate decisions resolved or formal risk acceptance recorded
- [ ] staging deployed and smoke-tested
- [ ] Cloudflare real-client-IP fix implemented and tested
- [ ] Secrets Manager/SSM working for staging and production
- [ ] independent production keys generated and stored securely
- [ ] EBS snapshot and DB dump created
- [ ] restore rehearsal completed successfully
- [ ] monitoring and alerting active
- [ ] WAF/rate limits configured
- [ ] backups encrypted and off-host
- [ ] rollback tested
- [ ] production smoke tests pass
- [ ] no secrets or PII visible in logs/errors
- [ ] named grievance officer configured
- [ ] authorised person signs off production release

---

## 21. Current next step

Because AWS CLI is not installed locally and no cloud access has been configured, I can currently provide this runbook but cannot safely provision AWS or change Cloudflare DNS.

Next required input from you, outside chat:

1. AWS CLI configured locally with an appropriate profile, or AWS CloudShell access.
2. EC2 SSH/SSM access.
3. Cloudflare DNS access.
4. Real secret values stored in AWS Secrets Manager, not pasted into chat.
5. Explicit confirmation before any production deployment.
