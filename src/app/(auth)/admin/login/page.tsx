import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaffActor } from '@/lib/auth';
import { BrandMark } from '@/components/BrandMark';
import { AdminLoginForm } from '@/components/auth/AdminLoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin Login',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const actor = await getStaffActor();
  if (actor && (actor.isSuperAdmin || actor.permissions.has('dashboard.view'))) {
    redirect('/admin');
  }

  return (
    <main className="min-h-screen bg-char text-cream flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(circle at 15% 15%, #C8401E 0%, transparent 45%), radial-gradient(circle at 85% 85%, #F4A62A 0%, transparent 45%)',
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
                Executive Admin Portal
              </p>
            </div>
          </div>
        </div>

        <AdminLoginForm />
      </div>
    </main>
  );
}
