# MASTER PROMPT — PRODUCTION KEBAB & TAKEAWAY PLATFORM (AUSTRALIA)
### Website · Till/POS hub · Station kitchen screens · Admin · Inventory · Payments
### Stack: Next.js (App Router) on Vercel · TiDB Cloud Starter (MySQL-compatible) · Prisma · Stripe · Resend · Ably · Upstash

> Paste this whole file as the first message to the agent in Antigravity, in **Planning mode**.
> The `.agents/` folder that ships with this file contains the always-on rules, on-demand skills and slash-command workflows the agent must follow. `AGENTS.md` at the repo root is the index.

---

## 0. HOW YOU (THE AGENT) MUST WORK

1. **Do not write application code until Phase 2 is approved.** Phase 1 and 2 produce documents in `/docs`. Stop at each gate and wait for approval.
2. Work **module by module** (see §19). Each module ends with: passing tests, a walkthrough artifact, and an updated `docs/CHANGELOG.md`.
3. **Code economy is a hard requirement.** If something can be done correctly in 10 lines using the framework, a library already in the project, or the database, do not write 100. See `.agents/rules/10-code-economy.md`. Every new dependency needs a one-line justification in `docs/DECISIONS.md`.
4. When a fact about a library, limit or API matters (versions, free-tier quotas, config keys), **check the current official docs** (use the Context7 / web tools) instead of relying on memory. Record anything surprising in `docs/DECISIONS.md`.
5. Mark every feature you document as **Confirmed** (seen on a public site/app/doc), **Inferred** (industry-standard, not directly verified) or **Recommended** (our addition).
6. Never present a placeholder, mock or fake statistic as finished functionality. A button that does nothing is a bug.

---

## 1. THE BUSINESS

An Australian **kebab & takeaway shop** that sells several food lines from one kitchen:

| Line | Examples | Kitchen station |
|---|---|---|
| Kebabs & wraps | Lamb, chicken, mixed, falafel kebab; HSP wrap | **Kebab** |
| Snack packs | Halal Snack Pack (HSP) small/large, meat choice, up to 3 sauces, cheese | **Snack Pack** |
| Pizza | Traditional, gourmet, Turkish pide | **Pizza** |
| Grill | Burgers, skewers, chicken, plates | **Grill** |
| Entrées & sides | Chips, nuggets, dips, bread, salads | **Fryer/Entrées** |
| Drinks & packaged | Cans, bottles, desserts | **Counter** (no cooking; auto-ready) |

Stations are **data, not code** — the admin can add, rename, reorder and deactivate stations (e.g. add "Dessert" later). The table above is the seed data.

### Channels
- **Website** (customer self-service): delivery or pickup, **ASAP or pre-order**.
- **Till / POS** (staff): walk-in, **phone orders**, dine-in; ASAP or pre-order.
- **Admin/Manager** may also create orders.

### The operational core (the owner's own words, restated)
1. Every order — website, phone or walk-in — lands in **one Till hub**, showing the whole order (pizza + kebab + snack pack + entrées together).
2. The order is **split automatically by station**: pizza items go to the Pizza screen, kebab items to the Kebab screen, snack pack items to the Snack Pack screen, and so on.
3. Chefs mark their part **Preparing** then **Ready**; a Ready ticket disappears from that station's Kitchen tab. When **all** stations for that order are Ready, the order moves to the Till's **Ready** tab (sound + highlight) and the customer is notified.
   - **Dine-in:** sales rep places the order (table number) → kitchen → Ready → cashier marks **Served** → takes payment (cash/card) → order **completes automatically** on successful payment → it then appears only in **Order History** with full payment details.
   - **Pickup & delivery:** web customers pay first; the order appears on the same board (tagged PICKUP / DELIVERY) only after payment is confirmed → kitchen Preparing/Ready → cashier marks **Collected** / **Dispatched** → completes automatically (it is already paid; phone orders paying on collection/delivery complete when that payment is recorded).
4. **No forced station tapping when one person runs the shop.** The Till operator can open the order, see a checklist of every item grouped by station, double-check, and press **"Mark all ready"** once. Station tapping is optional, never mandatory.
5. **Pre-orders** for both delivery and pickup: "today at 7:30 pm" or "Saturday 12:00". Phone pre-orders are entered on the Till. Pre-orders stay in a **Scheduled** list and appear on station screens automatically at the right time.
6. Customers receive **notifications at every key step**: order received, confirmed/scheduled, being prepared, ready for pickup / out for delivery, completed, cancelled/refunded.

---

## 2. PLATFORM CONSTRAINTS (READ BEFORE DESIGNING ANYTHING)

The owner will use free tiers to start. Design for them, but make every limit a config value, not an assumption baked into code.

| Service | Free-tier facts that shape the design (verify current values) | Design consequence |
|---|---|---|
| **Vercel Hobby** | Hobby is for **personal, non-commercial use**. Cron jobs on Hobby run at most **once per day** with imprecise timing. Function duration is bounded; no persistent WebSockets. ~1M function invocations/month included. | Use Hobby for dev/staging. **Flag in the PRD that a live trading business must be on Vercel Pro (or another host) to comply with Vercel's terms.** Never depend on Vercel Cron for anything time-critical. No polling loops that burn invocations. |
| **TiDB Cloud Starter** | Free per instance (up to 5 per org): **5 GiB row storage, 5 GiB columnar storage, 50M Request Units (RUs)/month**. When the free row storage is exceeded on a free instance, **new connections are restricted** until you set a spending limit. Public-endpoint data transfer also consumes RUs. | Cache read-heavy data (menu, settings, CMS). Paginate everything. Never `SELECT *` large tables. Keep payloads small. Add a **RU/usage health card** to the admin dashboard and set a spending limit before launch. |
| **TiDB + Prisma** | Use `@tidbcloud/prisma-adapter` + `@tidbcloud/serverless` (HTTPS, no TCP pool exhaustion, edge-compatible). **Migrations do not run through the HTTP adapter** — run `prisma migrate` over the normal TLS `mysql://` connection from local/CI. TiDB ≥ 6.6 supports foreign keys; prefer real FKs, verify on the cluster version. | Two env vars: `DATABASE_URL` (runtime, adapter) and `DIRECT_DATABASE_URL` (migrations). Pin adapter/Prisma versions per the adapter's compatibility table. |
| **Ably (realtime)** | Free: **6M messages/month, 200 concurrent connections, 200 channels**. | Till + station screens + customer tracking pages subscribe to Ably. Server publishes tiny "something changed" events; clients refetch. |
| **Upstash Redis** | Free: **500K commands/month**, 256 MB. HTTP-based (works in serverless/edge). | Use **only** for rate limiting on sensitive endpoints and short-lived locks. Not for page caching (Next.js cache does that). |
| **Resend** | Free: **100 emails/day, 3,000/month**. | Send only high-value emails (confirmation, ready/out-for-delivery, cancellation/refund, auth). Status changes in between go via the live tracking page + Web Push. Show the daily email count on the dashboard; queue + degrade gracefully when the cap is hit. |
| **GitHub Actions** | Free scheduled workflows (minutes-based quota). | Use as the **free scheduler** for nightly jobs: backups/exports, end-of-day reports, cleanup of expired holds. Each job calls a signed internal endpoint. |

**Scheduling rule:** nothing in the order flow may depend on a cron firing on time. Time-based behaviour (pre-order release to kitchen, deal start/end, slot availability) must be **computed at read time** from timestamps (e.g. a station screen shows tickets `WHERE release_at <= now()`), so it is always correct even if no job runs.

---

## 3. TECHNOLOGY STACK

- **Next.js (latest stable, App Router)**, React, **TypeScript strict**. Server Components by default; Client Components only for interactivity. Server Actions for mutations from our own UI; Route Handlers only for webhooks, public APIs, and realtime token auth. In recent Next.js versions middleware has been renamed (`proxy.ts`) and caching uses Cache Components (`'use cache'`, `cacheTag`, `cacheLife`) — use whatever the installed version documents.
- **Tailwind CSS** + **shadcn/ui** (copy-in components; no heavy UI kit). **Motion** (Framer Motion) only for meaningful transitions; respect `prefers-reduced-motion`.
- **Zod** schemas shared by client forms and server actions (one schema per input, never two).
- **Prisma ORM** with the TiDB adapter. Prisma *is* the data-access layer — do not wrap it in a generic repository. Put business rules in domain services.
- **Auth:** a maintained library with **database sessions** and revocation (e.g. Better Auth or Auth.js) — pick one in Phase 2 and justify. Password hashing via the library (argon2id/scrypt). Staff **PIN quick-switch** on registered till devices.
- **Stripe** (Payment Element / Checkout, AUD, webhooks). **Resend** + **React Email** templates. **Ably** realtime. **Upstash** rate limiting. **Web Push** (VAPID, free) for opted-in customers and the till.
- **Images:** Vercel Blob or Cloudinary (free tier) for storage; transforms/thumbnails by the image service + `next/image`. Do not run heavy image processing inside a request.
- **Testing:** Vitest (unit/integration against a dedicated TiDB test instance or a local MySQL 8 container), Playwright (E2E, including multi-device till/station scenarios).
- **Observability:** structured server logs (pino-style JSON), Vercel logs, optional Sentry free tier. Request id on every log line.

---

## 4. ENGINEERING PRINCIPLES (NON-NEGOTIABLE)

Priority order for every decision: **Security → Data integrity → Performance → Functionality → Design → Maintainability.**

1. **Server is the source of truth** for prices, totals, discounts, stock, roles, payment status and timestamps. Client values are hints only.
2. **One mutation pattern.** Every server action goes through a single wrapper (`defineAction`) that does, in order: session → permission check → rate limit (if configured) → Zod validation → handler inside a DB transaction when needed → audit log → typed result `{ ok, data } | { ok:false, error }`. Writing auth checks by hand in each action is forbidden.
3. **One registry for modules/tabs.** A single `modules.ts` defines each admin tab: key, label, icon, route, required permission(s). Sidebar, route guards, permission editor and breadcrumbs are all generated from it. Adding a tab = adding one entry.
4. **Idempotency everywhere money, stock or points move:** unique keys in the database, not "check then insert" in code.
5. **Append-only ledgers** for inventory movements, loyalty points, payments/refunds and financial transactions. Balances are derived or updated in the same transaction as the ledger row.
6. **Snapshots** on orders: product name, variant, modifiers, unit price, tax code, station — copied at order time so history never depends on today's catalogue.
7. **No hard deletes** of business records (categories, products, variants, ingredients, orders, customers' orders, ledgers). Soft-disable where allowed.
8. **Money = integer cents** (`Int`, AUD). Quantities = `Decimal(12,3)`. Never JS floats for money; one `money.ts` helper for formatting (`en-AU`, AUD) and GST maths.
9. **Small files, clear names.** Target < 250 lines per file; split by responsibility, not by layer ceremony.
10. **Every list paginated** (cursor-based for large tables) and filtered on the server.

---

## 5. PHASE 1 — RESEARCH & PRD (deliverable: `docs/PRD.md`)

Research the public, customer-facing experience of **Domino's Australia**, **KFC Australia**, and 2–3 other Australian takeaway brands (e.g. Guzman y Gomez, Oporto, Pizza Hut AU, Menulog/Uber Eats store pages). Do **not** claim knowledge of their private back-office systems.

Already-known public features to verify and build on (Confirmed via public sources unless your research says otherwise):
- Domino's: **Live Pizza Tracker** (stage-by-stage order status) and **GPS Driver Tracker** (customer sees when the order leaves the store and its ETA); **On-Time Cooking** for pickup (start cooking based on customer arrival); quick re-order of saved favourites; app-exclusive coupons.
- KFC AU app: **order ahead and pick up when you like, with check-in on arrival**; delivery; promos and rewards; customisation (add bacon, extra mayo); quick reorder from the home screen.

Produce:
1. Feature comparison table (Domino's / KFC / others / **Ours**) with Confirmed/Inferred/Recommended tags.
2. Final functional requirements for every module in §8–§15.
3. The §16 "additional features" table with phase recommendations.
4. Open business questions for the owner (list them; do not guess silently). Seed list: card surcharge %, public-holiday surcharge, delivery radius/postcodes and fees, minimum order, opening hours incl. late night, pre-order max days ahead, slot capacity, GST registration, loyalty earn/burn rate, whether drivers are in-house, printer models (if any), whether SMS is wanted (paid).

**Gate 1:** stop and wait for approval.

---

## 6. PHASE 2 — ARCHITECTURE (deliverables in `/docs`)

`ARCHITECTURE.md`, `ERD.md` (Mermaid ER diagram), `prisma/schema.prisma` (draft), `API.md` (actions, route handlers, webhooks, realtime channels), `RBAC.md` (permission catalogue + default roles), `WORKFLOWS.md` (Mermaid state machines for order, station ticket, payment, purchase order, pre-order release), `DECISIONS.md` (ADRs), `THREATS.md` (short threat model).

**Gate 2:** stop and wait for approval.

### 6.1 Application shape
One Next.js app, route groups:
```
app/
  (site)/            public website: /, /menu, /menu/[slug], /deals, /about, /contact, /blog, /legal/*
  (account)/         /account, /account/orders, /account/orders/[id], /account/points, /account/addresses
  (checkout)/        /cart, /checkout, /order/[publicId] (live tracking, no login needed via signed link)
  (staff)/
    till/            the Till hub (POS + order board)
    station/[code]/  station kitchen screens (pizza, kebab, snack-pack, grill, fryer…)
    admin/           admin & manager portal (same UI, tabs filtered by permission)
  api/
    stripe/webhook   ably/token   push/subscribe   internal/jobs/[job] (signed, for GitHub Actions)
```
- Paths first (`/admin`, `/till`, `/station/pizza`). Optional subdomains (`admin.`, `till.`) via a host rewrite in the Next.js request proxy/middleware — a convenience, **never** a security boundary.
- Manager and admin share one portal; what they see is purely permission-driven.
- Staff routes are `noindex`, excluded from sitemap, and never statically cached.

### 6.2 Folder layout (keep it flat and obvious)
```
src/
  app/…                      routes only (thin: fetch + render)
  modules/<domain>/          actions.ts · queries.ts · service.ts · schema.ts · components/
  lib/                       db.ts · auth.ts · action.ts (defineAction) · rbac.ts · ratelimit.ts
                             cache.ts · realtime.ts · money.ts · time.ts (Australia/Sydney etc.)
                             notify/ (email.ts, push.ts, sms.ts, dispatch.ts) · audit.ts · errors.ts
  config/                    modules.ts (tab registry) · permissions.ts (catalogue) · env.ts (zod-validated)
emails/                      React Email templates
prisma/                      schema.prisma · migrations/ · seed.ts
tests/                       unit/ · integration/ · e2e/
```
Domains: auth, staff, rbac, customers, catalog (categories, products, variants, modifiers, stations), inventory, recipes, vendors, purchasing, orders, scheduling, till, kitchen (stations/tickets), deals, billing, payments, finance, loyalty, delivery, cms (header/footer/pages/blog), notifications, settings, analytics, audit.

---

## 7. CROSS-CUTTING CONCERNS

### 7.1 Authentication & sessions
- Separate identities: `Customer` (email mandatory, verified) and `StaffUser`. Separate cookies; a customer session can never reach staff routes.
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix, no domain attribute unless subdomains are used.
- **Database sessions** (revocable). Staff: absolute lifetime 12 h, idle timeout 30 min on admin, longer on registered till/station devices. Customers: 30-day rolling.
- `User.sessionVersion` — incremented on password change, role change, disable; any session with an older version is rejected on the next request. "Log out all devices" in admin.
- **Registered devices**: admin registers a till or station screen (device token stored hashed). Station screens run under a **device session** with only `kitchen.view` + `kitchen.prepare` for their own station — no personal login needed in a busy kitchen.
- **PIN quick-switch** on a registered till: staff switch with a 4–6 digit PIN (hashed, rate-limited, locks after 5 failures). Every order records the staff member who created/changed it.
- Password reset and staff invitations via single-use, hashed, expiring tokens (15–60 min).
- Optional TOTP 2FA for Super Admin (recommended before go-live).

### 7.2 Authorization — dynamic roles (admin-defined)
- **Permission catalogue lives in code** (`config/permissions.ts`), e.g. `orders.view`, `orders.create`, `orders.cancel`, `orders.refund`, `till.use`, `till.mark_all_ready`, `kitchen.view`, `kitchen.prepare` (Preparing/Ready), `orders.serve`, `orders.dispatch`, `payments.take`, `orders.history.view`, `catalog.manage`, `inventory.view`, `inventory.adjust`, `vendors.manage`, `purchasing.receive`, `deals.manage`, `billing.manage`, `finance.view`, `finance.export`, `staff.manage`, `roles.manage`, `settings.manage`, `payments.configure`, `cms.manage`, `reports.view`, `discounts.apply` (with max % limit), `audit.view`. Seeded into a `Permission` table on deploy.
- **Roles live in the database.** Admin creates roles (e.g. "Manager", "Counter Staff", "Kitchen Lead", "Delivery Driver"), names them, and ticks permissions in a matrix UI grouped by module/tab. Admin assigns one role per staff user (+ optional per-user extra grants).
- **Super Admin** is a locked system role: cannot be deleted, edited or assigned by non-super-admins; at least one active Super Admin must always exist.
- Guard rails: nobody can grant a permission they don't hold; nobody can edit their own role; permission changes increment `sessionVersion` of affected users and are audited.
- Checks happen **on the server** in `defineAction` and in page/layout loaders (`requirePermission`). UI hiding is cosmetic only.
- **Resource-level checks**: e.g. a counter staff with `orders.view_own` sees only orders they created; customers see only their own orders (by session or signed tracking token). Never trust an id from the URL without an ownership check (IDOR).

### 7.3 Rate limiting (Upstash, sliding window; keys = IP + identifier)
| Endpoint | Limit (configurable) |
|---|---|
| Staff login / customer login | 5 per 15 min per IP+email; progressive lockout |
| PIN switch | 5 per minute per device |
| Password reset / verification email | 3 per hour per email |
| Create order / checkout | 10 per minute per IP; 3 per minute per customer |
| Coupon validation | 10 per minute per IP |
| Contact form, newsletter | 3 per 10 min per IP |
| Ably token | 30 per minute per session |
| Stripe webhook | not rate-limited; signature-verified |
Return `429` with `Retry-After`. Do **not** rate-limit every page view (wastes the 500K/month command budget).

### 7.4 Caching (Next.js cache + tags; no Redis page cache)
- **Cache:** menu (categories, products, variants, modifiers, availability flags), deals list, CMS (header, footer, pages, blog), store settings, opening hours, delivery zones. Tag each (`menu`, `deals`, `cms:header`, `settings`…). Every admin mutation calls `revalidateTag` for what it changed — new products appear on the storefront immediately, with no redeploy.
- **Never cache:** carts, checkout totals, prices at checkout (recomputed fresh from DB), order status, anything per user, staff screens.
- Public pages: static/ISR where possible; product pages generated from cached data.
- Browser: immutable hashed assets; images via `next/image` with proper `sizes`.
- **"Out of stock / 86'd" toggles** must revalidate the `menu` tag instantly.

### 7.5 Idempotency & concurrency
- `Order.idempotencyKey` (unique) — the checkout/till form generates one UUID per submit attempt; a double-click or retry returns the same order.
- `StripeEvent.id` (unique) — webhook processed exactly once.
- `InventoryTransaction` unique on `(sourceType, sourceId, inventoryItemId, kind)` — stock for an order is reserved once, reversed once.
- `LoyaltyTransaction` unique on `(orderId, kind)`.
- State transitions use **conditional updates** (`UPDATE … WHERE id = ? AND status = ?`) and check the affected-row count — that is the lock; no read-modify-write races.
- Human-friendly order numbers: daily sequence per store from a counter row updated in the same transaction (`#A-0123`), plus an opaque `publicId` (ULID/cuid2) for URLs. Do not rely on AUTO_INCREMENT being sequential (TiDB allocates in batches per node); use app-generated string ids or `AUTO_RANDOM` for primary keys to avoid write hotspots.

### 7.6 Realtime (Ably)
- Channels: `store:{storeId}:till`, `store:{storeId}:station:{code}`, `order:{publicId}` (customer tracking), `store:{storeId}:admin`.
- Server publishes **after the DB transaction commits** (small helper `publishAfterCommit`). Payload = ids and status only — **no PII, no prices**.
- Clients refetch via a server query on message; plus a slow safety refetch (60 s) and refetch on reconnect/visibility change. That is the entire realtime design — keep it that small.
- Ably token endpoint issues **capability-scoped** tokens (a station device can only subscribe to its own station channel; a customer only to their `order:{publicId}`).
- Till and stations play a sound on new/ready tickets (user-enabled audio, volume setting) and keep the screen awake (Wake Lock API).

### 7.7 Audit log
Append-only `AuditLog(actorType, actorId, action, entity, entityId, before, after, ip, userAgent, requestId, at)`. Written by `defineAction` for every mutation flagged `audit: true` (default for staff actions). Covers logins (success/fail), staff/role/permission changes, price/product edits, stock adjustments, refunds, cancellations, manual discounts, settings and payment-config changes, "mark all ready" overrides.

### 7.8 Errors, validation, logging
- Typed domain errors (`NotFound`, `Forbidden`, `Conflict`, `ValidationError`, `RateLimited`) mapped centrally to user-safe messages. Never leak stack traces or SQL to clients.
- Every form shows field errors from the shared Zod schema and a toast for action errors; every async UI has loading and empty states.
- Env vars validated at boot with Zod (`config/env.ts`); the app refuses to start with missing secrets.

### 7.9 Security headers & app security
CSP with nonces (allow Stripe, Ably, image host only), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` (except where Stripe requires). Server Actions' built-in origin checks stay enabled; Route Handlers that mutate verify `Origin`. File uploads: type sniffing (not extension), size limits, re-encode images, random file names, no SVG uploads from users. Secrets (Stripe secret, webhook secret, Resend key) stored **encrypted** (AES-256-GCM, key from env, key id for rotation), shown masked, never returned to the browser. Dependency audit in CI.

---

## 8. CATALOGUE (categories, products, variants, modifiers, stations)

- **Category**: name, slug, description, image, sort order, display settings, `defaultStationId`. **Never deleted or disabled** (history), but can be hidden from navigation (`showInMenu`) — confirm with owner.
- **Product**: name, slug, description, images (multiple), category, tags (halal, vegetarian, vegan, gluten-free, spicy level), allergens list, `taxCode` (GST / GST-free), `stationId` override, visibility (website / till / both), active flag, sort. **Never deleted; can be disabled.**
- **Variant** (≥ 1, first is base): name (Small/Large, Regular/Double), price (cents), SKU, active flag, optional image, recipe, prep minutes, optional `stationId` override. **Never deleted; can be disabled.**
- **Modifier groups** (essential for kebabs/HSP/pizza): e.g. *Meat* (pick 1: lamb/chicken/mixed/falafel), *Sauces* (pick up to 3: garlic, chilli, BBQ, tomato, sweet chilli, yoghurt), *Salad* (multi: lettuce, tomato, onion, tabouli), *Extras* (+cheese $1.50, +meat $3), *Remove* (no onion). Group: min/max selections, required flag, sort. Option: name, price delta, default selected, active, optional **recipe impact** (e.g. +0.050 kg cheese) so stock stays accurate. Groups are attached to products/variants and reused across products.
- **Station resolution** (no hardcoding): `variant.stationId ?? product.stationId ?? category.defaultStationId ?? store.defaultStationId`. Resolved and **snapshotted on the order item** at order time.
- **"86" / sold-out toggle** per product/variant/modifier option from the Till (permission-gated), instantly reflected on the website.
- New active products appear on the storefront automatically (cache tag revalidation).

---

## 9. ORDERS, TILL HUB, STATIONS, PRE-ORDERS  ← the core of this business

### 9.1 Order model
`Order`: publicId, number, storeId, channel (`WEB`, `TILL`, `PHONE`, `ADMIN`), fulfilment (`DINE_IN`, `PICKUP`, `DELIVERY`), `tableNumber` (required for dine-in), `covers` (optional), timing (`ASAP`, `SCHEDULED`), `scheduledFor`, `releaseAt` (when it goes to the kitchen), `promisedAt`, customer snapshot (name, phone, email), delivery address snapshot, notes, totals (subtotal, discounts, delivery fee, surcharges, GST, total — cents), **`paymentStatus`** (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`) kept separate from **`status`**, `amountPaid`, `balanceDue` (derived from `Payment` rows), createdBy staff, servedBy/dispatchedBy, idempotencyKey, timestamps per milestone (`sentToKitchenAt`, `readyAt`, `servedAt`, `dispatchedAt`, `completedAt`).
`OrderItem`: snapshots (product, variant, modifiers JSON, unit price, tax code, station), quantity, line total, item notes, `ticketId`, `round` (1, 2, 3… for items added later to an open dine-in order).
`StationTicket`: orderId, stationId, round, status (`NEW`, `PREPARING`, `READY`), `releaseAt`, preparingAt, readyAt, preparedBy / readyBy (staff or device), `bumpedFromTill` flag.
`Payment`: orderId, method (`CASH`, `CARD_EFTPOS` — external terminal, `CARD_ONLINE` — Stripe, `OTHER` e.g. voucher/points), amount, tendered + change (cash), terminal reference / card brand + last4 (from Stripe), Stripe PaymentIntent id, status (`SUCCEEDED`, `FAILED`, `REFUNDED`), takenBy staff, cashSessionId, at. Split payments = several rows.

### 9.2 One operations board, three fulfilment flows
Dine-in, pickup and delivery orders all live on the **same staff board** (`/till`), each card tagged with a coloured chip: **DINE-IN · Table 5**, **PICKUP**, **DELIVERY** (plus channel icon: web / phone / walk-in, and ⏰ for pre-orders). The kitchen process is identical for all three; only the cashier's last step differs.

| Step | DINE-IN (pay after eating) | PICKUP | DELIVERY |
|---|---|---|---|
| 1. Order placed | Sales rep places it on the Till (table number required). **No payment yet.** Goes straight to the kitchen. | Website: customer pays online first; the order appears on the board **only after Stripe confirms payment** (webhook). Phone/walk-in: rep places it, payment now or on collection. | Website: paid online first, appears only after Stripe confirmation. Phone: rep places it, prepaid (card/payment link) or cash on delivery. |
| 2. Kitchen tab (auto-listed) | Appears instantly on the relevant station(s) — no one has to send it manually. | Same (ASAP immediately; pre-orders at their `releaseAt`). | Same. |
| 3. Chef | Taps **Preparing** → then **Ready**. (Can tap Ready directly.) | Same | Same |
| 4. Kitchen tab | When a station marks its ticket **Ready**, the ticket **disappears from that station's Kitchen tab**. When **all** stations are Ready, the order moves to the **Ready** tab (chime + highlight on the Till). | Same | Same |
| 5. Cashier, Ready tab | **Mark served** → order moves to **Served – awaiting payment**. | **Mark collected** (handed over). If unpaid, the collect dialog takes payment first. | **Dispatch** (optional driver name; delivery ETA shown to customer). If cash on delivery, it waits in **Out for delivery – payment due**. |
| 6. Payment | Cashier taps **Take payment** → Cash (tendered, change shown) / Card (EFTPOS terminal ref) / split. | Already paid online, or taken at collection. | Already paid online, or driver's cash recorded when back. |
| 7. Completed (automatic) | Becomes **Completed automatically** the moment payment succeeds and the balance is $0. | Completes automatically on collection when fully paid. | Completes automatically on dispatch when already fully paid; otherwise when the cash-on-delivery payment is recorded. |
| 8. Order History tab | Completed orders leave every live tab and appear **only** in Order History. | Same | Same |

**The completion rule (hard requirement):** `COMPLETED` is **never a button**. One function, `tryComplete(tx, orderId)`, runs after every payment success (Stripe webhook, cash or EFTPOS recorded) and after every served/collected/dispatched action. It sets `COMPLETED` only when **(fulfilment step done) AND (paymentStatus = PAID, balanceDue = 0)**, using a conditional update so it happens exactly once. A failed or cancelled card payment leaves the order where it was with a clear "Payment failed — try again" state.

### 9.3 Order status machine (single source: `orders/state.ts`, a transition table, not if/else chains)
```
Web pickup/delivery:  PENDING_PAYMENT ──(Stripe webhook succeeded)──▶ PLACED
Till / phone / dine-in:                                              PLACED
PLACED ──▶ SCHEDULED (pre-order, releaseAt in future) ──(releaseAt reached, computed at read time)──▶ IN_KITCHEN
PLACED ──▶ IN_KITCHEN (ASAP; auto-accept configurable, else Till accepts web orders)
IN_KITCHEN ──(first ticket Preparing)──▶ PREPARING ──(all tickets Ready)──▶ READY
READY ──▶ SERVED            (dine-in, cashier)          ──(paid in full)──▶ COMPLETED
READY ──▶ COLLECTED         (pickup, cashier; pay if unpaid) ──(paid in full)──▶ COMPLETED
READY ──▶ OUT_FOR_DELIVERY  (delivery, cashier "Dispatch")   ──(paid in full)──▶ COMPLETED
Any state before COMPLETED ──▶ CANCELLED (permission + reason; releases stock; voids/refunds payments)
COMPLETED ──▶ PARTIALLY_REFUNDED / REFUNDED (permission + reason)
Dine-in "add items" (round 2…): SERVED/READY ──▶ IN_KITCHEN for the new round's tickets only; earlier items stay done.
```
`PENDING_PAYMENT` orders are **invisible** on the staff board and kitchen (they appear only after payment is confirmed); abandoned ones are cancelled by the cleanup job and their stock reservation released. Each transition: allowed permission, side effects (stock reserve/release, loyalty, notifications, realtime publish) inside one transaction with a conditional update; every transition writes `OrderStatusHistory` (from, to, actor, at) — this is the timeline shown in Order History.

### 9.4 Station routing, Kitchen tab & Ready tab (automatic, no manual sorting)
1. When the order enters **IN_KITCHEN**, group items by snapshotted station → one `StationTicket` per station (per round). Counter-only items (cans) get a ticket that is auto-`READY` (per-station `autoComplete`).
2. **Kitchen tab** query (per station, plus an "All stations" view for shops with one kitchen screen): `tickets WHERE stationId = ? AND status IN (NEW, PREPARING) AND releaseAt <= now() ORDER BY promisedAt` — new orders are listed automatically; pre-orders surface by themselves at the right time; Ready tickets drop off.
3. Chef buttons on each ticket: **Preparing** and **Ready** — two big buttons (≥ 56 px, high contrast, no hover-only UI). Optional per-item tick-off inside a ticket.
4. Marking a ticket Ready checks, in the same transaction, whether every ticket of the order is Ready → order becomes **READY** → it appears in the **Ready** tab → realtime to Till + customer → notification ("Your order #123 is ready for pickup" / "is on its way" at dispatch).
5. **Till "Mark all ready"** (permission `till.mark_all_ready`): checklist of every item grouped by station, pre-filled from station progress; operator double-checks and confirms once → remaining tickets Ready (`bumpedFromTill = true`, audited) → order READY. Also per-station "mark this station ready" from the Till.
6. **Solo mode** (store setting): station screens optional; tickets still created for reporting; the Till shows a compact "make list" with Preparing/Ready buttons. Switching modes needs no code change.
7. **Board tabs on `/till`:** **Kitchen** (in progress, with per-station chips "Pizza ✓ · Kebab ⏳ · HSP ✓") · **Ready** · **Served – awaiting payment** (dine-in) · **Out for delivery** · **Scheduled** · **Order History**. Filters by tag (Dine-in / Pickup / Delivery), search by number, table, name or phone. Ready cards flash and chime until actioned; age timers turn amber/red.
8. Recall/undo: a station can recall a Ready ticket within N minutes (mistaken tap), which moves the order back out of the Ready tab — audited.
9. Printing (phase 1): browser print of an 80 mm kitchen ticket/receipt via print CSS; phase 2: network thermal printers (ESC/POS via a local print bridge or cloud-print-capable printers) — research and recommend, do not build in phase 1.

### 9.5 Payments at the Till & Order History tab
- **Take payment** dialog: shows balance due; methods **Cash** (amount tendered → change calculated, rounding to 5c for cash if the owner enables it), **Card** (EFTPOS terminal — staff enters/confirms the approved amount and terminal reference; phase 2: integrated terminal such as Stripe Terminal), **Split** (any mix until balance is $0), optional tip. Each tender creates a `Payment` row inside a transaction that also updates `amountPaid`/`paymentStatus` and calls `tryComplete`. Idempotency key per tender (double-tap safe).
- Online card payments (`CARD_ONLINE`) are recorded only from the Stripe webhook.
- Receipt: print / email / no receipt, using the receipt template (§12).
- **Order History tab** (permission `orders.history.view`; cashiers see their shift, managers see all): only `COMPLETED`, `CANCELLED` and refunded orders, never live ones. Each order shows: number, tag (dine-in + table / pickup / delivery), channel, customer, items with variants, modifiers and notes, discounts, delivery fee, surcharges, GST, total; **payments** (method — Cash / Card EFTPOS / Card online — amount, tendered and change for cash, card brand + last4 or terminal reference, Stripe id link, time, staff); refunds; full status timeline with who did what and when (placed, preparing, ready per station, served/collected/dispatched, paid, completed); actions: reprint/email receipt, refund (permission), reorder. Filters: date range, method, tag, staff, table, amount; CSV/XLSX export; daily totals by payment method feed the end-of-day (Z) report and cash-drawer reconciliation.

### 9.6 Pre-orders & scheduling (web and phone)
- Customer/till chooses **ASAP** or **Schedule**: date + time slot (default 15-min slots) within opening hours, up to `maxDaysAhead` (default 7), not earlier than `now + minLeadTime` (default 30 min pickup, 45 min delivery).
- **Slot capacity** (max orders and/or max items per slot, per fulfilment type) prevents overload; full slots are disabled in the picker. Capacity check happens in the order transaction (re-validated server-side).
- `releaseAt = scheduledFor − prepLeadTime` where prepLeadTime = max prep minutes across items (from variants) + delivery travel buffer for delivery (from zone). Admin can override per order.
- Till has a **Scheduled** tab (today / tomorrow / later) with search; staff can edit the time, fire early ("Send to kitchen now"), or cancel.
- Stock is **reserved when the order is placed** (so you can't promise what you don't have) and the reservation is released on cancellation.
- Store closures/holidays calendar blocks slots; "pause online ordering" switch on the Till (busy night) with a message and auto-resume time.
- Notifications: scheduled confirmation at placement, reminder when the order is released to kitchen (optional), ready/out-for-delivery as normal.

### 9.7 Till / POS (`/till`)
- Touch-first, works on tablet/desktop/phone; category tabs + search + favourites grid; product → variant → modifier sheet with live price; cart with qty, item notes, remove; customer lookup by phone/email (create on the fly); fulfilment and ASAP/Schedule picker; discounts only within the staff member's permission limit (reason required); split order notes.
- **Phone order mode**: customer name + phone mandatory, email optional (needed for email notifications; offer SMS/web link instead), payment: **pay on pickup/delivery**, **cash**, **EFTPOS (external terminal, record only)**, or **send Stripe payment link** (paid status set only by webhook).
- Tender screen: cash with change calculation, card (external terminal reference), split tender, receipt (print/email).
- Cash drawer session: open float, cash in/out, close with counted cash → variance report (end-of-day/Z report).
- Multiple staff on multiple devices simultaneously; each order records who created it; staff see others' orders only if permitted.
- Offline tolerance (phase 2): queue the current order locally if the network drops and submit with the same idempotency key on reconnect; show a clear offline banner. Phase 1: block submit when offline with a clear message.

### 9.8 Kitchen screens (`/station/[code]`)
Ticket cards: order number, fulfilment icon, channel, **time since release / time to promised time** (amber/red thresholds configurable), items for this station only with variant + modifiers ("Large HSP — Lamb — Garlic, Chilli, BBQ — +Cheese"), item and order notes, allergy flags in red. "All-day" summary view (e.g. *6× Large HSP, 4× Lamb kebab*). Optional "other stations" mini-strip so staff know what else belongs to the order.

---

## 10. INVENTORY, RECIPES, VENDORS, PURCHASING

Keep the original requirements, implemented as ledgers:
- **InventoryItem**: name, code, description, base unit (kg, g, L, ml, piece, unit, packet, box, lb, oz), on-hand (derived/maintained with ledger), reserved, min threshold, cost per unit (cents, Decimal for sub-cent if needed), preferred vendor, notes. **Never deleted; no disable in phase 1; editable.** Unit change only through an audited conversion that rewrites recipes and posts a conversion ledger entry.
- **Recipe lines** per variant (and per modifier option): inventory item + quantity in the item's base unit (UI shows the unit; cannot pick another).
- **InventoryTransaction** (append-only): kind (`PURCHASE_RECEIPT`, `ORDER_RESERVE`, `ORDER_RELEASE`, `ORDER_CONSUME` if you separate reserve/consume, `ADJUSTMENT`, `WASTE`, `COUNT`, `UNIT_CONVERSION`), quantity ±, unit cost, source (type+id), actor, reason, at. Unique constraint for idempotency (§7.5).
- Deduct/reserve when the order is **PLACED** (paid web order confirmed, or Till/phone/dine-in order submitted); reverse on cancellation; no second deduction at completion.
- Low-stock and out-of-stock alerts on the dashboard and Till; optional auto-86 of products whose required ingredient is out.
- **Vendors**: business details, ABN, contacts, address, notes, purchase history, outstanding balance.
- **Purchase orders**: draft → ordered → partially received → received → closed; stock increases **only on receipt** (per line, partial allowed); supplier invoice reference; vendor payments (cash outflow) linked to POs.
- **Stocktake** (count sheet → variance posted as `COUNT` adjustments) and **waste log** (reason codes) — phase 1, they are small and save real money.

---

## 11. DEALS, COUPONS, LOYALTY

- **Deals/combos**: bundle of (product, variant, qty, allowed modifier rules, or "choose any from category X") with deal price, schedule (start/end, days of week, time window for happy-hour/lunch), channels (web/till), active flag, image, T&Cs. Validation blocks deals that reference disabled variants. Active deals shown under the homepage hero and on `/deals`. Activation is computed from timestamps (no cron).
- **Coupons** (phase 1, small): code, % or fixed, min spend, first-order only, per-customer limit, total uses, expiry. Validated server-side.
- **Loyalty**: configurable earn rule (e.g. 1 point per $1 of paid subtotal) and redemption (e.g. 100 points = $5). Points awarded when the order is **paid and completed**, in a ledger (unique per order+kind); reversed on refund. Customers see balance and history. Points are never awarded twice (webhook retries, repeated events).

---

## 12. PAYMENTS (Stripe), BILLING/RECEIPTS, FINANCE

- **Stripe**: Payment Element or Checkout in AUD; PaymentIntent created server-side from the **server-computed** total; `metadata.orderId`. Paid status set **only** by verified webhook (`payment_intent.succeeded`, `charge.refunded`, etc.), processed idempotently via `StripeEvent`. Success-page redirect only shows "confirming…" and waits for the webhook state (realtime).
- Admin **Payment settings**: publishable key, secret key, webhook secret, test/live mode — stored encrypted, masked, rotatable; "Test connection" calls a harmless Stripe endpoint server-side and reports OK/fail without echoing secrets. Prefer env vars for secrets in production; the DB-stored option is for owner convenience — document the trade-off.
- Refunds (full/partial) from admin with permission + reason → Stripe refund → webhook → ledger, stock and points reversals as configured.
- **Surcharges**: card surcharge and public-holiday surcharge are **configurable, disclosed before payment, shown as separate lines**. Card surcharges must not exceed the cost of acceptance and surcharging rules are under regulatory review in Australia — leave defaults at 0% and flag for owner/accountant decision.
- **Receipts / tax invoices**: editable template (logo, name, ABN, address, contacts, header/footer text, custom message, payment details), live preview, versioned (orders keep the template version used). For a GST-registered business a tax invoice for a sale under $1,000 must show: that it is a tax invoice, seller identity, seller ABN, date, items with quantity and price, GST amount (or "Total price includes GST"); sales of $1,000 or more also need the buyer's identity or ABN; a tax invoice must be provided within 28 days on request for sales over $82.50 incl. GST. GST in AU prices is inclusive (GST = taxable amount ÷ 11, rounded per ATO rules) — implement in `money.ts`, make rate and tax codes configurable, and require accountant sign-off before launch.
- **Finance**: inflows (online payments, till cash/card, other income) and outflows (vendor payments, expenses by category) as `FinancialTransaction` rows traceable to their source; daily/weekly/monthly/custom summaries; payment-method breakdown; refunds; cash drawer variances; CSV/XLSX export. Unpaid orders are never revenue.

---

## 13. NOTIFICATIONS

One dispatcher: `notify(event, order)` → resolves the customer's channels and templates → sends → writes `NotificationLog` (unique per order+event+channel so retries never double-send). Sending happens **after commit**, out of the request's critical path (`after()` / waitUntil); failures are logged and retried by the nightly job, never block the order.

| Event | Email | Web Push | SMS (optional, paid) | Live page |
|---|---|---|---|---|
| Order received / scheduled confirmation | ✔ | ✔ | ✔ | ✔ |
| Payment confirmed | (merged into confirmation) | | | ✔ |
| In kitchen | | ✔ | | ✔ |
| Ready for pickup | ✔ | ✔ | ✔ | ✔ |
| Out for delivery | ✔ | ✔ | ✔ | ✔ |
| Completed | | | | ✔ |
| Cancelled / refunded | ✔ | ✔ | ✔ | ✔ |
| Auth (verify, reset), staff invite | ✔ | | | |

- Every confirmation contains the **live tracking link** `/order/{publicId}?t={signedToken}` — works for guests and phone customers.
- Respect the Resend free cap: count sends per day; when near the cap, skip non-critical emails and rely on push/live page; dashboard warning.
- SMS provider behind an interface (e.g. an Australian-friendly provider); disabled by default.
- Staff notifications: Till chime + optional web push for "new web order", "order ready", "slot overload", "low stock".
- Marketing emails (later) must follow the Australian Spam Act (consent, sender ID, unsubscribe) — keep marketing separate from transactional.

---

## 14. PUBLIC WEBSITE

### 14.1 Pages
Home · Menu (category tabs, search, filters: halal/veg/spicy) · Product (images, variants, modifier groups, live price, add to cart) · Deals · About · Contact & Hours (map, opening hours incl. late night, phone) · Blog · Cart · Checkout · Order tracking · Account (orders, reorder, points, addresses, favourites) · Login/Register/Reset · Privacy · Terms · Refund & cancellation policy · 404/500.

### 14.2 Ordering journey (Domino's/KFC-grade)
1. First interaction asks **Delivery or Pickup** + **ASAP or Schedule**; delivery asks address/postcode → zone check (fee, minimum, ETA) with a clear "we don't deliver there, try pickup" fallback. Stored in a cookie; changeable any time from the header chip ("Pickup · ASAP · Change").
2. Store status banner: open / closed (show next opening and allow pre-order) / paused / busy (longer ETA).
3. Floating basket (item count + subtotal) with satisfying add-to-cart feedback (fly-to-cart or bump; reduced-motion aware). Upsell row ("Add garlic bread? Cans 2 for $5") from admin-configured cross-sells.
4. Checkout: contact (email mandatory), address (with saved addresses), time slot, notes, coupon, loyalty redemption, tip (optional, configurable), payment. Server reprices everything and shows any differences before charging.
5. Tracking page: stage timeline (Received → Preparing → Ready/Out for delivery → Done), per-station progress hidden from customers (they see one stage), ETA, store phone, "add to calendar" for pre-orders.
6. Reorder in one tap from account; favourites saved.

### 14.3 Dynamic header & footer (CMS-driven, cached)
Admin edits: logo, announcement bar (text, link, colours, schedule), main nav items (label, link, order, visibility), CTA button, footer columns and links, contact block, opening hours (from settings), social links, payment badges, legal links, ABN line. Stored in DB, cached with tags, revalidated on save. Same for homepage sections (hero slides, featured categories, best-sellers source, testimonials, loyalty promo) as an ordered list of typed blocks — no page builder, just a few well-designed block types.

### 14.4 Design system & theme (original brand — never copy Domino's/KFC assets)
Direction: **"charcoal grill & saffron"** — warm, appetising, premium street-food. Defaults (all exposed as CSS variables and editable in Settings → Branding; contrast checked to WCAG AA):

| Token | Hex | Use | Contrast check |
|---|---|---|---|
| `--char` | `#1C1412` | dark surfaces, text on light | 17:1 on cream |
| `--cream` | `#FFF7EC` | page background | — |
| `--ember` | `#C8401E` | primary buttons, prices | white text 5.0:1 ✔ |
| `--saffron` | `#F4A62A` | highlights, badges, deal ribbons | char text 8.9:1 ✔ |
| `--herb` | `#2F7D4A` | fresh/veg tags, success, "Ready" | white text 5.1:1 ✔ |
| `--chilli` | `#B42318` | errors, spicy, allergy flags | on cream 6.2:1 ✔ |
| `--smoke` | `#6B5E55` | secondary text | on cream 5.9:1 ✔ |

- Type: a characterful display face for headings (e.g. a condensed grotesk) + a highly legible sans for body/UI (self-hosted via `next/font`, `display: swap`). Prices in tabular numerals.
- Food photography first: large, warm, consistent angle; skeleton placeholders with blur; subtle 3D/parallax only on the hero and only on capable devices.
- Staff UIs (Till/Stations/Admin) use the same tokens in a calmer, denser layout; **dark mode** for kitchen screens (glare, grease, night shifts).
- Accessibility: keyboard navigable, visible focus, labels, `aria-live` for cart and order status, 44 px min touch targets (56 px in kitchen).

### 14.5 SEO & performance
Metadata per page, Open Graph images, `Restaurant`/`Menu`/`LocalBusiness` JSON-LD, sitemap/robots (staff routes excluded), canonical URLs. Budgets: LCP < 2.5 s on 4G mid-range phone, CLS < 0.1, INP < 200 ms, JS per public route < 150 KB gz. Lighthouse ≥ 90 on Home/Menu/Product.

---

## 15. ADMIN PORTAL (`/admin`) — tabs are generated from `modules.ts`

Dashboard · Orders (live board) · Order History · Till board (link) · Kitchen stations (config + live view) · Scheduled orders · Catalogue (Categories, Products, Variants, Modifier groups) · Inventory · Recipes · Stocktake & Waste · Vendors · Purchasing · Deals & Coupons · Customers · Loyalty · Billing/Receipts · Finance · Payments (Stripe) · Notifications (templates, logs, quotas) · Delivery zones & fees · Opening hours, slots & closures · Website (header, footer, homepage blocks, pages, blog) · Staff · Roles & permissions · Devices · Audit log · Settings (business, ABN, GST, currency AUD, timezone, branding/theme, store modes) · System health (TiDB RU/storage, email quota, Ably usage, error rate).

**Dashboard** (live DB aggregates, date-range filter, no fake numbers): orders today/total by status, revenue today/week/month (paid only), AOV, orders by channel and fulfilment, hourly heatmap, best sellers, most profitable (where recipe costs exist), food-cost %, inventory value, low/out-of-stock, pending POs, cash in/out, average **station times** (release → done) per station, pre-orders upcoming, staff sales. Charts: bar, line, doughnut, progress rings. Heavy aggregates cached 60 s and computed with SQL `GROUP BY`, never in JS loops over all rows. Exports CSV/XLSX.

**One generic `DataTable`** (server pagination, sort, filters, search, column visibility, CSV export) and **one form pattern** (shadcn form + shared Zod schema + `defineAction`) reused by every module. A new simple CRUD tab should be ~100 lines total.

---

## 16. ADDITIONAL FEATURES — RECOMMENDATION TABLE (finalise in PRD)

| Feature | Phase |
|---|---|
| Station KDS, Till "mark all ready", solo mode, pre-orders, slot capacity, pause ordering, 86 toggle | **1 (core)** |
| Modifier groups with recipe impact, allergens/halal tags | **1** |
| Coupons, quick reorder, favourites, upsell/cross-sell | **1** |
| Cash drawer open/close, end-of-day Z report, refunds | **1** |
| Stocktake, waste log, low-stock alerts, recipe cost & margin | **1** |
| Sales by staff / channel / category / station times | **1** |
| Web Push notifications | **1** |
| SMS notifications | 2 (paid, owner decision) |
| Delivery driver assignment, driver view, delivery status | 2 |
| Live driver GPS tracking | 3 |
| Thermal printer integration | 2 |
| QR table ordering / dine-in table management | 2 |
| Gift cards | 3 |
| Customer feedback/ratings after completion | 2 |
| Abandoned cart, segmentation, retention analytics | 3 |
| Shifts/attendance (clock-in with PIN) | 2 |
| Purchase forecasting, stock expiry/batches, transfers | 3 |
| Multi-location (all tables already carry `storeId`) | 3 |
| Third-party delivery aggregators (Uber Eats/Menulog/DoorDash) ingestion | 3 (research APIs/partnership terms) |

For each: what it does, why, launch-essential?, phase, DB/architecture impact.

---

## 17. DATA MODEL (minimum — refine in Phase 2)

Every business table has `id` (string, app-generated), `storeId` where relevant, `createdAt`, `updatedAt`; indexes on every FK and on every column used in a `WHERE`/`ORDER BY` of a listed query.

Store · StoreSetting · OpeningHours · Closure · TimeSlotRule · DeliveryZone (postcodes and/or radius, fee, min order, ETA) ·
StaffUser · Role · Permission · RolePermission · UserPermissionGrant · Session · Device · StaffPin · Invitation · PasswordReset ·
Customer · CustomerAddress · CustomerFavourite · PushSubscription ·
Station · Category · Product · ProductImage · Variant · ModifierGroup · ModifierOption · ProductModifierGroup · RecipeLine (variant or modifierOption → inventoryItem, qty) · CrossSell ·
InventoryItem · InventoryTransaction · StockCount · StockCountLine · WasteEntry ·
Vendor · PurchaseOrder · PurchaseOrderLine · GoodsReceipt · GoodsReceiptLine · VendorPayment ·
Order · OrderItem · OrderItemModifier (snapshot) · OrderStatusHistory · StationTicket · OrderCounter ·
Deal · DealItem · Coupon · CouponRedemption ·
Payment · Refund · StripeEvent · CashSession · CashMovement ·
LoyaltyAccount · LoyaltyTransaction · LoyaltyRule ·
ReceiptTemplate (versioned) · Receipt ·
Expense · ExpenseCategory · FinancialTransaction ·
CmsHeader · CmsFooter · CmsNavItem · CmsHomeBlock · CmsPage · BlogPost · Announcement ·
NotificationTemplate · NotificationLog · EmailQuotaDay ·
SecretSetting (encrypted) · AuditLog · IdempotencyKey (generic, for non-order endpoints)

Integrity rules (enforce in DB where possible): unique slugs, unique SKU per store, unique `(orderId, stationId)` on StationTicket, ledger uniqueness (§7.5), `CHECK` constraints for non-negative prices/quantities where TiDB supports them (else in service + tests). Use `Decimal(12,3)` for quantities, `Int` cents for money, `DateTime(3)` UTC in DB, display in the store timezone (`Australia/Sydney` default, configurable — remember AEST/AEDT switch for slots).

---

## 18. TESTING — MUST PASS BEFORE "DONE"

Unit: pricing (variants + modifiers + deals + coupons + surcharges + GST rounding), state machine transitions, station resolution, slot capacity, releaseAt computation across DST changes, permission checks.
Integration (real DB): every scenario below. E2E (Playwright, multiple browser contexts = multiple devices).

1. **Product creation** → category, product, base variant → visible on storefront without redeploy → add variant later → delete impossible, disable works.
2. **Ingredient deduction** → flour 50 kg, recipe 0.250 kg → order 2 → on PLACED stock 49.5 kg, one ledger row per ingredient → replay same event → no second deduction.
3. **Cancellation** → reversal row, stock restored exactly.
4. **Vendor purchase** → PO 20 kg flour → partial receipt 12 kg then 8 kg → stock +20 kg only on receipts.
5. **Multiple staff** → three counter staff on three devices create orders concurrently → all recorded with correct creator; each sees only what their role allows.
6. **Stripe** → test keys, test connection, web order paid → signed webhook marks paid exactly once (replay webhook → no change) → confirmation email once → points awarded once → refund reverses points.
7. **Historical order** → disable product → old order still shows original name/variant/price.
8. **Permissions** → custom role "Counter Staff" (till only) cannot load `/admin/finance` page or call finance actions directly (403 on server); permission change takes effect on next request.
9. **Station split** → order with pizza + kebab + HSP + can → 3 tickets auto-listed on 3 Kitchen tabs, can auto-Ready → Preparing/Ready taps update Till chips → each Ready ticket leaves its Kitchen tab → last Ready moves the order to the Ready tab → Till chimes, customer notified once.
10. **Solo operator** → no station taps → Till "Mark all ready" with checklist → READY, audited, tickets flagged `bumpedFromTill`.
11. **Pre-order (web, pickup)** → schedule tomorrow 19:30 → appears in Scheduled, not on stations → at releaseAt (simulate clock) appears on stations → ready flow as normal.
12. **Phone pre-order (delivery)** on Till, pay on delivery → confirmation via email/link → slot capacity respected (N+1th order in full slot rejected server-side even if UI was stale).
13. **Idempotency** → double-click "Place order" / retry with same key → one order, one charge.
14. **Rate limit** → 6th login attempt in window → 429; PIN lockout after 5 failures.
15. **Closed/paused store** → ASAP disabled, pre-order allowed, pause auto-resumes.
16. **Dine-in full cycle** → rep places order for Table 5 (unpaid) → auto-listed in Kitchen → chef Preparing → Ready → leaves Kitchen tab, shows in Ready tab → cashier Served → shows in "Served – awaiting payment" → cashier takes $20 cash for an $18.50 bill (change $1.50) → order **auto-COMPLETED** → visible only in Order History with method CASH, tendered, change, staff and timeline.
17. **Completion only on payment** → a served dine-in order cannot be completed by any button or direct action call (server rejects); a failed card attempt leaves it awaiting payment; a split payment (card $10 + cash rest) completes only when the balance hits $0, exactly once even if two tenders are submitted at the same moment.
18. **Web pickup & delivery** → unpaid web order (PENDING_PAYMENT) is **not** visible on the board or Kitchen; Stripe webhook success → appears tagged PICKUP / DELIVERY → Preparing → Ready → cashier Collected / Dispatched → auto-COMPLETED (already paid) → Order History shows CARD_ONLINE with card brand/last4 and Stripe id.
19. **Phone delivery, cash on delivery** → Dispatched → stays in "Out for delivery – payment due" → driver cash recorded → auto-COMPLETED.
20. **Dine-in add items** → second round added to Table 5 → only new tickets go to the kitchen → bill shows both rounds → one payment completes the order.

---

## 19. DELIVERY PHASES & GATES

1. Research & PRD → **Gate 1**
2. Architecture, ERD, schema draft, RBAC matrix, workflows, threat model → **Gate 2**
3. Foundation: repo, strict TS, lint/format, env validation, Prisma+TiDB (adapter runtime + direct migrations), auth + sessions + devices + PIN, RBAC + `modules.ts` + `defineAction`, rate limiting, audit, error handling, logging, CI (typecheck, lint, test, `prisma migrate diff` check), seed data (stations, permissions, demo menu clearly marked as seed) → demo login + permission matrix
4. Catalogue + modifiers + stations + CMS header/footer
5. Orders core: pricing service, state machine, Till POS, station screens, realtime, Till readiness, solo mode
6. Scheduling & pre-orders, opening hours, slots, delivery zones, pause/86
7. Inventory, recipes, purchasing, stocktake/waste
8. Public website + checkout + Stripe + tracking + accounts + loyalty
9. Notifications (email, push), receipts/tax invoices, finance, cash sessions, dashboard
10. Hardening: security review (`/security-review` workflow), load test of Till/station flow, accessibility, Lighthouse, backup/restore drill
11. Deployment (production project, domains, Stripe live, Resend domain DNS (SPF/DKIM/DMARC), TiDB spending limit, GitHub Actions jobs, runbook)

Do not expose a partially implemented system to customers. Use a feature flag / "coming soon" gate on the public site until launch.

---

## 20. OPERATIONS, BACKUPS, RUNBOOK

- TiDB Cloud built-in backups (verify retention for Starter) **plus** a nightly GitHub Actions job that exports critical tables (orders, ledgers, customers, catalogue) to encrypted storage; monthly restore drill into a scratch instance.
- Migrations: expand → migrate data → contract; never destructive in one step; run from CI with `DIRECT_DATABASE_URL`.
- Environments: local, preview (separate TiDB instance), production. Never point previews at production data.
- Runbook in `docs/RUNBOOK.md`: Stripe webhook failures, email quota hit, TiDB quota hit, Ably down (clients fall back to 15 s polling automatically while disconnected), how to pause ordering, how to rotate secrets, how to restore.

---

## 21. DEFINITION OF DONE (per module and for the project)

- Typecheck, lint, unit + integration + relevant E2E tests green in CI.
- Every visible button works; every table is real data; loading/empty/error states exist; forms validate on client and server with the same schema.
- Permissions enforced server-side and covered by a test; audit entries written.
- No N+1 queries (log query count in dev for heavy pages); lists paginated; caching tags correct.
- Docs updated: `CHANGELOG.md`, `DECISIONS.md`, API/RBAC docs, admin user guide section.
- Final deliverables: application, schema + migrations, ERD, API docs, RBAC matrix, admin guide (with screenshots), staff quick-start (Till & Stations, one page each), deployment & backup docs, runbook, test suite.

**Start now with Phase 1. Produce `docs/PRD.md` and stop at Gate 1.**
