import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Flame, ShieldCheck, Clock, Award, ArrowRight } from 'lucide-react';
import { getStorefrontContext } from '@/modules/storefront/queries';

export const metadata = {
  title: 'Our Story',
};

export default async function AboutPage() {
  const ctx = await getStorefrontContext();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 space-y-14">
      <section className="grid grid-cols-1 gap-10 lg:grid-cols-2 items-center">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-ember">
            <Flame className="h-3.5 w-3.5" /> Est. Newtown, Sydney
          </span>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold uppercase tracking-wide text-char leading-[0.95]">
            Fire, Craft &amp; <span className="text-ember">Real Charcoal</span>
          </h1>
          <p className="text-base leading-relaxed text-smoke">
            {ctx.store.name} started with a simple promise on King Street: never compromise on the
            fire. Every morning we hand-marinate 100% Australian Halal lamb shoulder and free-range
            chicken thighs in sumac, oregano, Aleppo pepper, and cold-pressed olive oil, then roast
            them slow over live ironbark charcoal.
          </p>
          <p className="text-base leading-relaxed text-smoke">
            Our Turkish pide dough ferments for 24 hours before hitting our blazing stone deck, and
            our garlic toum, hummus, and chilli sauces are whipped in-house daily. Whether it&apos;s
            a weekday lunch wrap or a 1:30am Saturday HSP, you get the exact same obsession with
            quality.
          </p>
          <div className="pt-2">
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 rounded-full bg-ember px-7 py-3.5 font-display text-xl font-bold uppercase tracking-wide text-cream hover:bg-ember-dark transition"
            >
              Explore Our Menu <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border-warm bg-char shadow-2xl">
          <Image
            src="/images/grill-plate.jpg"
            alt="Star Kebab mixed charcoal grill plate"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-warm bg-white p-6 space-y-2">
          <ShieldCheck className="h-7 w-7 text-herb" />
          <h2 className="font-display text-2xl font-bold uppercase text-char">100% Halal Certified</h2>
          <p className="text-sm text-smoke">
            Full Halal certification across our entire kitchen, suppliers, and sauces. Zero pork or
            alcohol on premises.
          </p>
        </div>
        <div className="rounded-2xl border border-border-warm bg-white p-6 space-y-2">
          <Clock className="h-7 w-7 text-ember" />
          <h2 className="font-display text-2xl font-bold uppercase text-char">Late-Night Newtown</h2>
          <p className="text-sm text-smoke">
            Open 7 days a week from 11am, staying fired up until 2:00am every Friday and Saturday
            night.
          </p>
        </div>
        <div className="rounded-2xl border border-border-warm bg-white p-6 space-y-2">
          <Award className="h-7 w-7 text-saffron" />
          <h2 className="font-display text-2xl font-bold uppercase text-char">House-Made Daily</h2>
          <p className="text-sm text-smoke">
            Freshly baked pide bread, hand-cut chips, and signature garlic toum &amp; smoky chilli
            sauces prepared every morning.
          </p>
        </div>
      </section>
    </div>
  );
}
