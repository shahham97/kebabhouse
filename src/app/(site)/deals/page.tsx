import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Tag, Flame, ArrowRight, Ticket } from 'lucide-react';
import { formatAUD } from '@/lib/money';
import { getActiveCoupons, getActiveDeals } from '@/modules/storefront/queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Deals & Coupons',
};

export default async function DealsPage() {
  const [deals, coupons] = await Promise.all([getActiveDeals(), getActiveCoupons()]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14 space-y-14">
      {/* Header */}
      <div className="rounded-3xl bg-char px-6 py-10 sm:px-10 text-cream relative overflow-hidden">
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-saffron/15 blur-3xl" />
        <div className="relative max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-saffron">
            <Flame className="h-3.5 w-3.5" /> Sydney Charcoal Value
          </span>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold uppercase tracking-wide leading-none">
            Deals, Combos &amp; <span className="text-saffron">Promo Codes</span>
          </h1>
          <p className="text-sm sm:text-base text-cream/80">
            Save on family feasts, late-night HSP combos, and apply instant coupon codes at checkout.
          </p>
        </div>
      </div>

      {/* Coupons Section */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-ember" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-wide text-char">
            Active Promo Codes
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => {
            const headline =
              coupon.kind === 'PERCENT'
                ? `${coupon.value}% OFF`
                : `${formatAUD(coupon.value)} OFF`;
            return (
              <div
                key={coupon.id}
                className="flex flex-col justify-between rounded-2xl border-2 border-dashed border-ember/50 bg-white p-6 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-ember/10 px-3 py-1 text-xs font-extrabold uppercase text-ember">
                      {headline}
                    </span>
                    {coupon.firstOrderOnly && (
                      <span className="rounded-full bg-saffron/25 px-2.5 py-0.5 text-[11px] font-bold text-char">
                        First Order
                      </span>
                    )}
                  </div>
                  <div className="mt-4 rounded-xl bg-cream-deep px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-smoke">
                      Use Code At Checkout
                    </p>
                    <p className="mt-1 font-mono text-2xl font-extrabold tracking-widest text-char select-all">
                      {coupon.code}
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-smoke">
                    {coupon.minSpendCents > 0
                      ? `Valid on orders over ${formatAUD(coupon.minSpendCents)}.`
                      : 'No minimum spend required.'}
                  </p>
                </div>

                <Link
                  href={`/checkout?coupon=${encodeURIComponent(coupon.code)}`}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-char py-2.5 text-sm font-bold text-saffron hover:bg-ember hover:text-cream transition"
                >
                  Apply {coupon.code} at Checkout <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active Deals Section */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-ember" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-wide text-char">
            Combo Deals
          </h2>
        </div>

        {deals.length === 0 ? (
          <div className="rounded-2xl border border-border-warm bg-white p-10 text-center text-smoke">
            No combo deals active right now — check back soon or browse our full menu!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="flex flex-col overflow-hidden rounded-3xl border border-border-warm bg-white shadow-sm"
              >
                <div className="relative h-52 w-full bg-char">
                  <Image
                    src={deal.imageUrl || '/images/grill-plate.jpg'}
                    alt={deal.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-char/85 via-transparent to-transparent" />
                  <span className="absolute left-4 top-4 rounded-full bg-saffron px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-char">
                    {deal.badgeText}
                  </span>
                  <span className="absolute bottom-4 right-4 rounded-xl bg-char/90 px-3.5 py-1.5 font-mono text-xl font-extrabold text-saffron tabular-nums">
                    {formatAUD(deal.priceCents)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char">
                    {deal.name}
                  </h3>
                  <p className="mt-1.5 text-sm text-smoke flex-1">{deal.description}</p>

                  {deal.items.length > 0 && (
                    <ul className="mt-4 space-y-1 border-t border-border-warm pt-3 text-xs text-char/80">
                      {deal.items.map((item) => (
                        <li key={item.id}>
                          • {item.quantity}× {item.variant.product.name} ({item.variant.name})
                        </li>
                      ))}
                    </ul>
                  )}

                  <Link
                    href="/menu"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ember py-3 text-sm font-bold text-cream hover:bg-ember-dark transition"
                  >
                    Build Your Order <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
