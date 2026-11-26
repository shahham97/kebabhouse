---
trigger: glob
globs: src/app/**, src/modules/**/components/**, next.config.*, src/proxy.ts, src/middleware.ts
description: Next.js App Router and Vercel conventions
---

# Next.js & Vercel

- Server Components by default. Add `'use client'` only to the smallest interactive leaf.
- Routes stay thin: call a `queries.ts` function, render. Business logic lives in `service.ts`.
- Mutations: Server Actions via `defineAction`. Route Handlers only for webhooks, Ably token, push subscribe, signed internal jobs.
- Caching: read-heavy public data via the installed Next.js caching API (`'use cache'` + `cacheTag`/`cacheLife`, or `unstable_cache` on older versions) with tags from `src/lib/cache.ts`. Every admin mutation revalidates the tags it affects. Never cache carts, checkout, order status, staff screens, per-user data.
- Use `after()` (or the equivalent) for post-response work: notifications, realtime publish, analytics.
- Vercel Hobby limitations: no reliance on cron timing, no long-running work in a request, no WebSockets (use Ably). Time-based behaviour is computed at read time.
- Images: `next/image` with explicit `sizes`; `priority` only for the LCP image.
- Fonts: `next/font`, self-hosted, `display: swap`.
- Staff routes: `export const dynamic = 'force-dynamic'`, `robots: noindex`.
- Env: import only from `src/config/env.ts` (zod-validated). `NEXT_PUBLIC_` only for truly public values (Stripe publishable key, Ably key name is NOT public — use token auth).
- Each page has `loading.tsx` / Suspense fallbacks and an `error.tsx` boundary where data can fail.
