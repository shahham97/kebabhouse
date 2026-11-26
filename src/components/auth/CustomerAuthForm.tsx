'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, Lock, User, Phone, AlertCircle } from 'lucide-react';
import { customerLoginAction, customerRegisterAction } from '@/modules/storefront/actions';
import { customerLoginSchema, customerRegisterSchema } from '@/modules/auth/schemas';
import { cn } from '@/lib/utils';

export function CustomerAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (mode === 'login') {
      const parsed = customerLoginSchema.safeParse({ email, password });
      if (!parsed.success) {
        const errs: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const k = String(issue.path[0] ?? '_form');
          errs[k] = errs[k] ?? [];
          errs[k].push(issue.message);
        }
        setFieldErrors(errs);
        setError(parsed.error.issues[0]?.message ?? 'Please check your credentials');
        return;
      }

      startTransition(async () => {
        const res = await customerLoginAction({ email, password });
        if (!res.ok) {
          setError(res.error.message);
          if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
          return;
        }
        router.push('/account');
        router.refresh();
      });
    } else {
      const parsed = customerRegisterSchema.safeParse({ name, email, phone, password });
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
        const res = await customerRegisterAction({ name, email, phone, password });
        if (!res.ok) {
          setError(res.error.message);
          if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
          return;
        }
        router.push('/account');
        router.refresh();
      });
    }
  }

  return (
    <div className="rounded-3xl border border-border-warm bg-white shadow-xl overflow-hidden">
      <div className="grid grid-cols-2 border-b border-border-warm bg-cream-deep/60 p-1.5">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
            setFieldErrors({});
          }}
          className={cn(
            'min-h-[44px] rounded-2xl text-sm font-bold transition cursor-pointer',
            mode === 'login' ? 'bg-char text-cream shadow' : 'text-smoke hover:text-char'
          )}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError(null);
            setFieldErrors({});
          }}
          className={cn(
            'min-h-[44px] rounded-2xl text-sm font-bold transition cursor-pointer',
            mode === 'register' ? 'bg-char text-cream shadow' : 'text-smoke hover:text-char'
          )}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-7 space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-chilli/30 bg-chilli/10 px-3.5 py-2.5 text-sm font-medium text-chilli"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'register' && (
          <>
            <div>
              <label htmlFor="cust-name" className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-smoke absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="cust-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Oliver Smith"
                  aria-invalid={Boolean(fieldErrors.name)}
                  className="w-full rounded-xl border border-border-warm bg-cream/40 pl-10 pr-3.5 py-3 text-sm text-char placeholder:text-smoke/50 focus:outline-none focus:ring-2 focus:ring-ember"
                />
              </div>
              {fieldErrors.name?.[0] && (
                <p className="mt-1 text-xs font-medium text-chilli">{fieldErrors.name[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="cust-phone" className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
                Australian Mobile *
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-smoke absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="cust-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0412 345 678"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className="w-full rounded-xl border border-border-warm bg-cream/40 pl-10 pr-3.5 py-3 text-sm text-char placeholder:text-smoke/50 focus:outline-none focus:ring-2 focus:ring-ember"
                />
              </div>
              {fieldErrors.phone?.[0] && (
                <p className="mt-1 text-xs font-medium text-chilli">{fieldErrors.phone[0]}</p>
              )}
            </div>
          </>
        )}

        <div>
          <label htmlFor="cust-email" className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
            Email Address *
          </label>
          <div className="relative">
            <Mail className="h-4 w-4 text-smoke absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="cust-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="oliver.smith@example.com.au"
              aria-invalid={Boolean(fieldErrors.email)}
              className="w-full rounded-xl border border-border-warm bg-cream/40 pl-10 pr-3.5 py-3 text-sm text-char placeholder:text-smoke/50 focus:outline-none focus:ring-2 focus:ring-ember"
            />
          </div>
          {fieldErrors.email?.[0] && (
            <p className="mt-1 text-xs font-medium text-chilli">{fieldErrors.email[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="cust-password" className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
            Password *
          </label>
          <div className="relative">
            <Lock className="h-4 w-4 text-smoke absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="cust-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'}
              aria-invalid={Boolean(fieldErrors.password)}
              className="w-full rounded-xl border border-border-warm bg-cream/40 pl-10 pr-3.5 py-3 text-sm text-char placeholder:text-smoke/50 focus:outline-none focus:ring-2 focus:ring-ember"
            />
          </div>
          {fieldErrors.password?.[0] && (
            <p className="mt-1 text-xs font-medium text-chilli">{fieldErrors.password[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-ember hover:bg-ember-dark disabled:opacity-60 px-6 py-3 font-display text-lg font-extrabold uppercase tracking-wide text-cream shadow-md transition cursor-pointer"
        >
          <span>
            {isPending
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign In to Star Rewards'
                : 'Join Star Rewards Free'}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>

        {mode === 'login' && (
          <div className="pt-3 border-t border-border-warm space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-smoke">
              Demo Customer Account
            </p>
            <button
              type="button"
              onClick={() => {
                setEmail('oliver@starkebab.com.au');
                setPassword('Customer123!');
                setError(null);
                setFieldErrors({});
              }}
              className="w-full flex items-center justify-between rounded-xl border border-border-warm bg-cream/50 hover:bg-cream-deep px-3.5 py-2.5 text-left transition cursor-pointer"
            >
              <div>
                <p className="text-sm font-bold text-char">Oliver Smith (250 Star Points)</p>
                <p className="text-xs font-mono text-smoke">oliver@starkebab.com.au</p>
              </div>
              <span className="rounded-full bg-saffron/30 px-2.5 py-0.5 text-[11px] font-bold text-char">
                Fill
              </span>
            </button>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between text-xs text-smoke">
          <Link href="/menu" className="font-semibold text-ember hover:underline">
            ← Continue as Guest
          </Link>
          <span className="font-mono text-[11px]">/account/login</span>
        </div>
      </form>
    </div>
  );
}
