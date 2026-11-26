import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { getAdminStaffAndRoles } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { RolesMatrix } from '@/components/admin/RolesMatrix';

export default async function AdminRolesPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('roles.manage')) {
    return <AccessDenied permission="roles.manage" />;
  }

  const data = await getAdminStaffAndRoles(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">System</p>
        <h1 className="font-display text-3xl font-bold text-char">Roles &amp; Permissions</h1>
        <p className="mt-1 text-sm text-smoke">
          Define custom staff roles, discount caps, and module-level RBAC permission matrices.
        </p>
      </div>

      <RolesMatrix
        roles={data.roles}
        permissionsByModule={data.permissionsByModule}
        currentRoleId={actor.roleId}
      />
    </div>
  );
}
