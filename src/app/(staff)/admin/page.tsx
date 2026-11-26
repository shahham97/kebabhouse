import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  Clock,
  Truck,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { getStaffActor } from '@/lib/auth';
import { getAdminDashboardData } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { DashboardCharts } from '@/components/admin/DashboardCharts';
import { formatAUD } from '@/lib/money';
import { formatStoreDateTime } from '@/lib/time';

export default async function AdminDashboardPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('dashboard.view')) {
    return <AccessDenied permission="dashboard.view" />;
  }

  const data = await getAdminDashboardData(actor.storeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-ember">Overview</p>
          <h1 className="font-display text-3xl font-bold text-char">Operations Dashboard</h1>
          <p className="mt-1 text-sm text-smoke">
            Live revenue, order flow, stock alerts, and kitchen health for Star Kebab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/till"
            className="rounded-xl bg-ember px-4 py-2 text-sm font-semibold text-cream transition hover:bg-ember-dark"
          >
            Open Till POS
          </Link>
          <Link
            href="/admin/orders"
            className="rounded-xl border border-border-warm bg-white px-4 py-2 text-sm font-semibold text-char transition hover:bg-cream-deep"
          >
            Live Orders
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-smoke">
            <span>Today&apos;s Revenue</span>
            <DollarSign className="h-4 w-4 text-ember" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-char tabular-nums">
            {formatAUD(data.todayRevenueCents)}
          </div>
          <p className="mt-1 text-xs text-smoke tabular-nums">
            {data.todayPaymentsCount} succeeded {data.todayPaymentsCount === 1 ? 'payment' : 'payments'} today
          </p>
        </div>

        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-smoke">
            <span>Total Revenue</span>
            <TrendingUp className="h-4 w-4 text-herb" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-char tabular-nums">
            {formatAUD(data.totalRevenueCents)}
          </div>
          <p className="mt-1 text-xs text-smoke tabular-nums">
            Across {data.paidOrdersCount} paid orders
          </p>
        </div>

        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-smoke">
            <span>Average Order Value</span>
            <ShoppingBag className="h-4 w-4 text-saffron" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-char tabular-nums">
            {formatAUD(data.aovCents)}
          </div>
          <p className="mt-1 text-xs text-smoke tabular-nums">
            {data.systemHealth.ordersCount} total orders recorded
          </p>
        </div>

        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-smoke">
            <span>Stock &amp; PO Alerts</span>
            <AlertTriangle
              className={`h-4 w-4 ${data.lowStockItems.length > 0 ? 'text-chilli' : 'text-herb'}`}
            />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-char tabular-nums">
            {data.lowStockItems.length} low
          </div>
          <p className="mt-1 text-xs text-smoke tabular-nums">
            {data.pendingPos.length} open purchase {data.pendingPos.length === 1 ? 'order' : 'orders'}
          </p>
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts
        revenueByPaymentMethod={data.revenueByPaymentMethod}
        ordersByFulfilment={data.ordersByFulfilment}
      />

      {/* Order Status & Channel Pills */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <h2 className="font-display text-base font-bold text-char">Orders by Status</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.ordersByStatus.length === 0 ? (
              <p className="text-sm text-smoke">No orders yet.</p>
            ) : (
              data.ordersByStatus.map((row) => (
                <Link
                  key={row.status}
                  href={`/admin/orders?status=${row.status}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border-warm bg-cream px-3 py-1.5 text-xs font-semibold text-char transition hover:bg-cream-deep"
                >
                  <span>{row.status}</span>
                  <span className="rounded-md bg-char px-1.5 py-0.5 font-mono text-[11px] text-cream tabular-nums">
                    {row.count}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <h2 className="font-display text-base font-bold text-char">Orders by Channel</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.ordersByChannel.length === 0 ? (
              <p className="text-sm text-smoke">No channel data yet.</p>
            ) : (
              data.ordersByChannel.map((row) => (
                <div
                  key={row.channel}
                  className="inline-flex items-center gap-2 rounded-xl border border-border-warm bg-cream px-3 py-1.5 text-xs font-semibold text-char"
                >
                  <span>{row.channel}</span>
                  <span className="rounded-md bg-ember px-1.5 py-0.5 font-mono text-[11px] text-cream tabular-nums">
                    {row.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders + Operational Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders */}
        <div className="rounded-2xl border border-border-warm bg-white shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border-warm px-5 py-4">
            <h2 className="font-display text-lg font-bold text-char">Recent Orders</h2>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ember hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <div className="p-6 text-sm text-smoke">No orders placed yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-warm bg-cream/70 text-xs font-semibold uppercase tracking-wider text-smoke">
                    <th className="px-4 py-2.5">Order</th>
                    <th className="px-4 py-2.5">Customer</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-warm/60">
                  {data.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-cream/40">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-char">
                        {o.number}
                        <div className="font-sans text-[11px] font-normal text-smoke">
                          {formatStoreDateTime(o.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-char">{o.customerName || 'Walk-in'}</td>
                      <td className="px-4 py-2.5 text-xs text-smoke">
                        {o.channel} · {o.fulfilment}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex rounded-md bg-cream-deep px-2 py-0.5 font-mono text-[11px] font-semibold text-char">
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-char tabular-nums">
                        {formatAUD(o.totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: Low Stock, Scheduled, Pending POs */}
        <div className="space-y-6">
          {/* Low Stock */}
          <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-char">Low Stock Alerts</h2>
              <Link
                href="/admin/inventory"
                className="text-xs font-semibold text-ember hover:underline"
              >
                Inventory
              </Link>
            </div>
            {data.lowStockItems.length === 0 ? (
              <p className="mt-3 text-sm text-herb">All inventory items are above minimum thresholds.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.lowStockItems.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-chilli/20 bg-chilli/5 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-char">{item.name}</div>
                      <div className="text-smoke">{item.vendorName}</div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <span className="font-bold text-chilli">
                        {item.onHand} {item.unit}
                      </span>
                      <div className="text-[11px] text-smoke">min {item.minThreshold}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upcoming Scheduled Orders */}
          <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-saffron" />
              <h2 className="font-display text-base font-bold text-char">Upcoming Scheduled</h2>
            </div>
            {data.upcomingScheduledOrders.length === 0 ? (
              <p className="mt-3 text-sm text-smoke">No upcoming scheduled orders.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.upcomingScheduledOrders.slice(0, 5).map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-mono font-semibold text-char">
                        {o.number} · {o.customerName || 'Guest'}
                      </div>
                      <div className="text-smoke">
                        {o.scheduledFor ? formatStoreDateTime(o.scheduledFor) : 'TBD'}
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-char tabular-nums">
                      {formatAUD(o.totalCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pending POs */}
          <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-ember" />
                <h2 className="font-display text-base font-bold text-char">Pending POs</h2>
              </div>
              <Link
                href="/admin/purchasing"
                className="text-xs font-semibold text-ember hover:underline"
              >
                Purchasing
              </Link>
            </div>
            {data.pendingPos.length === 0 ? (
              <p className="mt-3 text-sm text-smoke">No pending purchase orders.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.pendingPos.slice(0, 5).map((po) => (
                  <li
                    key={po.id}
                    className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-mono font-semibold text-char">{po.number}</div>
                      <div className="text-smoke">{po.vendorName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-char tabular-nums">
                        {formatAUD(po.totalCents)}
                      </div>
                      <div className="font-mono text-[10px] uppercase text-ember">{po.status}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* System Health Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-warm bg-char px-5 py-3.5 text-xs text-cream">
        <div className="flex items-center gap-2 font-semibold">
          <Activity className="h-4 w-4 text-saffron" />
          System Telemetry
        </div>
        <div className="flex flex-wrap items-center gap-6 font-mono tabular-nums">
          <span>Orders: {data.systemHealth.ordersCount}</span>
          <span>Audit Events: {data.systemHealth.auditCount}</span>
          <span>Notifications Today: {data.systemHealth.notificationsSentToday}</span>
        </div>
      </div>
    </div>
  );
}
