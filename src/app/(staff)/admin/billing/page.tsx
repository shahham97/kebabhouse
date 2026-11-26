import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getAdminBilling } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { BillingManager } from '@/components/admin/BillingManager';

export const dynamic = 'force-dynamic';

export default async function AdminBillingPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('billing.manage')) {
    return (
      <AccessDenied
        permission="billing.manage"
        message="You do not have permission to customise bills and tax invoice templates."
      />
    );
  }

  const data = await getAdminBilling(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-char">
          Bill &amp; Receipt Customization
        </h1>
        <p className="text-sm text-smoke mt-1">
          Configure Australian GST Tax Invoice headers, footers, ABN visibility, and 80mm thermal receipt layouts.
        </p>
      </div>

      <BillingManager store={data.store} templates={data.templates} />
    </div>
  );
}
