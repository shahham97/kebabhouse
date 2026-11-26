import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getKitchenScreenData } from '@/modules/kitchen/queries';
import { StationKdsBoard } from '@/components/kitchen/StationKdsBoard';

export const dynamic = 'force-dynamic';

export default async function KitchenStationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const actor = await getStaffActor();
  if (!actor) {
    redirect('/staff/login');
  }

  const canViewKitchen = actor.isSuperAdmin || actor.permissions.has('kitchen.view');
  if (!canViewKitchen) {
    return (
      <div className="min-h-screen bg-[#120E0D] text-cream flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-chilli/40 bg-char-soft p-8 text-center">
          <p className="font-mono text-sm text-chilli font-bold uppercase tracking-widest">
            403 Forbidden
          </p>
          <h1 className="font-display text-3xl font-extrabold mt-2">
            Kitchen Access Required
          </h1>
          <p className="text-sm text-cream/70 mt-2">
            Your role ({actor.roleName}) does not include the{' '}
            <code className="font-mono text-saffron">kitchen.view</code> permission.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/till"
              className="rounded-xl bg-ember hover:bg-ember-dark px-4 py-2.5 text-sm font-bold text-cream"
            >
              Go to Till
            </Link>
            <Link
              href="/staff/login"
              className="rounded-xl border border-cream/20 px-4 py-2.5 text-sm font-bold text-cream"
            >
              Switch Staff
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { code } = await params;
  const data = await getKitchenScreenData(actor.storeId, code);

  return (
    <StationKdsBoard
      data={data}
      staff={{
        name: actor.name,
        roleName: actor.roleName,
        canPrepare: actor.isSuperAdmin || actor.permissions.has('kitchen.prepare'),
        canRecall: actor.isSuperAdmin || actor.permissions.has('kitchen.recall'),
        canUseTill: actor.isSuperAdmin || actor.permissions.has('till.use'),
      }}
    />
  );
}
