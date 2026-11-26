---
name: testing
description: How to test this platform — Vitest unit/integration against a real MySQL-compatible DB, Playwright multi-device E2E for Till/Station flows, Stripe webhook fixtures, time control for pre-orders, and the mandatory business scenarios. Use when writing or running tests or before declaring a module done.
---

# Testing

## Layers
- **Unit (Vitest)**: pure functions — pricing, GST rounding, state table, station resolution, slot/releaseAt maths (include AEST↔AEDT change days), permission resolution.
- **Integration (Vitest + real DB)**: a dedicated TiDB Starter test instance or local `mysql:8` container; run migrations, truncate between tests; call actions/services directly with fake actors. No mocking of Prisma.
- **E2E (Playwright)**: separate browser contexts = separate devices (till, pizza station, kebab station, customer phone). Assert realtime by waiting for UI changes, not sleeps.

## Helpers
- `asActor(role|permissions)` → actor for direct service calls.
- `withClock(date)` → inject `now()` (all code reads time via `lib/time.ts`, never `new Date()` directly in services).
- `stripeEvent(type, payload)` → signed fixture using the test webhook secret.
- Factories for store, stations, menu (HSP with modifiers), inventory, customers.

## Mandatory scenarios
All scenarios in MASTER_PROMPT §18 (currently 20) are tests with the scenario number in the test name (`it('S9 station split …')`). A module is not done until its scenarios pass in CI.

## Concurrency tests
- Two devices mark the last two tickets Ready at once → READY once, one notification.
- Two tenders on the same order at once → no over-payment; COMPLETED exactly once.
- No code path (action, route, direct service call) can set COMPLETED without full payment.
- Two checkouts take the last slot capacity → one succeeds, one gets a clear "slot just filled" error.
- Same idempotency key submitted 3× in parallel → one order.
- Same Stripe event delivered twice in parallel → one payment row.

## CI
`typecheck → lint → unit → integration → e2e (smoke on PR, full nightly)`; fail on `.only`, on new `any` without a justification comment, and on Prisma schema drift (`prisma migrate diff`).
