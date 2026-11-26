import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getAdminStations } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { StationsManager } from '@/components/admin/StationsManager';

export default async function AdminStationsPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('kitchen.configure')) {
    return <AccessDenied permission="kitchen.configure" />;
  }

  const stations = await getAdminStations(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">Kitchen Display</p>
        <h1 className="font-display text-3xl font-bold text-char">Kitchen Stations</h1>
        <p className="mt-1 text-sm text-smoke">
          Configure prep stations, launch KDS screens, and manage auto-complete routing.
        </p>
      </div>

      <StationsManager stations={stations} />
    </div>
  );
}
