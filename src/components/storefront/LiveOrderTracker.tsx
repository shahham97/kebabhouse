'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Flame,
  PackageCheck,
  Truck,
  Clock,
  Phone,
  MapPin,
  Receipt,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { formatAUD } from '@/lib/money';
import { formatStoreDateTime, formatStoreTime } from '@/lib/time';
import { cn } from '@/lib/utils';

interface TrackedOrder {
  publicId: string;
  number: string;
  status: string;
  paymentStatus: string;
  fulfilment: string;
  timing: string;
  scheduledFor: string | null;
  promisedAt: string;
  createdAt: string;
  customerName: string;
  deliveryAddress: string | null;
  deliverySuburb: string | null;
  deliveryPostcode: string | null;
  driverName: string | null;
  notes: string;
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  deliveryFeeCents: number;
  surchargeCents: number;
  gstCents: number;
  totalCents: number;
  store: {
    name: string;
    phone: string;
    abn: string;
    address: string;
    timezone: string;
  };
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    quantity: number;
    lineTotalCents: number;
    notes: string;
    modifiers: Array<{ optionName: string; priceDeltaCents: number }>;
  }>;
  statusHistory: Array<{
    id: string;
    toState: string;
    note: string;
    createdAt: string;
  }>;
}

function getStageIndex(status: string): number {
  switch (status) {
    case 'PENDING_PAYMENT':
    case 'PLACED':
    case 'SCHEDULED':
    case 'IN_KITCHEN':
      return 0;
    case 'PREPARING':
      return 1;
    case 'READY':
    case 'OUT_FOR_DELIVERY':
      return 2;
    case 'SERVED':
    case 'COLLECTED':
    case 'COMPLETED':
      return 3;
    default:
      return -1;
  }
}

export function LiveOrderTracker({ order }: { order: TrackedOrder }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const isTerminal = ['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status);

  // Auto-refresh via SSE + 10s polling fallback
  useEffect(() => {
    if (isTerminal) return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, 10000);

    let es: EventSource | null = null;
    try {
      es = new EventSource(
        `/api/realtime/stream?channel=${encodeURIComponent(`order:${order.publicId}`)}`
      );
      es.onmessage = () => {
        router.refresh();
      };
      es.addEventListener('order.status', () => {
        router.refresh();
      });
    } catch {
      // Fallback to polling only
    }

    return () => {
      window.clearInterval(timer);
      if (es) es.close();
    };
  }, [order.publicId, isTerminal, router]);

  const stageIdx = getStageIndex(order.status);
  const isCancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED';

  const stages = [
    {
      label: order.status === 'SCHEDULED' ? 'Scheduled & Confirmed' : 'Order Received',
      sub: 'Sent to Newtown kitchen',
      icon: CheckCircle2,
    },
    {
      label: 'Preparing on the Grill',
      sub: 'Carving off the charcoal spit',
      icon: Flame,
    },
    {
      label: order.fulfilment === 'DELIVERY' ? 'Ready / Out for Delivery' : 'Ready for Pickup',
      sub:
        order.fulfilment === 'DELIVERY'
          ? order.driverName
            ? `Driver: ${order.driverName}`
            : 'Hot & packed for dispatch'
          : 'Waiting at the Newtown counter',
      icon: order.fulfilment === 'DELIVERY' ? Truck : PackageCheck,
    },
    {
      label: 'Completed',
      sub: 'Enjoy your charcoal feast!',
      icon: CheckCircle2,
    },
  ];

  function handleManualRefresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className="space-y-6">
      {/* Top Status Hero Card */}
      <div className="rounded-3xl bg-char p-6 sm:p-8 text-cream shadow-2xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-saffron">
              Live Order Tracker
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-wide mt-1">
              Order <span className="text-saffron font-mono">{order.number}</span>
            </h1>
            <p className="mt-1 text-sm text-cream/75">
              {order.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'} ·{' '}
              {order.timing === 'SCHEDULED' && order.scheduledFor
                ? `Scheduled for ${formatStoreDateTime(order.scheduledFor, order.store.timezone)}`
                : `Estimated ready around ${formatStoreTime(order.promisedAt, order.store.timezone)}`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-1.5 rounded-full border border-cream/20 bg-char-soft px-4 py-2 text-xs font-bold text-cream hover:border-saffron hover:text-saffron transition cursor-pointer"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh Status
          </button>
        </div>

        {/* Stage Timeline */}
        {isCancelled ? (
          <div className="flex items-center gap-3 rounded-2xl border border-chilli/40 bg-chilli/20 p-4 text-cream">
            <XCircle className="h-6 w-6 shrink-0 text-saffron" />
            <div>
              <p className="font-display text-xl font-bold uppercase">
                Order {order.status.replaceAll('_', ' ')}
              </p>
              <p className="text-xs text-cream/80">
                Please contact {order.store.name} on {order.store.phone} if you need assistance.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            {stages.map((stage, idx) => {
              const Icon = stage.icon;
              const done = stageIdx > idx;
              const current = stageIdx === idx;
              return (
                <div
                  key={stage.label}
                  className={cn(
                    'rounded-2xl border p-4 transition',
                    current
                      ? 'border-saffron bg-ember/25 shadow-lg ring-1 ring-saffron/40'
                      : done
                      ? 'border-herb/50 bg-herb/15'
                      : 'border-cream/10 bg-char-soft/70 opacity-60'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl',
                        current
                          ? 'bg-saffron text-char'
                          : done
                          ? 'bg-herb text-cream'
                          : 'bg-char text-cream/50'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs font-bold text-cream/60">
                      0{idx + 1}
                    </span>
                  </div>
                  <p className="font-display text-lg font-bold uppercase tracking-wide text-cream leading-tight">
                    {stage.label}
                  </p>
                  <p className="mt-1 text-xs text-cream/70">{stage.sub}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details & Tax Invoice Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Items & Modifiers */}
        <div className="md:col-span-7 rounded-3xl border border-border-warm bg-white p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border-warm pb-3">
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold uppercase text-char">
              <Receipt className="h-5 w-5 text-ember" /> Tax Invoice Summary
            </h2>
            <span className="rounded-full bg-herb/15 px-3 py-1 text-xs font-bold text-herb uppercase">
              {order.paymentStatus}
            </span>
          </div>

          <ul className="divide-y divide-border-warm/70">
            {order.items.map((item) => (
              <li key={item.id} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-char text-sm">
                      {item.quantity}× {item.productName}{' '}
                      <span className="font-normal text-smoke">({item.variantName})</span>
                    </p>
                    {item.modifiers.length > 0 && (
                      <p className="mt-0.5 text-xs text-smoke">
                        {item.modifiers.map((m) => m.optionName).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-xs italic text-ember">&ldquo;{item.notes}&rdquo;</p>
                    )}
                  </div>
                  <span className="font-mono text-sm font-bold text-char tabular-nums">
                    {formatAUD(item.lineTotalCents)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-border-warm pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-smoke">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatAUD(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between text-herb font-semibold">
                <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                <span className="font-mono tabular-nums">-{formatAUD(order.discountCents)}</span>
              </div>
            )}
            {order.deliveryFeeCents > 0 && (
              <div className="flex justify-between text-smoke">
                <span>Delivery Fee</span>
                <span className="font-mono tabular-nums">{formatAUD(order.deliveryFeeCents)}</span>
              </div>
            )}
            {order.surchargeCents > 0 && (
              <div className="flex justify-between text-smoke">
                <span>Card Surcharge</span>
                <span className="font-mono tabular-nums">{formatAUD(order.surchargeCents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border-warm pt-2.5 text-base font-extrabold text-char">
              <span>Total Paid (AUD)</span>
              <span className="font-mono text-lg tabular-nums">{formatAUD(order.totalCents)}</span>
            </div>
            <p className="text-right font-mono text-xs text-smoke tabular-nums">
              Includes GST: {formatAUD(order.gstCents)} · ABN {order.store.abn}
            </p>
          </div>
        </div>

        {/* Store Info & Activity Log */}
        <div className="md:col-span-5 space-y-5">
          <div className="rounded-3xl border border-border-warm bg-white p-6 space-y-3 shadow-xs text-sm">
            <h3 className="font-display text-xl font-extrabold uppercase text-char">
              {order.fulfilment === 'DELIVERY' ? 'Delivery Details' : 'Pickup Location'}
            </h3>
            {order.fulfilment === 'DELIVERY' ? (
              <p className="flex items-start gap-2 text-smoke">
                <MapPin className="h-4 w-4 shrink-0 text-ember mt-0.5" />
                <span>
                  {[order.deliveryAddress, order.deliverySuburb, order.deliveryPostcode]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-2 text-smoke">
                <MapPin className="h-4 w-4 shrink-0 text-ember mt-0.5" />
                <span>{order.store.address}</span>
              </p>
            )}
            <div className="pt-2 border-t border-border-warm">
              <p className="text-xs text-smoke">Need help with your order?</p>
              <a
                href={`tel:${order.store.phone.replace(/[^0-9+]/g, '')}`}
                className="mt-1 inline-flex items-center gap-2 font-bold text-ember hover:underline"
              >
                <Phone className="h-4 w-4" /> Call {order.store.name}: {order.store.phone}
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-border-warm bg-white p-6 space-y-3 shadow-xs">
            <h3 className="flex items-center gap-2 font-display text-xl font-extrabold uppercase text-char">
              <Clock className="h-4 w-4 text-ember" /> Order Updates
            </h3>
            <ul className="space-y-2.5 text-xs">
              {order.statusHistory.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-char">{h.toState.replaceAll('_', ' ')}</p>
                    {h.note && <p className="text-smoke">{h.note}</p>}
                  </div>
                  <span className="shrink-0 font-mono text-smoke tabular-nums">
                    {formatStoreTime(h.createdAt, order.store.timezone)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/menu"
            className="block w-full rounded-2xl bg-char py-3.5 text-center font-display text-lg font-bold uppercase tracking-wide text-saffron hover:bg-ember hover:text-cream transition"
          >
            Order Again
          </Link>
        </div>
      </div>
    </div>
  );
}
