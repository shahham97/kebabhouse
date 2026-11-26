import React from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { getOrderForTracking } from '@/modules/storefront/queries';
import { LiveOrderTracker } from '@/components/storefront/LiveOrderTracker';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Live Order Tracker',
};

export default async function OrderTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ publicId }, { t }] = await Promise.all([params, searchParams]);
  const order = await getOrderForTracking(publicId, t);

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-chilli/10 text-chilli">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="font-display text-3xl font-extrabold uppercase text-char">
          Order Not Found
        </h1>
        <p className="text-sm text-smoke">
          This tracking link is invalid or you do not have permission to view this order.
        </p>
        <Link
          href="/menu"
          className="inline-flex items-center rounded-full bg-ember px-6 py-3 text-sm font-bold text-cream hover:bg-ember-dark transition"
        >
          Back to Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
      <LiveOrderTracker
        order={{
          publicId: order.publicId,
          number: order.number,
          status: order.status,
          paymentStatus: order.paymentStatus,
          fulfilment: order.fulfilment,
          timing: order.timing,
          scheduledFor: order.scheduledFor ? order.scheduledFor.toISOString() : null,
          promisedAt: order.promisedAt.toISOString(),
          createdAt: order.createdAt.toISOString(),
          customerName: order.customerName,
          deliveryAddress: order.deliveryAddress,
          deliverySuburb: order.deliverySuburb,
          deliveryPostcode: order.deliveryPostcode,
          driverName: order.driverName,
          notes: order.notes,
          subtotalCents: order.subtotalCents,
          discountCents: order.discountCents,
          couponCode: order.couponCode,
          deliveryFeeCents: order.deliveryFeeCents,
          surchargeCents: order.surchargeCents,
          gstCents: order.gstCents,
          totalCents: order.totalCents,
          store: order.store,
          items: order.items.map((i) => ({
            id: i.id,
            productName: i.productName,
            variantName: i.variantName,
            quantity: i.quantity,
            lineTotalCents: i.lineTotalCents,
            notes: i.notes,
            modifiers: Array.isArray(i.modifiersJson)
              ? (i.modifiersJson as Array<{ optionName?: string; priceDeltaCents?: number }>).map(
                  (m) => ({
                    optionName: m.optionName ?? '',
                    priceDeltaCents: m.priceDeltaCents ?? 0,
                  })
                )
              : [],
          })),
          statusHistory: order.statusHistory.map((h) => ({
            id: h.id,
            toState: h.toState,
            note: h.note,
            createdAt: h.createdAt.toISOString(),
          })),
        }}
      />
    </div>
  );
}
