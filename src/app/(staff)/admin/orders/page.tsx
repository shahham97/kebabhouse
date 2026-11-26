import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getStaffActor } from '@/lib/auth';
import { getAdminOrders } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { formatAUD } from '@/lib/money';
import { formatStoreDateTime } from '@/lib/time';

const STATUS_FILTERS = [
  'ALL',
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('orders.view')) {
    return <AccessDenied permission="orders.view" />;
  }

  const sp = await searchParams;
  const activeStatus = sp.status && sp.status.length > 0 ? sp.status.toUpperCase() : 'ALL';
  const currentPage = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const data = await getAdminOrders(actor.storeId, activeStatus, currentPage, 30);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-ember">Operations</p>
          <h1 className="font-display text-3xl font-bold text-char">Live Orders</h1>
          <p className="mt-1 text-sm text-smoke">
            Full order ledger across Web, Till POS, Dine-in, Pickup, and Delivery.
          </p>
        </div>
        <div className="font-mono text-xs text-smoke tabular-nums">
          {data.totalCount} total {data.totalCount === 1 ? 'order' : 'orders'}
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((st) => {
          const isActive = activeStatus === st;
          const href = st === 'ALL' ? '/admin/orders' : `/admin/orders?status=${st}`;
          return (
            <Link
              key={st}
              href={href}
              className={`rounded-xl px-3 py-1.5 font-mono text-xs font-semibold transition ${
                isActive
                  ? 'bg-ember text-cream shadow-xs'
                  : 'border border-border-warm bg-white text-char hover:bg-cream-deep'
              }`}
            >
              {st}
            </Link>
          );
        })}
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-border-warm bg-white shadow-xs">
        {data.orders.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-display text-base font-semibold text-char">No orders found</p>
            <p className="mt-1 text-sm text-smoke">
              No orders match the selected status filter ({activeStatus}).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-warm bg-cream/70 text-xs font-semibold uppercase tracking-wider text-smoke">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Kitchen Tickets</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm/60">
                {data.orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-cream/40">
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-xs font-bold text-char">{order.number}</div>
                      <div className="mt-0.5 text-[11px] text-smoke">
                        {order.channel} · {order.fulfilment}
                        {order.tableNumber ? ` (T${order.tableNumber})` : ''}
                      </div>
                      <div className="mt-0.5 text-[11px] text-smoke">
                        {formatStoreDateTime(order.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-char">{order.customerName || 'Walk-in'}</div>
                      {order.customerPhone && (
                        <div className="font-mono text-xs text-smoke">{order.customerPhone}</div>
                      )}
                      {order.timing === 'SCHEDULED' && order.scheduledFor && (
                        <div className="mt-1 inline-flex rounded-md bg-saffron/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-char">
                          Sched: {formatStoreDateTime(order.scheduledFor)}
                        </div>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 align-top text-xs text-char">
                      <div className="font-mono text-[11px] text-smoke">
                        {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      </div>
                      <p className="mt-0.5 line-clamp-2">{order.itemsSummary || '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        {order.tickets.length === 0 ? (
                          <span className="text-xs text-smoke">—</span>
                        ) : (
                          order.tickets.map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex items-center gap-1 rounded-md border border-border-warm bg-cream px-2 py-0.5 font-mono text-[10px] font-semibold text-char"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: t.stationColor }}
                              />
                              {t.stationCode}: {t.status}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex rounded-lg bg-cream-deep px-2 py-1 font-mono text-[11px] font-semibold text-char">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-xs font-semibold text-char">
                        {order.paymentStatus}
                      </div>
                      <div className="text-[11px] text-smoke">{order.paymentMethods}</div>
                    </td>
                    <td className="px-4 py-3 text-right align-top font-mono tabular-nums">
                      <div className="font-bold text-char">{formatAUD(order.totalCents)}</div>
                      {order.gstCents > 0 && (
                        <div className="text-[11px] text-smoke">
                          incl. {formatAUD(order.gstCents)} GST
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border-warm px-4 py-3 text-xs">
            <span className="font-mono text-smoke tabular-nums">
              Page {data.page} of {data.totalPages}
            </span>
            <div className="flex items-center gap-2">
              {data.page > 1 && (
                <Link
                  href={`/admin/orders?status=${activeStatus}&page=${data.page - 1}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-warm bg-cream px-3 py-1.5 font-semibold text-char hover:bg-cream-deep"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Link>
              )}
              {data.page < data.totalPages && (
                <Link
                  href={`/admin/orders?status=${activeStatus}&page=${data.page + 1}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-warm bg-cream px-3 py-1.5 font-semibold text-char hover:bg-cream-deep"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
