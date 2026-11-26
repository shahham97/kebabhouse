'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  LogOut,
  Monitor,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type { KitchenScreenData, KitchenTicketDTO } from '@/modules/kitchen/queries';
import { recallTicketAction, setTicketStatusAction } from '@/modules/kitchen/actions';
import { staffLogoutAction } from '@/modules/till/actions';
import { formatStoreTime, minutesSince } from '@/lib/time';

interface StationKdsBoardProps {
  data: KitchenScreenData;
  staff: {
    name: string;
    roleName: string;
    canPrepare: boolean;
    canRecall: boolean;
    canUseTill: boolean;
  };
}

function getFulfilmentTag(ticket: KitchenTicketDTO): {
  label: string;
  className: string;
} {
  if (ticket.fulfilment === 'DINE_IN') {
    return {
      label: `DINE-IN · T${ticket.tableNumber || '?'}`,
      className: 'bg-saffron text-char',
    };
  }
  if (ticket.fulfilment === 'DELIVERY') {
    return {
      label: 'DELIVERY',
      className: 'bg-ember text-cream',
    };
  }
  return {
    label: 'PICKUP',
    className: 'bg-cream text-char',
  };
}

function getAgeClass(mins: number): string {
  if (mins >= 15) return 'bg-chilli text-cream animate-pulse';
  if (mins >= 8) return 'bg-saffron text-char';
  return 'bg-herb text-cream';
}

export function StationKdsBoard({ data, staff }: StationKdsBoardProps) {
  const router = useRouter();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [hiddenTicketIds, setHiddenTicketIds] = useState<Set<string>>(() => new Set());
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Live clock + age timer tick every 10s
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Reset optimistic hidden IDs when server data updates
  useEffect(() => {
    setHiddenTicketIds(new Set());
  }, [data.tickets]);

  // Realtime SSE + 30s safety refresh
  useEffect(() => {
    const channel = `store:${data.store.id}:till`;
    const es = new EventSource(`/api/realtime/stream?channel=${encodeURIComponent(channel)}`);

    const refresh = () => {
      router.refresh();
    };

    es.addEventListener('connected', () => setSseConnected(true));
    es.addEventListener('order.created', refresh);
    es.addEventListener('order.paid', refresh);
    es.addEventListener('order.updated', refresh);
    es.addEventListener('order.ready', refresh);
    es.addEventListener('order.fired', refresh);
    es.addEventListener('order.cancelled', refresh);
    es.onerror = () => setSseConnected(false);

    const safety = setInterval(refresh, 30_000);
    return () => {
      es.close();
      clearInterval(safety);
    };
  }, [data.store.id, router]);

  const visibleTickets = data.tickets.filter((t) => !hiddenTicketIds.has(t.id));
  const totalOpenCount = data.stations.reduce((sum, s) => sum + s.openCount, 0);

  function handleTicketStatus(ticketId: string, to: 'PREPARING' | 'READY') {
    setErrorMsg(null);
    setBusyTicketId(ticketId);
    startTransition(async () => {
      const res = await setTicketStatusAction({ ticketId, to });
      setBusyTicketId(null);
      if (!res.ok) {
        setErrorMsg(res.error.message);
        return;
      }
      if (to === 'READY') {
        setHiddenTicketIds((prev) => new Set(prev).add(ticketId));
      }
      router.refresh();
    });
  }

  function handleRecall(ticketId: string) {
    setErrorMsg(null);
    setBusyTicketId(ticketId);
    startTransition(async () => {
      const res = await recallTicketAction({ ticketId });
      setBusyTicketId(null);
      if (!res.ok) {
        setErrorMsg(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await staffLogoutAction({});
      router.push('/staff/login');
      router.refresh();
    });
  }

  const clockLabel = new Intl.DateTimeFormat('en-AU', {
    timeZone: data.store.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(nowTick));

  return (
    <div className="min-h-screen bg-[#120E0D] text-cream flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-cream/10 bg-[#1A1311]/95 backdrop-blur px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ember flex items-center justify-center text-cream shadow-md">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold tracking-tight leading-none">
                  {data.currentStation ? data.currentStation.name : 'ALL KITCHEN STATIONS'}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    sseConnected ? 'bg-herb/20 text-herb' : 'bg-saffron/20 text-saffron'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      sseConnected ? 'bg-herb' : 'bg-saffron'
                    }`}
                  />
                  {sseConnected ? 'LIVE' : 'SYNC'}
                </span>
              </div>
              <p className="text-xs text-cream/60 mt-0.5">
                {data.store.name} · {staff.name} ({staff.roleName})
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-char-soft border border-cream/10 px-3.5 py-2 flex items-center gap-2 font-mono text-sm font-bold tabular-nums">
              <Clock className="h-4 w-4 text-saffron" />
              {clockLabel}
            </div>
            <div className="rounded-xl bg-ember/20 border border-ember/40 px-3.5 py-2 font-mono text-sm font-bold tabular-nums text-cream">
              {visibleTickets.length} OPEN
            </div>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="rounded-xl bg-char-soft hover:bg-cream/10 border border-cream/10 p-2.5 text-cream transition-colors cursor-pointer"
              title="Refresh tickets"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            </button>
            {staff.canUseTill && (
              <Link
                href="/till"
                className="inline-flex items-center gap-1.5 rounded-xl bg-cream text-char hover:bg-cream-deep px-3.5 py-2 text-xs font-extrabold transition-colors"
              >
                <Monitor className="h-4 w-4" />
                Back to Till
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl bg-char-soft hover:bg-chilli/30 border border-cream/10 px-3 py-2 text-xs font-bold text-cream/80 hover:text-cream transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Out
            </button>
          </div>
        </div>

        {/* Station selector tabs */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <Link
            href="/station/all"
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold transition-all flex items-center gap-2 ${
              data.stationCode === 'all'
                ? 'bg-ember text-cream shadow'
                : 'bg-char-soft text-cream/75 hover:text-cream border border-cream/10'
            }`}
          >
            All Stations
            <span className="rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-xs tabular-nums">
              {totalOpenCount}
            </span>
          </Link>
          {data.stations.map((st) => {
            const active = data.stationCode === st.code;
            return (
              <Link
                key={st.id}
                href={`/station/${st.code}`}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold transition-all flex items-center gap-2 ${
                  active
                    ? 'bg-saffron text-char shadow'
                    : 'bg-char-soft text-cream/80 hover:text-cream border border-cream/10'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: st.color }}
                />
                {st.name}
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                    active ? 'bg-char/20 text-char' : 'bg-black/30 text-cream'
                  }`}
                >
                  {st.openCount}
                </span>
              </Link>
            );
          })}
        </div>

        {/* All-Day Summary Bar */}
        {data.allDaySummary.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pt-2 border-t border-cream/10">
            <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider text-saffron">
              ALL-DAY:
            </span>
            {data.allDaySummary.map((item) => (
              <span
                key={item.key}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-char-soft border border-cream/15 px-2.5 py-1 text-xs font-bold text-cream"
              >
                <span className="font-mono text-saffron tabular-nums">{item.count}×</span>
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mx-4 mt-4 rounded-xl bg-chilli/20 border border-chilli px-4 py-3 text-sm font-bold text-cream flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Ticket Grid */}
      <main className="flex-1 p-4">
        {visibleTickets.length === 0 ? (
          <div className="h-[55vh] flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-16 w-16 text-herb mb-4" />
            <h2 className="font-display text-3xl font-extrabold text-cream">
              ALL CLEAR — NO OPEN TICKETS
            </h2>
            <p className="text-sm text-cream/60 mt-1 max-w-md">
              New tickets from the Till or online checkout will appear here automatically in real time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
            {visibleTickets.map((ticket) => {
              const mins = minutesSince(ticket.releaseAt);
              const tag = getFulfilmentTag(ticket);
              const isPreparing = ticket.status === 'PREPARING';
              const isBusy = busyTicketId === ticket.id;

              return (
                <article
                  key={ticket.id}
                  className={`rounded-2xl border-2 overflow-hidden flex flex-col shadow-xl transition-all ${
                    isPreparing
                      ? 'border-saffron bg-[#1F1714]'
                      : 'border-cream/20 bg-[#1B1513]'
                  }`}
                >
                  {/* Ticket Header */}
                  <div className="p-4 border-b border-cream/10 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-2xl font-extrabold tracking-tight text-cream tabular-nums">
                          {ticket.orderNumber}
                        </span>
                        <span
                          className={`rounded-lg px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide ${tag.className}`}
                        >
                          {tag.label}
                        </span>
                        {ticket.round > 1 && (
                          <span className="rounded-lg bg-ember px-2 py-0.5 text-xs font-extrabold text-cream">
                            ROUND {ticket.round}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-cream/70">
                        {data.stationCode === 'all' && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold text-cream"
                            style={{ backgroundColor: `${ticket.stationColor}40` }}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: ticket.stationColor }}
                            />
                            {ticket.stationName}
                          </span>
                        )}
                        <span className="font-semibold text-cream/80">
                          {ticket.customerName}
                        </span>
                        <span>· Due {formatStoreTime(ticket.promisedAt, data.store.timezone)}</span>
                      </div>
                    </div>

                    <div
                      className={`shrink-0 rounded-xl px-3 py-1.5 font-mono text-lg font-extrabold tabular-nums ${getAgeClass(
                        mins
                      )}`}
                    >
                      {mins}m
                    </div>
                  </div>

                  {/* Status Strip */}
                  {isPreparing && (
                    <div className="bg-saffron/20 border-b border-saffron/30 px-4 py-1.5 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-saffron">
                      <Flame className="h-3.5 w-3.5" />
                      PREPARING NOW
                    </div>
                  )}

                  {/* Order-level notes */}
                  {ticket.orderNotes && (
                    <div className="mx-4 mt-3 rounded-xl bg-chilli/25 border border-chilli px-3 py-2 flex items-start gap-2 text-sm font-bold text-cream">
                      <AlertTriangle className="h-4 w-4 text-saffron shrink-0 mt-0.5" />
                      <span>ORDER NOTE: {ticket.orderNotes}</span>
                    </div>
                  )}

                  {/* Items List */}
                  <ul className="p-4 space-y-3 flex-1">
                    {ticket.items.map((item) => (
                      <li
                        key={item.id}
                        className="border-b border-cream/10 last:border-0 pb-3 last:pb-0"
                      >
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-mono text-2xl font-extrabold text-saffron tabular-nums">
                            {item.quantity}×
                          </span>
                          <div className="flex-1">
                            <p className="text-xl font-extrabold leading-snug text-cream">
                              {item.productName}
                            </p>
                            {item.variantName &&
                              item.variantName !== 'Regular' &&
                              item.variantName !== 'Standard' && (
                                <p className="text-sm font-bold uppercase tracking-wide text-saffron">
                                  {item.variantName}
                                </p>
                              )}
                          </div>
                        </div>

                        {item.modifiers.length > 0 && (
                          <div className="mt-1.5 pl-9 flex flex-wrap gap-1.5">
                            {item.modifiers.map((m, idx) => (
                              <span
                                key={`${item.id}-m-${idx}`}
                                className="rounded-md bg-cream/10 px-2 py-0.5 text-sm font-semibold text-cream/90"
                              >
                                {m.optionName}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.notes && (
                          <div className="mt-2 ml-9 inline-flex items-center gap-1.5 rounded-lg bg-chilli/30 border border-chilli px-2.5 py-1.5 text-sm font-extrabold text-cream">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-saffron" />
                            <span>{item.notes}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Giant Touch Action Buttons (>= 56px) */}
                  {staff.canPrepare && (
                    <div className="p-3 bg-black/25 border-t border-cream/10 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={isBusy || isPreparing}
                        aria-pressed={isPreparing}
                        onClick={() => handleTicketStatus(ticket.id, 'PREPARING')}
                        className={`min-h-[58px] inline-flex items-center justify-center gap-2 rounded-xl font-display text-lg font-extrabold tracking-wide uppercase transition-all cursor-pointer ${
                          isPreparing
                            ? 'bg-saffron/25 text-saffron/70 border border-saffron/40 cursor-default'
                            : 'bg-saffron hover:brightness-110 active:scale-[0.98] text-char shadow-md'
                        }`}
                      >
                        {isPreparing && <CheckCircle2 className="h-5 w-5" />}
                        <span>{isPreparing ? 'PREPARING' : 'PREPARING'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTicketStatus(ticket.id, 'READY')}
                        className="min-h-[58px] rounded-xl bg-herb hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-cream font-display text-lg font-extrabold tracking-wide uppercase shadow-md transition-all cursor-pointer"
                      >
                        READY
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Recently Ready / Recall Footer */}
      {staff.canRecall && data.recentlyReady.length > 0 && (
        <footer className="border-t border-cream/10 bg-[#1A1311] px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-cream/60 flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Recently Ready (Tap to Recall):
            </span>
            {data.recentlyReady.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={busyTicketId === r.id}
                onClick={() => handleRecall(r.id)}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-cream/15 bg-char-soft hover:border-saffron px-3 py-1.5 text-xs font-bold text-cream transition-colors cursor-pointer"
              >
                <span className="font-mono text-saffron">{r.orderNumber}</span>
                <span className="text-cream/70">{r.stationName}</span>
                <span className="text-[10px] uppercase text-cream/50">Recall</span>
              </button>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
