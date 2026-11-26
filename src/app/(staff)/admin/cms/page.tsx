import { redirect } from 'next/navigation';
import { Globe, Navigation } from 'lucide-react';
import { getStaffActor } from '@/lib/auth';
import { getAdminCms } from '@/modules/admin/queries';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { CmsAnnouncementEditor } from '@/components/admin/CmsAnnouncementEditor';

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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Storefront Navigation Overview */}
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-ember" />
            <h2 className="font-display text-lg font-bold text-char">Storefront Navigation</h2>
          </div>
          {data.navItems.length === 0 ? (
            <p className="mt-3 text-sm text-smoke">No custom navigation items configured.</p>
          ) : (
            <div className="mt-3 divide-y divide-border-warm/60 text-sm">
              {data.navItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-semibold text-char">{item.label}</span>
                    <span className="ml-2 font-mono text-xs text-smoke">{item.href}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-cream-deep px-2 py-0.5 font-mono text-[10px] uppercase text-char">
                      {item.location}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${
                        item.visible ? 'bg-herb/15 text-herb' : 'bg-smoke/15 text-smoke'
                      }`}
                    >
                      {item.visible ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storefront Branding Summary */}
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-ember" />
            <h2 className="font-display text-lg font-bold text-char">Storefront Branding</h2>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-cream px-3 py-2">
              <dt className="text-smoke">Store Name</dt>
              <dd className="font-semibold text-char">{data.storeBranding.storeName}</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-cream px-3 py-2">
              <dt className="text-smoke">Store Slug</dt>
              <dd className="font-mono text-xs font-semibold text-char">
                /{data.storeBranding.slug}
              </dd>
            </div>
            {data.storeBranding.brandingJson &&
              Object.entries(data.storeBranding.brandingJson).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-xl bg-cream px-3 py-2"
                >
                  <dt className="capitalize text-smoke">{k}</dt>
                  <dd className="font-mono text-xs text-char">{String(v)}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
