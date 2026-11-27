'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Search, Flame, Leaf, ShieldCheck, Star, Plus, SlidersHorizontal } from 'lucide-react';
import { formatAUD } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { PublicMenuCategory, PublicProduct } from '@/modules/storefront/queries';
import { ProductCustomizerModal } from './ProductCustomizerModal';
import { useCart, type CartModifier } from './CartProvider';

type FilterChip = 'ALL' | 'HALAL' | 'VEG' | 'SPICY' | 'BEST_SELLERS';

interface MenuBrowserProps {
  categories: PublicMenuCategory[];
  initialCategorySlug?: string;
}

export function MenuBrowser({ categories, initialCategorySlug }: MenuBrowserProps) {
  const [activeCategory, setActiveCategory] = useState<string>(initialCategorySlug || 'ALL');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterChip>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();

    return categories
      .filter((cat) => activeCategory === 'ALL' || cat.slug === activeCategory)
      .map((cat) => ({
        ...cat,
        products: cat.products.filter((p) => {
          if (filter === 'HALAL' && !p.tags.includes('halal')) return false;
          if (filter === 'VEG' && !p.tags.includes('veg')) return false;
          if (filter === 'SPICY' && p.spicyLevel <= 0 && !p.tags.includes('spicy')) return false;
          if (filter === 'BEST_SELLERS' && !p.isBestSeller) return false;

          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
          );
        }),
      }))
      .filter((cat) => cat.products.length > 0);
  }, [categories, activeCategory, search, filter]);

  const filterChips: Array<{ id: FilterChip; label: string }> = [
    { id: 'ALL', label: 'All Items' },
    { id: 'BEST_SELLERS', label: 'Best Sellers' },
    { id: 'HALAL', label: '100% Halal' },
    { id: 'VEG', label: 'Vegetarian' },
    { id: 'SPICY', label: 'Spicy' },
  ];

  return (
    <div className="space-y-8">
      {/* Sticky Category Tabs + Search + Filter Chips */}
      <div className="sticky top-16 sm:top-18 z-30 -mx-4 sm:-mx-6 bg-cream/95 px-4 sm:px-6 py-4 backdrop-blur-md border-b border-border-warm space-y-3">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-sm font-bold transition cursor-pointer',
              activeCategory === 'ALL'
                ? 'bg-char text-saffron shadow-sm'
                : 'bg-cream-deep text-char hover:bg-border-warm'
            )}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.slug)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-bold transition cursor-pointer',
                activeCategory === cat.slug
                  ? 'bg-char text-saffron shadow-sm'
                  : 'bg-cream-deep text-char hover:bg-border-warm'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search + Filter Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search kebabs, HSP, pide, baklava..."
              className="w-full rounded-full border border-border-warm bg-white pl-10 pr-4 py-2 text-sm text-char placeholder:text-smoke/70 focus:border-ember focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-smoke mr-1 hidden sm:block" />
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition cursor-pointer',
                  filter === chip.id
                    ? 'border-ember bg-ember text-cream'
                    : 'border-border-warm bg-white text-smoke hover:border-char hover:text-char'
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      {filteredCategories.length === 0 ? (
        <div className="rounded-3xl border border-border-warm bg-white/80 p-12 text-center">
          <p className="font-display text-2xl font-bold uppercase text-char">No matching items found</p>
          <p className="mt-1 text-sm text-smoke">
            Try clearing your search or switching dietary filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('ALL');
              setSearch('');
              setFilter('ALL');
            }}
            className="mt-4 rounded-full bg-ember px-5 py-2 text-sm font-semibold text-cream hover:bg-ember-dark transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {filteredCategories.map((cat) => (
            <section
              key={cat.id}
              id={cat.slug}
              className="scroll-mt-44 space-y-5"
              style={{ contentVisibility: 'auto', containIntrinsicSize: '0 420px' }}
            >
              <div className="border-b border-border-warm pb-3 flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-wide text-char">
                    {cat.name}
                  </h2>
                  {cat.description && <p className="mt-1 text-sm text-smoke">{cat.description}</p>}
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold text-smoke">
                  {cat.products.length} {cat.products.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {cat.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={() => setSelectedProduct(product)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ProductCustomizerModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </div>
  );
}

export function BestSellerGrid({ products }: { products: PublicProduct[] }) {
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={() => setSelectedProduct(product)}
          />
        ))}
      </div>
      <ProductCustomizerModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </>
  );
}

const ProductCard = React.memo(function ProductCard({
  product,
  onSelect,
}: {
  product: PublicProduct;
  onSelect: () => void;
}) {
  const { addItem, openDrawer } = useCart();
  const orderableVariants = product.variants.filter((v) => v.isOrderable);
  const basicVariant = product.variants[0];
  const basicIsOrderable = !!basicVariant && basicVariant.isOrderable && !product.soldOut;
  const allComingSoon =
    product.variants.length > 0 && product.variants.every((v) => v.status === 'COMING_SOON');
  const allUnavailable = orderableVariants.length === 0 || product.soldOut;

  const minPrice =
    orderableVariants.length > 0
      ? Math.min(...orderableVariants.map((v) => v.priceCents))
      : product.variants.length > 0
        ? Math.min(...product.variants.map((v) => v.priceCents))
        : 0;
  const hasMultipleVariants = product.variants.length > 1;
  const isHalal = product.tags.includes('halal');
  const isVeg = product.tags.includes('veg');

  function handleQuickAdd(e: React.MouseEvent) {
    e.stopPropagation();
    const targetVariant = basicIsOrderable ? basicVariant : orderableVariants[0];
    if (!targetVariant || allUnavailable || !basicIsOrderable) return;

    const defaultMods: CartModifier[] = [];
    for (const g of product.modifierGroups) {
      const defaults = g.options.filter((o) => o.isDefault && !o.soldOut);
      if (defaults.length > 0) {
        for (const opt of defaults.slice(0, g.maxSelect)) {
          defaultMods.push({
            optionId: opt.id,
            groupName: g.name,
            optionName: opt.name,
            priceDeltaCents: opt.priceDeltaCents,
          });
        }
      } else if (g.required || g.minSelect > 0) {
        const firstAvail = g.options.find((o) => !o.soldOut);
        if (firstAvail) {
          defaultMods.push({
            optionId: firstAvail.id,
            groupName: g.name,
            optionName: firstAvail.name,
            priceDeltaCents: firstAvail.priceDeltaCents,
          });
        }
      }
    }

    addItem({
      variantId: targetVariant.id,
      productId: product.id,
      productName: product.name,
      variantName: targetVariant.name,
      imageUrl: product.imageUrl,
      basePriceCents: targetVariant.priceCents,
      modifiers: defaultMods,
      quantity: 1,
      notes: '',
      availableVariants: orderableVariants.map((v) => ({
        id: v.id,
        name: v.name,
        priceCents: v.priceCents,
      })),
    });
    openDrawer();
  }

  return (
    <article
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border-warm bg-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-xl hover:border-ember/40 cursor-pointer',
        allUnavailable && 'opacity-75'
      )}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-char">
        <Image
          src={product.imageUrl || '/images/kebab-wrap.jpg'}
          alt={product.name}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-char/75 via-transparent to-transparent" />

        {/* Top Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.isBestSeller && !allUnavailable && (
            <span className="inline-flex items-center gap-1 rounded-full bg-saffron px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-char shadow">
              <Star className="h-3 w-3 fill-char" /> Best Seller
            </span>
          )}
          {allComingSoon && (
            <span className="rounded-full bg-char px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-saffron border border-saffron/40">
              Coming Soon
            </span>
          )}
          {!allComingSoon && allUnavailable && (
            <span className="rounded-full bg-char px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-cream border border-cream/30">
              Unavailable
            </span>
          )}
        </div>

        {/* Bottom Price Pill */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          {isHalal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-herb/95 px-2 py-0.5 text-[10px] font-bold uppercase text-cream">
              <ShieldCheck className="h-3 w-3" /> Halal
            </span>
          )}
          {isVeg && (
            <span className="inline-flex items-center gap-1 rounded-full bg-herb/95 px-2 py-0.5 text-[10px] font-bold uppercase text-cream">
              <Leaf className="h-3 w-3" /> Veg
            </span>
          )}
          {product.spicyLevel > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-chilli/95 px-2 py-0.5 text-[10px] font-bold uppercase text-cream">
              <Flame className="h-3 w-3" /> Spicy
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl font-bold uppercase tracking-wide text-char group-hover:text-ember transition leading-tight">
            {product.name}
          </h3>
          <span className="shrink-0 font-mono text-sm font-bold text-char tabular-nums">
            {hasMultipleVariants ? `From ${formatAUD(minPrice)}` : formatAUD(minPrice)}
          </span>
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs sm:text-sm text-smoke leading-relaxed flex-1">
          {product.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-border-warm/60">
          <span className="text-xs text-smoke truncate">
            {product.modifierGroups.length > 0 ? 'Tap to customise' : basicVariant?.name}
          </span>
          <button
            type="button"
            disabled={allUnavailable || !basicIsOrderable}
            onClick={handleQuickAdd}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition',
              allUnavailable || !basicIsOrderable
                ? 'bg-cream-deep text-smoke cursor-not-allowed'
                : 'bg-ember text-cream hover:bg-ember-dark cursor-pointer'
            )}
          >
            {!allUnavailable && basicIsOrderable && <Plus className="h-3.5 w-3.5" />}
            {allComingSoon
              ? 'Coming Soon'
              : allUnavailable || !basicIsOrderable
                ? 'Unavailable'
                : 'Quick Add'}
          </button>
        </div>
      </div>
    </article>
  );
});
