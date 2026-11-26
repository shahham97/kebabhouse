import Link from 'next/link';
import { getStaffActor } from '@/lib/auth';
import { StaffLoginForm } from '@/components/till/StaffLoginForm';
import { BrandMark } from '@/components/BrandMark';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Staff & Kitchen Login',
  robots: { index: false, follow: false },
};

export default async function StaffLoginPortalPage() {
  const actor = await getStaffActor();

  return (
    <main className="min-h-screen bg-char text-cream flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, #C8401E 0%, transparent 45%), radial-gradient(circle at 80% 80%, #F4A62A 0%, transparent 45%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-saffron hover:text-cream text-xs uppercase tracking-widest font-semibold mb-3 transition-colors"
          >
            ← Back to Star Kebab Storefront
          </Link>
          <div className="flex items-center justify-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-ember flex items-center justify-center text-cream shadow-lg">
              <BrandMark className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-cream leading-none">
                STAR KEBAB
              </h1>
              <p className="text-xs text-saffron font-semibold tracking-wider uppercase mt-0.5">
                Staff Till &amp; Kitchen Portal
              </p>
            </div>
          </div>
        </div>

        {actor && (
          <div className="mb-4 rounded-xl border border-saffron/40 bg-char-soft/90 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="text-cream/70 text-xs">Signed in as</p>
              <p className="font-semibold text-cream">
                {actor.name} <span className="text-saffron">({actor.roleName})</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(actor.isSuperAdmin || actor.permissions.has('till.use')) && (
                <Link
                  href="/till"
                  className="rounded-lg bg-ember hover:bg-ember-dark px-3 py-1.5 text-xs font-bold text-cream"
                >
                  Open Till
                </Link>
              )}
              {(actor.isSuperAdmin || actor.permissions.has('kitchen.view')) && (
                <Link
                  href="/station/all"
                  className="rounded-lg bg-herb px-3 py-1.5 text-xs font-bold text-cream"
                >
                  KDS
                </Link>
              )}
            </div>
          </div>
        )}

        <StaffLoginForm />
      </div>
    </main>
  );
}
