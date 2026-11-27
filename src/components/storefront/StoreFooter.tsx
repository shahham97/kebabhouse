import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, Clock, ShieldCheck, Mail } from 'lucide-react';

interface OpeningHourRow {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface FooterNavItem {
  id: string;
  label: string;
  href: string;
}

interface StoreFooterProps {
  store: {
    name: string;
    abn: string;
    phone: string;
    email: string;
    address: string;
  };
  openingHours: OpeningHourRow[];
  footerNav: FooterNavItem[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHourRange(open: string, close: string, isClosed: boolean) {
  if (isClosed) return 'Closed';
  const to12 = (t: string) => {
    const [hStr, mStr] = t.split(':');
    const h = Number(hStr);
    const suffix = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return mStr === '00' ? `${h12}${suffix}` : `${h12}:${mStr}${suffix}`;
  };
  return `${to12(open)} – ${to12(close)}`;
}

export function StoreFooter({ store, openingHours, footerNav }: StoreFooterProps) {
  return (
    <footer className="bg-char text-cream border-t border-saffron/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Story */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-char-soft shadow-md ring-1 ring-saffron/35">
                <Image
                  src="/images/logo.webp"
                  alt={`${store.name} logo`}
                  fill
                  sizes="48px"
                  className="object-contain p-0.5"
                />
              </span>
              <div>
                <p className="font-display text-2xl font-extrabold uppercase tracking-wider text-cream leading-none">
                  {store.name}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-saffron mt-0.5">
                  Newtown · Sydney
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-cream/75">
              Slow-roasted over live Australian ironbark charcoal, carved fresh to order and wrapped
              in blistered stone-baked bread with house-made garlic toum & chilli sauces.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-herb/40 bg-herb/15 px-3 py-1 text-xs font-semibold text-cream">
              <ShieldCheck className="h-3.5 w-3.5 text-saffron" />
              100% Halal Certified Meat
            </div>
          </div>

          {/* Opening Hours */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wider text-saffron">
              <Clock className="h-4 w-4" /> Opening Hours
            </h3>
            <ul className="space-y-1.5 text-sm text-cream/80">
              {openingHours.map((row) => {
                const isLate = row.dayOfWeek === 5 || row.dayOfWeek === 6;
                return (
                  <li key={row.dayOfWeek} className="flex justify-between gap-4">
                    <span className={isLate ? 'font-semibold text-saffron' : 'text-cream/70'}>
                      {DAY_NAMES[row.dayOfWeek]}
                    </span>
                    <span className="font-mono text-xs tabular-nums">
                      {formatHourRange(row.openTime, row.closeTime, row.isClosed)}
                      {isLate && !row.isClosed ? ' (Late!)' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Contact & Location */}
          <div className="space-y-3">
            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-saffron">
              Find Us
            </h3>
            <ul className="space-y-2.5 text-sm text-cream/80">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-ember mt-0.5" />
                <span>{store.address || '148 King Street, Newtown NSW 2042'}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-ember" />
                <a href={`tel:${store.phone.replace(/[^0-9+]/g, '')}`} className="hover:text-saffron transition">
                  {store.phone || '(02) 9876 5432'}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-ember" />
                <a href={`mailto:${store.email}`} className="hover:text-saffron transition">
                  {store.email || 'hello@starkebab.com.au'}
                </a>
              </li>
            </ul>
            {store.abn && (
              <p className="pt-2 font-mono text-xs text-cream/55">
                ABN {store.abn} · All prices in AUD incl. GST
              </p>
            )}
          </div>

          {/* Links & Staff Demos */}
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-lg font-bold uppercase tracking-wider text-saffron mb-3">
                Explore
              </h3>
              <ul className="space-y-1.5 text-sm text-cream/80">
                {(footerNav.length > 0
                  ? footerNav
                  : [
                      { id: 'f-menu', label: 'Menu', href: '/menu' },
                      { id: 'f-deals', label: 'Deals & Coupons', href: '/deals' },
                      { id: 'f-about', label: 'Our Story', href: '/about' },
                      { id: 'f-contact', label: 'Contact', href: '/contact' },
                      { id: 'f-privacy', label: 'Privacy Policy', href: '/legal/privacy' },
                      { id: 'f-terms', label: 'Terms of Service', href: '/legal/terms' },
                    ]
                ).map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="hover:text-saffron transition">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-cream/15 bg-char-soft p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-saffron mb-1.5">
                Live Order Status
              </p>
              <p className="text-xs text-cream/75 mb-2.5">
                Placed an order? Watch it go from the charcoal spit to your door in real time.
              </p>
              <Link
                href="/track"
                className="inline-flex items-center justify-center rounded-lg bg-ember px-3 py-1.5 text-xs font-bold text-cream hover:bg-ember-dark transition"
              >
                Track Your Order →
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-cream/10 pt-6 text-xs text-cream/55">
          <p>© {new Date().getFullYear()} {store.name}. Crafted with charcoal fire in Sydney, Australia.</p>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="hover:text-cream transition">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-cream transition">
              Terms
            </Link>
            <Link href="/account" className="hover:text-cream transition">
              Star Rewards
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
