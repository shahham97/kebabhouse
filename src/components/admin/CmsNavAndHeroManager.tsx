'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, Navigation, Plus, Trash2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  deleteCmsNavItemAction,
  saveCmsNavItemAction,
  updateHeroImageAction,
} from '@/modules/admin/actions';

interface NavRow {
  id: string;
  location: string;
  label: string;
  href: string;
  sortOrder: number;
  visible: boolean;
}

const IMAGE_PRESETS = [
  { label: 'Charcoal Grill Feast', url: '/images/hero-grill.jpg' },
  { label: 'Kebab Wrap', url: '/images/kebab-wrap.jpg' },
  { label: 'Loaded HSP Box', url: '/images/hsp-box.jpg' },
  { label: 'Wood-Fired Pide', url: '/images/turkish-pizza.jpg' },
  { label: 'Mixed Grill Plate', url: '/images/grill-plate.jpg' },
];

export function CmsNavAndHeroManager({
  heroImageUrl,
  navItems,
}: {
  heroImageUrl: string;
  navItems: NavRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Hero Image state
  const [heroUrl, setHeroUrl] = useState(heroImageUrl || '/images/hero-grill.jpg');

  // Header & Footer separate add/edit state
  const [editing, setEditing] = useState<NavRow | null>(null);
  const [newHeaderLabel, setNewHeaderLabel] = useState('');
  const [newHeaderHref, setNewHeaderHref] = useState('/');
  const [newFooterLabel, setNewFooterLabel] = useState('');
  const [newFooterHref, setNewFooterHref] = useState('/');

  const headerItems = navItems.filter((n) => n.location === 'HEADER');
  const footerItems = navItems.filter((n) => n.location === 'FOOTER');

  function handleSaveHero(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateHeroImageAction({ heroImageUrl: heroUrl });
      if (!res.ok) {
        setFeedback({ kind: 'err', text: res.error.message });
        return;
      }
      setFeedback({ kind: 'ok', text: 'Homepage hero image updated in database.' });
      router.refresh();
    });
  }

  function handleAddNav(location: 'HEADER' | 'FOOTER', e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const label = location === 'HEADER' ? newHeaderLabel : newFooterLabel;
    const href = location === 'HEADER' ? newHeaderHref : newFooterHref;
    const list = location === 'HEADER' ? headerItems : footerItems;

    startTransition(async () => {
      const res = await saveCmsNavItemAction({
        location,
        label,
        href,
        sortOrder: list.length + 1,
        visible: true,
      });
      if (!res.ok) {
        setFeedback({ kind: 'err', text: res.error.message });
        return;
      }
      if (location === 'HEADER') {
        setNewHeaderLabel('');
        setNewHeaderHref('/');
      } else {
        setNewFooterLabel('');
        setNewFooterHref('/');
      }
      setFeedback({ kind: 'ok', text: `${location} navigation item added.` });
      router.refresh();
    });
  }

  function handleUpdateNav(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await saveCmsNavItemAction({
        id: editing.id,
        location: editing.location as 'HEADER' | 'FOOTER',
        label: editing.label,
        href: editing.href,
        sortOrder: editing.sortOrder,
        visible: editing.visible,
      });
      if (!res.ok) {
        setFeedback({ kind: 'err', text: res.error.message });
        return;
      }
      setEditing(null);
      setFeedback({ kind: 'ok', text: 'Navigation item updated and storefront cache refreshed.' });
      router.refresh();
    });
  }

  function handleDeleteNav(id: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteCmsNavItemAction({ id });
      if (!res.ok) {
        setFeedback({ kind: 'err', text: res.error.message });
        return;
      }
      setFeedback({ kind: 'ok', text: 'Navigation item removed.' });
      router.refresh();
    });
  }

  function renderNavPanel(title: string, location: 'HEADER' | 'FOOTER', items: NavRow[]) {
    const labelVal = location === 'HEADER' ? newHeaderLabel : newFooterLabel;
    const hrefVal = location === 'HEADER' ? newHeaderHref : newFooterHref;
    const setLabel = location === 'HEADER' ? setNewHeaderLabel : setNewFooterLabel;
    const setHref = location === 'HEADER' ? setNewHeaderHref : setNewFooterHref;

    return (
      <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-char flex items-center gap-2">
            <Navigation className="h-4 w-4 text-ember" /> {title}
          </h2>
          <span className="rounded-full bg-cream-deep px-2.5 py-0.5 font-mono text-[11px] font-bold text-char">
            {items.length} items
          </span>
        </div>

        <div className="divide-y divide-border-warm/60 text-sm">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-char">{item.label}</p>
                <p className="font-mono text-xs text-smoke truncate">{item.href}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${
                    item.visible ? 'bg-herb/15 text-herb' : 'bg-smoke/15 text-smoke'
                  }`}
                >
                  {item.visible ? 'Visible' : 'Hidden'}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="rounded-lg border border-border-warm px-2.5 py-1 text-xs font-semibold text-char hover:bg-cream-deep cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDeleteNav(item.id)}
                  className="rounded-lg border border-chilli/30 p-1.5 text-chilli hover:bg-chilli/10 cursor-pointer"
                  aria-label={`Delete ${item.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={(e) => handleAddNav(location, e)} className="pt-3 border-t border-border-warm grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            type="text"
            value={labelVal}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`New ${location.toLowerCase()} label`}
            className="sm:col-span-5 rounded-xl border border-border-warm bg-cream/40 px-3 py-2 text-xs text-char"
          />
          <input
            type="text"
            value={hrefVal}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/menu"
            className="sm:col-span-4 rounded-xl border border-border-warm bg-cream/40 px-3 py-2 font-mono text-xs text-char"
          />
          <button
            type="submit"
            disabled={isPending || !labelVal.trim()}
            className="sm:col-span-3 inline-flex items-center justify-center gap-1 rounded-xl bg-char hover:bg-char-soft disabled:opacity-50 px-3 py-2 text-xs font-bold text-cream cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="alert"
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.kind === 'ok'
              ? 'border-herb/30 bg-herb/10 text-herb'
              : 'border-chilli/30 bg-chilli/10 text-chilli'
          }`}
        >
          {feedback.kind === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* DB-Backed Storefront Hero Image Editor */}
      <form
        onSubmit={handleSaveHero}
        className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-char flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-ember" /> Storefront Homepage Hero Image (DB-Backed)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-4 overflow-hidden rounded-xl border border-border-warm bg-char aspect-video">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroUrl} alt="Hero preview" className="h-full w-full object-cover" />
          </div>
          <div className="md:col-span-8 space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1">
                Hero Image URL / Path
              </label>
              <input
                type="text"
                value={heroUrl}
                onChange={(e) => setHeroUrl(e.target.value)}
                placeholder="/images/hero-grill.jpg"
                className="w-full rounded-xl border border-border-warm bg-cream/40 px-3.5 py-2.5 font-mono text-xs text-char"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {IMAGE_PRESETS.map((p) => (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => setHeroUrl(p.url)}
                  className="rounded-full border border-border-warm bg-cream hover:bg-cream-deep px-2.5 py-1 text-[11px] font-semibold text-char cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ember hover:bg-ember-dark disabled:opacity-60 px-4 py-2 text-xs font-bold text-cream cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" /> Save Hero Image
            </button>
          </div>
        </div>
      </form>

      {/* Edit Modal for Nav Item */}
      {editing && (
        <form
          onSubmit={handleUpdateNav}
          className="rounded-2xl border-2 border-ember bg-cream p-5 shadow-md space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-char">
              Edit {editing.location} Link: {editing.label}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-xs font-bold text-smoke hover:text-char cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={editing.label}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              placeholder="Label"
              className="rounded-xl border border-border-warm bg-white px-3 py-2 text-sm text-char"
            />
            <input
              type="text"
              value={editing.href}
              onChange={(e) => setEditing({ ...editing, href: e.target.value })}
              placeholder="/menu"
              className="rounded-xl border border-border-warm bg-white px-3 py-2 font-mono text-sm text-char"
            />
            <input
              type="number"
              value={editing.sortOrder}
              onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
              placeholder="Order"
              className="rounded-xl border border-border-warm bg-white px-3 py-2 font-mono text-sm text-char"
            />
            <label className="flex items-center gap-2 rounded-xl border border-border-warm bg-white px-3 py-2 text-xs font-bold text-char">
              <input
                type="checkbox"
                checked={editing.visible}
                onChange={(e) => setEditing({ ...editing, visible: e.target.checked })}
                className="accent-ember"
              />
              Visible on site
            </label>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-ember hover:bg-ember-dark px-5 py-2 text-xs font-bold text-cream cursor-pointer"
          >
            Save Navigation Item
          </button>
        </form>
      )}

      {/* Separate Header & Footer Navigation Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderNavPanel('Header Navigation', 'HEADER', headerItems)}
        {renderNavPanel('Footer Navigation', 'FOOTER', footerItems)}
      </div>
    </div>
  );
}
