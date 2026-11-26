---
name: caching-ratelimit
description: Cache tags and revalidation for menu/CMS/settings, what must never be cached, Upstash rate limiting, idempotency keys and free-tier budget awareness (TiDB RUs, Upstash commands, Resend, Ably). Use when adding a query to a public page, a new admin mutation, or a sensitive endpoint.
---

# Caching, rate limiting, budgets

## Cache tags (`src/lib/cache.ts`)
```ts
export const tags = {
  menu: 'menu', deals: 'deals', settings: 'settings', hours: 'hours', zones: 'zones',
  cms: (part: 'header' | 'footer' | 'home' | 'page' | 'blog') => `cms:${part}`,
  product: (slug: string) => `product:${slug}`,
};
```
- Cached reads: wrap the query function with the installed Next.js cache API and tag it. Mutation → `revalidateTag(tag)` for every tag it affects (product edit → `menu` + `product:slug`; 86 toggle → `menu`).
- Never cached: cart, checkout pricing, order/tracking data, staff screens, account pages, anything with a session.
- Deal/promotion active state is computed from `now()` at render inside the cached data's lifetime: give deal-dependent caches a short `cacheLife` (e.g. 60 s) so start/end times flip without a cron.

## Rate limiting (`src/lib/ratelimit.ts`)
```ts
const r = Redis.fromEnv();
export const limiters = {
  login:   new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'rl:login' }),
  pin:     new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(5, '1 m'),  prefix: 'rl:pin' }),
  checkout:new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:checkout' }),
  reset:   new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(3, '1 h'),  prefix: 'rl:reset' }),
  coupon:  new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:coupon' }),
  contact: new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(3, '10 m'), prefix: 'rl:contact' }),
};
export async function limit(name: keyof typeof limiters, key: string) {
  const { success, reset } = await limiters[name].limit(key);
  if (!success) throw new RateLimited(reset);
}
```
Keys combine IP (from the platform header) + identifier (email/device). Only sensitive endpoints — the free tier is a monthly command budget.

## Idempotency
- Order create: client sends `idempotencyKey` (UUID per attempt, kept until success) → unique column → on P2002 return existing order.
- Other create endpoints that charge or notify: generic `IdempotencyKey(key, scope, resultRef)` table.

## Budget guards (show on Admin → System health)
- TiDB: RU and storage usage (from TiDB Cloud API or console link), spending limit set? 
- Resend: emails sent today vs cap. Ably: messages this month. Upstash: commands this month.
- Rule of thumb: no client polling faster than 60 s; public pages served from cache; admin lists paginated (25/page).
