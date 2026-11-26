import Link from 'next/link';
import { ShieldAlert, ArrowLeft, MonitorSmartphone } from 'lucide-react';

interface AccessDeniedProps {
  permission: string;
  message?: string;
}

export function AccessDenied({ permission, message }: AccessDeniedProps) {
  return (
    <div className="mx-auto my-12 max-w-lg rounded-2xl border border-border-warm bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-chilli/10 text-chilli">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-chilli">
        403 Forbidden
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold text-char">
        Access Restricted
      </h1>
      <p className="mt-2 text-sm text-smoke">
        {message || 'Your role does not have permission to view this section.'}
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border-warm bg-cream px-3 py-1.5 font-mono text-xs text-char">
        Required permission: <span className="font-semibold text-ember">{permission}</span>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-border-warm bg-cream px-4 py-2.5 text-sm font-semibold text-char transition hover:bg-cream-deep"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <Link
          href="/till"
          className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-ember-dark"
        >
          <MonitorSmartphone className="h-4 w-4" />
          Open Till POS
        </Link>
      </div>
    </div>
  );
}
