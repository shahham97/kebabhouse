# Star Kebab — Operational Runbook

This runbook covers day-2 incident response and routine operational procedures for the Star Kebab platform.

---

## 1. TiDB Cloud Starter Quota & RU Spike Mitigation

**Symptoms:** Slow page loads, Prisma connection timeouts, or TiDB Cloud dashboard alerts approaching Starter monthly Request Unit (RU) or 5 GiB storage limits.

**Immediate Actions:**
1. Inspect TiDB Cloud Console -> **Monitoring -> Request Units & Slow Queries**.
2. Verify no client tab is stuck in an SSE reconnect loop hitting `/api/realtime/stream` or triggering rapid `router.refresh()` calls.
3. Confirm `ABLY_API_KEY` is configured in multi-instance production so SSE fallback storms don't amplify DB reads.
4. Prune expired sessions and old notification logs if storage approaches 80%:
   ```sql
   DELETE FROM StaffSession WHERE expiresAt < NOW();
   DELETE FROM CustomerSession WHERE expiresAt < NOW();
   ```
5. **Upgrade Path:** If sustained daily order volume exceeds Starter RU limits, upgrade the cluster tier in TiDB Cloud Console (zero schema changes required; update `DATABASE_URL` only if endpoint changes).

---

## 2. Stripe Webhook Failure & Retry Procedure

**Symptoms:** Customer reports card was charged online, but order remains in `PENDING_PAYMENT` and did not appear on the Till/KDS.

**Diagnosis & Recovery:**
1. Open **Stripe Dashboard -> Developers -> Webhooks -> `/api/stripe/webhook`**.
2. Inspect the failed delivery HTTP status (`400` = signature mismatch / wrong `STRIPE_WEBHOOK_SECRET`; `500` = transient DB/runtime error).
3. If `STRIPE_WEBHOOK_SECRET` drifted, update the environment variable and redeploy.
4. Click **Resend** on the failed `payment_intent.succeeded` event in Stripe Dashboard.
5. **Why Retrying Is Safe:** `confirmWebOrderPayment` enforces idempotency via `Payment.idempotencyKey` (`stripe_pi_<id>`) and conditional `Order.updateMany({ where: { id, status: 'PENDING_PAYMENT' } })`. Replaying the webhook will never double-charge, double-deduct stock, or create duplicate kitchen tickets.

---

## 3. Transactional Email Cap Degradation

**Symptoms:** Order confirmation or Ready emails stop arriving (e.g., Resend free tier 100 emails/day or monthly cap reached).

**Impact Assessment:**
- `notifyOrder` (`src/lib/notify.ts`) is **non-blocking** and catches transport failures, logging them to `NotificationLog` without failing order creation, payment confirmation, or KDS transitions.
- Customers still see real-time status on `/order/[publicId]?t=...` immediately after checkout.

**Mitigation:**
1. Check `NotificationLog` table for `status = 'FAILED'` and error details.
2. Upgrade Resend plan or rotate `RESEND_API_KEY` to a higher-tier key.
3. Verify `starkebab.com.au` DNS (SPF/DKIM) remains verified in Resend.

---

## 4. Pausing Online ASAP Orders During Peak Rush

**When to Use:** Friday/Saturday late-night rush, equipment failure (charcoal pit/oven down), or short-staffed shift where walk-in queue exceeds 30+ minutes.

**Procedure (2 clicks from Till):**
1. Sign in to `/till` as Owner or Manager.
2. Click **Pause Online** in the top header bar.
3. Enter a clear customer-facing message (e.g., `"Charcoal grill at peak capacity — online ASAP orders paused for 25 mins. Schedule a later pickup or visit us at 148 King St!"`).
4. Click **Pause Online Now**.
5. **Behavior:** Public storefront immediately displays the pause banner and disables `ASAP` web checkout while still allowing customers to browse the menu and book `SCHEDULED` pre-orders. Walk-in Till and Phone orders remain unaffected.
6. When the kitchen clears, click **Online PAUSED** in the Till header to resume immediately.

---

## 5. Secret Rotation Procedure

Rotate secrets immediately if staff devices are lost, a key is exposed, or on a 90-day security cadence:

| Secret | Rotation Steps | Downtime / Impact |
| --- | --- | --- |
| `SESSION_SECRET` (HMAC signing for guest tracking links) | Generate new 32-byte hex secret (`openssl rand -hex 32`), update env var, redeploy. | Existing guest `?t=` links generated prior to rotation will require customer login or staff lookup; rotate off-hours (3:00 am AEST). |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Roll key in Stripe Dashboard (use 24-hour grace window for secret key), update env vars, redeploy, send test webhook. | Zero downtime when using Stripe's rolling key expiry. |
| `ABLY_API_KEY` | Create new key in Ably dashboard with `publish` + `subscribe` capabilities, update env var, redeploy, revoke old key. | Zero downtime (SSE fallback continues seamlessly). |
| `DATABASE_URL` / `DIRECT_DATABASE_URL` | Create a new SQL user or rotate password in TiDB Cloud Console, update both env vars, redeploy, drop old credentials. | Brief connection pool recycle on redeploy. |
| **Compromised Staff Account** | In `/admin/staff`, disable user or reset password/PIN. This increments `StaffUser.sessionVersion`, instantly invalidating all active sessions for that user. | Immediate revocation; no redeploy needed. |

---

## 6. Backups & Recovery

1. **TiDB Cloud Automated Backups:** Enable scheduled daily snapshots in TiDB Cloud Console (Starter/Serverless backup settings) with minimum 7-day retention.
2. **Logical Dump (Pre-Migration / Monthly Archive):**
   ```bash
   mysqldump --host=<tidb-host> --port=4000 --user=<user> --password \
     --ssl-ca=prisma/isrgrootx1.pem --single-transaction --set-gtid-purged=OFF \
     test > star-kebab-backup-$(date +%Y%m%d).sql
   ```
3. **Financial & Audit Exports:** Export monthly CSVs from `/admin/finance` (`finance.export`) for Australian BAS/GST lodgement and retain for 5 years per ATO record-keeping requirements.
4. **Restore Verification:** Test restoring a logical dump into a separate TiDB Cloud staging branch at least once per quarter and run `pnpm test` against the staging branch.
