'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  Truck,
  Clock,
  CreditCard,
  Tag,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Lock,
  Loader2,
  X,
} from 'lucide-react';
import { applyBps, calcInclusiveGst, formatAUD } from '@/lib/money';
import { checkoutValidationSchema } from '@/modules/auth/schemas';
import { cn } from '@/lib/utils';
import {
  checkDeliveryPostcodeAction,
  placeWebOrderAction,
  validateCouponAction,
} from '@/modules/storefront/actions';
import { calcCartItemUnitCents, useCart } from './CartProvider';

interface CheckoutFormProps {
  store: {
    name: string;
    address: string;
    gstRatePct: number;
    gstRegistered: boolean;
    cardSurchargeBps: number;
    onlinePaused: boolean;
    pauseMessage: string | null;
  };
  initialCouponCode?: string;
  customerDefaults: { name: string; email: string; phone: string } | null;
  hasLiveStripe: boolean;
}

export function CheckoutForm({
  store,
  initialCouponCode = '',
  customerDefaults,
  hasLiveStripe,
}: CheckoutFormProps) {
  const router = useRouter();
  const {
    items,
    subtotalCents,
    fulfilment,
    postcode,
    deliveryZone,
    timing,
    scheduledFor,
    hydrated,
    setFulfilment,
    setPostcode,
    setDeliveryZone,
    setTiming,
    setScheduledFor,
    clearCart,
  } = useCart();

  // Contact & delivery fields
  const [customerName, setCustomerName] = useState(customerDefaults?.name ?? '');
  const [customerEmail, setCustomerEmail] = useState(customerDefaults?.email ?? '');
  const [customerPhone, setCustomerPhone] = useState(customerDefaults?.phone ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliverySuburb, setDeliverySuburb] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Postcode verification
  const [postcodeInput, setPostcodeInput] = useState(postcode);
  const [checkingPostcode, setCheckingPostcode] = useState(false);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState(initialCouponCode);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    label: string;
    discountCents: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Stable idempotency key per checkout attempt
  const idempotencyKeyRef = useRef<string>('');
  useEffect(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `sk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }, []);

  // Sync postcode input once hydrated
  useEffect(() => {
    if (hydrated && postcode && !postcodeInput) {
      setPostcodeInput(postcode);
    }
  }, [hydrated, postcode, postcodeInput]);

  // If online ASAP is paused, default to SCHEDULED
  useEffect(() => {
    if (store.onlinePaused && timing === 'ASAP') {
      setTiming('SCHEDULED');
    }
  }, [store.onlinePaused, timing, setTiming]);

  async function handleVerifyPostcode() {
    const trimmed = postcodeInput.trim();
    if (!trimmed) return;
    setCheckingPostcode(true);
    setPostcodeError(null);
    const res = await checkDeliveryPostcodeAction({ postcode: trimmed });
    setCheckingPostcode(false);
    if (!res.ok) {
      setPostcodeError(res.error.message);
      setDeliveryZone(null);
      return;
    }
    if (res.data.deliverable) {
      setPostcode(res.data.postcode);
      setDeliveryZone(res.data.zone);
    } else {
      setPostcodeError(res.data.message);
      setDeliveryZone(null);
    }
  }

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setApplyingCoupon(true);
    setCouponError(null);
    const res = await validateCouponAction({ code, subtotalCents });
    setApplyingCoupon(false);
    if (!res.ok) {
      setCouponError(res.error.message);
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon({
      code: res.data.code,
      label: res.data.label,
      discountCents: res.data.discountCents,
    });
  }

  const deliveryFeeCents = fulfilment === 'DELIVERY' && deliveryZone ? deliveryZone.feeCents : 0;
  const discountCents = appliedCoupon ? Math.min(subtotalCents, appliedCoupon.discountCents) : 0;
  const preSurcharge = Math.max(0, subtotalCents - discountCents + deliveryFeeCents);
  const surchargeCents = applyBps(preSurcharge, store.cardSurchargeBps);
  const totalCents = preSurcharge + surchargeCents;
  const gstCents = store.gstRegistered ? calcInclusiveGst(totalCents, store.gstRatePct) : 0;

  const minDeliveryNotMet = useMemo(() => {
    if (fulfilment !== 'DELIVERY' || !deliveryZone) return false;
    return subtotalCents < deliveryZone.minOrderCents;
  }, [fulfilment, deliveryZone, subtotalCents]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (items.length === 0) {
      setSubmitError('Your basket is empty.');
      return;
    }

    const clientCheck = checkoutValidationSchema.safeParse({
      fulfilment,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress: fulfilment === 'DELIVERY' ? deliveryAddress : undefined,
      deliverySuburb: fulfilment === 'DELIVERY' ? deliverySuburb : undefined,
      deliveryPostcode: fulfilment === 'DELIVERY' ? postcodeInput.trim() : undefined,
    });
    if (!clientCheck.success) {
      setSubmitError(clientCheck.error.issues[0]?.message ?? 'Please check the required fields.');
      return;
    }

    if (fulfilment === 'DELIVERY') {
      if (!deliveryZone || !postcodeInput.trim()) {
        setSubmitError('Please check and confirm your delivery postcode first.');
        return;
      }
      if (minDeliveryNotMet) {
        setSubmitError(
          `Minimum order for ${deliveryZone.name} is ${formatAUD(deliveryZone.minOrderCents)}.`
        );
        return;
      }
      if (!deliveryAddress.trim()) {
        setSubmitError('Please enter your street address for delivery.');
        return;
      }
    }

    if (timing === 'SCHEDULED' && !scheduledFor) {
      setSubmitError('Please choose a date and time for your scheduled order.');
      return;
    }

    setSubmitting(true);
    const res = await placeWebOrderAction({
      fulfilment,
      timing,
      scheduledFor: timing === 'SCHEDULED' ? new Date(scheduledFor).toISOString() : null,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress: fulfilment === 'DELIVERY' ? deliveryAddress : null,
      deliverySuburb: fulfilment === 'DELIVERY' ? deliverySuburb : null,
      deliveryPostcode: fulfilment === 'DELIVERY' ? postcodeInput.trim() : null,
      notes: orderNotes,
      couponCode: appliedCoupon?.code ?? null,
      idempotencyKey: idempotencyKeyRef.current,
      paymentMode: 'TEST_CARD',
      items: items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        modifierOptionIds: i.modifiers.map((m) => m.optionId),
        notes: i.notes,
      })),
    });
    setSubmitting(false);

    if (!res.ok) {
      setSubmitError(res.error.message);
      return;
    }

    clearCart();
    router.push(
      `/order/${res.data.publicId}?t=${encodeURIComponent(res.data.trackingToken)}`
    );
  }

  if (!hydrated) {
    return (
      <div className="rounded-3xl border border-border-warm bg-white p-12 text-center text-smoke">
        Loading your basket...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-border-warm bg-white p-12 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream-deep text-smoke">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h2 className="font-display text-3xl font-extrabold uppercase text-char">
          Your Basket Is Empty
        </h2>
        <p className="text-sm text-smoke">
          Add some charcoal kebabs, HSPs or wood-fired pide before checking out.
        </p>
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-bold text-cream hover:bg-ember-dark transition"
        >
          Return to Menu
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
      {/* Left Column: Progressive Form */}
      <div className="lg:col-span-7 space-y-6">
        {/* Step 1: Fulfilment */}
        <section className="rounded-3xl border border-border-warm bg-white p-6 space-y-5 shadow-xs">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char">
            1. Fulfilment &amp; Timing
          </h2>

          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-cream-deep p-1.5">
            <button
              type="button"
              onClick={() => setFulfilment('PICKUP')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition cursor-pointer',
                fulfilment === 'PICKUP'
                  ? 'bg-char text-saffron shadow-sm'
                  : 'text-smoke hover:text-char'
              )}
            >
              <Store className="h-4 w-4" />
              Pickup (Free)
            </button>
            <button
              type="button"
              onClick={() => setFulfilment('DELIVERY')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition cursor-pointer',
                fulfilment === 'DELIVERY'
                  ? 'bg-char text-saffron shadow-sm'
                  : 'text-smoke hover:text-char'
              )}
            >
              <Truck className="h-4 w-4" />
              Delivery
            </button>
          </div>

          {fulfilment === 'PICKUP' ? (
            <div className="rounded-2xl border border-border-warm bg-cream/60 p-4 text-sm">
              <p className="font-bold text-char">Pickup at {store.name}</p>
              <p className="text-xs text-smoke mt-0.5">{store.address}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
                  Delivery Postcode
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={postcodeInput}
                    onChange={(e) => {
                      setPostcodeInput(e.target.value);
                      setPostcodeError(null);
                    }}
                    placeholder="e.g. 2042, 2000, 2010"
                    className="flex-1 rounded-xl border border-border-warm bg-cream/40 px-3.5 py-2.5 text-sm font-mono text-char focus:border-ember focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyPostcode}
                    disabled={checkingPostcode || !postcodeInput.trim()}
                    className="rounded-xl bg-char px-4 py-2.5 text-sm font-bold text-cream hover:bg-char-soft disabled:opacity-50 cursor-pointer"
                  >
                    {checkingPostcode ? 'Checking...' : 'Check Zone'}
                  </button>
                </div>

                {deliveryZone && !postcodeError && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-herb">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {deliveryZone.name} · {formatAUD(deliveryZone.feeCents)} delivery fee · ~
                    {deliveryZone.travelMinutes} mins
                  </p>
                )}
                {postcodeError && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-chilli">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {postcodeError}
                  </p>
                )}
                {minDeliveryNotMet && deliveryZone && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-chilli">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Add {formatAUD(deliveryZone.minOrderCents - subtotalCents)} more to meet the{' '}
                    {formatAUD(deliveryZone.minOrderCents)} delivery minimum.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    required={fulfilment === 'DELIVERY'}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Unit / Street number & name"
                    className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1">
                    Suburb
                  </label>
                  <input
                    type="text"
                    value={deliverySuburb}
                    onChange={(e) => setDeliverySuburb(e.target.value)}
                    placeholder="e.g. Newtown"
                    className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Timing */}
          <div className="space-y-2.5 pt-2 border-t border-border-warm">
            <label className="block text-xs font-bold uppercase tracking-wider text-smoke">
              Timing
            </label>
            {store.onlinePaused && (
              <p className="rounded-xl bg-saffron/20 px-3 py-2 text-xs font-semibold text-char">
                {store.pauseMessage ||
                  'ASAP orders are temporarily paused — please schedule a time slot below.'}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={store.onlinePaused}
                onClick={() => setTiming('ASAP')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
                  timing === 'ASAP'
                    ? 'border-ember bg-ember/10 text-ember'
                    : 'border-border-warm bg-white text-smoke hover:text-char'
                )}
              >
                <Clock className="h-4 w-4" />
                ASAP (~20 mins)
              </button>
              <button
                type="button"
                onClick={() => setTiming('SCHEDULED')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition cursor-pointer',
                  timing === 'SCHEDULED'
                    ? 'border-ember bg-ember/10 text-ember'
                    : 'border-border-warm bg-white text-smoke hover:text-char'
                )}
              >
                <Clock className="h-4 w-4" />
                Schedule Pre-Order
              </button>
            </div>
            {timing === 'SCHEDULED' && (
              <input
                type="datetime-local"
                required
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none"
              />
            )}
          </div>
        </section>

        {/* Step 2: Contact Details */}
        <section className="rounded-3xl border border-border-warm bg-white p-6 space-y-4 shadow-xs">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char">
            2. Your Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Charlotte Taylor"
                className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1">
                Mobile Phone *
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0412 345 678"
                className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1">
              Email (for tax invoice &amp; live tracker link) *
            </label>
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="charlotte.taylor@example.com.au"
              className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1">
              Order / Delivery Notes
            </label>
            <textarea
              rows={2}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Gate code, extra napkins, cutlery request..."
              className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none"
            />
          </div>
        </section>

        {/* Step 3: Payment */}
        <section className="rounded-3xl border border-border-warm bg-white p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char">
              3. Payment
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-herb">
              <Lock className="h-3.5 w-3.5" /> Encrypted
            </span>
          </div>

          <div className="rounded-2xl border-2 border-ember/40 bg-cream/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-char text-sm">
                <CreditCard className="h-4 w-4 text-ember" />
                {hasLiveStripe ? 'Card Payment (Stripe / Demo)' : 'Instant Demo Card (Visa •••• 4242)'}
              </span>
              <span className="rounded-full bg-saffron/30 px-2.5 py-0.5 text-[11px] font-bold text-char">
                Test Mode Ready
              </span>
            </div>
            <p className="text-xs text-smoke">
              Clicking Pay confirms your order immediately, reserves kitchen stock, fires station
              tickets, and opens your live order tracker.
            </p>
          </div>

          {submitError && (
            <div className="flex items-start gap-2 rounded-xl border border-chilli/30 bg-chilli/10 p-3.5 text-sm font-medium text-chilli">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || minDeliveryNotMet}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-ember py-4 font-display text-2xl font-extrabold uppercase tracking-wide text-cream shadow-xl shadow-ember/25 transition hover:bg-ember-dark disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Sending To Charcoal Grill...
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                Pay {formatAUD(totalCents)} &amp; Place Order
              </>
            )}
          </button>
        </section>
      </div>

      {/* Right Column: Order Summary & Coupon */}
      <aside className="lg:col-span-5 lg:sticky lg:top-6 space-y-5">
        <div className="rounded-3xl border border-border-warm bg-white p-6 shadow-xs space-y-5">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char">
            Order Summary
          </h2>

          <ul className="divide-y divide-border-warm/70 max-h-80 overflow-y-auto pr-1">
            {items.map((item) => {
              const lineTotal = calcCartItemUnitCents(item) * item.quantity;
              return (
                <li key={item.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-char">
                        {item.quantity}× {item.productName}
                      </p>
                      <p className="text-xs text-smoke">{item.variantName}</p>
                      {item.modifiers.length > 0 && (
                        <p className="mt-0.5 text-xs text-smoke">
                          {item.modifiers.map((m) => m.optionName).join(', ')}
                        </p>
                      )}
                      {item.notes && (
                        <p className="mt-0.5 text-xs italic text-ember">&ldquo;{item.notes}&rdquo;</p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold text-char tabular-nums">
                      {formatAUD(lineTotal)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Coupon Input */}
          <div className="border-t border-border-warm pt-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-smoke">
              <Tag className="h-3.5 w-3.5 text-ember" /> Promo / Coupon Code
            </label>
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-xl border border-herb/30 bg-herb/10 px-3.5 py-2.5 text-sm">
                <span className="font-bold text-herb">
                  {appliedCoupon.code} ({appliedCoupon.label})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput('');
                  }}
                  className="text-xs font-semibold text-smoke hover:text-chilli inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setCouponError(null);
                  }}
                  placeholder="Try STAR15 or WELCOME5"
                  className="flex-1 rounded-xl border border-border-warm bg-cream/40 px-3 py-2 text-sm font-mono uppercase text-char focus:border-ember focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={applyingCoupon || !couponInput.trim()}
                  className="rounded-xl bg-char px-4 py-2 text-xs font-bold uppercase tracking-wider text-saffron hover:bg-char-soft disabled:opacity-50 cursor-pointer"
                >
                  {applyingCoupon ? '...' : 'Apply'}
                </button>
              </div>
            )}
            {couponError && <p className="text-xs font-medium text-chilli">{couponError}</p>}
          </div>

          {/* Totals Breakdown */}
          <div className="border-t border-border-warm pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-smoke">
              <span>Subtotal</span>
              <span className="font-mono font-semibold text-char tabular-nums">
                {formatAUD(subtotalCents)}
              </span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between text-herb font-semibold">
                <span>Discount ({appliedCoupon?.code})</span>
                <span className="font-mono tabular-nums">-{formatAUD(discountCents)}</span>
              </div>
            )}
            {fulfilment === 'DELIVERY' && (
              <div className="flex justify-between text-smoke">
                <span>Delivery Fee</span>
                <span className="font-mono font-semibold text-char tabular-nums">
                  {deliveryZone ? formatAUD(deliveryFeeCents) : 'Check postcode'}
                </span>
              </div>
            )}
            {surchargeCents > 0 && (
              <div className="flex justify-between text-smoke">
                <span>Card Surcharge</span>
                <span className="font-mono font-semibold text-char tabular-nums">
                  {formatAUD(surchargeCents)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-border-warm pt-3 text-base font-extrabold text-char">
              <span>Total (AUD)</span>
              <span className="font-mono text-xl tabular-nums">{formatAUD(totalCents)}</span>
            </div>
            {store.gstRegistered && (
              <p className="text-right text-xs text-smoke font-mono tabular-nums">
                Includes GST of {formatAUD(gstCents)}
              </p>
            )}
          </div>
        </div>
      </aside>
    </form>
  );
}
