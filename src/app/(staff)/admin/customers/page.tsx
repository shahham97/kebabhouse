import { redirect } from 'next/navigation';
import { Search, Users, Star, Wallet } from 'lucide-react';
import { getStaffActor } from '@/lib/auth';
import { getAdminCustomers } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { formatAUD } from '@/lib/money';
import { formatStoreDateTime } from '@/lib/time';

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('customers.view')) {
    return <AccessDenied permission="customers.view" />;
  }

  const sp = await searchParams;
  const query = (sp.q ?? '').trim().toLowerCase();

  const allCustomers = await getAdminCustomers(actor.storeId);
  const customers = query
    ? allCustomers.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          c.phone.toLowerCase().includes(query)
      )
    : allCustomers;

  const totalPoints = allCustomers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
  const totalSpentCents = allCustomers.reduce((sum, c) => sum + c.totalSpentCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">Growth &amp; Finance</p>
        <h1 className="font-display text-3xl font-bold text-char">Customers &amp; Loyalty</h1>
        <p className="mt-1 text-sm text-smoke">
          Registered customer accounts, lifetime spend, and loyalty point balances.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-smoke">
            <span>Total Customers</span>
            <Users className="h-4 w-4 text-ember" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-char tabular-nums">
            {allCustomers.length}
          </div>
        </div>
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-smoke">
            <span>Loyalty Points Pool</span>
            <Star className="h-4 w-4 text-saffron" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-char tabular-nums">
            {totalPoints.toLocaleString('en-AU')} pts
          </div>
        </div>
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-smoke">
            <span>Customer Lifetime Spend</span>
            <Wallet className="h-4 w-4 text-herb" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-char tabular-nums">
            {formatAUD(totalSpentCents)}
          </div>
        </div>
      </div>

      {/* Search + Table */}
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
              placeholder="Search name, email, or phone…"
              className="w-full rounded-xl border border-border-warm bg-cream py-2 pl-9 pr-3 text-sm text-char placeholder:text-smoke/70 focus:border-ember focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-xl bg-ember px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-ember-dark"
            >
              Search
            </button>
            <span className="font-mono text-xs text-smoke tabular-nums">
              {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
            </span>
          </div>
        </form>

        {customers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-display text-base font-semibold text-char">No customers found</p>
            <p className="mt-1 text-sm text-smoke">
              Try a different search query or wait for customer sign-ups.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-warm bg-cream/70 text-xs font-semibold uppercase tracking-wider text-smoke">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Loyalty Points</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Total Spent</th>
                  <th className="px-4 py-3">Last Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm/60">
                {customers.map((c) => (
                  <tr key={c.id} className="transition hover:bg-cream/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-char">{c.name}</div>
                      <div className="text-[11px] text-smoke">
                        Joined {formatStoreDateTime(c.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-char">{c.email}</div>
                      {c.phone && <div className="font-mono text-smoke">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-ember tabular-nums">
                      {c.loyaltyPoints.toLocaleString('en-AU')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-char tabular-nums">
                      {c.orderCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-char tabular-nums">
                      {formatAUD(c.totalSpentCents)}
                    </td>
                    <td className="px-4 py-3 text-xs text-smoke">
                      {c.lastOrderAt ? formatStoreDateTime(c.lastOrderAt) : 'Never'}
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
