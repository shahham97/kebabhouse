---
trigger: always_on
description: Security rules that apply to every change
---

# Security

- **Every** mutation goes through `defineAction({ permission, schema, rateLimit?, audit?, handler })`. Pages/layouts under `(staff)` call `requirePermission()` in the server component. Hiding a button is not authorization.
- Ownership checks on every resource read by id (orders, addresses, receipts, tickets): staff scope by permission + store; customers by session or signed tracking token. Return 404 (not 403) for resources the caller may not know exist.
- Never accept from the client: prices, totals, discounts beyond the caller's permitted limit, stock, roles, payment status, timestamps, `storeId` of another store, `createdBy`.
- Payment status changes only from verified Stripe webhooks (signature checked, event id stored unique).
- Secrets: only server-side env or encrypted `SecretSetting` (AES-256-GCM). Never log, return, or send them to the client. Mask in UI (`sk_live_…abcd`).
- Sessions: DB-backed, `HttpOnly; Secure; SameSite=Lax; __Host-` cookies; `sessionVersion` check; staff idle timeout.
- Rate limit login, PIN, reset, checkout, coupon, contact, Ably token (see MASTER_PROMPT §7.3).
- Realtime payloads contain ids/status only — no PII, no prices. Ably tokens are capability-scoped.
- Uploads: verify magic bytes, size cap, re-encode images, random names, no user SVG.
- Raw SQL only via tagged templates (`prisma.$queryRaw\`…\``) — never string concatenation.
- Errors to clients are generic + request id; details go to server logs (without PII/secrets).
- Keep CSP, HSTS and other security headers in `next.config` / proxy; adding a third-party script requires a CSP update and a DECISIONS entry.
- Audit log every staff mutation (who, what, before/after, ip, request id).
