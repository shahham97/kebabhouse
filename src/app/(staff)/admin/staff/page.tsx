import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getAdminStaffAndRoles } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { StaffManager } from '@/components/admin/StaffManager';

export default async function AdminStaffPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('staff.manage')) {
    return <AccessDenied permission="staff.manage" />;
  }

  const data = await getAdminStaffAndRoles(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">System</p>
        <h1 className="font-display text-3xl font-bold text-char">Staff &amp; PINs</h1>
        <p className="mt-1 text-sm text-smoke">
          Create staff accounts, assign roles, configure till PINs, and revoke active sessions.
        </p>
      </div>

      <StaffManager
        staffUsers={data.staffUsers}
        roles={data.roles}
        currentStaffId={actor.id}
      />
    </div>
  );
}
