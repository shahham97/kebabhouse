---
name: stripe-payments
description: Stripe integration for AUD payments — PaymentIntents from server totals, webhook verification and idempotent processing, refunds, payment links for phone orders, admin key settings and connection test. Use for checkout, payment, refund or Stripe settings work.
---

# Stripe payments

## Flow (web checkout)
1. `createCheckout` action: reprice server-side → create Order (`PENDING_PAYMENT`, idempotencyKey) → create PaymentIntent `{ amount: total, currency: 'aud', metadata: { orderId }, automatic_payment_methods: { enabled: true } }` with Stripe idempotency key = order id → return `client_secret`.
2. Until the webhook confirms payment the order is `PENDING_PAYMENT` and invisible to staff and kitchen. Client confirms with Payment Element. Redirect page shows "Confirming payment…" and subscribes to `order:{publicId}`.
3. Webhook `/api/stripe/webhook` (Node runtime, raw body):
```ts
const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);   // reject if invalid
try { await db.stripeEvent.create({ data: { id: event.id, type: event.type } }); }
catch (e) { if (isUniqueViolation(e)) return ok(); throw e; }                // already processed
await handle(event);                                                         // tx: Payment row, Payment row (CARD_ONLINE, brand+last4), PENDING_PAYMENT → PLACED (order now appears on board + kitchen), finance row, tryComplete
return ok();
```
Handle at least: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created` (flag). Verify amount/currency match the order before marking paid.

## Phone orders
"Send payment link": create a Checkout Session / Payment Link for the server total, send via email/SMS; paid only via webhook. Or pay on pickup/delivery (cash/EFTPOS recorded on Till).

## Refunds
`orders.refund` permission + reason → `stripe.refunds.create({ payment_intent, amount })` → the `charge.refunded` webhook writes Refund + finance + reversals. Till cash refunds post directly (audited).

## Settings
- Production: prefer `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` env vars. Admin screen may store them encrypted (`SecretSetting`, AES-256-GCM, `ENCRYPTION_KEY` env) when the owner wants self-service; show mode (test/live) and masked keys.
- "Test connection": server calls `stripe.balance.retrieve()` (or `accounts.retrieve`) and returns `{ ok, mode, accountName }` only.
- Key rotation: save new key → test → activate; keep previous for 24 h for in-flight webhooks.

## Never
Mark paid from the client/redirect. Trust client amounts. Log full card/PI objects with PII. Put Stripe calls inside a DB transaction.

## Tests
Use Stripe test mode + `stripe trigger` / signed fixture events: replayed event → no double processing; amount mismatch → not paid; refund reverses points.
