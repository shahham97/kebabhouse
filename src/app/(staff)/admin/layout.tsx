import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { ADMIN_MODULES } from '@/config/modules';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getStaffActor();
  if (!actor) {
    redirect('/admin/login');
  }

  const allowedModules = ADMIN_MODULES.filter(
    (m) => actor.isSuperAdmin || actor.permissions.has(m.permission)
  );

  return (
    <AdminShell
      modules={[...allowedModules]}
      staffName={actor.name}
      roleName={actor.roleName}
      isSuperAdmin={actor.isSuperAdmin}
    >
      {children}
    </AdminShell>
  );
}
