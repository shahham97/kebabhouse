import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getAdminDealsAndCoupons } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { DealsManager } from '@/components/admin/DealsManager';

export default async function AdminDealsPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('deals.manage')) {
    return <AccessDenied permission="deals.manage" />;
  }

  const data = await getAdminDealsAndCoupons(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">Growth &amp; Finance</p>
        <h1 className="font-display text-3xl font-bold text-char">Deals, Coupons &amp; Loyalty</h1>
        <p className="mt-1 text-sm text-smoke">
          Create combo deals, promo coupons, and review active loyalty earning rules.
        </p>
      </div>

      <DealsManager data={data} />
    </div>
  );
}
