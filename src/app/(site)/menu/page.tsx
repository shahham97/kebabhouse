import React from 'react';
import { AlertTriangle, Flame } from 'lucide-react';
import { getPublicMenu, getStorefrontContext } from '@/modules/storefront/queries';
import { MenuBrowser } from '@/components/storefront/MenuBrowser';
import { buildBreadcrumbJsonLd, buildMenuJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Full Menu — 100% Halal Kebabs, HSP, Turkish Pide, Gourmet Pizza & Skewers',
  description:
    'Explore Star Kebab House’s full 100% Halal menu: Kebab Rolls, Regular & Large Halal Snack Packs (HSP), 14 Turkish Pides, 30+ Gourmet Pizzas, Gozleme, Charcoal Skewers, Burgers, Banquets, Dips & Baklava. Order online in AUD.',
  alternates: { canonical: '/menu' },
  openGraph: {
    title: 'Star Kebab House Full Menu — 100% Halal Kebabs, HSP, Pide & Pizza',
    description:
      '119 authentic Turkish & charcoal grill dishes across 15 categories. Order online for fast pickup or local delivery.',
    url: '/menu',
  },
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const [params, ctx, categories] = await Promise.all([
    searchParams,
    getStorefrontContext(),
    getPublicMenu(),
  ]);

  const menuJsonLd = buildMenuJsonLd(categories);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Menu', path: '/menu' },
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd) }}
      />
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-ember">
            <Flame className="h-3.5 w-3.5" /> 100% Halal · Fresh Off The Spit
          </p>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold uppercase tracking-wide text-char leading-none mt-1">
            Star Kebab Menu
          </h1>
        </div>
        <p className="text-sm text-smoke max-w-md">
          All prices in AUD including GST. Tap any item to choose size, salads, sauces &amp; extras.
        </p>
      </div>

      {/* Online Paused Banner */}
      {ctx.store.onlinePaused && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-saffron bg-saffron/15 p-4 text-char">
          <AlertTriangle className="h-5 w-5 shrink-0 text-ember mt-0.5" />
          <div>
            <p className="font-display text-lg font-bold uppercase tracking-wide">
              ASAP Online Orders Temporarily Paused
            </p>
            <p className="text-sm text-char/85">
              {ctx.store.pauseMessage ||
                'Our charcoal grill is at peak capacity right now. You can still schedule a pre-order for later today!'}
            </p>
          </div>
        </div>
      )}

      <MenuBrowser
        categories={categories}
        initialCategorySlug={params.category}
        initialQuery={params.q}
      />
    </div>
  );
}
