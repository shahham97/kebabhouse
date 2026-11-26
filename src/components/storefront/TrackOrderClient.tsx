'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PackageSearch, ArrowRight, Clock, AlertCircle, Flame } from 'lucide-react';
import { lookupOrderForTrackingAction } from '@/modules/storefront/actions';

export interface RecentTrackedOrder {
  publicId: string;
  number: string;
  trackingToken: string;
  placedAt: string;
}

const RECENT_ORDERS_KEY = 'sk_recent_orders_v1';

export function saveRecentTrackedOrder(entry: RecentTrackedOrder) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(RECENT_ORDERS_KEY);
    const existing: RecentTrackedOrder[] = raw ? JSON.parse(raw) : [];
    const next = [entry, ...existing.filter((e) => e.publicId !== entry.publicId)].slice(0, 8);
    window.localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function TrackOrderClient() {
  const router = useRouter();
  const [recentOrders, setRecentOrders] = useState<RecentTrackedOrder[]>([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_ORDERS_KEY);
      if (raw) setRecentOrders(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orderNumber.trim() || !contact.trim()) {
      setError('Please enter both your order number and the email or phone used at checkout.');
      return;
    }

    startTransition(async () => {
      const res = await lookupOrderForTrackingAction({ orderNumber, contact });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      saveRecentTrackedOrder({
        publicId: res.data.publicId,
        number: res.data.number,
        trackingToken: res.data.trackingToken,
        placedAt: new Date().toISOString(),
      });
      router.push(
        `/order/${res.data.publicId}?t=${encodeURIComponent(res.data.trackingToken)}`
      );
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16 space-y-8">
      <div className="rounded-3xl bg-char px-6 py-8 sm:px-10 text-cream relative overflow-hidden">
        <div className="relative space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-saffron">
            <Flame className="h-3.5 w-3.5" /> Live Grill Tracker
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-wide leading-none">
            Track Your <span className="text-saffron">Order</span>
          </h1>
          <p className="text-sm text-cream/80 max-w-xl">
            Watch your order live from the charcoal spit to pickup or delivery — no account needed.
          </p>
        </div>
      </div>

      {recentOrders.length > 0 && (
        <section className="rounded-3xl border border-border-warm bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char flex items-center gap-2">
            <Clock className="h-5 w-5 text-ember" /> Your Recent Orders
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentOrders.map((o) => (
              <Link
                key={o.publicId}
                href={`/order/${o.publicId}?t=${encodeURIComponent(o.trackingToken)}`}
                className="flex items-center justify-between rounded-2xl border border-border-warm bg-cream/40 hover:border-ember hover:bg-cream px-4 py-3.5 transition"
              >
                <div>
                  <p className="font-mono text-base font-extrabold text-char">{o.number}</p>
                  <p className="text-xs text-smoke">
                    Placed {new Date(o.placedAt).toLocaleString('en-AU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-ember">
                  Track Live <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-border-warm bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char flex items-center gap-2 mb-4">
          <PackageSearch className="h-5 w-5 text-ember" /> Look Up By Order Number
        </h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-chilli/30 bg-chilli/10 px-3.5 py-2.5 text-sm font-medium text-chilli"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="track-number" className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
                Order Number *
              </label>
              <input
                id="track-number"
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="#SK-0001"
                className="w-full rounded-xl border border-border-warm bg-cream/40 px-3.5 py-3 font-mono text-sm text-char placeholder:text-smoke/50 focus:outline-none focus:ring-2 focus:ring-ember"
              />
            </div>

            <div>
              <label htmlFor="track-contact" className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
                Email or Mobile Phone *
              </label>
              <input
                id="track-contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="charlotte.taylor@example.com.au"
                className="w-full rounded-xl border border-border-warm bg-cream/40 px-3.5 py-3 text-sm text-char placeholder:text-smoke/50 focus:outline-none focus:ring-2 focus:ring-ember"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-ember hover:bg-ember-dark disabled:opacity-60 px-7 py-3 font-display text-lg font-extrabold uppercase tracking-wide text-cream shadow-md transition cursor-pointer"
          >
            <span>{isPending ? 'Looking up order…' : 'View Live Order Status'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
