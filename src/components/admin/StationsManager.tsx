'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Flame, ExternalLink, Plus, CheckCircle2, Clock } from 'lucide-react';
import {
  createStationAction,
  toggleStationAutoCompleteAction,
} from '@/modules/admin/actions';

export interface StationRow {
  id: string;
  code: string;
  name: string;
  color: string;
  sortOrder: number;
  autoComplete: boolean;
  active: boolean;
  openTicketsCount: number;
  newTicketsCount: number;
  preparingTicketsCount: number;
  productsCount: number;
  categoriesCount: number;
}

export function StationsManager({ stations }: { stations: StationRow[] }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState('#C8401E');
  const [autoComplete, setAutoComplete] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createStationAction({ name, code, color, autoComplete });
      if (res.ok) {
        setName('');
        setCode('');
        setAutoComplete(false);
        setFeedback({ type: 'ok', text: `Station "${name}" created.` });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const handleToggleAutoComplete = (id: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await toggleStationAutoCompleteAction({ id });
      if (!res.ok) {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

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

      {/* Station Launch Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* All-stations overview card */}
        <div className="flex flex-col justify-between rounded-2xl border border-char bg-char p-5 text-cream shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-ember px-2.5 py-1 font-mono text-xs font-semibold uppercase">
                <Flame className="h-3.5 w-3.5" />
                Combined KDS
              </span>
              <span className="font-mono text-xs text-saffron">ALL STATIONS</span>
            </div>
            <h3 className="mt-3 font-display text-xl font-bold">All Kitchen Stations</h3>
            <p className="mt-1 text-xs text-cream/70">
              Combined view across every active prep station.
            </p>
          </div>
          <Link
            href="/station/all"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-bold text-char transition hover:bg-saffron/90"
          >
            Launch Combined KDS
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        {stations.map((s) => (
          <div
            key={s.id}
            className="flex flex-col justify-between rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-mono text-xs uppercase text-smoke">/{s.code}</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                    s.openTicketsCount > 0
                      ? 'bg-ember/15 text-ember'
                      : 'bg-herb/15 text-herb'
                  }`}
                >
                  {s.openTicketsCount} open
                </span>
              </div>

              <h3 className="mt-2 font-display text-xl font-bold text-char">{s.name}</h3>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-smoke">
                <div className="rounded-lg bg-cream px-2.5 py-1.5">
                  <span className="font-mono font-bold text-char tabular-nums">
                    {s.newTicketsCount}
                  </span>{' '}
                  New /{' '}
                  <span className="font-mono font-bold text-ember tabular-nums">
                    {s.preparingTicketsCount}
                  </span>{' '}
                  Prep
                </div>
                <div className="rounded-lg bg-cream px-2.5 py-1.5">
                  <span className="font-mono font-bold text-char tabular-nums">
                    {s.productsCount}
                  </span>{' '}
                  items ·{' '}
                  <span className="font-mono font-bold text-char tabular-nums">
                    {s.categoriesCount}
                  </span>{' '}
                  cats
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-warm pt-4">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggleAutoComplete(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  s.autoComplete
                    ? 'bg-herb/15 text-herb hover:bg-herb/25'
                    : 'bg-cream text-smoke hover:bg-cream-deep'
                }`}
              >
                {s.autoComplete ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Auto-Ready ON
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    Manual KDS
                  </>
                )}
              </button>

              <Link
                href={`/station/${s.code}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ember px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-ember-dark"
              >
                Open KDS
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Create Station Form */}
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
      >
        <h2 className="font-display text-lg font-bold text-char">Add Kitchen Station</h2>
        <p className="mt-0.5 text-xs text-smoke">
          Create a new prep screen (e.g., Grill, Doner, Fryer, Counter/Drinks).
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-smoke">Station Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!code) {
                  setCode(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '')
                  );
                }
              }}
              placeholder="Charcoal Grill"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-smoke">URL Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="grill"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char focus:border-ember focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-smoke">Accent Color</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border-warm bg-cream p-1"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char focus:border-ember focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 rounded-xl border border-border-warm bg-cream px-3 py-2 text-xs font-medium text-char">
              <input
                type="checkbox"
                checked={autoComplete}
                onChange={(e) => setAutoComplete(e.target.checked)}
                className="h-4 w-4 accent-ember"
              />
              Auto-complete tickets (e.g. Drinks)
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-ember-dark disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {isPending ? 'Creating…' : 'Create Station'}
          </button>
        </div>
      </form>
    </div>
  );
}
