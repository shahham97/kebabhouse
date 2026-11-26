import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getAdminPurchasing } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { PurchasingManager } from '@/components/admin/PurchasingManager';

export default async function AdminPurchasingPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('vendors.manage')) {
    return <AccessDenied permission="vendors.manage" />;
  }

  const data = await getAdminPurchasing(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">Catalogue &amp; Stock</p>
        <h1 className="font-display text-3xl font-bold text-char">Vendors &amp; Purchase Orders</h1>
        <p className="mt-1 text-sm text-smoke">
          Manage suppliers, raise purchase orders, and receive stock directly into inventory.
        </p>
      </div>

      <PurchasingManager data={data} />
    </div>
  );
}
