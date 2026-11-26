import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Flame,
  Award,
  ShoppingBag,
  LogOut,
  ArrowRight,
  MapPin,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { destroyCustomerSession, getCustomerActor } from '@/lib/auth';
import { formatAUD } from '@/lib/money';
import { formatStoreDateTime } from '@/lib/time';
import { getCustomerAccountData } from '@/modules/storefront/queries';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Account & Star Rewards',
};

export default async function CustomerAccountPage() {
  const actor = await getCustomerActor();
  if (!actor) {
    redirect('/account/login');
  }

  const customer = await getCustomerAccountData(actor.id);
  if (!customer) {
    redirect('/account/login');
  }

  const pointsBalance = customer.loyaltyAccount?.balance ?? 0;
  const loyaltyTxns = customer.loyaltyAccount?.transactions ?? [];
  const redeemableDollars = Math.floor(pointsBalance / 100) * 5;

  async function handleLogout() {
    'use server';
    await destroyCustomerSession();
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-cream text-char">
      {/* Top Bar */}
      <header className="border-b border-border-warm bg-char text-cream">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember text-cream">
              <Flame className="h-5 w-5" />
            </span>
            <span className="font-display text-2xl font-extrabold uppercase tracking-wider">
              Star Kebab
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/menu"
              className="rounded-full bg-ember px-4 py-1.5 text-xs font-bold text-cream hover:bg-ember-dark transition"
            >
              Order Now
            </Link>
            <form action={handleLogout}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-cream/25 px-3.5 py-1.5 text-xs font-semibold text-cream/85 hover:border-saffron hover:text-saffron transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-8">
        {/* Welcome + Loyalty Card */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 rounded-3xl bg-char p-7 text-cream shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-saffron">
                <Award className="h-4 w-4" /> Star Rewards Member
              </p>
              <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">
                {customer.name}
              </h1>
              <p className="text-xs text-cream/70">{customer.email}</p>
            </div>

            <div className="rounded-2xl bg-char-soft border border-saffron/25 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-cream/65">
                Current Points Balance
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-5xl font-extrabold text-saffron tabular-nums">
                  {pointsBalance}
                </span>
                <span className="text-sm font-semibold text-cream/80">pts</span>
              </div>
              <p className="mt-2 text-xs text-cream/70">
                {redeemableDollars > 0
                  ? `You have $${redeemableDollars} in Star Rewards ready to redeem!`
                  : `${100 - (pointsBalance % 100)} more points until your next $5 reward.`}
              </p>
            </div>
          </div>

          {/* Loyalty History */}
          <div className="lg:col-span-7 rounded-3xl border border-border-warm bg-white p-6 shadow-xs space-y-4">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char">
              Points Activity
            </h2>
            {loyaltyTxns.length === 0 ? (
              <div className="rounded-2xl bg-cream/60 p-8 text-center text-sm text-smoke">
                Complete your first online order to start earning Star Points!
              </div>
            ) : (
              <ul className="divide-y divide-border-warm/70 max-h-64 overflow-y-auto">
                {loyaltyTxns.map((txn) => (
                  <li key={txn.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-char">{txn.note || txn.kind}</p>
                      <p className="text-xs text-smoke">{formatStoreDateTime(txn.createdAt)}</p>
                    </div>
                    <span
                      className={
                        txn.points >= 0
                          ? 'font-mono font-bold text-herb tabular-nums'
                          : 'font-mono font-bold text-ember tabular-nums'
                      }
                    >
                      {txn.points >= 0 ? `+${txn.points}` : txn.points} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Past Orders */}
        <section className="rounded-3xl border border-border-warm bg-white p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-3xl font-extrabold uppercase tracking-wide text-char">
              <ShoppingBag className="h-6 w-6 text-ember" /> Recent Orders
            </h2>
            <Link
              href="/menu"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-ember hover:text-ember-dark"
            >
              New Order <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {customer.orders.length === 0 ? (
            <div className="rounded-2xl bg-cream/60 p-10 text-center space-y-3">
              <p className="text-sm text-smoke">You haven&apos;t placed any online orders yet.</p>
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-bold text-cream hover:bg-ember-dark transition"
              >
                Browse Menu
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {customer.orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border-warm bg-cream/40 p-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-extrabold text-char">
                        {order.number}
                      </span>
                      <span className="rounded-full bg-char px-2.5 py-0.5 text-[11px] font-bold uppercase text-saffron">
                        {order.status.replaceAll('_', ' ')}
                      </span>
                      <span className="text-xs text-smoke flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatStoreDateTime(order.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-smoke">
                      {order.items
                        .map((i) => `${i.quantity}× ${i.productName}`)
                        .join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className="font-mono text-base font-bold text-char tabular-nums">
                      {formatAUD(order.totalCents)}
                    </span>
                    <Link
                      href={`/order/${order.publicId}?t=${encodeURIComponent(order.trackingToken)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-char px-3.5 py-2 text-xs font-bold text-cream hover:bg-ember transition"
                    >
                      Live Tracker <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Saved Addresses */}
        {customer.addresses.length > 0 && (
          <section className="rounded-3xl border border-border-warm bg-white p-6 shadow-xs space-y-4">
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-wide text-char">
              <MapPin className="h-5 w-5 text-ember" /> Saved Addresses
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customer.addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="rounded-2xl border border-border-warm bg-cream/40 p-4 text-sm"
                >
                  <p className="font-bold text-char">
                    {addr.label}{' '}
                    {addr.isDefault && (
                      <span className="ml-1 rounded-full bg-herb/15 px-2 py-0.5 text-[10px] font-bold text-herb">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-smoke">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''}, {addr.suburb} {addr.state}{' '}
                    {addr.postcode}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
