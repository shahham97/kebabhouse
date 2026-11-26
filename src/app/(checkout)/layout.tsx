import React from 'react';
import Link from 'next/link';
import { Flame, ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { CartProvider } from '@/components/storefront/CartProvider';

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-cream text-char">
        <header className="border-b border-border-warm bg-char text-cream">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link
              href="/menu"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-cream/80 hover:text-saffron transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Menu
            </Link>

            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember text-cream">
                <Flame className="h-4 w-4" />
              </span>
              <span className="font-display text-2xl font-extrabold uppercase tracking-wider text-cream">
                Star Kebab
              </span>
            </Link>

            <div className="hidden sm:flex items-center gap-3 text-xs text-cream/75">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-saffron" /> 100% Halal
              </span>
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-saffron" /> Secure Checkout
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </CartProvider>
  );
}
