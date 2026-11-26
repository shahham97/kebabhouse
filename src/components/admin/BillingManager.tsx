'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ReceiptText, CheckCircle2, AlertCircle, Printer } from 'lucide-react';
import { saveReceiptTemplateAction } from '@/modules/admin/actions';
import { formatAUD, calcInclusiveGst } from '@/lib/money';

interface TemplateRow {
  id: string;
  version: number;
  headerText: string;
  footerText: string;
  showAbn: boolean;
  showGstLine: boolean;
  active: boolean;
  createdAt: string;
}

interface BillingManagerProps {
  store: {
    name: string;
    abn: string;
    phone: string;
    email: string;
    address: string;
    gstRatePct: number;
    gstRegistered: boolean;
  };
  templates: TemplateRow[];
}

export function BillingManager({ store, templates }: BillingManagerProps) {
  const router = useRouter();
  const activeTpl = templates.find((t) => t.active) ?? templates[0];

  const [headerText, setHeaderText] = useState(activeTpl?.headerText ?? 'TAX INVOICE — STAR KEBAB');
  const [footerText, setFooterText] = useState(
    activeTpl?.footerText ?? '100% Halal Certified • Carved Fresh Daily. Thanks mate!'
  );
  const [showAbn, setShowAbn] = useState(activeTpl?.showAbn ?? true);
  const [showGstLine, setShowGstLine] = useState(activeTpl?.showGstLine ?? true);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await saveReceiptTemplateAction({
        headerText,
        footerText,
        showAbn,
        showGstLine,
      });
      if (!res.ok) {
        setFeedback({ kind: 'err', text: res.error.message });
        return;
      }
      setFeedback({
        kind: 'ok',
        text: `Saved Receipt Template v${res.data.version}. Applied to all new bills immediately.`,
      });
      router.refresh();
    });
  }

  const sampleTotal = 3650;
  const sampleGst = calcInclusiveGst(sampleTotal, store.gstRatePct);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Editor Form */}
      <div className="lg:col-span-7 space-y-6">
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-border-warm bg-white p-6 shadow-xs space-y-5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-warm pb-4">
            <div>
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-char flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-ember" /> Tax Invoice &amp; Bill Template
              </h2>
              <p className="text-xs text-smoke mt-0.5">
                Customise your printed 80mm Till receipts &amp; digital customer tax invoices. Every save creates a new audited version.
              </p>
            </div>
            {activeTpl && (
              <span className="rounded-full bg-saffron/25 px-3 py-1 font-mono text-xs font-bold text-char">
                v{activeTpl.version} Active
              </span>
            )}
          </div>

          {feedback && (
            <div
              role="alert"
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border ${
                feedback.kind === 'ok'
                  ? 'bg-herb/10 border-herb/30 text-herb'
                  : 'bg-chilli/10 border-chilli/30 text-chilli'
              }`}
            >
              {feedback.kind === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
              Bill Header Title *
            </label>
            <input
              type="text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="TAX INVOICE — STAR KEBAB"
              className="w-full rounded-xl border border-border-warm bg-cream/40 px-3.5 py-2.5 text-sm text-char focus:outline-none focus:ring-2 focus:ring-ember"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-smoke mb-1.5">
              Footer / Thank You Message *
            </label>
            <textarea
              rows={3}
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="100% Halal Certified • Carved Fresh Daily on Ironbark Charcoal."
              className="w-full rounded-xl border border-border-warm bg-cream/40 px-3.5 py-2.5 text-sm text-char focus:outline-none focus:ring-2 focus:ring-ember"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 rounded-xl border border-border-warm bg-cream/40 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showAbn}
                onChange={(e) => setShowAbn(e.target.checked)}
                className="h-4 w-4 accent-ember"
              />
              <div>
                <p className="text-sm font-bold text-char">Display Business ABN</p>
                <p className="text-xs text-smoke">Required on AU tax invoices</p>
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-border-warm bg-cream/40 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showGstLine}
                onChange={(e) => setShowGstLine(e.target.checked)}
                className="h-4 w-4 accent-ember"
              />
              <div>
                <p className="text-sm font-bold text-char">Show GST Inclusive Line</p>
                <p className="text-xs text-smoke">ATO 1/11th GST breakdown</p>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="min-h-[46px] rounded-xl bg-ember hover:bg-ember-dark disabled:opacity-60 px-6 py-2.5 text-sm font-bold text-cream shadow-sm transition cursor-pointer"
          >
            {isPending ? 'Saving Template…' : 'Save & Publish Bill Template'}
          </button>
        </form>

        {/* Version History */}
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs space-y-3">
          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-char">
            Template Version History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-warm text-smoke uppercase">
                  <th className="py-2 pr-3">Ver</th>
                  <th className="py-2 pr-3">Header</th>
                  <th className="py-2 pr-3">Flags</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm/60">
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3 font-mono font-bold">v{t.version}</td>
                    <td className="py-2 pr-3 font-medium text-char">{t.headerText}</td>
                    <td className="py-2 pr-3 text-smoke">
                      {t.showAbn ? 'ABN ' : ''}
                      {t.showGstLine ? 'GST' : ''}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          t.active ? 'bg-herb/15 text-herb' : 'bg-cream-deep text-smoke'
                        }`}
                      >
                        {t.active ? 'Active' : 'Archived'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Live 80mm Thermal Receipt Preview */}
      <div className="lg:col-span-5">
        <div className="rounded-2xl border border-border-warm bg-char p-6 text-cream sticky top-6">
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-saffron">
              <Printer className="h-4 w-4" /> Live 80mm Bill Preview
            </span>
            <span className="font-mono text-[11px] text-cream/60">AUD · en-AU</span>
          </div>

          <div className="mx-auto max-w-[300px] rounded-xl bg-white p-5 text-char font-mono text-xs shadow-xl space-y-3">
            <div className="text-center border-b border-dashed border-char/30 pb-3 space-y-1">
              <p className="font-extrabold text-sm uppercase">{headerText || 'TAX INVOICE'}</p>
              <p className="font-bold">{store.name}</p>
              <p className="text-[10px] text-smoke">{store.address}</p>
              <p className="text-[10px] text-smoke">{store.phone}</p>
              {showAbn && store.abn && (
                <p className="text-[10px] font-semibold">ABN: {store.abn}</p>
              )}
            </div>

            <div className="flex justify-between text-[11px] border-b border-dashed border-char/30 pb-2">
              <span>Order #SK-0042</span>
              <span>DINE-IN · T5</span>
            </div>

            <div className="space-y-1.5 border-b border-dashed border-char/30 pb-3">
              <div className="flex justify-between">
                <span>1× Signature Kebab (Reg)</span>
                <span>{formatAUD(1450)}</span>
              </div>
              <div className="flex justify-between">
                <span>1× Spiced Lamb Pide</span>
                <span>{formatAUD(2200)}</span>
              </div>
            </div>

            <div className="space-y-1 border-b border-dashed border-char/30 pb-3">
              <div className="flex justify-between font-extrabold text-sm">
                <span>TOTAL (AUD)</span>
                <span>{formatAUD(sampleTotal)}</span>
              </div>
              {showGstLine && store.gstRegistered && (
                <div className="flex justify-between text-[11px] text-smoke">
                  <span>Includes GST ({store.gstRatePct}%)</span>
                  <span>{formatAUD(sampleGst)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px]">
                <span>Paid: CASH</span>
                <span>$40.00 (Chg $3.50)</span>
              </div>
            </div>

            <p className="text-center text-[10px] text-smoke leading-relaxed pt-1">
              {footerText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
