'use client';

import { useState, useTransition } from 'react';
import { Plus, Power, Flame, Layers } from 'lucide-react';
import {
  createCategoryAction,
  createProductAction,
  addVariantAction,
  toggleProductActiveAction,
  toggleVariantActiveAction,
  toggleProductSoldOutAction,
} from '@/modules/admin/actions';
import { formatAUD } from '@/lib/money';

interface CatalogData {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    showInMenu: boolean;
    defaultStationId: string | null;
    defaultStationName: string | null;
    productCount: number;
  }>;
  products: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    stationId: string | null;
    stationName: string | null;
    name: string;
    description: string;
    taxCode: string;
    visibility: string;
    active: boolean;
    soldOut: boolean;
    isBestSeller: boolean;
    variants: Array<{
      id: string;
      name: string;
      sku: string;
      priceCents: number;
      prepMinutes: number;
      active: boolean;
      soldOut: boolean;
    }>;
  }>;
  stations: Array<{ id: string; name: string; code: string }>;
}

export function CatalogManager({ data }: { data: CatalogData }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // New Category form
  const [catName, setCatName] = useState('');
  const [catStationId, setCatStationId] = useState('');

  // New Product form
  const [prodName, setProdName] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState(data.categories[0]?.id ?? '');
  const [prodStationId, setProdStationId] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodVariantName, setProdVariantName] = useState('Regular');
  const [prodPriceDollars, setProdPriceDollars] = useState('14.50');
  const [prodPrepMins, setProdPrepMins] = useState('8');
  const [prodTaxCode, setProdTaxCode] = useState<'GST' | 'GST_FREE'>('GST');
  const [prodVisibility, setProdVisibility] = useState<'WEB' | 'TILL' | 'BOTH'>('BOTH');

  // Add Variant form state (keyed by productId)
  const [addingVariantFor, setAddingVariantFor] = useState<string | null>(null);
  const [varName, setVarName] = useState('');
  const [varPriceDollars, setVarPriceDollars] = useState('18.50');
  const [varPrepMins, setVarPrepMins] = useState('10');

  const showMsg = (type: 'ok' | 'err', text: string) => setFeedback({ type, text });

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCategoryAction({
        name: catName,
        defaultStationId: catStationId || null,
      });
      if (res.ok) {
        setCatName('');
        showMsg('ok', `Category "${res.data.name}" added.`);
      } else {
        showMsg('err', res.error.message);
      }
    });
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(prodPriceDollars) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      showMsg('err', 'Enter a valid AUD price.');
      return;
    }
    startTransition(async () => {
      const res = await createProductAction({
        categoryId: prodCategoryId,
        stationId: prodStationId || null,
        name: prodName,
        description: prodDesc,
        taxCode: prodTaxCode,
        visibility: prodVisibility,
        defaultVariantName: prodVariantName || 'Regular',
        defaultPriceCents: cents,
        defaultPrepMinutes: Number(prodPrepMins) || 8,
      });
      if (res.ok) {
        setProdName('');
        setProdDesc('');
        showMsg('ok', `Product "${res.data.name}" created.`);
      } else {
        showMsg('err', res.error.message);
      }
    });
  };

  const handleAddVariant = (productId: string) => {
    const cents = Math.round(Number(varPriceDollars) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      showMsg('err', 'Enter a valid variant price.');
      return;
    }
    startTransition(async () => {
      const res = await addVariantAction({
        productId,
        name: varName,
        priceCents: cents,
        prepMinutes: Number(varPrepMins) || 8,
      });
      if (res.ok) {
        setVarName('');
        setAddingVariantFor(null);
        showMsg('ok', `Variant "${res.data.name}" added.`);
      } else {
        showMsg('err', res.error.message);
      }
    });
  };

  const filteredProducts =
    selectedCategoryFilter === 'ALL'
      ? data.products
      : data.products.filter((p) => p.categoryId === selectedCategoryFilter);

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

      {/* Creation forms */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Add Category */}
        <form
          onSubmit={handleCreateCategory}
          className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
        >
          <h2 className="font-display text-lg font-bold text-char">New Category</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-smoke">Category Name</label>
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Charcoal Plates"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Default Station</label>
              <select
                value={catStationId}
                onChange={(e) => setCatStationId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
              >
                <option value="">None (use store default)</option>
                {data.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-char px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-char-soft disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          </div>
        </form>

        {/* Add Product */}
        <form
          onSubmit={handleCreateProduct}
          className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs lg:col-span-2"
        >
          <h2 className="font-display text-lg font-bold text-char">New Menu Product</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-smoke">Product Name</label>
              <input
                type="text"
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Mixed Doner Wrap"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Category</label>
              <select
                required
                value={prodCategoryId}
                onChange={(e) => setProdCategoryId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Kitchen Station</label>
              <select
                value={prodStationId}
                onChange={(e) => setProdStationId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
              >
                <option value="">Inherit from category</option>
                {data.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">First Variant</label>
              <input
                type="text"
                required
                value={prodVariantName}
                onChange={(e) => setProdVariantName(e.target.value)}
                placeholder="Regular"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Price (AUD $)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                required
                value={prodPriceDollars}
                onChange={(e) => setProdPriceDollars(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char focus:border-ember focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Prep Time (mins)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={prodPrepMins}
                onChange={(e) => setProdPrepMins(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char focus:border-ember focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-smoke">Description</label>
              <input
                type="text"
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                placeholder="Shaved lamb & chicken, fresh salad, garlic & chilli sauce"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-smoke">Tax</label>
                <select
                  value={prodTaxCode}
                  onChange={(e) => setProdTaxCode(e.target.value as 'GST' | 'GST_FREE')}
                  className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-2 py-2 text-xs text-char"
                >
                  <option value="GST">GST (10%)</option>
                  <option value="GST_FREE">GST-Free</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-smoke">Channel</label>
                <select
                  value={prodVisibility}
                  onChange={(e) => setProdVisibility(e.target.value as 'WEB' | 'TILL' | 'BOTH')}
                  className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-2 py-2 text-xs text-char"
                >
                  <option value="BOTH">Both</option>
                  <option value="WEB">Web</option>
                  <option value="TILL">Till</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending || data.categories.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-ember-dark disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Create Product
            </button>
          </div>
        </form>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategoryFilter('ALL')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            selectedCategoryFilter === 'ALL'
              ? 'bg-char text-cream'
              : 'border border-border-warm bg-white text-char hover:bg-cream-deep'
          }`}
        >
          All Categories ({data.products.length})
        </button>
        {data.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategoryFilter(c.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedCategoryFilter === c.id
                ? 'bg-ember text-cream'
                : 'border border-border-warm bg-white text-char hover:bg-cream-deep'
            }`}
          >
            {c.name} ({c.productCount})
          </button>
        ))}
      </div>

      {/* Products List */}
      <div className="space-y-4">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border bg-white p-5 shadow-xs transition ${
              !p.active ? 'border-border-warm/60 opacity-65' : 'border-border-warm'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-char">{p.name}</h3>
                  <span className="rounded-md bg-cream px-2 py-0.5 text-xs font-medium text-smoke">
                    {p.categoryName}
                  </span>
                  {p.stationName && (
                    <span className="rounded-md bg-saffron/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-char">
                      {p.stationName}
                    </span>
                  )}
                  <span className="rounded-md border border-border-warm px-2 py-0.5 font-mono text-[11px] text-smoke">
                    {p.taxCode} · {p.visibility}
                  </span>
                  {p.soldOut && (
                    <span className="rounded-md bg-chilli px-2 py-0.5 font-mono text-[11px] font-bold text-cream">
                      86 SOLD OUT
                    </span>
                  )}
                  {!p.active && (
                    <span className="rounded-md bg-char px-2 py-0.5 font-mono text-[11px] font-bold text-cream">
                      DISABLED
                    </span>
                  )}
                </div>
                {p.description && <p className="mt-1 text-xs text-smoke">{p.description}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await toggleProductSoldOutAction({ id: p.id });
                      if (!res.ok) showMsg('err', res.error.message);
                    })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    p.soldOut
                      ? 'bg-chilli text-cream hover:bg-chilli/90'
                      : 'border border-border-warm bg-cream text-char hover:bg-cream-deep'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  {p.soldOut ? 'Clear 86' : 'Mark 86'}
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await toggleProductActiveAction({ id: p.id });
                      if (!res.ok) showMsg('err', res.error.message);
                    })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    p.active
                      ? 'border border-border-warm bg-white text-char hover:bg-cream'
                      : 'bg-herb text-cream hover:bg-herb/90'
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {p.active ? 'Disable' : 'Enable'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setAddingVariantFor(addingVariantFor === p.id ? null : p.id)
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-char px-3 py-1.5 text-xs font-semibold text-cream transition hover:bg-char-soft"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Add Variant
                </button>
              </div>
            </div>

            {/* Variants */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {p.variants.map((v) => (
                <div
                  key={v.id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                    v.active
                      ? 'border-border-warm bg-cream/60'
                      : 'border-border-warm/50 bg-cream/20 opacity-60'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-char">{v.name}</div>
                    <div className="font-mono text-[11px] text-smoke">
                      {v.sku} · {v.prepMinutes}m
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-char tabular-nums">
                      {formatAUD(v.priceCents)}
                    </span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await toggleVariantActiveAction({ id: v.id });
                          if (!res.ok) showMsg('err', res.error.message);
                        })
                      }
                      className={`rounded-lg px-2 py-1 font-mono text-[10px] font-semibold ${
                        v.active
                          ? 'bg-herb/15 text-herb hover:bg-herb/25'
                          : 'bg-char/10 text-smoke hover:bg-char/20'
                      }`}
                    >
                      {v.active ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Inline Add Variant Form */}
            {addingVariantFor === p.id && (
              <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-ember/30 bg-cream p-3">
                <div className="min-w-[140px] flex-1">
                  <label className="block text-[11px] font-semibold text-smoke">Variant Name</label>
                  <input
                    type="text"
                    value={varName}
                    onChange={(e) => setVarName(e.target.value)}
                    placeholder="Large / Jumbo"
                    className="mt-1 w-full rounded-lg border border-border-warm bg-white px-2.5 py-1.5 text-sm text-char"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-[11px] font-semibold text-smoke">Price ($)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={varPriceDollars}
                    onChange={(e) => setVarPriceDollars(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-warm bg-white px-2.5 py-1.5 font-mono text-sm text-char"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[11px] font-semibold text-smoke">Prep (m)</label>
                  <input
                    type="number"
                    min="1"
                    value={varPrepMins}
                    onChange={(e) => setVarPrepMins(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border-warm bg-white px-2.5 py-1.5 font-mono text-sm text-char"
                  />
                </div>
                <button
                  type="button"
                  disabled={isPending || !varName.trim()}
                  onClick={() => handleAddVariant(p.id)}
                  className="rounded-lg bg-ember px-3.5 py-2 text-xs font-semibold text-cream hover:bg-ember-dark disabled:opacity-50"
                >
                  Save Variant
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
