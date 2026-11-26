import React from 'react';
import { getStorefrontContext } from '@/modules/storefront/queries';

export const metadata = {
  title: 'Privacy Policy',
};

export default async function PrivacyPolicyPage() {
  const ctx = await getStorefrontContext();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16 space-y-6">
      <div className="border-b border-border-warm pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ember">Legal</p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-wide text-char mt-1">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-smoke">
          {ctx.store.name} · ABN {ctx.store.abn} · Effective 2026
        </p>
      </div>

      <div className="space-y-5 text-sm leading-relaxed text-char/85">
        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase text-char">1. Information We Collect</h2>
          <p>
            When you place an online order or join Star Rewards, we collect your name, email
            address, phone number, and (for delivery orders) your street address and postcode. Card
            payments are processed securely via Stripe — we never store raw credit card numbers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase text-char">2. How We Use Your Details</h2>
          <p>
            We use your contact details strictly to prepare and deliver your order, provide live
            order tracking notifications, issue ATO-compliant GST tax invoices, and credit Star
            Rewards loyalty points.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase text-char">3. Australian Privacy Principles</h2>
          <p>
            We handle all personal information in accordance with the Australian Privacy Act 1988
            (Cth). You may request access to or deletion of your account data at any time by
            emailing{' '}
            <a href={`mailto:${ctx.store.email}`} className="text-ember font-semibold hover:underline">
              {ctx.store.email}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
