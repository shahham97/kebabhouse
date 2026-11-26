'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Clock,
  Store,
  Truck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { formatAUD } from '@/lib/money';
import { cn } from '@/lib/utils';
import { checkDeliveryPostcodeAction } from '@/modules/storefront/actions';

export interface CartModifier {
  optionId: string;
  groupName: string;
  optionName: string;
  priceDeltaCents: number;
}

export interface CartVariantOption {
  id: string;
  name: string;
  priceCents: number;
}

export interface CartItem {
  key: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  basePriceCents: number;
  modifiers: CartModifier[];
  quantity: number;
  notes: string;
  availableVariants?: CartVariantOption[];
}

export type FulfilmentMode = 'PICKUP' | 'DELIVERY';
export type TimingMode = 'ASAP' | 'SCHEDULED';

export interface VerifiedDeliveryZone {
  id: string;
  name: string;
  feeCents: number;
  minOrderCents: number;
  travelMinutes: number;
}

interface PersistedCart {
  items: CartItem[];
  fulfilment: FulfilmentMode;
  postcode: string;
  deliveryZone: VerifiedDeliveryZone | null;
  timing: TimingMode;
  scheduledFor: string;
}

const STORAGE_KEY = 'sk_cart_v1';

const DEFAULT_CART: PersistedCart = {
  items: [],
  fulfilment: 'PICKUP',
  postcode: '',
  deliveryZone: null,
  timing: 'ASAP',
  scheduledFor: '',
};

function buildItemKey(variantId: string, modifiers: CartModifier[], notes: string): string {
  const modIds = [...modifiers]
    .map((m) => m.optionId)
    .sort()
    .join(',');
  return `${variantId}::${modIds}::${notes.trim().toLowerCase()}`;
}

export function calcCartItemUnitCents(item: Pick<CartItem, 'basePriceCents' | 'modifiers'>): number {
  const modTotal = item.modifiers.reduce((sum, m) => sum + m.priceDeltaCents, 0);
  return Math.max(0, item.basePriceCents + modTotal);
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  fulfilment: FulfilmentMode;
  postcode: string;
  deliveryZone: VerifiedDeliveryZone | null;
  timing: TimingMode;
  scheduledFor: string;
  drawerOpen: boolean;
  fulfilmentModalOpen: boolean;
  hydrated: boolean;
  addItem: (item: Omit<CartItem, 'key'>) => void;
  updateQuantity: (key: string, quantity: number) => void;
  updateItemNotes: (key: string, notes: string) => void;
  switchItemVariant: (key: string, nextVariantId: string) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  setFulfilment: (mode: FulfilmentMode) => void;
  setPostcode: (postcode: string) => void;
  setDeliveryZone: (zone: VerifiedDeliveryZone | null) => void;
  setTiming: (timing: TimingMode) => void;
  setScheduledFor: (iso: string) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  openFulfilmentModal: () => void;
  closeFulfilmentModal: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<PersistedCart>(DEFAULT_CART);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fulfilmentModalOpen, setFulfilmentModalOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedCart>;
        setState({
          items: Array.isArray(parsed.items) ? parsed.items : [],
          fulfilment: parsed.fulfilment === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
          postcode: typeof parsed.postcode === 'string' ? parsed.postcode : '',
          deliveryZone: parsed.deliveryZone ?? null,
          timing: parsed.timing === 'SCHEDULED' ? 'SCHEDULED' : 'ASAP',
          scheduledFor: typeof parsed.scheduledFor === 'string' ? parsed.scheduledFor : '',
        });
      }
    } catch {
      // Ignore corrupt localStorage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state, hydrated]);

  const addItem = useCallback((incoming: Omit<CartItem, 'key'>) => {
    const key = buildItemKey(incoming.variantId, incoming.modifiers, incoming.notes);
    setState((prev) => {
      const idx = prev.items.findIndex((i) => i.key === key);
      const existing = idx >= 0 ? prev.items[idx] : undefined;
      if (existing) {
        const next = [...prev.items];
        next[idx] = { ...existing, quantity: existing.quantity + incoming.quantity };
        return { ...prev, items: next };
      }
      return { ...prev, items: [...prev.items, { ...incoming, key }] };
    });
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setState((prev) => {
      if (quantity <= 0) {
        return { ...prev, items: prev.items.filter((i) => i.key !== key) };
      }
      return {
        ...prev,
        items: prev.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
      };
    });
  }, []);

  const updateItemNotes = useCallback((key: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.key === key ? { ...i, notes } : i)),
    }));
  }, []);

  const switchItemVariant = useCallback((key: string, nextVariantId: string) => {
    setState((prev) => {
      const target = prev.items.find((i) => i.key === key);
      if (!target || !target.availableVariants) return prev;
      const nextVar = target.availableVariants.find((v) => v.id === nextVariantId);
      if (!nextVar || nextVar.id === target.variantId) return prev;

      const updatedItem: CartItem = {
        ...target,
        variantId: nextVar.id,
        variantName: nextVar.name,
        basePriceCents: nextVar.priceCents,
        key: buildItemKey(nextVar.id, target.modifiers, target.notes),
      };

      const withoutOld = prev.items.filter((i) => i.key !== key);
      const mergeIdx = withoutOld.findIndex((i) => i.key === updatedItem.key);
      if (mergeIdx >= 0) {
        const merged = [...withoutOld];
        const existing = merged[mergeIdx]!;
        merged[mergeIdx] = { ...existing, quantity: existing.quantity + updatedItem.quantity };
        return { ...prev, items: merged };
      }
      const oldIdx = prev.items.findIndex((i) => i.key === key);
      const nextItems = [...withoutOld];
      nextItems.splice(oldIdx, 0, updatedItem);
      return { ...prev, items: nextItems };
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.key !== key),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setState((prev) => ({ ...prev, items: [] }));
  }, []);

  const setFulfilment = useCallback((fulfilment: FulfilmentMode) => {
    setState((prev) => ({ ...prev, fulfilment }));
  }, []);

  const setPostcode = useCallback((postcode: string) => {
    setState((prev) => ({ ...prev, postcode }));
  }, []);

  const setDeliveryZone = useCallback((deliveryZone: VerifiedDeliveryZone | null) => {
    setState((prev) => ({ ...prev, deliveryZone }));
  }, []);

  const setTiming = useCallback((timing: TimingMode) => {
    setState((prev) => ({ ...prev, timing }));
  }, []);

  const setScheduledFor = useCallback((scheduledFor: string) => {
    setState((prev) => ({ ...prev, scheduledFor }));
  }, []);

  const itemCount = useMemo(
    () => state.items.reduce((sum, item) => sum + item.quantity, 0),
    [state.items]
  );

  const subtotalCents = useMemo(
    () => state.items.reduce((sum, item) => sum + calcCartItemUnitCents(item) * item.quantity, 0),
    [state.items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      itemCount,
      subtotalCents,
      fulfilment: state.fulfilment,
      postcode: state.postcode,
      deliveryZone: state.deliveryZone,
      timing: state.timing,
      scheduledFor: state.scheduledFor,
      drawerOpen,
      fulfilmentModalOpen,
      hydrated,
      addItem,
      updateQuantity,
      updateItemNotes,
      switchItemVariant,
      removeItem,
      clearCart,
      setFulfilment,
      setPostcode,
      setDeliveryZone,
      setTiming,
      setScheduledFor,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      openFulfilmentModal: () => setFulfilmentModalOpen(true),
      closeFulfilmentModal: () => setFulfilmentModalOpen(false),
    }),
    [
      state,
      itemCount,
      subtotalCents,
      drawerOpen,
      fulfilmentModalOpen,
      hydrated,
      addItem,
      updateQuantity,
      updateItemNotes,
      switchItemVariant,
      removeItem,
      clearCart,
      setFulfilment,
      setPostcode,
      setDeliveryZone,
      setTiming,
      setScheduledFor,
    ]
  );

  const hideFloatingButton = pathname?.startsWith('/checkout') || pathname?.startsWith('/order');

  return (
    <CartContext.Provider value={value}>
      {children}

      {/* Floating Bottom-Right Basket Button */}
      {hydrated && itemCount > 0 && !hideFloatingButton && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full bg-ember px-5 py-3.5 text-cream shadow-2xl shadow-char/30 ring-2 ring-saffron/40 transition hover:bg-ember-dark active:scale-95 cursor-pointer"
          aria-label={`Open basket with ${itemCount} items`}
        >
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-char text-saffron font-mono text-xs font-bold tabular-nums">
            {itemCount}
          </span>
          <span className="font-display text-lg font-bold tracking-wide uppercase">View Order</span>
          <span className="border-l border-cream/30 pl-3 font-mono text-sm font-bold tabular-nums">
            {formatAUD(subtotalCents)}
          </span>
        </button>
      )}

      {/* Slide-over Basket Drawer */}
      {drawerOpen && (
        <BasketDrawer
          onClose={() => setDrawerOpen(false)}
          onOpenFulfilment={() => {
            setDrawerOpen(false);
            setFulfilmentModalOpen(true);
          }}
        />
      )}

      {/* Fulfilment Modal */}
      {fulfilmentModalOpen && <FulfilmentModal onClose={() => setFulfilmentModalOpen(false)} />}
    </CartContext.Provider>
  );
}

function BasketDrawer({
  onClose,
  onOpenFulfilment,
}: {
  onClose: () => void;
  onOpenFulfilment: () => void;
}) {
  const {
    items,
    itemCount,
    subtotalCents,
    fulfilment,
    postcode,
    deliveryZone,
    timing,
    updateQuantity,
    updateItemNotes,
    switchItemVariant,
    removeItem,
    clearCart,
  } = useCart();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-char/60 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-cream shadow-2xl border-l border-border-warm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-warm bg-char px-5 py-4 text-cream">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-saffron" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">
              Your Order ({itemCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-cream/70 transition hover:bg-char-soft hover:text-cream cursor-pointer"
            aria-label="Close basket"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Fulfilment Summary Strip */}
        <div className="flex items-center justify-between border-b border-border-warm bg-cream-deep px-5 py-3 text-sm">
          <div className="flex items-center gap-2 text-char">
            {fulfilment === 'DELIVERY' ? (
              <Truck className="h-4 w-4 text-ember" />
            ) : (
              <Store className="h-4 w-4 text-ember" />
            )}
            <span className="font-semibold">
              {fulfilment === 'DELIVERY'
                ? postcode
                  ? `Delivery · ${postcode}`
                  : 'Delivery'
                : 'Pickup · Newtown'}
            </span>
            <span className="text-smoke">· {timing === 'ASAP' ? 'ASAP' : 'Scheduled'}</span>
          </div>
          <button
            type="button"
            onClick={onOpenFulfilment}
            className="text-xs font-semibold text-ember hover:text-ember-dark underline underline-offset-2 cursor-pointer"
          >
            Change
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cream-deep text-smoke">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <p className="font-display text-xl font-bold uppercase text-char">Your basket is empty</p>
              <p className="mt-1 text-sm text-smoke">
                Fresh charcoal kebabs, loaded HSPs & stone-baked pide are waiting.
              </p>
              <Link
                href="/menu"
                onClick={onClose}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ember-dark transition"
              >
                Browse Menu
              </Link>
            </div>
          ) : (
            <>
              {items.map((item) => {
                const unitCents = calcCartItemUnitCents(item);
                const lineTotal = unitCents * item.quantity;
                return (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-border-warm bg-white/80 p-3.5 shadow-xs"
                  >
                    <div className="flex gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
                        <Image
                          src={item.imageUrl || '/images/kebab-wrap.jpg'}
                          alt={item.productName}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-char leading-tight">
                              {item.productName}
                            </h3>
                            <p className="text-xs text-smoke">{item.variantName}</p>
                          </div>
                          <span className="font-mono text-sm font-bold text-char tabular-nums">
                            {formatAUD(lineTotal)}
                          </span>
                        </div>

                        {item.modifiers.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 text-xs text-smoke">
                            {item.modifiers.map((m) => (
                              <li key={m.optionId} className="flex justify-between gap-2">
                                <span className="truncate">
                                  + {m.optionName}
                                </span>
                                {m.priceDeltaCents > 0 && (
                                  <span className="font-mono tabular-nums">
                                    +{formatAUD(m.priceDeltaCents)}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Switch Variant in Order Drawer (auto-recalculates bill) */}
                    {item.availableVariants && item.availableVariants.length > 1 && (
                      <div className="mt-2.5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-smoke mb-1">
                          Variant / Size
                        </label>
                        <select
                          aria-label={`Change variant for ${item.productName}`}
                          value={item.variantId}
                          onChange={(e) => switchItemVariant(item.key, e.target.value)}
                          className="w-full rounded-lg border border-border-warm bg-cream/60 px-2.5 py-1.5 text-xs font-semibold text-char focus:border-ember focus:outline-none"
                        >
                          {item.availableVariants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} — {formatAUD(v.priceCents)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Item notes */}
                    <div className="mt-2.5">
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateItemNotes(item.key, e.target.value)}
                        placeholder="Add kitchen note (e.g. extra crispy, no onion)..."
                        className="w-full rounded-lg border border-border-warm bg-cream/60 px-2.5 py-1.5 text-xs text-char placeholder:text-smoke/70 focus:border-ember focus:outline-none"
                      />
                    </div>

                    {/* Qty Controls */}
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="inline-flex items-center gap-1 text-xs text-smoke hover:text-chilli transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>

                      <div className="flex items-center gap-2 rounded-full border border-border-warm bg-cream px-1.5 py-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-char hover:bg-cream-deep transition cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center font-mono text-sm font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-ember text-cream hover:bg-ember-dark transition cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-medium text-smoke hover:text-chilli underline underline-offset-2 cursor-pointer"
              >
                Clear basket
              </button>
            </>
          )}
        </div>

        {/* Footer Totals + Checkout CTA */}
        {items.length > 0 && (
          <div className="border-t border-border-warm bg-white px-5 py-4 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-smoke">
                <span>Subtotal (incl. GST)</span>
                <span className="font-mono font-semibold text-char tabular-nums">
                  {formatAUD(subtotalCents)}
                </span>
              </div>
              {fulfilment === 'DELIVERY' && deliveryZone && (
                <div className="flex justify-between text-smoke">
                  <span>Delivery ({deliveryZone.name})</span>
                  <span className="font-mono font-semibold text-char tabular-nums">
                    {formatAUD(deliveryZone.feeCents)}
                  </span>
                </div>
              )}
            </div>

            <Link
              href="/checkout"
              onClick={onClose}
              className="flex w-full items-center justify-between rounded-xl bg-ember px-5 py-3.5 text-cream font-semibold shadow-lg shadow-ember/20 transition hover:bg-ember-dark"
            >
              <span className="font-display text-lg uppercase tracking-wide">Proceed to Checkout</span>
              <span className="flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums">
                {formatAUD(
                  subtotalCents + (fulfilment === 'DELIVERY' && deliveryZone ? deliveryZone.feeCents : 0)
                )}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function FulfilmentModal({ onClose }: { onClose: () => void }) {
  const {
    fulfilment,
    postcode,
    deliveryZone,
    timing,
    scheduledFor,
    setFulfilment,
    setPostcode,
    setDeliveryZone,
    setTiming,
    setScheduledFor,
  } = useCart();

  const [localMode, setLocalMode] = useState<FulfilmentMode>(fulfilment);
  const [localPostcode, setLocalPostcode] = useState(postcode);
  const [localTiming, setLocalTiming] = useState<TimingMode>(timing);
  const [localScheduled, setLocalScheduled] = useState(scheduledFor);
  const [checking, setChecking] = useState(false);
  const [zoneStatus, setZoneStatus] = useState<{
    ok: boolean;
    message: string;
    zone: VerifiedDeliveryZone | null;
  } | null>(
    deliveryZone
      ? {
          ok: true,
          message: `We deliver to ${postcode} (${deliveryZone.name} · ${formatAUD(deliveryZone.feeCents)}, ~${deliveryZone.travelMinutes} min)`,
          zone: deliveryZone,
        }
      : null
  );

  async function handleCheckPostcode() {
    if (!localPostcode.trim()) return;
    setChecking(true);
    setZoneStatus(null);
    const res = await checkDeliveryPostcodeAction({ postcode: localPostcode.trim() });
    setChecking(false);
    if (!res.ok) {
      setZoneStatus({ ok: false, message: res.error.message, zone: null });
      return;
    }
    if (res.data.deliverable) {
      const z = res.data.zone;
      setZoneStatus({
        ok: true,
        message: `We deliver to ${res.data.postcode}! ${z.name} · ${formatAUD(z.feeCents)} fee · ~${z.travelMinutes} mins`,
        zone: z,
      });
    } else {
      setZoneStatus({ ok: false, message: res.data.message, zone: null });
    }
  }

  function handleSave() {
    setFulfilment(localMode);
    if (localMode === 'DELIVERY') {
      setPostcode(localPostcode.trim());
      setDeliveryZone(zoneStatus?.zone ?? null);
    }
    setTiming(localTiming);
    setScheduledFor(localTiming === 'SCHEDULED' ? localScheduled : '');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-char/65 p-4 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border-warm bg-cream shadow-2xl">
        <div className="flex items-center justify-between bg-char px-6 py-4 text-cream">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
            How Would You Like Your Order?
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-cream/70 hover:bg-char-soft hover:text-cream cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Pickup / Delivery Toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-cream-deep p-1.5">
            <button
              type="button"
              onClick={() => setLocalMode('PICKUP')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition cursor-pointer',
                localMode === 'PICKUP'
                  ? 'bg-char text-cream shadow-sm'
                  : 'text-smoke hover:text-char'
              )}
            >
              <Store className="h-4 w-4 text-saffron" />
              Pickup
            </button>
            <button
              type="button"
              onClick={() => setLocalMode('DELIVERY')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition cursor-pointer',
                localMode === 'DELIVERY'
                  ? 'bg-char text-cream shadow-sm'
                  : 'text-smoke hover:text-char'
              )}
            >
              <Truck className="h-4 w-4 text-saffron" />
              Delivery
            </button>
          </div>

          {localMode === 'PICKUP' ? (
            <div className="rounded-2xl border border-border-warm bg-white/80 p-4 text-sm">
              <p className="font-semibold text-char flex items-center gap-2">
                <MapPin className="h-4 w-4 text-ember" />
                Star Kebab — 148 King Street, Newtown NSW 2042
              </p>
              <p className="mt-1 text-xs text-smoke">
                Ready in ~15–20 mins for ASAP pickup. No delivery fee.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-smoke">
                Check Your Sydney Postcode
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={localPostcode}
                  onChange={(e) => setLocalPostcode(e.target.value)}
                  placeholder="e.g. 2042, 2000, 2010"
                  className="flex-1 rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm font-mono text-char focus:border-ember focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCheckPostcode}
                  disabled={checking || !localPostcode.trim()}
                  className="rounded-xl bg-char px-4 py-2.5 text-sm font-semibold text-cream hover:bg-char-soft disabled:opacity-50 transition cursor-pointer"
                >
                  {checking ? 'Checking...' : 'Check'}
                </button>
              </div>
              {zoneStatus && (
                <div
                  className={cn(
                    'flex items-start gap-2 rounded-xl p-3 text-xs font-medium',
                    zoneStatus.ok
                      ? 'bg-herb/10 text-herb border border-herb/25'
                      : 'bg-chilli/10 text-chilli border border-chilli/25'
                  )}
                >
                  {zoneStatus.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{zoneStatus.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Timing Toggle */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-smoke">
              When Do You Want It?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLocalTiming('ASAP')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition cursor-pointer',
                  localTiming === 'ASAP'
                    ? 'border-ember bg-ember/10 text-ember'
                    : 'border-border-warm bg-white text-smoke hover:text-char'
                )}
              >
                <Clock className="h-4 w-4" />
                ASAP
              </button>
              <button
                type="button"
                onClick={() => setLocalTiming('SCHEDULED')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition cursor-pointer',
                  localTiming === 'SCHEDULED'
                    ? 'border-ember bg-ember/10 text-ember'
                    : 'border-border-warm bg-white text-smoke hover:text-char'
                )}
              >
                <Clock className="h-4 w-4" />
                Schedule Later
              </button>
            </div>
            {localTiming === 'SCHEDULED' && (
              <input
                type="datetime-local"
                value={localScheduled}
                onChange={(e) => setLocalScheduled(e.target.value)}
                className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none"
              />
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-xl bg-ember py-3.5 font-display text-lg font-bold uppercase tracking-wide text-cream shadow-md transition hover:bg-ember-dark cursor-pointer"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
