---
trigger: glob
globs: prisma/**, src/**/service.ts, src/**/queries.ts, src/**/actions.ts, src/lib/db.ts
description: Database rules for TiDB Cloud Starter + Prisma
---

# Database (TiDB Cloud Starter, MySQL-compatible, via Prisma)

- Runtime client uses `@tidbcloud/prisma-adapter` (HTTPS) from `src/lib/db.ts` (single instance). Migrations use `DIRECT_DATABASE_URL` (TLS `mysql://`) — the adapter cannot run migrations.
- Pin Prisma and adapter versions per the adapter's compatibility table; upgrade them together.
- IDs: app-generated strings (cuid2/ULID). Do not rely on AUTO_INCREMENT order (TiDB allocates per node). Human order numbers come from `OrderCounter` inside the order transaction.
- Money `Int` (cents). Quantities `Decimal(12,3)`. Timestamps `DateTime(3)` in UTC.
- Index every FK and every column used in list filters/sorts. Add composite indexes matching real queries (e.g. `StationTicket(stationId, status, releaseAt)`, `Order(storeId, status, createdAt)`).
- Free tier is metered in Request Units: always `select` only needed columns, paginate (cursor for big tables), aggregate in SQL, cache read-heavy data with tags. No `findMany()` without `take`.
- Transactions: use `prisma.$transaction(async tx => …)` for multi-row business operations; keep them short; no network calls (Stripe, email, Ably) inside — do those after commit.
- Concurrency: state changes via conditional `updateMany({ where: { id, status: from } })` and check `count === 1`; otherwise throw `Conflict`.
- Idempotency through unique constraints (order idempotencyKey, StripeEvent.id, ledger source keys); catch the unique violation and return the existing record.
- Never hard-delete business records; no `onDelete: Cascade` on business data. Soft-disable fields where the spec allows.
- Migrations are reviewed SQL: expand → backfill → contract. Never drop/rename a column in the same release that stops writing it.
- Prefer real foreign keys (TiDB ≥ 6.6). If the cluster rejects them, switch to `relationMode = "prisma"` AND add `@@index` for every relation field — record the decision.
