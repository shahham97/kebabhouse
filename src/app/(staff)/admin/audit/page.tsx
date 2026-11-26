import { redirect } from 'next/navigation';
import { Search, ShieldCheck } from 'lucide-react';
import { getStaffActor } from '@/lib/auth';
import { getAdminAuditLogs } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { formatStoreDateTime } from '@/lib/time';

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('audit.view')) {
    return <AccessDenied permission="audit.view" />;
  }

  const sp = await searchParams;
  const query = (sp.q ?? '').trim().toLowerCase();

  const allLogs = await getAdminAuditLogs();
  const logs = query
    ? allLogs.filter(
        (l) =>
          l.actorName.toLowerCase().includes(query) ||
          l.action.toLowerCase().includes(query) ||
          l.entity.toLowerCase().includes(query) ||
          (l.entityId ?? '').toLowerCase().includes(query) ||
          l.ip.toLowerCase().includes(query)
      )
    : allLogs;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-ember">System</p>
          <h1 className="font-display text-3xl font-bold text-char">Audit Log</h1>
          <p className="mt-1 text-sm text-smoke">
            Immutable security and operations trail for the latest 80 recorded events.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border-warm bg-white px-3 py-1.5 font-mono text-xs text-smoke">
          <ShieldCheck className="h-4 w-4 text-herb" />
          Append-only ledger
        </div>
      </div>

      <div className="rounded-2xl border border-border-warm bg-white shadow-xs">
        <form
          method="GET"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border-warm px-4 py-3"
        >
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke" />
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="Filter actor, action, entity, or IP…"
              className="w-full rounded-xl border border-border-warm bg-cream py-2 pl-9 pr-3 text-sm text-char placeholder:text-smoke/70 focus:border-ember focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-xl bg-ember px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-ember-dark"
            >
              Filter
            </button>
            <span className="font-mono text-xs text-smoke tabular-nums">
              {logs.length} {logs.length === 1 ? 'event' : 'events'}
            </span>
          </div>
        </form>

        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-display text-base font-semibold text-char">No audit events found</p>
            <p className="mt-1 text-sm text-smoke">Try clearing or adjusting your filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-warm bg-cream/70 text-xs font-semibold uppercase tracking-wider text-smoke">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">IP / Request</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm/60">
                {logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-cream/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-smoke">
                      {formatStoreDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-char">{log.actorName}</div>
                      <div className="font-mono text-[11px] uppercase text-smoke">
                        {log.actorType}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-lg bg-cream-deep px-2 py-0.5 font-mono text-xs font-semibold text-ember">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-char">
                      <div>{log.entity}</div>
                      {log.entityId && (
                        <div className="text-[11px] text-smoke">{log.entityId}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-smoke">
                      <div>{log.ip || '—'}</div>
                      <div className="text-[10px] text-smoke/70">{log.requestId}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
