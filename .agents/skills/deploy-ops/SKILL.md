---
name: deploy-ops
description: Environments, Vercel + TiDB + Stripe + Resend + Ably + Upstash setup, migrations in CI, GitHub Actions scheduled jobs (free cron), backups/restore, secrets rotation and the runbook. Use for deployment, environment variables, scheduled jobs, backups or production incidents.
---

# Deploy & operations

## Environments
local → preview (own TiDB instance, Stripe test, Resend test domain) → production. Preview deployments must never use production DB or live Stripe keys.

## Env vars (validated in `config/env.ts`)
`DATABASE_URL` (adapter, runtime) · `DIRECT_DATABASE_URL` (migrations only) · `AUTH_SECRET` · `ENCRYPTION_KEY` (+ `ENCRYPTION_KEY_ID`) · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` · `RESEND_API_KEY` · `EMAIL_FROM` · `ABLY_API_KEY` · `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` · `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `INTERNAL_JOB_SECRET` · `APP_URL` · `BLOB_*`/`CLOUDINARY_*`.

## Hosting note (tell the owner)
Vercel Hobby is for personal, non-commercial use. Develop and stage on Hobby; move the production project to **Vercel Pro** (or an alternative host) before taking real orders.

## Migrations
CI job on `main`: `prisma migrate deploy` with `DIRECT_DATABASE_URL` **before** promoting the deployment. Expand/contract only.

## Scheduled jobs (GitHub Actions = free cron)
`.github/workflows/jobs.yml` with `schedule:` entries calling `POST {APP_URL}/api/internal/jobs/{job}` with `Authorization: Bearer $INTERNAL_JOB_SECRET` (constant-time compare, also check a timestamp header to prevent replay):
- `nightly-backup` (export critical tables → encrypted artifact/storage)
- `reconcile-inventory` (ledger SUM vs onHand, report drift)
- `retry-notifications`
- `end-of-day-report` (email owner)
- `cleanup` (expired sessions, reset tokens, abandoned `PENDING_PAYMENT` > 2 h → cancel + release stock)
Jobs must be idempotent and safe to run late or twice. Nothing customer-facing depends on them running on time.

## Go-live checklist
TiDB spending limit set · backups verified + restore drill done · Stripe live keys + live webhook endpoint · Resend domain verified (SPF/DKIM/DMARC) · Ably/Upstash production keys · security headers checked · Super Admin 2FA on · seed/demo data removed · legal pages reviewed (privacy incl. Australian Privacy Principles, refunds, terms) · GST/receipt template signed off by accountant · staff trained with the quick-start sheets.

## Runbook entries
Webhook failing → check endpoint secret, replay from Stripe dashboard (idempotent). Email cap hit → status emails auto-skipped; consider upgrading. TiDB quota hit → raise spending limit; check slow/expensive queries. Ably down → clients auto-fallback to polling. Busy night → Till "Pause online orders" with auto-resume.
