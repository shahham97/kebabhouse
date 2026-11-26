# Star Kebab — Product Requirements Document (PRD)

**Brand:** Star Kebab (`148 King Street, Newtown NSW 2042`)  
**Jurisdiction & Tax:** Australia (AUD, GST-inclusive 10% per ATO 1/11 rule, ABN `51 824 753 556`)  
**Positioning:** 100% Halal ironbark charcoal kebabs, Halal Snack Packs (HSP), stone-oven Turkish pide & pizza, charcoal grill plates — open late Fri–Sat until 2:00 am.  
**Version:** 1.0.0

---

## 1. Executive Summary

Star Kebab requires a unified, commission-free restaurant commerce and operations platform that replaces fragmented third-party ordering apps (Uber Eats / DoorDash 25–35% commissions) and disconnected counter tills. The platform serves four distinct personas from a single Next.js 15 + TiDB Cloud codebase:

1. **Hungry Customers** — fast mobile-first online ordering (Pickup & Delivery), live order tracking, loyalty points, and one-tap reordering.
2. **Counter / Till Staff** — rapid walk-in, phone, and dine-in POS order entry, 6-tab live operations board, split Cash/EFTPOS payments, cash drawer reconciliation, and 80 mm ATO-compliant tax invoices.
3. **Kitchen Station Chefs** — high-contrast dark-mode Kitchen Display System (KDS) routed per station (Kebab, HSP, Pizza/Pide, Grill, Fryer, Counter/Drinks) with giant touch targets and live age alerts.
4. **Owners & Managers** — real-time revenue & GST dashboards, dynamic RBAC roles, recipe-linked inventory & purchase orders, deals/coupons, website CMS, and immutable audit logs.

---

## 2. Australian QSR Competitive Benchmark

Legend: **[Confirmed]** = observed on public AU sites/apps · **[Inferred]** = standard industry pattern · **[Recommended]** = Star Kebab differentiator.

| Capability | Domino's AU | KFC AU | Star Kebab (Target) | Tag |
| --- | --- | --- | --- | --- |
| Pickup / Delivery toggle in header + postcode zone check | Yes (store finder + delivery fee) | Yes (Click & Collect / Delivery) | Yes — header fulfilment chip, AU postcode zone lookup, min-order & fee validation | **Confirmed** |
| Scheduled pre-orders with slot capacity caps | Yes (15-min windows) | Limited (same-day pickup) | Yes — 15-min slots, configurable `maxOrdersPerSlot`, auto-release to KDS by prep + travel lead time | **Confirmed** |
| Deep kebab / HSP modifier customiser (meat, 3 sauces, salads, extras) | Pizza half-n-half & crusts | Meal swaps & sides | Yes — required/optional modifier groups, min/max guards, price deltas, 86'd option locking | **Recommended** |
| Live order tracker with signed guest link (no login required) | Domino's Live Pizza Tracker | Order status screen | Yes — HMAC-signed `/order/[publicId]?t=...` with SSE + 10 s polling fallback | **Confirmed** |
| Multi-station KDS routing & auto-ready drinks | Make-line + cut-table screens | Fry / pack screens | Yes — data-driven stations (`variant -> product -> category -> store` fallback), `autoComplete` for Counter/Drinks | **Inferred** |
| Solo Mode (1-person late-night till + kitchen bump) | No (multi-staff stores) | No | Yes — toggleable Solo Mode lets counter staff bump station tickets inline from Till | **Recommended** |
| Dine-In table rounds (Round 2 add-on to open bill) | No | No | Yes — adds Round 2+ tickets only, reopens order to `IN_KITCHEN`, combines single tax invoice | **Recommended** |
| System-only auto-completion (no premature close) | N/A | N/A | Yes — `COMPLETED` fires strictly when fulfilled (`SERVED`/`COLLECTED`/`OUT_FOR_DELIVERY`) AND `PAID` | **Recommended** |
| Recipe-linked ingredient stock ledger & PO partial receipts | Enterprise ERP | Enterprise ERP | Yes — atomic `ORDER_RESERVE` / `ORDER_RELEASE` on `Decimal(12,3)` stock + multi-delivery PO receipts | **Recommended** |
| Dynamic RBAC + 4-digit Till PIN quick-switch | Franchise POS | Franchise POS | Yes — DB-backed roles, per-user grants, `sessionVersion` revocation, PIN lockout | **Inferred** |
| AU ATO 1/11 GST tax invoice + 5c Swedish cash rounding | Yes | Yes | Yes — integer cents, GST-free item ratio support, printable 80 mm receipt with ABN | **Confirmed** |
| Loyalty points + promo coupons (`STAR15`, `WELCOME5`) | Voucher codes | App rewards | Yes — append-only `LoyaltyTransaction` ledger (1 pt/$1, 100 pts = $5) + % and fixed coupons | **Confirmed** |

---

## 3. Functional Requirements by Module

### 3.1 Public Storefront (`(site)`)
- Editorial charcoal & cream storefront with Hero CTA (Order Pickup / Order Delivery), Active Deals carousel, Popular Categories grid, Crowd Best Sellers, Star Rewards promo band, 3-pillar Halal/Charcoal/Late-Night strip, delivery zones, and trading hours.
- Interactive `/menu` browser with sticky category pills, live search, dietary chips (`All Items`, `Best Sellers`, `100% Halal`, `Vegetarian`, `Spicy`), and `ProductCustomizerModal` enforcing variant selection and modifier min/max rules.
- Persistent `CartProvider` basket drawer with quantity steppers, item notes, and fulfilment persistence.
- CMS-managed header/footer navigation, top announcement bar, `/deals`, `/about`, `/contact`, and legal pages (`/legal/privacy`, `/legal/terms`).

### 3.2 Checkout, Payments & Live Tracker (`(checkout)`)
- Progressive 3-step checkout: Fulfilment & Timing (Pickup/Delivery, ASAP/Scheduled), Customer Details, and Payment (Stripe PaymentIntent / Test Card mode).
- Server-side pricing engine (`calculateOrderPricing`) recalculates all line totals, modifiers, coupons (`minSpendCents`, expiry, `maxUses`), delivery fees, card surcharges (basis points), and ATO 1/11 GST — client totals are never trusted.
- Idempotent order creation (`idempotencyKey`) and Stripe webhook confirmation (`confirmWebOrderPayment`) that reserves stock and fires station tickets exactly once.
- Signed guest live tracker (`/order/[publicId]?t=...`) with 4-stage visual progress, SSE updates, itemized tax invoice summary, and store contact info.

### 3.3 Customer Accounts & Loyalty (`(account)`)
- Email/password customer authentication with DB-backed `CustomerSession` and `sessionVersion`.
- Saved delivery addresses, favourite products, order history with tracker links, and live Star Rewards point balance.
- Loyalty points awarded idempotently upon system `COMPLETED` transition.

### 3.4 Till / POS & Live Operations Board (`(staff)/till`)
- Staff authentication via email/password or 4-digit PIN pad (with failed-attempt lockout).
- **Mode 1 — New Order POS:** Category tabs, product search, instant 86/Sold-Out toggle (`catalog.manage`), Dine-In (Table # + covers), Pickup, Delivery (postcode zone validation), Phone channel flag, Scheduled pre-orders, role-capped manual discounts (`maxDiscountPct`), and modifier configurator.
- **Mode 2 — 6-Tab Live Operations Board:**
  1. `Kitchen` — per-station status chips, Solo Mode inline bump buttons, `Mark All Ready` checklist modal (`bumpedFromTill = true`).
  2. `Ready` — fulfilment-specific handoff (`Mark Served`, `Mark Collected`, `Dispatch Driver` with driver name).
  3. `Served – Awaiting Payment` — open dine-in tables with `+ Add Round N` and `Take Payment`.
  4. `Out for Delivery` — active deliveries with COD payment collection.
  5. `Scheduled` — queued pre-orders with `Fire to Kitchen Now` override.
  6. `Order History` — completed/cancelled orders with expandable items, payments, status timeline, and printable 80 mm AU Tax Invoice.
- **Cash Drawer Management:** Open drawer with opening float, track live cash sales, close drawer with counted cash variance calculation.
- **Online Order Pause:** Pause/resume online ASAP ordering with custom storefront banner message while still allowing scheduled pre-orders.

### 3.5 Kitchen Display System (`(staff)/station/[code]`)
- Dark-mode KDS (`#120E0D` background) with station tabs (`All Stations` + each active station) and open ticket counters.
- All-Day item summary bar aggregating open quantities across tickets.
- Ticket cards with order number, fulfilment/table tag, `ROUND N` badge, age timer color coding (`<8m` herb, `8–14m` saffron, `>=15m` pulsing chilli), allergy/order notes highlight, and giant `>=56px` `PREPARING` and `READY` touch buttons.
- Recently Ready footer bar with one-tap `Recall` (`kitchen.recall`).

### 3.6 Admin Back-Office (`(admin)/admin/*`)
- **Dashboard (`/admin`):** Today's gross sales, order count, average ticket, GST collected, low-stock alerts, and live station load.
- **Catalogue (`/admin/catalog`):** CRUD for categories, products, variants, modifier groups/options, station overrides, and 86 toggles.
- **Kitchen Stations (`/admin/stations`):** Create, rename, color-code, reorder, and set `autoComplete` on stations.
- **Inventory & Recipes (`/admin/inventory`):** Manage ingredients (`Decimal(12,3)`), link `RecipeLine` rows to variants/modifiers, post manual stocktake/waste adjustments, and inspect append-only `InventoryTransaction` ledger.
- **Vendors & Purchasing (`/admin/purchasing`):** Supplier directory, Purchase Order creation, and multi-delivery partial Goods Receipts (`ORDERED -> PARTIALLY_RECEIVED -> RECEIVED`).
- **Deals & Coupons (`/admin/deals`):** Manage combo deals, percent/fixed coupons with min-spend & caps, and loyalty earn/redeem rules.
- **Customers (`/admin/customers`):** Customer directory, order counts, and loyalty balances.
- **Finance & Cash (`/admin/finance`):** Financial inflows/outflows ledger, expense logging, Z-report cash session history, and CSV export (`finance.export`).
- **Website CMS (`/admin/cms`):** Header/footer nav links, announcement bar, and custom pages.
- **Staff, Roles & Audit (`/admin/staff`, `/admin/roles`, `/admin/audit`):** Staff onboarding/PIN reset, dynamic role permission matrix (locked Super Admin), per-user grants, and immutable `AuditLog` viewer.
- **Store & Branding (`/admin/settings`):** Store metadata, ABN, GST rate, card/holiday surcharges, opening hours, delivery zones, time-slot rules, and receipt template.

---

## 4. Phased Roadmap

| Phase | Scope | Target Outcome |
| --- | --- | --- |
| **Phase 1 — Core Commerce & Ops (v1.0.0 — Delivered)** | Storefront, customiser, Stripe/demo checkout, live tracker, Till POS + 6-tab board, multi-station KDS, Solo Mode, dine-in rounds, recipe inventory + PO receipts, dynamic RBAC, AU GST tax invoices, cash drawer, admin suite, unit/integration/E2E tests. | Single-store Newtown launch ready; zero third-party commission on direct orders. |
| **Phase 2 — Retention & Dispatch Automation** | SMS notifications (Twilio/MessageMedia AU), Uber Direct / DoorDash Drive on-demand courier dispatch webhook, QR table self-ordering for dine-in, Apple Pay / Google Pay Express Checkout, automated scheduled-order cron release, loyalty redemption at checkout. | Higher repeat order rate, automated delivery fleet, faster dine-in table turns. |
| **Phase 3 — Multi-Store & Catering** | Multi-branch store switcher (Newtown, Parramatta, Bankstown), central commissary stock transfers, wholesale/corporate catering invoices (Net-14), Xero / MYOB automated daily GST journal sync, native thermal ESC/POS print bridge. | Franchise-ready Australian kebab group platform. |

---

## 5. Commercial Hosting Note: Vercel Hobby vs Pro

> **Important Commercial Compliance Notice:**  
> **Vercel Hobby** is strictly licensed for **non-commercial, personal projects only** (and enforces shorter serverless function timeouts, limited bandwidth, and no team seats).  
> Running Star Kebab in live commercial production **requires** either:
> - **Vercel Pro** (commercial license, higher serverless execution limits, team access, production analytics), **or**
> - **Self-hosted Node.js / Docker** (e.g., Railway, Fly.io Sydney `syd` region, or AWS Lightsail Sydney) which also keeps SSE connections long-lived in a single Sydney process with minimal latency to TiDB Cloud.

---

## 6. Open Business Decisions Checklist

- [ ] **Card Surcharge Policy:** Confirm whether online Stripe card surcharge (`cardSurchargeBps`, e.g., `150` = 1.50%) is passed to customers in compliance with RBA/ACCC cost-of-acceptance rules, or absorbed into menu prices (`0` bps).
- [ ] **Public Holiday Surcharge:** Confirm NSW public holiday surcharge percentage (`holidaySurchargeBps`, typically `1000`–`1500` bps) and menu disclosure text.
- [ ] **Delivery Fleet Model:** Confirm whether deliveries are fulfilled by in-house drivers (current driver-name dispatch) or integrated with Uber Direct in Phase 2.
- [ ] **Negative Stock Policy:** Decide between `warn` (allow orders during busy rush even if stock count drifts negative) vs `block` (hard-stop ordering when an ingredient reaches `0`).
- [ ] **Cash Rounding Display:** Confirm whether Till cash checkout auto-applies Australian 5c Swedish rounding (`roundCashAU`) on cash tenders and prints the rounding adjustment line on 80 mm receipts.
- [ ] **Halal Certification Badge:** Supply official Halal certifier registration number and PDF certificate link for `/about` and footer.
- [ ] **Production Email Domain:** Verify `starkebab.com.au` SPF/DKIM/DMARC records in Resend before enabling live order confirmation emails.
