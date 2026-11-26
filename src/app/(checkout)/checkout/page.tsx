import React from 'react';
import { getCustomerActor } from '@/lib/auth';
import { db } from '@/lib/db';
import { getStorefrontContext } from '@/modules/storefront/queries';
import { CheckoutForm } from '@/components/storefront/CheckoutForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Checkout',
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ coupon?: string }>;
}) {
  const [params, ctx, customerActor] = await Promise.all([
    searchParams,
    getStorefrontContext(),
    getCustomerActor(),
  ]);

  let customerDefaults: { name: string; email: string; phone: string } | null = null;
  if (customerActor) {
    const cust = await db.customer.findUnique({
      where: { id: customerActor.id },
      select: { name: true, email: true, phone: true },
    });
    if (cust) customerDefaults = cust;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ember">
          Star Kebab Newtown
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-wide text-char">
          Checkout
        </h1>
      </div>

      <CheckoutForm
        store={{
          name: ctx.store.name,
          address: ctx.store.address,
          gstRatePct: ctx.store.gstRatePct,
          gstRegistered: ctx.store.gstRegistered,
          cardSurchargeBps: ctx.store.cardSurchargeBps,
          onlinePaused: ctx.store.onlinePaused,
          pauseMessage: ctx.store.pauseMessage,
        }}
        initialCouponCode={params.coupon ?? ''}
        customerDefaults={customerDefaults}
        hasLiveStripe={!!process.env.STRIPE_SECRET_KEY}
      />
    </div>
  );
}
