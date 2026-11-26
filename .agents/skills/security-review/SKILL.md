---
name: security-review
description: Checklist-driven security review of a change or module — authz/IDOR, input validation, secrets, sessions, rate limits, webhooks, uploads, headers, business-logic abuse (price/discount/stock/points tampering). Use before merging anything touching auth, payments, orders, permissions, uploads or settings, and at the hardening phase.
---

# Security review

Review the diff (or module) against each item and report PASS / FIX (with file:line) / N/A.

## Access control
- [ ] Every new action uses `defineAction` with the narrowest permission.
- [ ] Every page under `(staff)` calls `requirePermission`.
- [ ] Every by-id read/write checks ownership/store scope (try another user's id in a test).
- [ ] No permission escalation via role editor (grant only what you hold; can't edit own role; last Super Admin protected).

## Business logic abuse
- [ ] Totals, prices, discounts, delivery fee, GST recomputed server-side; client values ignored.
- [ ] Discount above staff limit rejected; coupon limits enforced in tx.
- [ ] Quantity bounds (1–50), modifier min/max enforced server-side.
- [ ] Slot capacity and opening hours re-validated server-side.
- [ ] Paid status only via verified webhook; amount/currency matched.
- [ ] Points/stock/ledger writes protected by unique keys.

## Input/output
- [ ] Zod on every input; strings length-capped; enums for statuses.
- [ ] No `dangerouslySetInnerHTML` except sanitised CMS rich text (allow-list sanitizer).
- [ ] Raw SQL only tagged templates.
- [ ] Errors don't leak internals.

## Sessions & secrets
- [ ] Cookies flags; sessionVersion bump on sensitive changes; logout-all works.
- [ ] No secret in client bundle (`grep` build output for `sk_`, `whsec_`, API keys).
- [ ] Encrypted secret settings; masked in UI; never in logs or audit `after` values.

## Platform
- [ ] Rate limits on login, PIN, reset, checkout, coupon, contact, Ably token.
- [ ] CSP/HSTS/headers intact; new third-party origins justified.
- [ ] Uploads: magic bytes, size, re-encode, no SVG.
- [ ] Webhooks: signature + replay safety; internal job endpoints: bearer secret + timestamp.
- [ ] `pnpm audit` clean or exceptions documented.

Output a short report artifact; FIX items block the merge.
