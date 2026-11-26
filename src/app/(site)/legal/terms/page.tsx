import React from 'react';
import { getStorefrontContext } from '@/modules/storefront/queries';

export const metadata = {
  title: 'Terms of Service',
};

export default async function TermsPage() {
  const ctx = await getStorefrontContext();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16 space-y-6">
      <div className="border-b border-border-warm pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ember">Legal</p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-wide text-char mt-1">
          Terms of Service
        </h1>
        <p className="mt-2 text-xs text-smoke">
          {ctx.store.name} · ABN {ctx.store.abn} · Effective 2026
        </p>
      </div>

      <div className="space-y-5 text-sm leading-relaxed text-char/85">
        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase text-char">1. Pricing &amp; GST</h2>
          <p>
            All menu prices are listed in Australian Dollars (AUD) and include 10% Goods and
            Services Tax (GST) where applicable. Delivery fees and optional surcharges are displayed
            clearly before payment is confirmed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase text-char">2. Orders, Cancellations &amp; Refunds</h2>
          <p>
            Because every kebab, HSP, and pide is cooked fresh to order over charcoal, please call{' '}
            <span className="font-semibold">{ctx.store.phone}</span> immediately if you need to
            amend or cancel an order. Refunds are issued in accordance with Australian Consumer Law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase text-char">3. Allergens &amp; Dietary Info</h2>
          <p>
            All meat served at {ctx.store.name} is 100% Halal certified. Our kitchen handles wheat
            (gluten), dairy, sesame, and nuts. Please specify severe allergies in the item notes and
            notify our staff by phone before ordering.
          </p>
        </section>
      </div>
    </div>
  );
}
