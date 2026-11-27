import React from 'react';
import Link from 'next/link';
import { MapPin, Phone, Mail, Clock, Truck, ArrowRight } from 'lucide-react';
import { formatAUD } from '@/lib/money';
import { getStorefrontContext } from '@/modules/storefront/queries';
import { buildBreadcrumbJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Contact, Opening Hours & Delivery Zones',
  description:
    'Find Star Kebab House’s phone number, address, opening hours, catering email, and local delivery postcodes. Order 100% Halal kebabs, HSP, pide & pizza online.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Star Kebab House — Hours, Location & Delivery',
    description: 'Shop details, opening hours, phone, catering enquiries, and delivery zones.',
    url: '/contact',
  },
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function ContactPage() {
  const ctx = await getStorefrontContext();
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Contact', path: '/contact' },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ember">Get In Touch</p>
        <h1 className="font-display text-5xl sm:text-6xl font-extrabold uppercase tracking-wide text-char leading-none">
          Visit {ctx.store.name}
        </h1>
        <p className="text-base text-smoke">
          Questions about catering, allergens, or a live order? Call the shop directly or drop by
          King Street.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Contact Details */}
        <div className="rounded-3xl border border-border-warm bg-white p-7 sm:p-9 space-y-6 shadow-xs">
          <h2 className="font-display text-3xl font-bold uppercase text-char">Shop Details</h2>

          <div className="space-y-4 text-sm text-char">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-ember mt-0.5" />
              <div>
                <p className="font-bold">Address</p>
                <p className="text-smoke">{ctx.store.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 shrink-0 text-ember mt-0.5" />
              <div>
                <p className="font-bold">Phone</p>
                <a
                  href={`tel:${ctx.store.phone.replace(/[^0-9+]/g, '')}`}
                  className="text-ember font-semibold hover:underline"
                >
                  {ctx.store.phone}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 shrink-0 text-ember mt-0.5" />
              <div>
                <p className="font-bold">Email &amp; Catering</p>
                <a
                  href={`mailto:${ctx.store.email}`}
                  className="text-ember font-semibold hover:underline"
                >
                  {ctx.store.email}
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-border-warm pt-5 space-y-3">
            <h3 className="flex items-center gap-2 font-display text-xl font-bold uppercase text-char">
              <Truck className="h-5 w-5 text-ember" /> Delivery Zones
            </h3>
            {ctx.deliveryZones.map((z) => (
              <div
                key={z.id}
                className="rounded-xl border border-border-warm bg-cream/60 px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between font-bold text-char">
                  <span>{z.name}</span>
                  <span className="font-mono text-ember tabular-nums">{formatAUD(z.feeCents)}</span>
                </div>
                <p className="mt-1 text-xs text-smoke">
                  Postcodes: <span className="font-mono">{z.postcodes}</span> · Min order{' '}
                  {formatAUD(z.minOrderCents)} · ~{z.travelMinutes} mins
                </p>
              </div>
            ))}
          </div>

          {ctx.store.abn && (
            <p className="font-mono text-xs text-smoke">ABN {ctx.store.abn}</p>
          )}
        </div>

        {/* Hours Card */}
        <div className="rounded-3xl bg-char p-7 sm:p-9 text-cream flex flex-col justify-between shadow-xl">
          <div>
            <h2 className="flex items-center gap-2 font-display text-3xl font-bold uppercase text-saffron">
              <Clock className="h-6 w-6" /> Opening Hours
            </h2>
            <ul className="mt-6 space-y-3 text-sm">
              {ctx.openingHours.map((row) => {
                const isLate = row.dayOfWeek === 5 || row.dayOfWeek === 6;
                return (
                  <li
                    key={row.dayOfWeek}
                    className="flex items-center justify-between border-b border-cream/10 pb-2.5"
                  >
                    <span className={isLate ? 'font-bold text-saffron' : 'text-cream/85'}>
                      {DAY_NAMES[row.dayOfWeek]}
                    </span>
                    <span className="font-mono tabular-nums">
                      {row.isClosed ? 'Closed' : `${row.openTime} – ${row.closeTime}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-8 rounded-2xl bg-char-soft p-5 border border-cream/10">
            <p className="font-display text-xl font-bold uppercase text-cream">
              Skip the queue — order online
            </p>
            <p className="mt-1 text-xs text-cream/70">
              Order ahead for pickup or Inner West delivery and track your grill order live.
            </p>
            <Link
              href="/menu"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-bold text-cream hover:bg-ember-dark transition"
            >
              Order Now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
