import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getAdminCatalog } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { CatalogManager } from '@/components/admin/CatalogManager';

export default async function AdminCatalogPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('catalog.manage')) {
    return <AccessDenied permission="catalog.manage" />;
  }

  const data = await getAdminCatalog(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">Catalogue &amp; Stock</p>
        <h1 className="font-display text-3xl font-bold text-char">Catalogue &amp; Menu</h1>
        <p className="mt-1 text-sm text-smoke">
          Manage categories, products, variants, pricing, GST codes, and sold-out flags.
        </p>
      </div>

      <CatalogManager data={data} />
    </div>
  );
}
