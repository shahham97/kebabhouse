import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getAdminFinance } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { FinanceManager } from '@/components/admin/FinanceManager';

export default async function AdminFinancePage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('finance.view')) {
    return <AccessDenied permission="finance.view" />;
  }

  const data = await getAdminFinance(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">Growth &amp; Finance</p>
        <h1 className="font-display text-3xl font-bold text-char">Finance &amp; Cash</h1>
        <p className="mt-1 text-sm text-smoke">
          Inflows, operating expenses, payment method breakdown, and till cash drawer sessions.
        </p>
      </div>

      <FinanceManager data={data} />
    </div>
  );
}
