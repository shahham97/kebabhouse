import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getAdminInventory } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { InventoryManager } from '@/components/admin/InventoryManager';

export default async function AdminInventoryPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('inventory.view')) {
    return <AccessDenied permission="inventory.view" />;
  }

  const data = await getAdminInventory(actor.storeId);
  const canAdjust = actor.isSuperAdmin || actor.permissions.has('inventory.adjust');

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">Catalogue &amp; Stock</p>
        <h1 className="font-display text-3xl font-bold text-char">Inventory &amp; Recipes</h1>
        <p className="mt-1 text-sm text-smoke">
          Track stock on hand, log waste or stocktake counts, and link recipe deductions to menu variants.
        </p>
      </div>

      <InventoryManager data={data} canAdjust={canAdjust} />
    </div>
  );
}
