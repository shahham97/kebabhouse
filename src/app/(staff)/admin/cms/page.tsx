import { redirect } from 'next/navigation';
import { Globe, Navigation } from 'lucide-react';
import { getStaffActor } from '@/lib/auth';
import { getAdminCms } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { CmsAnnouncementEditor } from '@/components/admin/CmsAnnouncementEditor';
import { CmsNavAndHeroManager } from '@/components/admin/CmsNavAndHeroManager';

export default async function AdminCmsPage() {
  const actor = await getStaffActor();
  if (!actor) redirect('/admin/login');
  if (!actor.isSuperAdmin && !actor.permissions.has('cms.manage')) {
    return <AccessDenied permission="cms.manage" />;
  }

  const data = await getAdminCms(actor.storeId);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ember">System</p>
        <h1 className="font-display text-3xl font-bold text-char">Website &amp; CMS</h1>
        <p className="mt-1 text-sm text-smoke">
          Manage storefront announcement banners, navigation links, and brand metadata.
        </p>
      </div>

      <CmsAnnouncementEditor announcements={data.announcements} />

      <CmsNavAndHeroManager
        heroImageUrl={data.storeBranding.heroImageUrl}
        navItems={data.navItems}
      />
    </div>
  );
}
