import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCustomerActor } from '@/lib/auth';
import { BrandMark } from '@/components/BrandMark';
import { CustomerAuthForm } from '@/components/auth/CustomerAuthForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Customer Sign In — Star Rewards',
};

export default async function CustomerAccountLoginPage() {
  const customer = await getCustomerActor();
  if (customer) {
    redirect('/account');
  }

  return (
    <main className="min-h-screen bg-cream text-char flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-smoke hover:text-ember transition"
          >
            ← Back to Star Kebab
          </Link>
          <div className="flex items-center justify-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-ember flex items-center justify-center text-cream shadow">
              <BrandMark className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide text-char leading-none">
                Star Rewards
              </h1>
              <p className="text-xs font-semibold text-smoke">Customer Account Portal</p>
            </div>
          </div>
        </div>

        <CustomerAuthForm />
      </div>
    </main>
  );
}
