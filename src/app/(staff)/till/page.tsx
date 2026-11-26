import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getTillWorkspaceData } from '@/modules/till/queries';
import { TillWorkspace } from '@/components/till/TillWorkspace';

export const dynamic = 'force-dynamic';

export default async function TillPage() {
  const actor = await getStaffActor();
  if (!actor) {
    redirect('/staff/login');
  }

  const canUseTill = actor.isSuperAdmin || actor.permissions.has('till.use');
  if (!canUseTill) {
    return (
      <div className="min-h-screen bg-cream text-char flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border-warm bg-white p-8 text-center shadow-lg">
          <p className="font-mono text-sm text-chilli font-bold uppercase tracking-widest">
            403 Forbidden
          </p>
          <h1 className="font-display text-3xl font-extrabold mt-2">
            Till Access Required
          </h1>
          <p className="text-sm text-smoke mt-2">
            Your role ({actor.roleName}) does not include the{' '}
            <code className="font-mono text-ember">till.use</code> permission.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            {(actor.isSuperAdmin || actor.permissions.has('kitchen.view')) && (
              <Link
                href="/station/all"
                className="rounded-xl bg-char hover:bg-char-soft px-4 py-2.5 text-sm font-bold text-cream"
              >
                Open Kitchen KDS
              </Link>
            )}
            <Link
              href="/staff/login"
              className="rounded-xl border border-border-warm bg-cream hover:bg-cream-deep px-4 py-2.5 text-sm font-bold text-char"
            >
              Switch Staff
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const data = await getTillWorkspaceData(actor.storeId);

  return (
    <TillWorkspace
      data={data}
      staff={{
        id: actor.id,
        name: actor.name,
        roleName: actor.roleName,
        maxDiscountPct: actor.maxDiscountPct,
        canCreateOrder: actor.isSuperAdmin || actor.permissions.has('orders.create'),
        canMarkAllReady: actor.isSuperAdmin || actor.permissions.has('till.mark_all_ready'),
        canServe: actor.isSuperAdmin || actor.permissions.has('orders.serve'),
        canDispatch: actor.isSuperAdmin || actor.permissions.has('orders.dispatch'),
        canTakePayment: actor.isSuperAdmin || actor.permissions.has('payments.take'),
        canCancel: actor.isSuperAdmin || actor.permissions.has('orders.cancel'),
        canManageCatalog: actor.isSuperAdmin || actor.permissions.has('catalog.manage'),
        canApplyDiscount: actor.isSuperAdmin || actor.permissions.has('discounts.apply'),
        canViewKitchen: actor.isSuperAdmin || actor.permissions.has('kitchen.view'),
        canPrepareKitchen: actor.isSuperAdmin || actor.permissions.has('kitchen.prepare'),
        canViewAdmin: actor.isSuperAdmin || actor.permissions.has('dashboard.view'),
      }}
    />
  );
}
