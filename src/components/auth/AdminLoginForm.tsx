'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { staffLoginAction } from '@/modules/till/actions';
import { staffLoginSchema } from '@/modules/auth/schemas';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = staffLoginSchema.safeParse({ email, password, portal: 'admin' });
    if (!parsed.success) {
      const errs: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? '_form');
        errs[k] = errs[k] ?? [];
        errs[k].push(issue.message);
      }
      setFieldErrors(errs);
      setError(parsed.error.issues[0]?.message ?? 'Please check the highlighted fields');
      return;
    }

    startTransition(async () => {
      const res = await staffLoginAction({ email, password, portal: 'admin' });
      if (!res.ok) {
        setError(res.error.message);
        if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
        return;
      }
      router.push(res.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-cream text-char shadow-2xl border border-border-warm overflow-hidden">
      <div className="bg-char-soft px-6 py-4 flex items-center justify-between text-cream border-b border-cream/10">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-saffron">
          <ShieldCheck className="h-4 w-4" /> Admin &amp; Manager Access
        </span>
        <span className="text-[11px] font-mono text-cream/60">/admin/login</span>
      </div>

      <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-chilli/10 border border-chilli/30 px-3.5 py-2.5 text-sm text-chilli font-medium"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="admin-email" className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
            Admin Email
          </label>
          <div className="relative">
            <Mail className="h-4 w-4 text-smoke absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usama@starkebab.com.au"
              aria-invalid={Boolean(fieldErrors.email)}
              className="w-full rounded-xl border border-border-warm bg-white pl-10 pr-3.5 py-3 text-sm text-char placeholder:text-smoke/50 focus:outline-none focus:ring-2 focus:ring-ember"
            />
          </div>
          {fieldErrors.email?.[0] && (
            <p className="mt-1 text-xs font-medium text-chilli">{fieldErrors.email[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="admin-password" className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="h-4 w-4 text-smoke absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              aria-invalid={Boolean(fieldErrors.password)}
              className="w-full rounded-xl border border-border-warm bg-white pl-10 pr-3.5 py-3 text-sm text-char placeholder:text-smoke/50 focus:outline-none focus:ring-2 focus:ring-ember"
            />
          </div>
          {fieldErrors.password?.[0] && (
            <p className="mt-1 text-xs font-medium text-chilli">{fieldErrors.password[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-ember hover:bg-ember-dark disabled:opacity-60 text-cream font-bold text-sm shadow-md transition-colors cursor-pointer"
        >
          <span>{isPending ? 'Verifying Admin Credentials…' : 'Sign In to Admin Portal'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        {/* Demo Admin Quick-Fill */}
        <div className="pt-3 border-t border-border-warm space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-smoke">
            Demo Admin Account (Quick Fill)
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setEmail('admin@starkebab.com.au');
              setPassword('StarAdmin123!');
              setError(null);
              setFieldErrors({});
            }}
            className="w-full flex items-center justify-between rounded-xl border border-border-warm bg-white hover:bg-cream-deep px-3.5 py-2.5 text-left transition cursor-pointer"
          >
            <div>
              <p className="text-sm font-bold text-char">Usama (Owner · Super Admin)</p>
              <p className="text-xs font-mono text-smoke">admin@starkebab.com.au</p>
            </div>
            <span className="rounded-full bg-saffron/25 px-2.5 py-0.5 text-[11px] font-bold text-char">
              Fill
            </span>
          </button>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-smoke">
          <Link href="/staff/login" className="font-semibold text-ember hover:underline">
            Till / Kitchen Staff Login →
          </Link>
          <Link href="/account/login" className="hover:text-char transition">
            Customer Account
          </Link>
        </div>
      </form>
    </div>
  );
}
