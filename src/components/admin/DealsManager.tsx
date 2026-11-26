'use client';

import { useState, useTransition } from 'react';
import { Tag, Ticket, Plus, Power } from 'lucide-react';
import {
  createDealAction,
  toggleDealAction,
  createCouponAction,
  toggleCouponAction,
} from '@/modules/admin/actions';
import { formatAUD } from '@/lib/money';

interface DealsData {
  deals: Array<{
    id: string;
    name: string;
    description: string;
    priceCents: number;
    badgeText: string;
    channels: string;
    active: boolean;
    itemsSummary: string;
  }>;
  coupons: Array<{
    id: string;
    code: string;
    kind: string;
    value: number;
    minSpendCents: number;
    maxUses: number | null;
    usedCount: number;
    firstOrderOnly: boolean;
    active: boolean;
  }>;
  loyaltyRule: {
    pointsPerDollar: number;
    redeemPointsBlock: number;
    redeemValueCents: number;
    active: boolean;
  } | null;
}

export function DealsManager({ data }: { data: DealsData }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Deal form
  const [dealName, setDealName] = useState('');
  const [dealDesc, setDealDesc] = useState('');
  const [dealPriceDollars, setDealPriceDollars] = useState('22.00');
  const [dealBadge, setDealBadge] = useState('HOT DEAL');
  const [dealChannels, setDealChannels] = useState<'WEB' | 'TILL' | 'BOTH'>('BOTH');

  // Coupon form
  const [cCode, setCCode] = useState('');
  const [cKind, setCKind] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [cValue, setCValue] = useState('15');
  const [cMinSpendDollars, setCMinSpendDollars] = useState('25');
  const [cMaxUses, setCMaxUses] = useState('');
  const [cFirstOnly, setCFirstOnly] = useState(false);

  const handleCreateDeal = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createDealAction({
        name: dealName,
        description: dealDesc,
        priceCents: Math.round((Number(dealPriceDollars) || 0) * 100),
        badgeText: dealBadge,
        channels: dealChannels,
      });
      if (res.ok) {
        setDealName('');
        setDealDesc('');
        setFeedback({ type: 'ok', text: `Deal "${res.data.name}" created.` });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const val =
      cKind === 'PERCENT'
        ? Math.round(Number(cValue) || 0)
        : Math.round((Number(cValue) || 0) * 100);
    startTransition(async () => {
      const res = await createCouponAction({
        code: cCode,
        kind: cKind,
        value: val,
        minSpendCents: Math.round((Number(cMinSpendDollars) || 0) * 100),
        maxUses: cMaxUses ? Number(cMaxUses) : null,
        firstOrderOnly: cFirstOnly,
      });
      if (res.ok) {
        setCCode('');
        setFeedback({ type: 'ok', text: `Coupon ${res.data.code} created.` });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'ok'
              ? 'border-herb/30 bg-herb/10 text-herb'
              : 'border-chilli/30 bg-chilli/10 text-chilli'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Loyalty summary banner */}
      {data.loyaltyRule && (
        <div className="rounded-2xl border border-saffron/40 bg-saffron/15 px-5 py-4 text-sm text-char">
          <span className="font-display font-bold">Loyalty Program Active:</span> Earn{' '}
          <span className="font-mono font-bold">{data.loyaltyRule.pointsPerDollar} pt</span> per
          $1 spent · Redeem{' '}
          <span className="font-mono font-bold">{data.loyaltyRule.redeemPointsBlock} pts</span>{' '}
          for{' '}
          <span className="font-mono font-bold">
            {formatAUD(data.loyaltyRule.redeemValueCents)}
          </span>{' '}
          off.
        </div>
      )}

      {/* Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create Deal */}
        <form
          onSubmit={handleCreateDeal}
          className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-ember" />
            <h2 className="font-display text-lg font-bold text-char">Create Combo Deal</h2>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-smoke">Deal Name</label>
              <input
                type="text"
                required
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder="Late Night HSP + Can Combo"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Price (AUD $)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                required
                value={dealPriceDollars}
                onChange={(e) => setDealPriceDollars(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Badge Text</label>
              <input
                type="text"
                value={dealBadge}
                onChange={(e) => setDealBadge(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Channels</label>
              <select
                value={dealChannels}
                onChange={(e) => setDealChannels(e.target.value as 'WEB' | 'TILL' | 'BOTH')}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              >
                <option value="BOTH">Web & Till</option>
                <option value="WEB">Web Only</option>
                <option value="TILL">Till Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Description</label>
              <input
                type="text"
                value={dealDesc}
                onChange={(e) => setDealDesc(e.target.value)}
                placeholder="Includes 375ml soft drink"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream hover:bg-ember-dark disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Create Deal
            </button>
          </div>
        </form>

        {/* Create Coupon */}
        <form
          onSubmit={handleCreateCoupon}
          className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-ember" />
            <h2 className="font-display text-lg font-bold text-char">Create Coupon Code</h2>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-smoke">Code</label>
              <input
                type="text"
                required
                value={cCode}
                onChange={(e) => setCCode(e.target.value.toUpperCase())}
                placeholder="STAR15"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm uppercase text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Kind</label>
              <select
                value={cKind}
                onChange={(e) => setCKind(e.target.value as 'PERCENT' | 'FIXED')}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              >
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">
                {cKind === 'PERCENT' ? 'Percent Off (%)' : 'Amount Off ($)'}
              </label>
              <input
                type="number"
                step={cKind === 'PERCENT' ? '1' : '0.5'}
                min="1"
                required
                value={cValue}
                onChange={(e) => setCValue(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Min Spend ($)</label>
              <input
                type="number"
                step="1"
                min="0"
                value={cMinSpendDollars}
                onChange={(e) => setCMinSpendDollars(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Max Uses (optional)</label>
              <input
                type="number"
                min="1"
                value={cMaxUses}
                onChange={(e) => setCMaxUses(e.target.value)}
                placeholder="Unlimited"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div className="flex items-end">
              <label className="flex w-full items-center gap-2 rounded-xl border border-border-warm bg-cream px-3 py-2 text-xs font-medium text-char">
                <input
                  type="checkbox"
                  checked={cFirstOnly}
                  onChange={(e) => setCFirstOnly(e.target.checked)}
                  className="h-4 w-4 accent-ember"
                />
                First order only
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-char px-4 py-2.5 text-sm font-semibold text-cream hover:bg-char-soft disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Create Coupon
            </button>
          </div>
        </form>
      </div>

      {/* Deals List */}
      <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-char">
          Combo Deals ({data.deals.length})
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.deals.map((d) => (
            <div
              key={d.id}
              className={`flex flex-col justify-between rounded-xl border p-4 ${
                d.active ? 'border-border-warm bg-cream/40' : 'border-border-warm/50 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-ember/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-ember">
                    {d.badgeText}
                  </span>
                  <span className="font-mono text-base font-bold text-char tabular-nums">
                    {formatAUD(d.priceCents)}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-base font-bold text-char">{d.name}</h3>
                {d.description && <p className="mt-1 text-xs text-smoke">{d.description}</p>}
                {d.itemsSummary && (
                  <p className="mt-1 text-[11px] font-medium text-char/80">{d.itemsSummary}</p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border-warm pt-3 text-xs">
                <span className="font-mono text-smoke">{d.channels}</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await toggleDealAction({ id: d.id });
                      if (!res.ok) setFeedback({ type: 'err', text: res.error.message });
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                    d.active
                      ? 'bg-herb/15 text-herb hover:bg-herb/25'
                      : 'bg-char/10 text-smoke hover:bg-char/20'
                  }`}
                >
                  <Power className="h-3 w-3" />
                  {d.active ? 'Active' : 'Paused'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coupons List */}
      <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-char">
          Coupons ({data.coupons.length})
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.coupons.map((c) => (
            <div
              key={c.id}
              className={`flex flex-col justify-between rounded-xl border p-4 ${
                c.active ? 'border-border-warm bg-cream/40' : 'border-border-warm/50 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-ember">{c.code}</span>
                  <span className="font-mono text-sm font-bold text-char">
                    {c.kind === 'PERCENT' ? `${c.value}% OFF` : `${formatAUD(c.value)} OFF`}
                  </span>
                </div>
                <div className="mt-1 text-xs text-smoke">
                  Min spend: {formatAUD(c.minSpendCents)} · Uses: {c.usedCount}
                  {c.maxUses ? `/${c.maxUses}` : ' (∞)'}
                </div>
                {c.firstOrderOnly && (
                  <span className="mt-1.5 inline-block rounded bg-saffron/25 px-2 py-0.5 font-mono text-[10px] font-semibold text-char">
                    FIRST ORDER ONLY
                  </span>
                )}
              </div>
              <div className="mt-3 flex justify-end border-t border-border-warm pt-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await toggleCouponAction({ id: c.id });
                      if (!res.ok) setFeedback({ type: 'err', text: res.error.message });
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    c.active
                      ? 'bg-herb/15 text-herb hover:bg-herb/25'
                      : 'bg-char/10 text-smoke hover:bg-char/20'
                  }`}
                >
                  <Power className="h-3 w-3" />
                  {c.active ? 'Active' : 'Disabled'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
