---
name: storefront-design
description: Public website UX and visual design — ordering journey (delivery/pickup, ASAP/schedule), menu, product customisation, floating basket, checkout, tracking page, CMS-driven header/footer/home blocks, theme tokens, motion and Core Web Vitals. Use for any customer-facing page or component.
---

# Storefront design

## Brand direction
"Charcoal grill & saffron": warm, appetising, premium street food. Original identity — study Domino's/KFC for *flow*, never copy assets, copy or layouts.
Tokens: `--char #1C1412`, `--cream #FFF7EC`, `--ember #C8401E` (primary, white text AA), `--saffron #F4A62A` (accents, dark text), `--herb #2F7D4A` (fresh/success), `--chilli #B42318` (error/spicy), `--smoke #6B5E55` (secondary text). Admin can override in Settings → Branding (validate AA contrast on save).

## Layout
- **Header** (CMS): announcement bar · logo · nav · fulfilment chip ("Pickup · ASAP · Change") · account · basket. Sticky, shrinks on scroll, no layout shift.
- **Home** (ordered CMS blocks): hero (one great food photo/video poster, headline, Order now, delivery/pickup toggle) → **active deals carousel directly under hero** → popular categories → best sellers (from real sales) → loyalty promo → why us (halal, fresh daily, open late) → testimonials (real, admin-entered) → hours/location → footer.
- **Menu**: sticky category tabs with scroll-spy, search, filter chips (halal, veg, spicy), cards with photo, name, from-price, badges, quick-add when no required modifiers.
- **Product sheet/page**: gallery, variants as segmented control, modifier groups with live constraints ("Choose up to 3 sauces — 2 selected"), notes, qty, sticky "Add · $14.50".
- **Basket**: floating button (count + subtotal) → drawer; fly-to-cart micro-animation; cross-sell row.
- **Checkout**: one page, progressive sections; server reprice diff banner; slot picker showing only available slots; Stripe Payment Element.
- **Tracking**: timeline with friendly copy, ETA, store phone, add-to-calendar for pre-orders, push opt-in.

## Performance rules
LCP image `priority` + correct `sizes`; everything else lazy. Client JS only for: basket, product customiser, slot picker, payment, live tracking. Motion via CSS where possible; Framer/Motion loaded only in interactive leaves. Budgets: LCP < 2.5 s, CLS < 0.1, INP < 200 ms, < 150 KB JS gz per route.

## Accessibility
Focus order, labels on every control, `aria-live="polite"` for basket and order status, colour never the only signal, reduced-motion respected, 44 px targets.
