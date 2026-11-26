# Changelog

All notable changes to the **Star Kebab** platform are documented in this file.

## [1.0.0] — Initial Production Release

### Storefront & Customer Experience
- Editorial charcoal & cream storefront (`/`, `/menu`, `/deals`, `/about`, `/contact`, `/legal/*`) tailored for Australian kebab & takeaway trade (100% Halal, ironbark charcoal, Newtown NSW).
- Interactive menu browser with sticky category tabs, search, dietary chips, and `ProductCustomizerModal` enforcing variant selection and modifier min/max rules.
- Progressive 3-step `/checkout` with AU postcode delivery zone validation, ASAP & 15-minute scheduled slot capacity checks, coupon codes (`STAR15`, `WELCOME5`), server-side pricing, and ATO 1/11 GST-inclusive calculation.
- HMAC-signed live guest order tracker (`/order/[publicId]?t=...`) with SSE updates and itemized GST tax invoice summary.
- Customer accounts (`/login`, `/account`) with saved addresses, favourites, order history, and Star Rewards loyalty ledger.

### Till POS & Kitchen Operations
- Staff authentication (`/staff-login`) supporting both email/password and 4-digit quick-switch PIN pad with lockout protection and `sessionVersion` revocation.
- Full-screen Till POS (`/till`) with New Order builder (Dine-In tables/covers, Pickup, Delivery, Phone, Scheduled, 86 toggles, role-capped discounts) and 6-tab Live Operations Board (`Kitchen`, `Ready`, `Served – Awaiting Payment`, `Out for Delivery`, `Scheduled`, `Order History`).
- Multi-station dark-mode KDS (`/station/[code]`) with data-driven station routing (`variant -> product -> category -> store`), auto-ready Counter/Drinks station, All-Day summary bar, age timers, giant touch buttons, and Recall bar.
- Solo Mode toggle for single-operator late-night shifts and `Mark All Ready` Till checklist (`bumpedFromTill`).
- Dine-In Round 2+ ordering (fires new round tickets only, reopens order to `IN_KITCHEN`, combines bill).
- Cash, EFTPOS, and Split payment recording with atomic balance guards, cash drawer float/variance reconciliation, and printable 80 mm AU Tax Invoices.
- System-only auto-completion (`tryCompleteOrder`) guaranteeing orders complete strictly when both fulfilled and paid in full.

### Inventory, Purchasing & Back-Office Admin
- Append-only `InventoryTransaction` ledger with `Decimal(12, 3)` precision, idempotent `ORDER_RESERVE` on placement, and exact `ORDER_RELEASE` reversal on cancellation.
- Vendor directory, Purchase Orders, and multi-delivery partial Goods Receipts (`ORDERED -> PARTIALLY_RECEIVED -> RECEIVED`).
- Dynamic RBAC (`PERMISSIONS`, `ADMIN_MODULES`, locked Super Admin, custom roles, per-user grants) and immutable `AuditLog`.
- Admin back-office modules for Dashboard, Catalogue, Stations, Inventory, Purchasing, Deals & Coupons, Customers, Finance & Cash, CMS, Staff, Roles, Audit Log, and Store Settings.

### Quality Assurance & Documentation
- Unit test suite (`tests/unit/pricing-and-state.test.ts`) covering AU money/GST math, server-side pricing engine, order state machine guards, and station routing fallback.
- Real TiDB Cloud integration test suite (`tests/integration/order-lifecycle.test.ts`) covering stock reservation/cancellation, partial PO receipts, multi-station KDS sync, Solo Mode, idempotency, Dine-In cash/split auto-completion, Web Pickup payment flow, and Dine-In Round 2.
- Playwright E2E suite (`tests/e2e/star-kebab.spec.ts`) covering Storefront checkout, Till Dine-In + KDS + Auto-Complete + Order History, and Admin RBAC enforcement.
- Complete documentation suite (`docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/RUNBOOK.md`, `docs/CHANGELOG.md`).
