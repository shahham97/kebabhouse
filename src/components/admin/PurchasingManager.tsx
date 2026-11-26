'use client';

import { useState, useTransition } from 'react';
import { Plus, PackageCheck, Truck } from 'lucide-react';
import {
  createVendorAction,
  createPurchaseOrderAction,
  receivePoGoodsAction,
} from '@/modules/admin/actions';
import { formatAUD } from '@/lib/money';
import { formatStoreDateTime } from '@/lib/time';

interface PurchasingData {
  vendors: Array<{
    id: string;
    name: string;
    abn: string;
    contact: string;
    email: string;
    phone: string;
    poCount: number;
    itemCount: number;
  }>;
  purchaseOrders: Array<{
    id: string;
    number: string;
    status: string;
    vendorName: string;
    invoiceRef: string;
    totalCents: number;
    orderedAt: string;
    lines: Array<{
      id: string;
      itemCode: string;
      itemName: string;
      unit: string;
      orderedQty: number;
      receivedQty: number;
      remainingQty: number;
      unitCostCents: number;
    }>;
  }>;
  inventoryItems: Array<{
    id: string;
    code: string;
    name: string;
    unit: string;
    costPerUnitCents: number;
  }>;
}

export function PurchasingManager({ data }: { data: PurchasingData }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Vendor form
  const [vName, setVName] = useState('');
  const [vAbn, setVAbn] = useState('');
  const [vContact, setVContact] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vEmail, setVEmail] = useState('');

  // PO form
  const [poVendorId, setPoVendorId] = useState(data.vendors[0]?.id ?? '');
  const [poInvoiceRef, setPoInvoiceRef] = useState('');
  const [poItemId, setPoItemId] = useState(data.inventoryItems[0]?.id ?? '');
  const [poQty, setPoQty] = useState('20');
  const [poUnitCostDollars, setPoUnitCostDollars] = useState('14.00');

  // Receiving modal/panel state
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [receiveInvoice, setReceiveInvoice] = useState('');

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createVendorAction({
        name: vName,
        abn: vAbn,
        contact: vContact,
        phone: vPhone,
        email: vEmail,
      });
      if (res.ok) {
        setVName('');
        setVAbn('');
        setVContact('');
        setVPhone('');
        setVEmail('');
        setFeedback({ type: 'ok', text: `Vendor "${res.data.name}" added.` });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createPurchaseOrderAction({
        vendorId: poVendorId,
        invoiceRef: poInvoiceRef,
        lines: [
          {
            inventoryItemId: poItemId,
            orderedQty: Number(poQty) || 1,
            unitCostCents: Math.round((Number(poUnitCostDollars) || 0) * 100),
          },
        ],
      });
      if (res.ok) {
        setPoInvoiceRef('');
        setFeedback({ type: 'ok', text: `Purchase Order ${res.data.number} created.` });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const openReceive = (po: PurchasingData['purchaseOrders'][number]) => {
    setReceivingPoId(po.id);
    setReceiveInvoice(po.invoiceRef || '');
    const defaults: Record<string, string> = {};
    for (const l of po.lines) {
      defaults[l.id] = String(l.remainingQty);
    }
    setReceiveQtys(defaults);
  };

  const handleReceiveGoods = (po: PurchasingData['purchaseOrders'][number]) => {
    setFeedback(null);
    const lines = po.lines.map((l) => ({
      purchaseOrderLineId: l.id,
      receivedQty: Number(receiveQtys[l.id] ?? 0) || 0,
    }));
    startTransition(async () => {
      const res = await receivePoGoodsAction({
        purchaseOrderId: po.id,
        invoiceRef: receiveInvoice,
        lines,
      });
      if (res.ok) {
        setReceivingPoId(null);
        setFeedback({
          type: 'ok',
          text: `Goods received for ${po.number}. PO status: ${res.data.status}.`,
        });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

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

      {/* Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create Vendor */}
        <form
          onSubmit={handleCreateVendor}
          className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-ember" />
            <h2 className="font-display text-lg font-bold text-char">Add Supplier / Vendor</h2>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-smoke">Supplier Name</label>
              <input
                type="text"
                required
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                placeholder="Sydney Halal Meats Pty Ltd"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">ABN</label>
              <input
                type="text"
                value={vAbn}
                onChange={(e) => setVAbn(e.target.value)}
                placeholder="51 824 753 556"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Contact Person</label>
              <input
                type="text"
                value={vContact}
                onChange={(e) => setVContact(e.target.value)}
                placeholder="Tariq"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Phone</label>
              <input
                type="text"
                value={vPhone}
                onChange={(e) => setVPhone(e.target.value)}
                placeholder="02 9123 4567"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Email</label>
              <input
                type="email"
                value={vEmail}
                onChange={(e) => setVEmail(e.target.value)}
                placeholder="orders@supplier.com.au"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-char px-4 py-2.5 text-sm font-semibold text-cream hover:bg-char-soft disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Save Vendor
            </button>
          </div>
        </form>

        {/* Create PO */}
        <form
          onSubmit={handleCreatePO}
          className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-ember" />
            <h2 className="font-display text-lg font-bold text-char">Create Purchase Order</h2>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-smoke">Vendor</label>
              <select
                required
                value={poVendorId}
                onChange={(e) => setPoVendorId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              >
                {data.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Invoice / Ref</label>
              <input
                type="text"
                value={poInvoiceRef}
                onChange={(e) => setPoInvoiceRef(e.target.value)}
                placeholder="INV-2026-041"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-smoke">Ingredient Line</label>
              <select
                required
                value={poItemId}
                onChange={(e) => {
                  setPoItemId(e.target.value);
                  const found = data.inventoryItems.find((i) => i.id === e.target.value);
                  if (found) setPoUnitCostDollars((found.costPerUnitCents / 100).toFixed(2));
                }}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              >
                {data.inventoryItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.code} · {i.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Ordered Qty</label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                required
                value={poQty}
                onChange={(e) => setPoQty(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Unit Cost ($)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                required
                value={poUnitCostDollars}
                onChange={(e) => setPoUnitCostDollars(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending || data.vendors.length === 0 || data.inventoryItems.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream hover:bg-ember-dark disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Create PO
            </button>
          </div>
        </form>
      </div>

      {/* Purchase Orders List */}
      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold text-char">
          Purchase Orders ({data.purchaseOrders.length})
        </h2>
        {data.purchaseOrders.length === 0 ? (
          <div className="rounded-2xl border border-border-warm bg-white p-8 text-center text-sm text-smoke">
            No purchase orders yet.
          </div>
        ) : (
          data.purchaseOrders.map((po) => {
            const canReceive = po.status !== 'RECEIVED' && po.status !== 'CLOSED';
            const isReceiving = receivingPoId === po.id;
            return (
              <div
                key={po.id}
                className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-char">{po.number}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                          po.status === 'RECEIVED'
                            ? 'bg-herb/15 text-herb'
                            : po.status === 'PARTIALLY_RECEIVED'
                              ? 'bg-saffron/25 text-char'
                              : 'bg-ember/15 text-ember'
                        }`}
                      >
                        {po.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-smoke">
                      {po.vendorName} · {formatStoreDateTime(po.orderedAt)}
                      {po.invoiceRef ? ` · Ref ${po.invoiceRef}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold text-char tabular-nums">
                      {formatAUD(po.totalCents)}
                    </span>
                    {canReceive && (
                      <button
                        type="button"
                        onClick={() => (isReceiving ? setReceivingPoId(null) : openReceive(po))}
                        className="rounded-xl bg-herb px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-herb/90"
                      >
                        {isReceiving ? 'Cancel' : 'Receive Goods'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {po.lines.map((l) => (
                    <div
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream/60 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-char">{l.itemName}</span>{' '}
                        <span className="font-mono text-smoke">({l.itemCode})</span>
                      </div>
                      <div className="flex items-center gap-4 font-mono tabular-nums">
                        <span>
                          Received{' '}
                          <strong className="text-char">
                            {l.receivedQty}/{l.orderedQty} {l.unit}
                          </strong>
                        </span>
                        <span className="text-smoke">@ {formatAUD(l.unitCostCents)}</span>
                        {isReceiving && l.remainingQty > 0 && (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={l.remainingQty}
                            value={receiveQtys[l.id] ?? '0'}
                            onChange={(e) =>
                              setReceiveQtys((prev) => ({ ...prev, [l.id]: e.target.value }))
                            }
                            className="w-24 rounded-lg border border-herb bg-white px-2 py-1 text-right font-mono text-xs text-char"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isReceiving && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-herb/30 bg-herb/5 p-3">
                    <input
                      type="text"
                      value={receiveInvoice}
                      onChange={(e) => setReceiveInvoice(e.target.value)}
                      placeholder="Supplier delivery docket / invoice #"
                      className="min-w-[220px] flex-1 rounded-lg border border-border-warm bg-white px-3 py-1.5 text-xs text-char"
                    />
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleReceiveGoods(po)}
                      className="rounded-xl bg-herb px-4 py-2 text-xs font-semibold text-cream hover:bg-herb/90 disabled:opacity-60"
                    >
                      Confirm Receipt & Update Stock
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Vendors Directory */}
      <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-char">
          Suppliers ({data.vendors.length})
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.vendors.map((v) => (
            <div key={v.id} className="rounded-xl border border-border-warm bg-cream/40 p-3.5">
              <div className="font-semibold text-char">{v.name}</div>
              {v.abn && <div className="font-mono text-[11px] text-smoke">ABN {v.abn}</div>}
              <div className="mt-1 text-xs text-smoke">
                {[v.contact, v.phone, v.email].filter(Boolean).join(' · ') || 'No contact details'}
              </div>
              <div className="mt-2 font-mono text-[11px] text-ember">
                {v.poCount} POs · {v.itemCount} items
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
