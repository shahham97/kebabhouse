'use client';

import { useState, useTransition } from 'react';
import { Plus, AlertTriangle, Scale, BookOpen } from 'lucide-react';
import {
  createInventoryItemAction,
  postInventoryAdjustmentAction,
  addRecipeLineAction,
} from '@/modules/admin/actions';
import { formatAUD } from '@/lib/money';
import { formatStoreDateTime } from '@/lib/time';
import { DataTable, type DataTableColumn } from './DataTable';

interface InventoryData {
  inventoryItems: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    unit: string;
    onHand: number;
    minThreshold: number;
    costPerUnitCents: number;
    vendorName: string;
    isLowStock: boolean;
  }>;
  transactions: Array<{
    id: string;
    itemCode: string;
    itemName: string;
    unit: string;
    kind: string;
    quantity: number;
    unitCostCents: number;
    sourceType: string;
    reason: string;
    createdAt: string;
  }>;
  recipeLines: Array<{
    id: string;
    targetLabel: string;
    inventoryItemName: string;
    unit: string;
    quantity: number;
  }>;
  vendors: Array<{ id: string; name: string }>;
  variants: Array<{ id: string; label: string }>;
}

const UNITS = ['kg', 'g', 'L', 'ml', 'piece', 'unit', 'packet', 'box'] as const;

export function InventoryManager({
  data,
  canAdjust,
}: {
  data: InventoryData;
  canAdjust: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add item form
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('kg');
  const [onHand, setOnHand] = useState('10');
  const [minThreshold, setMinThreshold] = useState('5');
  const [costDollars, setCostDollars] = useState('12.00');
  const [vendorId, setVendorId] = useState('');

  // Adjustment / Waste / Count form
  const [adjItemId, setAdjItemId] = useState(data.inventoryItems[0]?.id ?? '');
  const [adjKind, setAdjKind] = useState<'ADJUSTMENT' | 'WASTE' | 'COUNT'>('WASTE');
  const [adjQty, setAdjQty] = useState('1');
  const [adjReason, setAdjReason] = useState('');

  // Recipe line form
  const [recVariantId, setRecVariantId] = useState(data.variants[0]?.id ?? '');
  const [recItemId, setRecItemId] = useState(data.inventoryItems[0]?.id ?? '');
  const [recQty, setRecQty] = useState('0.18');

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createInventoryItemAction({
        code,
        name,
        unit,
        onHand: Number(onHand) || 0,
        minThreshold: Number(minThreshold) || 0,
        costPerUnitCents: Math.round((Number(costDollars) || 0) * 100),
        preferredVendorId: vendorId || null,
      });
      if (res.ok) {
        setCode('');
        setName('');
        setFeedback({ type: 'ok', text: `Inventory item ${res.data.code} created.` });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const handlePostAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await postInventoryAdjustmentAction({
        inventoryItemId: adjItemId,
        kind: adjKind,
        quantity: Number(adjQty),
        reason: adjReason,
      });
      if (res.ok) {
        setAdjReason('');
        setFeedback({
          type: 'ok',
          text: `Ledger posted (${adjKind}). New on-hand: ${res.data.newOnHand}.`,
        });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const handleAddRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await addRecipeLineAction({
        variantId: recVariantId,
        inventoryItemId: recItemId,
        quantity: Number(recQty),
      });
      if (res.ok) {
        setFeedback({ type: 'ok', text: 'Recipe line linked to variant.' });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const itemColumns: DataTableColumn<InventoryData['inventoryItems'][number]>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (r) => <span className="font-mono text-xs font-semibold text-char">{r.code}</span>,
      csvValue: (r) => r.code,
    },
    {
      key: 'name',
      header: 'Ingredient',
      render: (r) => (
        <div>
          <div className="font-semibold text-char">{r.name}</div>
          <div className="text-xs text-smoke">{r.vendorName}</div>
        </div>
      ),
      csvValue: (r) => r.name,
    },
    {
      key: 'onHand',
      header: 'On Hand',
      align: 'right',
      render: (r) => (
        <span
          className={`inline-flex items-center gap-1 font-mono font-bold tabular-nums ${
            r.isLowStock ? 'text-chilli' : 'text-herb'
          }`}
        >
          {r.isLowStock && <AlertTriangle className="h-3.5 w-3.5" />}
          {r.onHand.toFixed(2)} {r.unit}
        </span>
      ),
      csvValue: (r) => `${r.onHand} ${r.unit}`,
    },
    {
      key: 'min',
      header: 'Min Par',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs text-smoke tabular-nums">
          {r.minThreshold} {r.unit}
        </span>
      ),
      csvValue: (r) => r.minThreshold,
    },
    {
      key: 'cost',
      header: 'Unit Cost',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs text-char tabular-nums">
          {formatAUD(r.costPerUnitCents)}
        </span>
      ),
      csvValue: (r) => (r.costPerUnitCents / 100).toFixed(2),
    },
  ];

  const ledgerColumns: DataTableColumn<InventoryData['transactions'][number]>[] = [
    {
      key: 'time',
      header: 'Timestamp',
      render: (t) => (
        <span className="font-mono text-xs text-smoke whitespace-nowrap">
          {formatStoreDateTime(t.createdAt)}
        </span>
      ),
      csvValue: (t) => t.createdAt,
    },
    {
      key: 'item',
      header: 'Item',
      render: (t) => (
        <div>
          <span className="font-semibold text-char">{t.itemName}</span>{' '}
          <span className="font-mono text-[11px] text-smoke">({t.itemCode})</span>
        </div>
      ),
      csvValue: (t) => `${t.itemCode} ${t.itemName}`,
    },
    {
      key: 'kind',
      header: 'Kind',
      render: (t) => (
        <span className="rounded-md bg-cream px-2 py-0.5 font-mono text-[11px] font-semibold text-char">
          {t.kind}
        </span>
      ),
      csvValue: (t) => t.kind,
    },
    {
      key: 'qty',
      header: 'Delta',
      align: 'right',
      render: (t) => (
        <span
          className={`font-mono font-bold tabular-nums ${
            t.quantity >= 0 ? 'text-herb' : 'text-chilli'
          }`}
        >
          {t.quantity >= 0 ? '+' : ''}
          {t.quantity.toFixed(3)} {t.unit}
        </span>
      ),
      csvValue: (t) => t.quantity,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (t) => <span className="text-xs text-smoke">{t.reason || t.sourceType}</span>,
      csvValue: (t) => t.reason,
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

      {/* Stock table */}
      <DataTable
        rows={data.inventoryItems}
        columns={itemColumns}
        rowKey={(r) => r.id}
        searchPlaceholder="Search ingredients or codes…"
        csvFilename="star-kebab-inventory.csv"
      />

      {/* Action forms (only if staff has inventory.adjust) */}
      {canAdjust && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Post Adjustment / Waste / Stocktake */}
          <form
            onSubmit={handlePostAdjustment}
            className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-ember" />
              <h2 className="font-display text-lg font-bold text-char">
                Post Stock Movement
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-smoke">
              Append-only ledger entry (Waste, Adjustment, or Stocktake Count).
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-smoke">Ingredient</label>
                <select
                  required
                  value={adjItemId}
                  onChange={(e) => setAdjItemId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
                >
                  {data.inventoryItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.onHand.toFixed(2)} {i.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-smoke">Type</label>
                  <select
                    value={adjKind}
                    onChange={(e) =>
                      setAdjKind(e.target.value as 'ADJUSTMENT' | 'WASTE' | 'COUNT')
                    }
                    className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
                  >
                    <option value="WASTE">Waste (-)</option>
                    <option value="COUNT">Stocktake (=)</option>
                    <option value="ADJUSTMENT">Adjustment (+/-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-smoke">
                    {adjKind === 'COUNT' ? 'Counted Qty' : adjKind === 'WASTE' ? 'Waste Qty' : 'Signed Delta'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={adjQty}
                    onChange={(e) => setAdjQty(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-smoke">Reason</label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="End of night trim / Weekly stocktake"
                  className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
                />
              </div>
              <button
                type="submit"
                disabled={isPending || data.inventoryItems.length === 0}
                className="w-full rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-ember-dark disabled:opacity-60"
              >
                Post to Ledger
              </button>
            </div>
          </form>

          {/* Add Inventory Item */}
          <form
            onSubmit={handleCreateItem}
            className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-ember" />
              <h2 className="font-display text-lg font-bold text-char">Add Ingredient</h2>
            </div>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-smoke">Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="LAMB-SHAW"
                    className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-smoke">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}
                    className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-smoke">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Halal Lamb Doner Spit"
                  className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-smoke">Opening</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={onHand}
                    onChange={(e) => setOnHand(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-2 py-2 font-mono text-xs text-char"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-smoke">Min Par</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-2 py-2 font-mono text-xs text-char"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-smoke">Cost ($)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={costDollars}
                    onChange={(e) => setCostDollars(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-2 py-2 font-mono text-xs text-char"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-smoke">Preferred Vendor</label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
                >
                  <option value="">Unassigned</option>
                  {data.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-char px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-char-soft disabled:opacity-60"
              >
                Create Ingredient
              </button>
            </div>
          </form>

          {/* Link Recipe Line */}
          <form
            onSubmit={handleAddRecipe}
            className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-ember" />
              <h2 className="font-display text-lg font-bold text-char">Add Recipe Line</h2>
            </div>
            <p className="mt-0.5 text-xs text-smoke">
              Deducts automatically when orders are placed.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-smoke">Product Variant</label>
                <select
                  required
                  value={recVariantId}
                  onChange={(e) => setRecVariantId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
                >
                  {data.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-smoke">Ingredient</label>
                <select
                  required
                  value={recItemId}
                  onChange={(e) => setRecItemId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
                >
                  {data.inventoryItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-smoke">Qty per Serve</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={recQty}
                  onChange={(e) => setRecQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
                />
              </div>
              <button
                type="submit"
                disabled={isPending || data.variants.length === 0 || data.inventoryItems.length === 0}
                className="w-full rounded-xl bg-char px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-char-soft disabled:opacity-60"
              >
                Link Recipe Ingredient
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recipes List */}
      <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-char">
          Active Recipe BOM ({data.recipeLines.length})
        </h2>
        {data.recipeLines.length === 0 ? (
          <p className="mt-2 text-sm text-smoke">No recipe lines configured yet.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.recipeLines.map((rl) => (
              <div
                key={rl.id}
                className="flex items-center justify-between rounded-xl border border-border-warm bg-cream/50 px-3 py-2 text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="truncate font-semibold text-char">{rl.targetLabel}</div>
                  <div className="text-smoke">{rl.inventoryItemName}</div>
                </div>
                <span className="shrink-0 font-mono font-bold text-ember tabular-nums">
                  {rl.quantity} {rl.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Append-only Ledger */}
      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-char">
          Append-Only Stock Ledger (Latest 40)
        </h2>
        <DataTable
          rows={data.transactions}
          columns={ledgerColumns}
          rowKey={(t) => t.id}
          searchPlaceholder="Filter ledger by item, kind, reason…"
          csvFilename="star-kebab-stock-ledger.csv"
        />
      </div>
    </div>
  );
}
