'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { X, Plus, Minus, Flame, Leaf, ShieldCheck, AlertTriangle, Check } from 'lucide-react';
import { formatAUD } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { PublicModifierGroup, PublicProduct } from '@/modules/storefront/queries';
import { useCart, type CartModifier } from './CartProvider';

interface ProductCustomizerModalProps {
  product: PublicProduct | null;
  onClose: () => void;
}

export function ProductCustomizerModal({ product, onClose }: ProductCustomizerModalProps) {
  const { addItem, openDrawer } = useCart();

  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    const defaultVariant = product.variants.find((v) => !v.soldOut) ?? product.variants[0];
    setSelectedVariantId(defaultVariant?.id ?? '');

    const initialGroups: Record<string, string[]> = {};
    for (const g of product.modifierGroups) {
      const defaults = g.options
        .filter((o) => o.isDefault && !o.soldOut)
        .slice(0, g.maxSelect)
        .map((o) => o.id);
      initialGroups[g.id] = defaults;
    }
    setSelectedByGroup(initialGroups);
    setNotes('');
    setQuantity(1);
  }, [product]);

  const selectedVariant = useMemo(() => {
    if (!product) return null;
    return product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0] ?? null;
  }, [product, selectedVariantId]);

  const selectedModifiers = useMemo<CartModifier[]>(() => {
    if (!product) return [];
    const list: CartModifier[] = [];
    for (const group of product.modifierGroups) {
      const ids = selectedByGroup[group.id] ?? [];
      for (const opt of group.options) {
        if (ids.includes(opt.id)) {
          list.push({
            optionId: opt.id,
            groupName: group.name,
            optionName: opt.name,
            priceDeltaCents: opt.priceDeltaCents,
          });
        }
      }
    }
    return list;
  }, [product, selectedByGroup]);

  const groupValidation = useMemo(() => {
    if (!product) return { allValid: false, missingGroups: [] as string[] };
    const missingGroups: string[] = [];
    for (const g of product.modifierGroups) {
      const effectiveMin = g.required ? Math.max(1, g.minSelect) : g.minSelect;
      const count = (selectedByGroup[g.id] ?? []).length;
      if (count < effectiveMin) {
        missingGroups.push(g.name);
      }
    }
    return { allValid: missingGroups.length === 0, missingGroups };
  }, [product, selectedByGroup]);

  const unitCents = useMemo(() => {
    const base = selectedVariant?.priceCents ?? 0;
    const mods = selectedModifiers.reduce((s, m) => s + m.priceDeltaCents, 0);
    return base + mods;
  }, [selectedVariant, selectedModifiers]);

  const totalCents = unitCents * quantity;

  if (!product) return null;

  const isSoldOut = product.soldOut || !selectedVariant || selectedVariant.soldOut;

  function toggleOption(group: PublicModifierGroup, optionId: string) {
    setSelectedByGroup((prev) => {
      const current = prev[group.id] ?? [];
      const exists = current.includes(optionId);

      if (group.maxSelect === 1) {
        if (exists) {
          const minReq = group.required ? Math.max(1, group.minSelect) : group.minSelect;
          return { ...prev, [group.id]: minReq >= 1 ? current : [] };
        }
        return { ...prev, [group.id]: [optionId] };
      }

      if (exists) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.maxSelect) {
        return prev;
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  function handleAddToOrder() {
    if (!product || !selectedVariant || isSoldOut || !selectedVariant.isOrderable || !groupValidation.allValid) return;
    const orderableVariants = product.variants
      .filter((v) => v.isOrderable)
      .map((v) => ({ id: v.id, name: v.name, priceCents: v.priceCents }));
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantName: selectedVariant.name,
      imageUrl: product.imageUrl,
      basePriceCents: selectedVariant.priceCents,
      modifiers: selectedModifiers,
      quantity,
      notes: notes.trim(),
      availableVariants: orderableVariants,
    });
    onClose();
    openDrawer();
  }

  const isHalal = product.tags.includes('halal');
  const isVeg = product.tags.includes('veg');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-char/70 sm:items-center sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border-warm bg-cream shadow-2xl">
        {/* Hero Image Header */}
        <div className="relative h-52 sm:h-60 w-full shrink-0 bg-char">
          <Image
            src={product.imageUrl || '/images/kebab-wrap.jpg'}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-char via-char/35 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-char/80 text-cream hover:bg-char transition cursor-pointer"
            aria-label="Close customiser"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-5 right-5">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              {isHalal && (
                <span className="inline-flex items-center gap-1 rounded-full bg-herb px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cream">
                  <ShieldCheck className="h-3 w-3" /> 100% Halal
                </span>
              )}
              {isVeg && (
                <span className="inline-flex items-center gap-1 rounded-full bg-herb/90 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cream">
                  <Leaf className="h-3 w-3" /> Veg
                </span>
              )}
              {product.spicyLevel > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-chilli px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cream">
                  {Array.from({ length: Math.min(3, product.spicyLevel) }).map((_, idx) => (
                    <Flame key={idx} className="h-3 w-3" />
                  ))}
                  <span>
                    {product.spicyLevel === 1
                      ? 'Mild Heat'
                      : product.spicyLevel === 2
                        ? 'Medium Heat'
                        : 'Hot'}
                  </span>
                </span>
              )}
              {product.soldOut && (
                <span className="rounded-full bg-char px-2.5 py-0.5 text-[11px] font-bold uppercase text-saffron border border-saffron/40">
                  86 · Sold Out
                </span>
              )}
            </div>
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide text-cream drop-shadow">
              {product.name}
            </h2>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {product.description && (
            <p className="text-sm leading-relaxed text-smoke">{product.description}</p>
          )}

          {product.allergens.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-saffron/40 bg-saffron/10 px-3.5 py-2 text-xs text-char">
              <AlertTriangle className="h-4 w-4 shrink-0 text-ember" />
              <span>
                <strong className="font-semibold">Allergens:</strong>{' '}
                {product.allergens.join(', ')}
              </span>
            </div>
          )}

          {/* Variant Selector */}
          {product.variants.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold uppercase tracking-wide text-char">
                  Choose Size / Option
                </h3>
                <span className="rounded-full bg-char px-2.5 py-0.5 text-[11px] font-semibold text-saffron">
                  Required
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {product.variants.map((v) => {
                  const active = v.id === selectedVariant?.id;
                  const unavailable = !v.isOrderable;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={unavailable}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition',
                        unavailable
                          ? 'opacity-55 cursor-not-allowed border-border-warm bg-cream-deep/60'
                          : 'cursor-pointer',
                        !unavailable && active
                          ? 'border-ember bg-ember/10 text-char shadow-xs'
                          : !unavailable && 'border-border-warm bg-white hover:border-ember/50 text-char'
                      )}
                    >
                      <div>
                        <span className={cn('font-semibold text-sm', unavailable && 'line-through')}>
                          {v.name}
                        </span>
                        {v.status === 'COMING_SOON' && (
                          <span className="ml-2 rounded-full bg-saffron/30 px-2 py-0.5 text-[10px] font-bold uppercase text-char">
                            Coming Soon
                          </span>
                        )}
                        {v.status === 'UNAVAILABLE' && (
                          <span className="ml-2 rounded-full bg-char/10 px-2 py-0.5 text-[10px] font-bold uppercase text-smoke">
                            Unavailable
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {formatAUD(v.priceCents)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modifier Groups */}
          {product.modifierGroups.map((group) => {
            const selectedIds = selectedByGroup[group.id] ?? [];
            const effectiveMin = group.required ? Math.max(1, group.minSelect) : group.minSelect;
            const satisfied = selectedIds.length >= effectiveMin;

            const badgeText =
              effectiveMin > 0
                ? group.maxSelect === 1
                  ? 'Required · Pick 1'
                  : `Required · Pick ${effectiveMin}–${group.maxSelect} · ${selectedIds.length} selected`
                : `Optional · Up to ${group.maxSelect} · ${selectedIds.length} selected`;

            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold uppercase tracking-wide text-char">
                    {group.name}
                  </h3>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                      effectiveMin > 0 && !satisfied
                        ? 'bg-chilli/15 text-chilli'
                        : satisfied && selectedIds.length > 0
                        ? 'bg-herb/15 text-herb'
                        : 'bg-cream-deep text-smoke'
                    )}
                  >
                    {badgeText}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.options.map((opt) => {
                    const isChecked = selectedIds.includes(opt.id);
                    const atLimit =
                      group.maxSelect > 1 && !isChecked && selectedIds.length >= group.maxSelect;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={opt.soldOut || atLimit}
                        onClick={() => toggleOption(group, opt.id)}
                        className={cn(
                          'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition cursor-pointer',
                          opt.soldOut && 'opacity-45 cursor-not-allowed line-through',
                          atLimit && 'opacity-50 cursor-not-allowed',
                          isChecked
                            ? 'border-ember bg-ember/10 font-semibold text-char'
                            : 'border-border-warm bg-white text-char hover:border-ember/40'
                        )}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-cream',
                              group.maxSelect === 1 ? 'rounded-full' : 'rounded-sm',
                              isChecked
                                ? 'border-ember bg-ember'
                                : 'border-smoke/40 bg-white'
                            )}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </span>
                          <span className="truncate">{opt.name}</span>
                        </span>
                        {opt.priceDeltaCents > 0 && (
                          <span className="ml-2 shrink-0 font-mono text-xs font-semibold text-smoke tabular-nums">
                            +{formatAUD(opt.priceDeltaCents)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Notes */}
          <div className="space-y-1.5">
            <label className="block font-display text-base font-bold uppercase tracking-wide text-char">
              Special Instructions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={250}
              placeholder="Any allergies or cooking preferences? (e.g. extra garlic sauce on the side)"
              className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char placeholder:text-smoke/70 focus:border-ember focus:outline-none"
            />
          </div>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="border-t border-border-warm bg-white px-5 py-4">
          {!groupValidation.allValid && (
            <p className="mb-2 text-xs font-semibold text-chilli">
              Please complete required selection: {groupValidation.missingGroups.join(', ')}
            </p>
          )}
          <div className="flex items-center gap-3">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-2 rounded-xl border border-border-warm bg-cream px-2 py-1.5">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-char hover:bg-cream-deep transition cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-7 text-center font-mono text-base font-bold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-char hover:bg-cream-deep transition cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Sticky Add Button */}
            <button
              type="button"
              disabled={isSoldOut || !groupValidation.allValid}
              onClick={handleAddToOrder}
              className="flex-1 flex items-center justify-between rounded-xl bg-ember px-5 py-3.5 text-cream shadow-lg shadow-ember/25 transition hover:bg-ember-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="font-display text-lg font-bold uppercase tracking-wide">
                {isSoldOut ? 'Currently Sold Out' : 'Add to Order'}
              </span>
              {!isSoldOut && (
                <span className="font-mono text-base font-bold tabular-nums">
                  {formatAUD(totalCents)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
