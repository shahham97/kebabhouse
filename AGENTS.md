# AGENTS.md — project index for AI agents

Production platform for an Australian kebab & takeaway shop: public ordering website, Till/POS hub, station kitchen screens, admin portal.
Full requirements: `MASTER_PROMPT.md` (source of truth). Decisions: `docs/DECISIONS.md`.

## Stack
Next.js (App Router, TS strict) on Vercel · TiDB Cloud Starter via Prisma + `@tidbcloud/prisma-adapter` · Better Auth/Auth.js (DB sessions) · Stripe · Resend + React Email · Ably · Upstash Ratelimit · Tailwind + shadcn/ui · Zod · Vitest · Playwright.

## Commands (keep in sync with package.json)
- `pnpm dev` — local dev
- `pnpm typecheck && pnpm lint && pnpm test` — must pass before any commit
- `pnpm test:e2e` — Playwright
- `pnpm db:migrate` — `prisma migrate dev` using `DIRECT_DATABASE_URL` (never the adapter URL)
- `pnpm db:seed` — stations, permissions, Super Admin, sample menu (marked as seed)

## Where things live
- `src/config/modules.ts` — admin tab registry (one entry per tab). `src/config/permissions.ts` — permission catalogue.
- `src/lib/action.ts` — `defineAction` (auth → permission → rate limit → zod → tx → audit). ALL mutations use it.
- `src/modules/<domain>/` — `schema.ts`, `actions.ts`, `queries.ts`, `service.ts`, `components/`.
- `src/modules/orders/state.ts` — order transition table. `src/modules/kitchen/` — station tickets.

## Always
- Read the matching skill in `.agents/skills/` before working in its area.
- Server decides prices, totals, stock, status, permissions. Money in integer cents.
- No hard deletes of business records. Ledgers are append-only. Idempotency via DB unique keys.
- Smallest correct change. Reuse before you write. Ask before adding a dependency.
- Stop at the gates defined in MASTER_PROMPT §19.

## Never
- Commit secrets or `.env*` files. Expose secrets to the client. Trust client totals.
- Use Vercel Cron for time-critical logic. Poll the DB in a loop from the browser.
- Mark an order paid from a redirect. Write auth checks by hand inside actions.
