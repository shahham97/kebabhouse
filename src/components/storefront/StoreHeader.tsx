'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Flame,
  ShoppingBag,
  User,
  MapPin,
  Menu,
  X,
  Truck,
  Store,
  PackageSearch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAUD } from '@/lib/money';
import { useCart } from './CartProvider';

interface NavLinkItem {
  id: string;
  label: string;
  href: string;
}

interface AnnouncementItem {
  id: string;
  text: string;
  linkHref: string | null;
}

interface StoreHeaderProps {
  storeName: string;
  announcements: AnnouncementItem[];
  navItems: NavLinkItem[];
  customerName?: string | null;
}

export function StoreHeader({
  storeName,
  announcements,
  navItems,
  customerName,
}: StoreHeaderProps) {
  const pathname = usePathname();
  const { itemCount, subtotalCents, fulfilment, postcode, timing, openDrawer, openFulfilmentModal, hydrated } =
    useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryAnnouncement = announcements[0] ?? null;

  const fallbackNav: NavLinkItem[] =
    navItems.length > 0
      ? navItems
      : [
          { id: 'menu', label: 'Menu', href: '/menu' },
          { id: 'deals', label: 'Deals', href: '/deals' },
          { id: 'about', label: 'About', href: '/about' },
          { id: 'contact', label: 'Contact', href: '/contact' },
        ];

  const fulfilmentLabel =
    fulfilment === 'DELIVERY'
      ? postcode
        ? `Delivery ${postcode}`
        : 'Delivery'
      : 'Pickup';

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Warm Char / Saffron Announcement Bar */}
      {primaryAnnouncement && (
        <div className="bg-char text-cream border-b border-saffron/25">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-xs sm:text-sm font-medium">
            <Flame className="h-3.5 w-3.5 shrink-0 text-saffron" />
            {primaryAnnouncement.linkHref ? (
              <Link
                href={primaryAnnouncement.linkHref}
                className="hover:text-saffron transition underline-offset-4 hover:underline"
              >
                {primaryAnnouncement.text}
              </Link>
            ) : (
              <span>{primaryAnnouncement.text}</span>
            )}
          </div>
        </div>
      )}

      {/* Main Nav Bar */}
      <div className="border-b border-border-warm bg-cream/95 backdrop-blur-md">
        <div className="mx-auto flex h-18 sm:h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center group shrink-0" aria-label={storeName}>
            <Image
              src="/images/logo-transparent.png"
              alt={`${storeName} logo`}
              width={96}
              height={63}
              priority
              className="h-14 sm:h-16 w-auto object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Desktop CMS Nav Links */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
            {fallbackNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-sm font-semibold transition',
                    active
                      ? 'bg-char text-saffron'
                      : 'text-char hover:bg-cream-deep hover:text-ember'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Interactive Fulfilment Chip */}
            <button
              type="button"
              onClick={openFulfilmentModal}
              className="hidden md:flex items-center gap-1.5 rounded-full border border-border-warm bg-white px-3.5 py-1.5 text-xs font-semibold text-char shadow-xs hover:border-ember transition cursor-pointer"
            >
              {fulfilment === 'DELIVERY' ? (
                <Truck className="h-3.5 w-3.5 text-ember" />
              ) : (
                <Store className="h-3.5 w-3.5 text-ember" />
              )}
              <span>{fulfilmentLabel}</span>
              <span className="text-smoke">· {timing === 'ASAP' ? 'ASAP' : 'Scheduled'}</span>
              <span className="ml-1 text-ember font-bold">Change</span>
            </button>

            {/* Track Order Link */}
            <Link
              href="/track"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border-warm bg-white px-3 py-1.5 text-xs font-semibold text-char hover:border-ember hover:text-ember transition"
            >
              <PackageSearch className="h-3.5 w-3.5 text-ember" />
              <span>Track Order</span>
            </Link>

            {/* Account Link */}
            <Link
              href={customerName ? '/account' : '/account/login'}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border-warm bg-white px-3 py-1.5 text-xs font-semibold text-char hover:border-char transition"
            >
              <User className="h-3.5 w-3.5 text-smoke" />
              <span className="max-w-[96px] truncate">{customerName || 'Account'}</span>
            </Link>

            {/* Basket Button */}
            <button
              type="button"
              onClick={openDrawer}
              className="relative flex items-center gap-2 rounded-full bg-ember px-3.5 py-2 text-xs sm:text-sm font-bold text-cream shadow-sm hover:bg-ember-dark transition cursor-pointer"
              aria-label="Open basket"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="font-mono tabular-nums">
                {hydrated && itemCount > 0 ? formatAUD(subtotalCents) : 'Order'}
              </span>
              {hydrated && itemCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron px-1 font-mono text-[11px] font-extrabold text-char tabular-nums">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="inline-flex lg:hidden items-center justify-center rounded-xl border border-border-warm bg-white p-2 text-char hover:bg-cream-deep cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border-warm bg-cream px-4 py-4 space-y-3">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openFulfilmentModal();
              }}
              className="flex w-full items-center justify-between rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm font-semibold text-char"
            >
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-ember" />
                {fulfilmentLabel} · {timing === 'ASAP' ? 'ASAP' : 'Scheduled'}
              </span>
              <span className="text-xs font-bold text-ember">Change</span>
            </button>

            <nav className="flex flex-col gap-1">
              {fallbackNav.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'rounded-xl px-3.5 py-2.5 text-sm font-semibold',
                    pathname === item.href
                      ? 'bg-char text-saffron'
                      : 'text-char hover:bg-cream-deep'
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/track"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-char hover:bg-cream-deep"
              >
                Track Order
              </Link>
              <Link
                href={customerName ? '/account' : '/account/login'}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-char hover:bg-cream-deep"
              >
                {customerName ? `Account (${customerName})` : 'Sign In / Star Rewards'}
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
