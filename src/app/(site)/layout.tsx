import React from 'react';
import { getCustomerActor } from '@/lib/auth';
import { getStorefrontContext } from '@/modules/storefront/queries';
import { CartProvider } from '@/components/storefront/CartProvider';
import { StoreHeader } from '@/components/storefront/StoreHeader';
import { StoreFooter } from '@/components/storefront/StoreFooter';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [ctx, customer] = await Promise.all([getStorefrontContext(), getCustomerActor()]);

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-cream text-char">
        <StoreHeader
          storeName={ctx.store.name}
          announcements={ctx.announcements.map((a) => ({
            id: a.id,
            text: a.text,
            linkHref: a.linkHref,
          }))}
          navItems={ctx.headerNav.map((n) => ({
            id: n.id,
            label: n.label,
            href: n.href,
          }))}
          customerName={customer?.name ?? null}
        />
        <main className="flex-1">{children}</main>
        <StoreFooter
          store={ctx.store}
          openingHours={ctx.openingHours}
          footerNav={ctx.footerNav.map((n) => ({
            id: n.id,
            label: n.label,
            href: n.href,
          }))}
        />
      </div>
    </CartProvider>
  );
}
