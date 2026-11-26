'use client';

import { useState, useTransition } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight, Banknote } from 'lucide-react';
import { createExpenseAction } from '@/modules/admin/actions';
import { formatAUD } from '@/lib/money';
import { formatStoreDateTime } from '@/lib/time';
import { DataTable, type DataTableColumn } from './DataTable';

interface FinanceData {
  summary: {
    totalInflowsCents: number;
    totalOutflowsCents: number;
    netCents: number;
  };
  revenueByMethod: Array<{ method: string; amountCents: number; count: number }>;
  financialTransactions: Array<{
    id: string;
    direction: string;
    category: string;
    method: string;
    amountCents: number;
    sourceType: string;
    note: string;
    createdAt: string;
  }>;
  expenses: Array<{
    id: string;
    category: string;
    description: string;
    amountCents: number;
    incurredAt: string;
  }>;
  cashSessions: Array<{
    id: string;
    openedByName: string;
    status: string;
    openingFloatCents: number;
    cashSalesCents: number;
    expectedCashCents: number;
    countedCashCents: number | null;
    varianceCents: number | null;
    openedAt: string;
    closedAt: string | null;
    notes: string;
  }>;
}

export function FinanceManager({ data }: { data: FinanceData }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [category, setCategory] = useState('Supplies');
  const [description, setDescription] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [method, setMethod] = useState<'CASH' | 'CARD_EFTPOS' | 'BANK'>('BANK');

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const cents = Math.round((Number(amountDollars) || 0) * 100);
    if (cents <= 0) {
      setFeedback({ type: 'err', text: 'Enter an expense amount greater than $0.00' });
      return;
    }
    startTransition(async () => {
      const res = await createExpenseAction({
        category,
        description,
        amountCents: cents,
        method,
      });
      if (res.ok) {
        setDescription('');
        setAmountDollars('');
        setFeedback({ type: 'ok', text: 'Expense recorded and posted to financial ledger.' });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const ledgerColumns: DataTableColumn<FinanceData['financialTransactions'][number]>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (t) => (
        <span className="font-mono text-xs text-smoke whitespace-nowrap">
          {formatStoreDateTime(t.createdAt)}
        </span>
      ),
      csvValue: (t) => t.createdAt,
    },
    {
      key: 'direction',
      header: 'Flow',
      render: (t) =>
        t.direction === 'INFLOW' ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-herb/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-herb">
            <ArrowDownLeft className="h-3 w-3" />
            INFLOW
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-chilli/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-chilli">
            <ArrowUpRight className="h-3 w-3" />
            OUTFLOW
          </span>
        ),
      csvValue: (t) => t.direction,
    },
    {
      key: 'category',
      header: 'Category',
      render: (t) => <span className="font-mono text-xs font-semibold text-char">{t.category}</span>,
      csvValue: (t) => t.category,
    },
    {
      key: 'method',
      header: 'Method',
      render: (t) => <span className="text-xs text-smoke">{t.method}</span>,
      csvValue: (t) => t.method,
    },
    {
      key: 'note',
      header: 'Note',
      render: (t) => <span className="text-xs text-smoke">{t.note || t.sourceType}</span>,
      csvValue: (t) => t.note || t.sourceType,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (t) => (
        <span
          className={`font-mono font-bold tabular-nums ${
            t.direction === 'INFLOW' ? 'text-herb' : 'text-chilli'
          }`}
        >
          {t.direction === 'INFLOW' ? '+' : '-'}
          {formatAUD(t.amountCents)}
        </span>
      ),
      csvValue: (t) =>
        `${t.direction === 'INFLOW' ? '' : '-'}${(t.amountCents / 100).toFixed(2)}`,
    },
  ];

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'ok'
              ? 'border-herb/30 bg-herb/10 text-herb'
              : 'border-chilli/30 bg-chilli/10 text-chilli'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-smoke">
            Total Inflows
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-herb tabular-nums">
            {formatAUD(data.summary.totalInflowsCents)}
          </div>
        </div>
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-smoke">
            Total Outflows
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-chilli tabular-nums">
            {formatAUD(data.summary.totalOutflowsCents)}
          </div>
        </div>
        <div className="rounded-2xl border border-border-warm bg-char p-5 text-cream shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-saffron">
            Net Position
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums">
            {formatAUD(data.summary.netCents)}
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown + Record Expense */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <h2 className="font-display text-lg font-bold text-char">
            Payment Method Breakdown
          </h2>
          <div className="mt-4 space-y-3">
            {data.revenueByMethod.map((m) => (
              <div
                key={m.method}
                className="flex items-center justify-between rounded-xl border border-border-warm bg-cream/60 px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-char">{m.method.replace('_', ' ')}</div>
                  <div className="font-mono text-xs text-smoke">{m.count} transactions</div>
                </div>
                <div className="font-mono text-lg font-bold text-char tabular-nums">
                  {formatAUD(m.amountCents)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleCreateExpense}
          className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
        >
          <h2 className="font-display text-lg font-bold text-char">Record Operating Expense</h2>
          <p className="mt-0.5 text-xs text-smoke">
            Creates an Expense and posts an OUTFLOW entry to the financial ledger.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-smoke">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              >
                <option value="Supplies">Supplies</option>
                <option value="Packaging">Packaging</option>
                <option value="Gas & Charcoal">Gas & Charcoal</option>
                <option value="Utilities">Utilities</option>
                <option value="Repairs">Repairs</option>
                <option value="Wages">Wages</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Payment Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'CASH' | 'CARD_EFTPOS' | 'BANK')}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              >
                <option value="BANK">Bank Transfer</option>
                <option value="CASH">Cash Drawer</option>
                <option value="CARD_EFTPOS">Business Card</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Amount (AUD $)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                placeholder="145.50"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Description</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="20kg redgum charcoal delivery"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream hover:bg-ember-dark disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Post Expense
            </button>
          </div>
        </form>
      </div>

      {/* Cash Drawer Z-Report */}
      <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-ember" />
          <h2 className="font-display text-lg font-bold text-char">
            Cash Drawer Sessions (Z-Report)
          </h2>
        </div>
        {data.cashSessions.length === 0 ? (
          <p className="mt-3 text-sm text-smoke">No cash drawer sessions recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border-warm bg-cream/60 text-[11px] uppercase tracking-wider text-smoke">
                  <th className="px-3 py-2">Opened</th>
                  <th className="px-3 py-2">Staff</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Float</th>
                  <th className="px-3 py-2 text-right">Cash Sales</th>
                  <th className="px-3 py-2 text-right">Expected</th>
                  <th className="px-3 py-2 text-right">Counted</th>
                  <th className="px-3 py-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm/60 font-mono tabular-nums">
                {data.cashSessions.map((cs) => (
                  <tr key={cs.id}>
                    <td className="px-3 py-2.5 text-smoke">{formatStoreDateTime(cs.openedAt)}</td>
                    <td className="px-3 py-2.5 font-sans font-semibold text-char">
                      {cs.openedByName}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          cs.status === 'OPEN'
                            ? 'bg-herb/15 text-herb'
                            : 'bg-char/10 text-char'
                        }`}
                      >
                        {cs.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatAUD(cs.openingFloatCents)}</td>
                    <td className="px-3 py-2.5 text-right">{formatAUD(cs.cashSalesCents)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {formatAUD(cs.expectedCashCents)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {cs.countedCashCents !== null ? formatAUD(cs.countedCashCents) : '—'}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold ${
                        cs.varianceCents === null
                          ? 'text-smoke'
                          : cs.varianceCents === 0
                            ? 'text-herb'
                            : 'text-chilli'
                      }`}
                    >
                      {cs.varianceCents !== null ? formatAUD(cs.varianceCents) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Financial Ledger with CSV Export */}
      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-char">Financial Ledger</h2>
        <DataTable
          rows={data.financialTransactions}
          columns={ledgerColumns}
          rowKey={(t) => t.id}
          searchPlaceholder="Filter ledger by category, method, note…"
          csvFilename="star-kebab-finance-ledger.csv"
        />
      </div>
    </div>
  );
}
