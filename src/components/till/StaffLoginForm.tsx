'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Delete, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { staffLoginAction, staffPinLoginAction } from '@/modules/till/actions';
import { staffLoginSchema } from '@/modules/auth/schemas';

const DEMO_ACCOUNTS = [
  {
    label: "Liam O'Connor (Counter Staff)",
    email: 'staff@starkebab.com.au',
    password: 'StarStaff123!',
    pin: '2222',
    badge: 'Till POS',
  },
  {
    label: 'Jack Thompson (Grill Chef)',
    email: 'chef@starkebab.com.au',
    password: 'StarStaff123!',
    pin: '3333',
    badge: 'KDS Only',
  },
] as const;

export function StaffLoginForm() {
  const router = useRouter();
  const [tab, setTab] = useState<'email' | 'pin'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = staffLoginSchema.safeParse({ email, password, portal: 'staff' });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please enter a valid email and password');
      return;
    }
    startTransition(async () => {
      const res = await staffLoginAction({ email, password, portal: 'staff' });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.push(res.data.redirectTo);
      router.refresh();
    });
  }

  function submitPin(nextPin: string) {
    if (nextPin.length < 4) return;
    setError(null);
    startTransition(async () => {
      const res = await staffPinLoginAction({ pin: nextPin });
      if (!res.ok) {
        setError(res.error.message);
        setPin('');
        return;
      }
      router.push(res.data.redirectTo);
      router.refresh();
    });
  }

  function handleDigit(digit: string) {
    if (isPending || pin.length >= 6) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError(null);
    if (next.length === 4) {
      submitPin(next);
    }
  }

  function handleBackspace() {
    if (isPending) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }

  return (
    <div className="rounded-2xl bg-cream text-char shadow-2xl border border-border-warm overflow-hidden">
      {/* Mode tabs */}
      <div className="grid grid-cols-2 bg-cream-deep p-1.5 gap-1.5 border-b border-border-warm">
        <button
          type="button"
          onClick={() => {
            setTab('email');
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all cursor-pointer ${
            tab === 'email'
              ? 'bg-char text-cream shadow-sm'
              : 'text-smoke hover:text-char'
          }`}
        >
          <Mail className="h-4 w-4" />
          Email &amp; Password
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('pin');
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all cursor-pointer ${
            tab === 'pin'
              ? 'bg-char text-cream shadow-sm'
              : 'text-smoke hover:text-char'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          Staff PIN Pad
        </button>
      </div>

      <div className="p-6">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-chilli/30 bg-chilli/10 px-3.5 py-2.5 text-sm font-medium text-chilli"
          >
            {error}
          </div>
        )}

        {tab === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="staff-email"
                className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5"
              >
                Staff Email
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-smoke absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="staff-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@starkebab.com.au"
                  className="w-full rounded-xl border border-border-warm bg-white pl-10 pr-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="staff-password"
                className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-smoke absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="staff-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border-warm bg-white pl-10 pr-3.5 py-2.5 text-sm text-char focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl bg-ember hover:bg-ember-dark disabled:opacity-60 text-cream font-bold py-3 text-sm transition-colors shadow-sm cursor-pointer"
            >
              {isPending ? 'Signing in…' : 'Sign In to Staff Portal'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-smoke mb-2">
                Enter 4-Digit Quick-Switch PIN
              </p>
              <div className="flex items-center justify-center gap-3 py-2">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`h-4 w-4 rounded-full border-2 transition-all ${
                      pin.length > idx
                        ? 'bg-ember border-ember scale-110'
                        : 'border-border-warm bg-white'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDigit(d)}
                  className="h-14 rounded-xl bg-white hover:bg-cream-deep active:scale-95 border border-border-warm font-mono text-2xl font-bold text-char transition-all cursor-pointer"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setPin('');
                  setError(null);
                }}
                className="h-14 rounded-xl bg-cream-deep hover:bg-border-warm text-xs font-bold uppercase tracking-wider text-smoke transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDigit('0')}
                className="h-14 rounded-xl bg-white hover:bg-cream-deep active:scale-95 border border-border-warm font-mono text-2xl font-bold text-char transition-all cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleBackspace}
                aria-label="Backspace"
                className="h-14 rounded-xl bg-cream-deep hover:bg-border-warm flex items-center justify-center text-smoke transition-colors cursor-pointer"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            {isPending && (
              <p className="text-center text-xs font-semibold text-ember">
                Verifying PIN…
              </p>
            )}
          </div>
        )}

        {/* Seed demo accounts */}
        <div className="mt-6 pt-5 border-t border-border-warm">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-smoke mb-2.5">
            <ShieldCheck className="h-3.5 w-3.5 text-saffron" />
            Seed Demo Accounts (Quick Fill)
          </div>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((acct) => (
              <button
                key={acct.email}
                type="button"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  if (tab === 'email') {
                    setEmail(acct.email);
                    setPassword(acct.password);
                  } else {
                    setPin(acct.pin);
                    submitPin(acct.pin);
                  }
                }}
                className="w-full flex items-center justify-between gap-2 rounded-xl border border-border-warm bg-white hover:bg-cream-deep px-3 py-2 text-left transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-char">{acct.label}</p>
                  <p className="text-[11px] text-smoke font-mono">
                    {tab === 'email' ? acct.email : `PIN ${acct.pin}`}
                  </p>
                </div>
                <span className="rounded-md bg-saffron/20 text-char px-2 py-0.5 text-[11px] font-bold">
                  {acct.badge}
                </span>
              </button>
            ))}
          </div>
          <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-smoke border-t border-border-warm mt-3">
            <Link href="/admin/login" className="font-semibold text-ember hover:underline">
              Admin Portal Login →
            </Link>
            <Link href="/account/login" className="hover:text-char transition">
              Customer Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
