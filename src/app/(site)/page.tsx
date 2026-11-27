import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Flame,
  ArrowRight,
  ShieldCheck,
  Clock,
  MapPin,
  Phone,
  Truck,
  Store,
  Tag,
  Award,
} from 'lucide-react';
import { formatAUD } from '@/lib/money';
import {
  getActiveDeals,
  getBestSellers,
  getPublicMenu,
  getStorefrontContext,
} from '@/modules/storefront/queries';
import { BestSellerGrid } from '@/components/storefront/MenuBrowser';
import { RevealOnScroll, FaqAccordion } from '@/components/storefront/MotionPrimitives';
import { buildFaqJsonLd, buildRestaurantJsonLd, STAR_KEBAB_FAQS } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  kebabs: '/images/kebab-wrap.jpg',
  'kebab-rolls': '/images/kebab-wrap.jpg',
  'charcoal-kebabs': '/images/kebab-wrap.jpg',
  hsp: '/images/hsp-box.jpg',
  'snack-packs': '/images/hsp-box.jpg',
  'halal-snack-packs': '/images/hsp-box.jpg',
  pide: '/images/turkish-pizza.jpg',
  'turkish-pide': '/images/turkish-pizza.jpg',
  'turkish-pides': '/images/turkish-pizza.jpg',
  'gourmet-pizzas': '/images/turkish-pizza.jpg',
  gozleme: '/images/turkish-pizza.jpg',
  plates: '/images/grill-plate.jpg',
  'grill-plates': '/images/grill-plate.jpg',
  'mains-skewers': '/images/grill-plate.jpg',
  'lunch-boxes': '/images/grill-plate.jpg',
  burgers: '/images/kebab-wrap.jpg',
  banquets: '/images/grill-plate.jpg',
  sides: '/images/sides-chips.jpg',
  'hot-entrees': '/images/sides-chips.jpg',
  'homemade-dips': '/images/sides-chips.jpg',
  'bread-and-kids': '/images/turkish-pizza.jpg',
  beverages: '/images/sides-chips.jpg',
  desserts: '/images/sides-chips.jpg',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function HomePage() {
  const [ctx, deals, bestSellers, menuCategories] = await Promise.all([
    getStorefrontContext(),
    getActiveDeals(),
    getBestSellers(),
    getPublicMenu(),
  ]);

  const featuredCategories = menuCategories.slice(0, 4);
  const restaurantJsonLd = buildRestaurantJsonLd(ctx.store, ctx.openingHours);
  const faqJsonLd = buildFaqJsonLd();

  return (
    <div className="bg-cream text-char">
      {/* JSON-LD Structured Data for Google Search & AI Overviews */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* EDITORIAL HERO */}
      <section className="relative overflow-hidden bg-char text-cream">
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/images/hero-kebab-steak-bg.jpg"
            alt="Star Kebab charcoal kebab skewers and seared steak grill"
            fill
            priority
            className="hero-bg-float object-cover object-center opacity-55"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-char via-char/88 to-char/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-char via-transparent to-char/45" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-10 lg:gap-12">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-saffron/40 bg-char/70 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-saffron backdrop-blur-xs">
                <Flame className="h-3.5 w-3.5 text-ember" />
                100% Halal · Ironbark Charcoal · Newtown
              </div>

              <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-extrabold uppercase leading-[0.95] tracking-tight text-cream drop-shadow-lg">
                CARVED OFF THE{' '}
                <span className="text-saffron">CHARCOAL</span> SPIT
              </h1>

              <p className="max-w-xl text-base sm:text-lg leading-relaxed text-cream/85">
                Hand-stacked lamb &amp; chicken doner roasted slow over live Australian ironbark,
                loaded Halal Snack Packs dripping in garlic toum, and blistered stone-baked Turkish
                pide.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/menu"
                  className="btn-glow inline-flex items-center gap-2.5 rounded-full bg-ember px-7 py-4 font-display text-xl font-bold uppercase tracking-wide text-cream shadow-xl shadow-ember/30 hover:bg-ember-dark"
                >
                  <Store className="h-5 w-5" />
                  Order Pickup
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/menu?mode=delivery"
                  className="btn-glow inline-flex items-center gap-2.5 rounded-full border-2 border-saffron/70 bg-char/70 px-7 py-4 font-display text-xl font-bold uppercase tracking-wide text-saffron backdrop-blur-xs hover:bg-saffron hover:text-char"
                >
                  <Truck className="h-5 w-5" />
                  Order Delivery
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 text-xs sm:text-sm text-cream/75">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-saffron" /> 100% Halal Certified
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-saffron" /> Open Fri–Sat till 2am
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-saffron" /> 148 King St, Newtown
                </span>
              </div>
            </div>

            {/* Subtle Slowly Floating Hero Visual Showcase */}
            <div className="lg:col-span-5">
              <div className="hero-card-float relative mx-auto max-w-md lg:max-w-none">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-saffron/35 bg-char-soft shadow-2xl shadow-black/60">
                  <Image
                    src={ctx.store.heroImageUrl || '/images/hero-grill.jpg'}
                    alt="Star Kebab signature charcoal grill spread"
                    fill
                    priority
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 42vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-char/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 rounded-2xl border border-cream/15 bg-char/80 px-4 py-2.5 backdrop-blur-md">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-saffron">
                        Fresh Off The Spit
                      </p>
                      <p className="font-display text-lg font-extrabold uppercase tracking-wide text-cream leading-tight">
                        Carved To Order Daily
                      </p>
                    </div>
                    <span className="rounded-full bg-ember px-3 py-1 font-mono text-xs font-bold text-cream">
                      100% Halal
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVE DEALS CAROUSEL DIRECTLY UNDER HERO */}
      {deals.length > 0 && (
        <section className="relative -mt-6 z-10 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-3xl border border-border-warm bg-cream-deep/95 p-5 sm:p-7 shadow-xl backdrop-blur-xs">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-ember">
                  <Tag className="h-3.5 w-3.5" /> Hot Off The Grill
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-wide text-char">
                  Active Combos &amp; Deals
                </h2>
              </div>
              <Link
                href="/deals"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-ember hover:text-ember-dark transition"
              >
                View All Deals &amp; Coupons <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible">
              {deals.map((deal, idx) => (
                <RevealOnScroll key={deal.id} delayMs={idx * 90} className="min-w-[280px] snap-start flex">
                  <div className="card-lift flex w-full flex-col overflow-hidden rounded-2xl border border-border-warm bg-white shadow-sm">
                    <div className="relative h-40 w-full bg-char overflow-hidden group">
                      <Image
                        src={deal.imageUrl || '/images/hsp-box.jpg'}
                        alt={deal.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 80vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-char/80 via-transparent to-transparent" />
                      <span className="deal-shimmer absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-char shadow">
                        {deal.badgeText}
                      </span>
                      <span className="absolute bottom-3 right-3 rounded-xl bg-char/90 px-3 py-1 font-mono text-lg font-extrabold text-saffron tabular-nums">
                        {formatAUD(deal.priceCents)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-char">
                        {deal.name}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-smoke flex-1">{deal.description}</p>
                      <Link
                        href="/menu"
                        className="btn-glow mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-char py-2.5 text-sm font-bold text-cream hover:bg-ember"
                      >
                        Order This Deal <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* POPULAR CATEGORIES 4-COL PHOTO GRID */}
      {featuredCategories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-ember">
                Explore The Menu
              </p>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-wide text-char">
                Popular Categories
              </h2>
            </div>
            <Link
              href="/menu"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-ember hover:text-ember-dark"
            >
              Full Menu <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCategories.map((cat, idx) => {
              const img =
                cat.imageUrl ||
                CATEGORY_FALLBACK_IMAGES[cat.slug] ||
                cat.products[0]?.imageUrl ||
                '/images/kebab-wrap.jpg';
              return (
                <RevealOnScroll key={cat.id} delayMs={idx * 80}>
                  <Link
                    href={`/menu?category=${cat.slug}`}
                    className="card-lift group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-char shadow-md"
                  >
                  <Image
                    src={img}
                    alt={cat.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-char via-char/30 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 text-cream">
                    <span className="text-xs font-semibold uppercase tracking-widest text-saffron">
                      {cat.products.length} items
                    </span>
                    <h3 className="mt-0.5 font-display text-3xl font-extrabold uppercase tracking-wide leading-none">
                      {cat.name}
                    </h3>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-cream/90 group-hover:text-saffron transition">
                      Explore <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  </Link>
                </RevealOnScroll>
              );
            })}
          </div>
        </section>
      )}

      {/* BEST SELLERS INTERACTIVE CARDS */}
      {bestSellers.length > 0 && (
        <section className="bg-cream-deep/60 border-y border-border-warm py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-ember">
                  Newtown Favourites
                </p>
                <h2 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-wide text-char">
                  Crowd Best Sellers
                </h2>
              </div>
              <Link
                href="/menu"
                className="inline-flex items-center gap-1.5 rounded-full bg-char px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-saffron hover:bg-ember hover:text-cream transition"
              >
                See All Menu Items <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <BestSellerGrid products={bestSellers} />
          </div>
        </section>
      )}

      {/* STAR REWARDS LOYALTY PROMO BAND */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-char px-6 py-12 sm:px-12 sm:py-14 text-cream shadow-2xl">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-saffron/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-ember/25 blur-3xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-saffron/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-saffron">
                <Award className="h-4 w-4" /> Star Rewards Club
              </div>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-wide leading-none">
                Earn Points On Every <span className="text-saffron">Kebab &amp; HSP</span>
              </h2>
              <p className="text-sm sm:text-base text-cream/80">
                Earn 1 Star Point for every $1 spent online. Hit 100 points and unlock $5 off your
                next charcoal feast — plus exclusive late-night member drops.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/account/login"
                className="inline-flex items-center gap-2 rounded-full bg-saffron px-7 py-3.5 font-display text-xl font-extrabold uppercase tracking-wide text-char shadow-lg transition hover:bg-cream"
              >
                <Award className="h-5 w-5" />
                Join Free Today
              </Link>
              <Link
                href="/deals"
                className="inline-flex items-center gap-2 rounded-full border border-cream/25 px-6 py-3.5 text-sm font-bold text-cream hover:border-saffron hover:text-saffron transition"
              >
                See Member Coupons
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* WHY STAR KEBAB — 3-PILLAR STRIP */}
      <section className="border-t border-border-warm bg-white/70 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border-warm bg-cream p-6 space-y-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-herb text-cream">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char">
                100% Halal Certified
              </h3>
              <p className="text-sm leading-relaxed text-smoke">
                Every lamb shoulder, chicken thigh &amp; beef skewer is sourced from certified
                Australian Halal farms and prepared fresh daily.
              </p>
            </div>

            <div className="rounded-2xl border border-border-warm bg-cream p-6 space-y-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember text-cream">
                <Flame className="h-6 w-6" />
              </span>
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char">
                Live Ironbark Charcoal
              </h3>
              <p className="text-sm leading-relaxed text-smoke">
                No shortcuts, no gas-only burners. We sear over glowing Australian ironbark embers
                for that unmistakable smoky crust.
              </p>
            </div>

            <div className="rounded-2xl border border-border-warm bg-cream p-6 space-y-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-char text-saffron">
                <Clock className="h-6 w-6" />
              </span>
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char">
                Open Late Fri–Sat 2am
              </h3>
              <p className="text-sm leading-relaxed text-smoke">
                Craving a loaded HSP after a night on King Street? Our charcoal pit stays fired up
                until 2:00am every Friday and Saturday.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* LOCATION & HOURS BLOCK */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 items-stretch">
          <div className="rounded-3xl border border-border-warm bg-white p-7 sm:p-9 space-y-6 shadow-xs">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-ember">Visit Us</p>
              <h2 className="font-display text-4xl font-extrabold uppercase tracking-wide text-char">
                King Street, Newtown
              </h2>
            </div>

            <div className="space-y-3 text-sm text-char">
              <p className="flex items-start gap-3">
                <MapPin className="h-5 w-5 shrink-0 text-ember mt-0.5" />
                <span>{ctx.store.address}</span>
              </p>
              <p className="flex items-center gap-3">
                <Phone className="h-5 w-5 shrink-0 text-ember" />
                <a href={`tel:${ctx.store.phone.replace(/[^0-9+]/g, '')}`} className="font-semibold hover:text-ember">
                  {ctx.store.phone}
                </a>
              </p>
            </div>

            <div className="border-t border-border-warm pt-5">
              <h3 className="font-display text-lg font-bold uppercase tracking-wide text-char mb-3">
                Delivery Zones
              </h3>
              <div className="space-y-2">
                {ctx.deliveryZones.map((zone) => (
                  <div
                    key={zone.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream px-4 py-2.5 text-xs sm:text-sm"
                  >
                    <div>
                      <span className="font-bold text-char">{zone.name}</span>
                      <span className="ml-2 font-mono text-xs text-smoke">
                        ({zone.postcodes})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-ember tabular-nums">
                      {formatAUD(zone.feeCents)} · ~{zone.travelMinutes}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-char p-7 sm:p-9 text-cream flex flex-col justify-between shadow-xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">
                Trading Hours
              </p>
              <h2 className="font-display text-4xl font-extrabold uppercase tracking-wide mt-1">
                Fresh Off The Fire Daily
              </h2>
              <ul className="mt-6 space-y-2.5 text-sm">
                {ctx.openingHours.map((h) => {
                  const late = h.dayOfWeek === 5 || h.dayOfWeek === 6;
                  return (
                    <li
                      key={h.dayOfWeek}
                      className="flex items-center justify-between border-b border-cream/10 pb-2"
                    >
                      <span className={late ? 'font-bold text-saffron' : 'text-cream/80'}>
                        {DAY_NAMES[h.dayOfWeek]}
                      </span>
                      <span className="font-mono text-xs sm:text-sm tabular-nums">
                        {h.isClosed ? 'Closed' : `${h.openTime} – ${h.closeTime}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/menu"
                className="btn-glow inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3 font-display text-lg font-bold uppercase tracking-wide text-cream hover:bg-ember-dark"
              >
                Order Online Now <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-cream/25 px-5 py-3 text-sm font-semibold text-cream hover:border-saffron hover:text-saffron transition"
              >
                Directions &amp; Contact
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* AI OVERVIEW & LOCAL SEO FAQ SECTION */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-16 sm:pb-20">
        <RevealOnScroll>
          <div className="text-center mb-8 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-ember">
              Good To Know
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-wide text-char">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-smoke max-w-xl mx-auto">
              Halal certification, late-night Sydney trading hours, delivery zones, and pre-orders at Star Kebab House.
            </p>
          </div>
          <FaqAccordion items={STAR_KEBAB_FAQS} />
        </RevealOnScroll>
      </section>
    </div>
  );
}
