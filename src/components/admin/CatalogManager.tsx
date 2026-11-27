'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Power, Flame, Layers, Pencil, X, Clock } from 'lucide-react';
import {
  createCategoryAction,
  createProductAction,
  addVariantAction,
  toggleProductActiveAction,
  toggleVariantActiveAction,
  toggleProductSoldOutAction,
  updateCategoryAction,
  updateProductAction,
  updateVariantAction,
} from '@/modules/admin/actions';
import { formatAUD } from '@/lib/money';

interface CatalogData {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    imageUrl: string | null;
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
    imageUrl: string | null;
    spicyLevel: number;
    taxCode: string;
    visibility: string;
    active: boolean;
    soldOut: boolean;
    isBestSeller: boolean;
    isMultiVariant: boolean;
    variants: Array<{
      id: string;
      name: string;
      sku: string;
      priceCents: number;
      prepMinutes: number;
      active: boolean;
      soldOut: boolean;
      comingSoon: boolean;
      maxServings: number | null;
      computedOutOfStock: boolean;
      isOrderable: boolean;
    }>;
  }>;
  stations: Array<{ id: string; name: string; code: string }>;
}

const IMAGE_PRESETS = [
  '/images/kebab-wrap.jpg',
  '/images/hsp-box.jpg',
  '/images/turkish-pizza.jpg',
  '/images/grill-plate.jpg',
  '/images/sides-chips.jpg',
  '/images/hero-grill.jpg',
];

export function CatalogManager({ data }: { data: CatalogData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [productSearch, setProductSearch] = useState('');

  // Edit modals state
  const [editingCat, setEditingCat] = useState<CatalogData['categories'][number] | null>(null);
  const [editingProd, setEditingProd] = useState<CatalogData['products'][number] | null>(null);
  const [editingVar, setEditingVar] = useState<{
    productName: string;
    variant: CatalogData['products'][number]['variants'][number];
  } | null>(null);

  // New Category form
  const [catName, setCatName] = useState('');
  const [catStationId, setCatStationId] = useState('');

  // New Product form
  const [prodName, setProdName] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState(data.categories[0]?.id ?? '');
  const [prodStationId, setProdStationId] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodIsMultiVariant, setProdIsMultiVariant] = useState(false);
  const [prodVariantName, setProdVariantName] = useState('Regular');
  const [prodPriceDollars, setProdPriceDollars] = useState('16.00');
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
        isMultiVariant: prodIsMultiVariant,
        defaultVariantName: prodIsMultiVariant ? prodVariantName || 'Regular' : 'Standard',
        defaultPriceCents: cents,
        defaultPrepMinutes: Number(prodPrepMins) || 8,
      });
      if (res.ok) {
        setProdName('');
        setProdDesc('');
        showMsg('ok', `Product "${res.data.name}" created.`);
        router.refresh();
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

  const filteredProducts = data.products.filter((p) => {
    if (selectedCategoryFilter !== 'ALL' && p.categoryId !== selectedCategoryFilter) return false;
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.categoryName.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-char">New Menu Product</h2>
            <div className="inline-flex rounded-xl border border-border-warm bg-cream p-1">
              <button
                type="button"
                onClick={() => setProdIsMultiVariant(false)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  !prodIsMultiVariant
                    ? 'bg-char text-saffron shadow-xs'
                    : 'text-smoke hover:text-char'
                }`}
              >
                Single Item
              </button>
              <button
                type="button"
                onClick={() => setProdIsMultiVariant(true)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  prodIsMultiVariant
                    ? 'bg-ember text-cream shadow-xs'
                    : 'text-smoke hover:text-char'
                }`}
              >
                Multi-Variant
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-smoke">
            {prodIsMultiVariant
              ? 'Multi-Variant ON: create with an initial variant (e.g. Regular) and add more sizes/variants afterwards.'
              : 'Single Item (Atomic): creates one standalone product with product-level price, disable, stock-out & coming-soon controls.'}
          </p>
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
            {prodIsMultiVariant && (
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
            )}
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

      {/* Search & Category Filter Pills */}
      <div className="space-y-3">
        <input
          type="search"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Search products by name, category, or description..."
          className="w-full max-w-md rounded-xl border border-border-warm bg-white px-3.5 py-2 text-sm text-char placeholder:text-smoke/70 focus:border-ember focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('ALL')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
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
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                selectedCategoryFilter === c.id
                  ? 'bg-ember text-cream'
                  : 'border border-border-warm bg-white text-char hover:bg-cream-deep'
              }`}
            >
              {c.name} ({c.productCount})
            </button>
          ))}
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-4">
        {filteredProducts.map((p) => {
          const isAtomic = !p.isMultiVariant && p.variants.length === 1;
          const atomicVar = isAtomic ? p.variants[0] : null;
          return (
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
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      isAtomic
                        ? 'bg-char/10 text-char'
                        : 'bg-ember/15 text-ember'
                    }`}
                  >
                    {isAtomic ? 'Single Item' : `${p.variants.length} Variants`}
                  </span>
                  {atomicVar && (
                    <span className="font-mono text-sm font-bold text-char tabular-nums">
                      {formatAUD(atomicVar.priceCents)}
                    </span>
                  )}
                  {p.stationName && (
                    <span className="rounded-md bg-saffron/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-char">
                      {p.stationName}
                    </span>
                  )}
                  <span className="rounded-md border border-border-warm px-2 py-0.5 font-mono text-[11px] text-smoke">
                    {p.taxCode} · {p.visibility}
                  </span>
                  {atomicVar && (
                    <span
                      className={`font-mono text-[11px] ${
                        atomicVar.maxServings === null
                          ? 'text-smoke'
                          : atomicVar.maxServings <= 0
                            ? 'font-bold text-chilli'
                            : atomicVar.maxServings <= 5
                              ? 'font-bold text-ember'
                              : 'font-bold text-herb'
                      }`}
                    >
                      {atomicVar.maxServings === null
                        ? 'Stock: Unlimited'
                        : `Stock: ${atomicVar.maxServings} left`}
                    </span>
                  )}
                  {atomicVar?.comingSoon && (
                    <span className="rounded-md bg-saffron/35 px-2 py-0.5 font-mono text-[11px] font-bold text-char">
                      COMING SOON
                    </span>
                  )}
                  {(p.soldOut || atomicVar?.computedOutOfStock) && (
                    <span className="rounded-md bg-chilli px-2 py-0.5 font-mono text-[11px] font-bold text-cream">
                      STOCK OUT
                    </span>
                  )}
                  {(!p.active || (atomicVar && !atomicVar.active && !atomicVar.comingSoon)) && (
                    <span className="rounded-md bg-char px-2 py-0.5 font-mono text-[11px] font-bold text-cream">
                      DISABLED
                    </span>
                  )}
                </div>
                {p.description && <p className="mt-1 text-xs text-smoke">{p.description}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {atomicVar ? (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await updateVariantAction({
                            variantId: atomicVar.id,
                            name: atomicVar.name,
                            sku: atomicVar.sku,
                            priceCents: atomicVar.priceCents,
                            prepMinutes: atomicVar.prepMinutes,
                            active: atomicVar.active,
                            soldOut: !atomicVar.soldOut,
                            comingSoon: atomicVar.comingSoon,
                          });
                          if (res.ok) router.refresh();
                          else showMsg('err', res.error.message);
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        atomicVar.soldOut
                          ? 'bg-chilli text-cream hover:bg-chilli/90'
                          : 'border border-border-warm bg-cream text-char hover:bg-cream-deep'
                      }`}
                    >
                      <Flame className="h-3.5 w-3.5" />
                      {atomicVar.soldOut ? 'Stock Out: ON' : 'Stock Out'}
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const nextComingSoon = !atomicVar.comingSoon;
                          const res = await updateVariantAction({
                            variantId: atomicVar.id,
                            name: atomicVar.name,
                            sku: atomicVar.sku,
                            priceCents: atomicVar.priceCents,
                            prepMinutes: atomicVar.prepMinutes,
                            active: nextComingSoon ? false : true,
                            soldOut: atomicVar.soldOut,
                            comingSoon: nextComingSoon,
                          });
                          if (res.ok) router.refresh();
                          else showMsg('err', res.error.message);
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        atomicVar.comingSoon
                          ? 'bg-saffron text-char'
                          : 'border border-border-warm bg-cream text-char hover:bg-cream-deep'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {atomicVar.comingSoon ? 'Coming Soon: ON' : 'Coming Soon'}
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const nextActive = !atomicVar.active;
                          const res = await updateVariantAction({
                            variantId: atomicVar.id,
                            name: atomicVar.name,
                            sku: atomicVar.sku,
                            priceCents: atomicVar.priceCents,
                            prepMinutes: atomicVar.prepMinutes,
                            active: nextActive,
                            soldOut: atomicVar.soldOut,
                            comingSoon: nextActive ? false : atomicVar.comingSoon,
                          });
                          if (res.ok) router.refresh();
                          else showMsg('err', res.error.message);
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        atomicVar.active
                          ? 'border border-border-warm bg-white text-char hover:bg-cream'
                          : 'bg-herb text-cream hover:bg-herb/90'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {atomicVar.active ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingVar({ productName: p.name, variant: atomicVar })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs font-semibold text-char transition hover:bg-cream cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Price &amp; Prep
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await toggleProductSoldOutAction({ id: p.id });
                          if (!res.ok) showMsg('err', res.error.message);
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
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
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        p.active
                          ? 'border border-border-warm bg-white text-char hover:bg-cream'
                          : 'bg-herb text-cream hover:bg-herb/90'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {p.active ? 'Disable' : 'Enable'}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setEditingProd(p)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs font-semibold text-char transition hover:bg-cream cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Product
                </button>

                {!isAtomic && (
                  <button
                    type="button"
                    onClick={() =>
                      setAddingVariantFor(addingVariantFor === p.id ? null : p.id)
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-char px-3 py-1.5 text-xs font-semibold text-cream transition hover:bg-char-soft cursor-pointer"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Add Variant
                  </button>
                )}
              </div>
            </div>

            {/* Variants (only shown for Multi-Variant products) */}
            {!isAtomic && (
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {p.variants.map((v) => (
                <div
                  key={v.id}
                  className={`flex flex-col justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                    v.isOrderable
                      ? 'border-border-warm bg-cream/60'
                      : 'border-chilli/30 bg-cream/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-char flex flex-wrap items-center gap-1.5">
                        <span>{v.name}</span>
                        {v.comingSoon && (
                          <span className="rounded bg-saffron/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-char">
                            COMING SOON
                          </span>
                        )}
                        {!v.active && !v.comingSoon && (
                          <span className="rounded bg-char/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-smoke">
                            DISABLED
                          </span>
                        )}
                        {v.computedOutOfStock && (
                          <span className="rounded bg-chilli/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-chilli">
                            STOCK OUT
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-smoke mt-0.5">
                        {v.sku} · {v.prepMinutes}m ·{' '}
                        <span
                          className={
                            v.maxServings === null
                              ? 'text-smoke'
                              : v.maxServings <= 0
                                ? 'font-bold text-chilli'
                                : v.maxServings <= 5
                                  ? 'font-bold text-ember'
                                  : 'font-bold text-herb'
                          }
                        >
                          {v.maxServings === null
                            ? 'Stock: Unlimited'
                            : `Stock: ${v.maxServings} left`}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-char tabular-nums">
                      {formatAUD(v.priceCents)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border-warm/60">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await updateVariantAction({
                            variantId: v.id,
                            name: v.name,
                            sku: v.sku,
                            priceCents: v.priceCents,
                            prepMinutes: v.prepMinutes,
                            active: !v.active,
                            soldOut: v.soldOut,
                            comingSoon: !v.active ? false : v.comingSoon,
                          });
                          if (res.ok) router.refresh();
                          else showMsg('err', res.error.message);
                        })
                      }
                      className={`rounded-lg px-2 py-1 font-mono text-[10px] font-bold cursor-pointer ${
                        v.active
                          ? 'bg-herb/15 text-herb hover:bg-herb/25'
                          : 'bg-char/15 text-smoke hover:bg-char/25'
                      }`}
                    >
                      {v.active ? 'Enabled' : 'Disabled'}
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const nextComingSoon = !v.comingSoon;
                          const res = await updateVariantAction({
                            variantId: v.id,
                            name: v.name,
                            sku: v.sku,
                            priceCents: v.priceCents,
                            prepMinutes: v.prepMinutes,
                            active: nextComingSoon ? false : true,
                            soldOut: v.soldOut,
                            comingSoon: nextComingSoon,
                          });
                          if (res.ok) router.refresh();
                          else showMsg('err', res.error.message);
                        })
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[10px] font-bold cursor-pointer ${
                        v.comingSoon
                          ? 'bg-saffron text-char'
                          : 'bg-cream-deep text-smoke hover:text-char'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {v.comingSoon ? 'Coming Soon: ON' : 'Coming Soon'}
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await updateVariantAction({
                            variantId: v.id,
                            name: v.name,
                            sku: v.sku,
                            priceCents: v.priceCents,
                            prepMinutes: v.prepMinutes,
                            active: v.active,
                            soldOut: !v.soldOut,
                            comingSoon: v.comingSoon,
                          });
                          if (res.ok) router.refresh();
                          else showMsg('err', res.error.message);
                        })
                      }
                      className={`rounded-lg px-2 py-1 font-mono text-[10px] font-bold cursor-pointer ${
                        v.soldOut
                          ? 'bg-chilli text-cream'
                          : 'bg-cream-deep text-smoke hover:text-char'
                      }`}
                    >
                      {v.soldOut ? 'Stock Out: ON' : 'Stock Out'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingVar({ productName: p.name, variant: v })}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border-warm bg-white px-2 py-1 text-[10px] font-bold text-char hover:bg-cream-deep cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Inline Add Variant Form */}
            {!isAtomic && addingVariantFor === p.id && (
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
          );
        })}
      </div>
      {/* Category Edit Strip */}
      <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs space-y-3">
        <h3 className="font-display text-lg font-bold text-char">Edit Categories</h3>
        <div className="flex flex-wrap gap-2">
          {data.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setEditingCat(c)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-warm bg-cream/60 hover:bg-cream-deep px-3 py-1.5 text-xs font-semibold text-char cursor-pointer"
            >
              <Pencil className="h-3 w-3 text-ember" />
              <span>{c.name}</span>
              <span className="font-mono text-[10px] text-smoke">({c.productCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Edit Category Modal */}
      {editingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-char/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await updateCategoryAction({
                  categoryId: editingCat.id,
                  name: editingCat.name,
                  description: editingCat.description,
                  imageUrl: editingCat.imageUrl,
                  defaultStationId: editingCat.defaultStationId,
                  showInMenu: editingCat.showInMenu,
                });
                if (res.ok) {
                  setEditingCat(null);
                  showMsg('ok', `Category "${res.data.name}" updated.`);
                  router.refresh();
                } else showMsg('err', res.error.message);
              });
            }}
            className="w-full max-w-lg rounded-2xl border border-border-warm bg-cream p-6 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-border-warm pb-2">
              <h3 className="font-display text-xl font-bold text-char">Edit Category</h3>
              <button type="button" onClick={() => setEditingCat(null)} className="cursor-pointer">
                <X className="h-5 w-5 text-smoke" />
              </button>
            </div>
            <input
              type="text"
              required
              value={editingCat.name}
              onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
              placeholder="Category Name"
              className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-char"
            />
            <textarea
              rows={2}
              value={editingCat.description}
              onChange={(e) => setEditingCat({ ...editingCat, description: e.target.value })}
              placeholder="Description"
              className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-char"
            />
            <input
              type="text"
              value={editingCat.imageUrl ?? ''}
              onChange={(e) => setEditingCat({ ...editingCat, imageUrl: e.target.value })}
              placeholder="/images/kebab-wrap.jpg"
              className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 font-mono text-xs text-char"
            />
            <select
              value={editingCat.defaultStationId ?? ''}
              onChange={(e) => setEditingCat({ ...editingCat, defaultStationId: e.target.value || null })}
              className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-char"
            >
              <option value="">Default Store Station</option>
              {data.stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs font-bold text-char">
              <input
                type="checkbox"
                checked={editingCat.showInMenu}
                onChange={(e) => setEditingCat({ ...editingCat, showInMenu: e.target.checked })}
                className="accent-ember"
              />
              Show in Storefront Menu
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingCat(null)} className="rounded-xl border border-border-warm bg-white px-4 py-2 text-xs font-bold cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="rounded-xl bg-ember px-5 py-2 text-xs font-bold text-cream cursor-pointer">
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Product Modal (with Picture URL + Presets) */}
      {editingProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-char/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await updateProductAction({
                  productId: editingProd.id,
                  name: editingProd.name,
                  description: editingProd.description,
                  imageUrl: editingProd.imageUrl,
                  categoryId: editingProd.categoryId,
                  spicyLevel: editingProd.spicyLevel,
                  isBestSeller: editingProd.isBestSeller,
                  isMultiVariant: editingProd.isMultiVariant,
                  active: editingProd.active,
                });
                if (res.ok) {
                  setEditingProd(null);
                  showMsg('ok', `Product "${res.data.name}" updated.`);
                  router.refresh();
                } else showMsg('err', res.error.message);
              });
            }}
            className="w-full max-w-lg rounded-2xl border border-border-warm bg-cream p-6 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border-warm pb-2">
              <h3 className="font-display text-xl font-bold text-char">Edit Product &amp; Picture</h3>
              <button type="button" onClick={() => setEditingProd(null)} className="cursor-pointer">
                <X className="h-5 w-5 text-smoke" />
              </button>
            </div>
            {editingProd.imageUrl && (
              <div className="h-32 w-full overflow-hidden rounded-xl border border-border-warm bg-char">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editingProd.imageUrl} alt={editingProd.name} className="h-full w-full object-cover" />
              </div>
            )}
            <input
              type="text"
              required
              value={editingProd.name}
              onChange={(e) => setEditingProd({ ...editingProd, name: e.target.value })}
              placeholder="Product Name"
              className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-char"
            />
            <textarea
              rows={2}
              value={editingProd.description}
              onChange={(e) => setEditingProd({ ...editingProd, description: e.target.value })}
              placeholder="Product Description"
              className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-char"
            />
            <div>
              <label className="block text-xs font-bold uppercase text-smoke mb-1">Product Picture URL</label>
              <input
                type="text"
                value={editingProd.imageUrl ?? ''}
                onChange={(e) => setEditingProd({ ...editingProd, imageUrl: e.target.value })}
                placeholder="/images/kebab-wrap.jpg or https://..."
                className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 font-mono text-xs text-char"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {IMAGE_PRESETS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setEditingProd({ ...editingProd, imageUrl: u })}
                    className="rounded-md border border-border-warm bg-white px-2 py-0.5 font-mono text-[10px] text-char hover:bg-cream-deep cursor-pointer"
                  >
                    {u.replace('/images/', '')}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={editingProd.categoryId}
                onChange={(e) => setEditingProd({ ...editingProd, categoryId: e.target.value })}
                className="rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-char"
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={editingProd.spicyLevel}
                onChange={(e) => setEditingProd({ ...editingProd, spicyLevel: Number(e.target.value) })}
                className="rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-char"
              >
                <option value={0}>No Heat</option>
                <option value={1}>Mild Heat (1)</option>
                <option value={2}>Medium Heat (2)</option>
                <option value={3}>Hot (3)</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-4 text-xs font-bold text-char">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProd.isBestSeller}
                  onChange={(e) => setEditingProd({ ...editingProd, isBestSeller: e.target.checked })}
                  className="accent-ember"
                />
                Best Seller
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProd.isMultiVariant}
                  onChange={(e) => setEditingProd({ ...editingProd, isMultiVariant: e.target.checked })}
                  className="accent-ember"
                />
                Multi-Variant Mode
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProd.active}
                  onChange={(e) => setEditingProd({ ...editingProd, active: e.target.checked })}
                  className="accent-ember"
                />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingProd(null)} className="rounded-xl border border-border-warm bg-white px-4 py-2 text-xs font-bold cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="rounded-xl bg-ember px-5 py-2 text-xs font-bold text-cream cursor-pointer">
                Save Product
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Variant Modal */}
      {editingVar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-char/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const v = editingVar.variant;
                const res = await updateVariantAction({
                  variantId: v.id,
                  name: v.name,
                  sku: v.sku,
                  priceCents: v.priceCents,
                  prepMinutes: v.prepMinutes,
                  active: v.active,
                  soldOut: v.soldOut,
                  comingSoon: v.comingSoon,
                });
                if (res.ok) {
                  setEditingVar(null);
                  showMsg('ok', `Variant "${v.name}" updated.`);
                  router.refresh();
                } else showMsg('err', res.error.message);
              });
            }}
            className="w-full max-w-md rounded-2xl border border-border-warm bg-cream p-6 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-border-warm pb-2">
              <h3 className="font-display text-xl font-bold text-char">
                Edit Variant · {editingVar.productName}
              </h3>
              <button type="button" onClick={() => setEditingVar(null)} className="cursor-pointer">
                <X className="h-5 w-5 text-smoke" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-smoke mb-1">Variant Name</label>
                <input
                  type="text"
                  required
                  value={editingVar.variant.name}
                  onChange={(e) =>
                    setEditingVar({ ...editingVar, variant: { ...editingVar.variant, name: e.target.value } })
                  }
                  className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-char"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-smoke mb-1">SKU</label>
                <input
                  type="text"
                  required
                  value={editingVar.variant.sku}
                  onChange={(e) =>
                    setEditingVar({ ...editingVar, variant: { ...editingVar.variant, sku: e.target.value } })
                  }
                  className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 font-mono text-sm text-char"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-smoke mb-1">Price (AUD Cents)</label>
                <input
                  type="number"
                  min={0}
                  value={editingVar.variant.priceCents}
                  onChange={(e) =>
                    setEditingVar({
                      ...editingVar,
                      variant: { ...editingVar.variant, priceCents: Number(e.target.value) },
                    })
                  }
                  className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 font-mono text-sm text-char"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-smoke mb-1">Prep Minutes</label>
                <input
                  type="number"
                  min={1}
                  value={editingVar.variant.prepMinutes}
                  onChange={(e) =>
                    setEditingVar({
                      ...editingVar,
                      variant: { ...editingVar.variant, prepMinutes: Number(e.target.value) },
                    })
                  }
                  className="w-full rounded-xl border border-border-warm bg-white px-3 py-2 font-mono text-sm text-char"
                />
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-border-warm bg-white p-3 text-xs font-bold text-char">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!editingVar.variant.active}
                  onChange={(e) =>
                    setEditingVar({
                      ...editingVar,
                      variant: { ...editingVar.variant, active: !e.target.checked },
                    })
                  }
                  className="accent-ember"
                />
                Disabled (prevents ordering)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingVar.variant.comingSoon}
                  onChange={(e) =>
                    setEditingVar({
                      ...editingVar,
                      variant: {
                        ...editingVar.variant,
                        comingSoon: e.target.checked,
                        active: e.target.checked ? false : editingVar.variant.active,
                      },
                    })
                  }
                  className="accent-ember"
                />
                Coming Soon (auto-toggles Disabled ON)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingVar.variant.soldOut}
                  onChange={(e) =>
                    setEditingVar({
                      ...editingVar,
                      variant: { ...editingVar.variant, soldOut: e.target.checked },
                    })
                  }
                  className="accent-ember"
                />
                Manual Stock Out override
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingVar(null)} className="rounded-xl border border-border-warm bg-white px-4 py-2 text-xs font-bold cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="rounded-xl bg-ember px-5 py-2 text-xs font-bold text-cream cursor-pointer">
                Save Variant
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
