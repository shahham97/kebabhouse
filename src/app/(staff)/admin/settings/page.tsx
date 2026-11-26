import { redirect } from 'next/navigation';
import { Clock, CalendarClock, ReceiptText } from 'lucide-react';
import { getStaffActor } from '@/lib/auth';
import { getAdminSettings } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { SettingsManager } from '@/components/admin/SettingsManager';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export default async function AdminSettingsPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('settings.manage')) {
    return <AccessDenied permission="settings.manage" />;
  }

  const data = await getAdminSettings(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">System</p>
        <h1 className="font-display text-3xl font-bold text-char">Store &amp; Branding Settings</h1>
        <p className="mt-1 text-sm text-smoke">
          Configure Australian ABN/GST rules, surcharges, online ordering toggles, and delivery zones.
        </p>
      </div>

      <SettingsManager data={data} />

      {/* Read-only operational schedules & templates overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Opening Hours */}
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-ember" />
            <h2 className="font-display text-base font-bold text-char">Opening Hours</h2>
          </div>
          {data.openingHours.length === 0 ? (
            <p className="mt-3 text-sm text-smoke">No opening hours configured.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-xs">
              {data.openingHours.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-lg bg-cream px-3 py-1.5"
                >
                  <span className="font-semibold text-char">
                    {DAY_NAMES[h.dayOfWeek] ?? `Day ${h.dayOfWeek}`}
                  </span>
                  <span className="font-mono text-smoke">
                    {h.isClosed ? 'Closed' : `${h.openTime} – ${h.closeTime}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Time Slot Rules */}
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-ember" />
            <h2 className="font-display text-base font-bold text-char">Time Slot Rules</h2>
          </div>
          {data.timeSlotRules.length === 0 ? (
            <p className="mt-3 text-sm text-smoke">No time slot rules configured.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs">
              {data.timeSlotRules.map((t) => (
                <li key={t.id} className="rounded-xl bg-cream p-3">
                  <div className="font-mono font-bold text-char">{t.fulfilment}</div>
                  <div className="mt-1 text-smoke tabular-nums">
                    {t.slotMinutes}m slots · min {t.minLeadMinutes}m lead · up to {t.maxDaysAhead}d
                    ahead
                  </div>
                  <div className="mt-0.5 text-smoke tabular-nums">
                    Cap: {t.maxOrdersPerSlot} orders / {t.maxItemsPerSlot} items per slot
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Receipt Templates */}
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-ember" />
            <h2 className="font-display text-base font-bold text-char">Receipt Templates</h2>
          </div>
          {data.receiptTemplates.length === 0 ? (
            <p className="mt-3 text-sm text-smoke">No receipt templates configured.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs">
              {data.receiptTemplates.map((r) => (
                <li key={r.id} className="rounded-xl bg-cream p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-char">v{r.version}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${
                        r.active ? 'bg-herb/15 text-herb' : 'bg-smoke/15 text-smoke'
                      }`}
                    >
                      {r.active ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-char">{r.headerText}</p>
                  <p className="mt-0.5 line-clamp-2 text-smoke">{r.footerText}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
