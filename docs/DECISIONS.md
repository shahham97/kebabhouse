# Star Kebab — Architecture Decision Records (ADRs)

This document records the key architectural decisions made for the Star Kebab platform, their rationale, and trade-offs.

---

## ADR-001: Prisma 6 + TiDB Cloud Starter with Pinned TLS (`isrgrootx1.pem`)

- **Status:** Accepted
- **Context:** Star Kebab needs a managed, MySQL-compatible relational database with strong ACID transactions for orders, payments, and stock ledgers, while keeping infrastructure costs low during single-store launch. TiDB Cloud Starter enforces strict TLS 1.2+ using Let's Encrypt ISRG Root X1.
- **Decision:** Use Prisma 6 (`provider = "mysql"`) connected to TiDB Cloud Starter with `DATABASE_URL` and `DIRECT_DATABASE_URL`, pinning the Let's Encrypt root certificate at `prisma/isrgrootx1.pem` (`sslaccept=strict&sslcert=./isrgrootx1.pem`).
- **Consequences:**
  - Full ACID transactions (`db.$transaction`) for multi-table order creation, stock reservation, and payment recording.
  - Zero TLS handshake failures on Windows dev machines and Linux/Vercel serverless runtimes.
  - Schema uses MySQL-native `Decimal(12, 3)` for ingredient weights and `DateTime(3)` for millisecond-precision audit timestamps.

---

## ADR-002: Integer AUD Cents + ATO 1/11 GST-Inclusive Math

- **Status:** Accepted
- **Context:** Floating-point arithmetic (`0.1 + 0.2 !== 0.3`) causes penny discrepancies on receipts, split payments, and BAS/GST reporting. Under Australian Taxation Office (ATO) rules, consumer-facing menu prices must be GST-inclusive, where the GST component is `1/11` of the GST-taxable total (`round(taxable * 10 / 110)`), and cash tenders are rounded to the nearest 5 cents (Swedish rounding).
- **Decision:** Store and compute all monetary values as integer AUD cents (`*Cents` columns). Centralize formatting and tax helpers in `src/lib/money.ts` (`formatAUD`, `calcInclusiveGst`, `applyBps`, `roundCashAU`) and run all order pricing exclusively server-side in `calculateOrderPricing`.
- **Consequences:**
  - Exact cent-for-cent reconciliation across Order totals, Payments, Refunds, Cash Sessions, and Financial Transactions.
  - Supports mixed baskets containing `GST_FREE` items (e.g., certain plain water/staples) by prorating discounts across the taxable subtotal ratio.
  - Eliminates client-side price tampering.

---

## ADR-003: Database-Backed Sessions with `sessionVersion` Revocation

- **Status:** Accepted
- **Context:** Stateless JWTs cannot be revoked immediately when a counter staff member leaves mid-shift, a shared Till tablet is lost, or a manager restricts a role's permissions.
- **Decision:** Store SHA-256 hashed opaque tokens in `StaffSession` and `CustomerSession` tables (HTTP-only cookies `sk_staff_session` and `sk_cust_session`). Each session records the user's `sessionVersion` at login. `getStaffActor` and `getCustomerActor` (memoized per request with React `cache()`) reject any session where `!user.active`, `expiresAt < now`, or `user.sessionVersion !== session.sessionVersion`.
- **Consequences:**
  - Instant global logout on role change, deactivation, password/PIN reset, or security incident by incrementing `sessionVersion`.
  - Slightly higher DB read frequency (1 indexed lookup by `tokenHash` per request), mitigated by React per-request `cache()` and covering unique index on `tokenHash`.

---

## ADR-004: System-Only Order Completion (`tryCompleteOrder`)

- **Status:** Accepted
- **Context:** In busy kebab shops, dine-in customers eat before paying at the counter, while online pickup customers pay before collecting. Allowing staff to manually click "Complete" causes unpaid dine-in tables to be closed prematurely or uncollected prepaid orders to vanish from the pass.
- **Decision:** Make `COMPLETED` strictly `'system'`-only in `ORDER_TRANSITIONS` (`src/modules/orders/state.ts`). Both `handoffReadyOrder` and `recordTillPayment` invoke `tryCompleteOrder(tx, orderId)` inside their transaction. `tryCompleteOrder` executes a single atomic conditional update:
  ```ts
  tx.order.updateMany({
    where: { id: orderId, status: FULFILLED_STATUS[fulfilment], paymentStatus: 'PAID' },
    data: { status: 'COMPLETED', completedAt: now },
  });
  ```
  Only when `count === 1` does it write the `COMPLETED` history entry and award loyalty points.
- **Consequences:**
  - Impossible for any staff member to accidentally close an unpaid dine-in order or an uncollected pickup order.
  - Concurrency-safe: simultaneous payment and handoff cannot double-complete or double-award loyalty points.

---

## ADR-005: Append-Only Inventory & Loyalty Ledgers

- **Status:** Accepted
- **Context:** Overwriting mutable `onHand` or `balance` counters without a ledger makes stock shrinkage, cancelled-order reversals, and loyalty disputes impossible to audit, and risks double-deduction on webhook/network retries.
- **Decision:**
  - Every stock change writes an immutable `InventoryTransaction` row with `@@unique([sourceType, sourceId, inventoryItemId, kind])` before adjusting `InventoryItem.onHand` inside the same transaction. Duplicate retries hit `P2002` and become safe no-ops.
  - Cancellation (`releaseStockForOrder`) reads the exact original `ORDER_RESERVE` ledger rows rather than recomputing from potentially edited recipes.
  - Loyalty earns/redemptions write immutable `LoyaltyTransaction` rows with unique constraints per `(loyaltyAccountId, orderId, kind)`.
- **Consequences:**
  - Full forensic auditability of every gram of lamb doner and every Star Rewards point.
  - Idempotent retries across web checkout, Stripe webhooks, and Till order placement.

---

## ADR-006: Hybrid SSE + Ably ID-Only Realtime Fanout

- **Status:** Accepted
- **Context:** Live Till boards, KDS screens, and guest order trackers need sub-second updates without exposing customer PII or prices over pub/sub channels, and must work both in local/single-node deployments (zero external keys required) and multi-instance serverless production.
- **Decision:** Implement `publishRealtime` (`src/lib/realtime.ts`) to emit minimal ID-only payloads (`{ orderId, ticketId, status, stationCode }`) to both an in-process `EventEmitter` (backing `/api/realtime/stream` SSE) and, when `ABLY_API_KEY` is configured, the Ably REST API. Clients react to events by calling `router.refresh()` (fetching authoritative authorized data from Server Components) with a 30 s safety fallback timer.
- **Consequences:**
  - Zero PII leakage over realtime channels.
  - Works out-of-the-box locally with zero third-party setup, and scales horizontally across serverless instances when Ably is enabled.
