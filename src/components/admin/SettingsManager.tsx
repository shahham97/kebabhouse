'use client';

import { useState, useTransition } from 'react';
import { Save, MapPin, Plus, ShieldAlert } from 'lucide-react';
import {
  updateStoreSettingsAction,
  createDeliveryZoneAction,
} from '@/modules/admin/actions';
import { formatAUD } from '@/lib/money';

interface SettingsData {
  store: {
    id: string;
    name: string;
    abn: string;
    phone: string;
    email: string;
    address: string;
    timezone: string;
    gstRatePct: number;
    gstRegistered: boolean;
    cardSurchargeBps: number;
    holidaySurchargeBps: number;
    soloMode: boolean;
    autoAcceptWeb: boolean;
    onlinePaused: boolean;
    pauseMessage: string;
    negativeStockPolicy: string;
  };
  deliveryZones: Array<{
    id: string;
    name: string;
    postcodes: string;
    feeCents: number;
    minOrderCents: number;
    travelMinutes: number;
    active: boolean;
  }>;
}

export function SettingsManager({ data }: { data: SettingsData }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Store settings form
  const [name, setName] = useState(data.store.name);
  const [abn, setAbn] = useState(data.store.abn);
  const [phone, setPhone] = useState(data.store.phone);
  const [email, setEmail] = useState(data.store.email);
  const [address, setAddress] = useState(data.store.address);
  const [gstRatePct, setGstRatePct] = useState(String(data.store.gstRatePct));
  const [gstRegistered, setGstRegistered] = useState(data.store.gstRegistered);
  const [cardSurchargeBps, setCardSurchargeBps] = useState(String(data.store.cardSurchargeBps));
  const [holidaySurchargeBps, setHolidaySurchargeBps] = useState(
    String(data.store.holidaySurchargeBps)
  );
  const [soloMode, setSoloMode] = useState(data.store.soloMode);
  const [autoAcceptWeb, setAutoAcceptWeb] = useState(data.store.autoAcceptWeb);
  const [onlinePaused, setOnlinePaused] = useState(data.store.onlinePaused);
  const [pauseMessage, setPauseMessage] = useState(data.store.pauseMessage);
  const [negativeStockPolicy, setNegativeStockPolicy] = useState<'warn' | 'block'>(
    data.store.negativeStockPolicy === 'block' ? 'block' : 'warn'
  );

  // Delivery Zone form
  const [zName, setZName] = useState('');
  const [zPostcodes, setZPostcodes] = useState('');
  const [zFeeDollars, setZFeeDollars] = useState('5.50');
  const [zMinOrderDollars, setZMinOrderDollars] = useState('20.00');
  const [zTravelMins, setZTravelMins] = useState('25');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateStoreSettingsAction({
        name,
        abn,
        phone,
        email,
        address,
        gstRatePct: Number(gstRatePct) || 10,
        gstRegistered,
        cardSurchargeBps: Number(cardSurchargeBps) || 0,
        holidaySurchargeBps: Number(holidaySurchargeBps) || 0,
        soloMode,
        autoAcceptWeb,
        onlinePaused,
        pauseMessage,
        negativeStockPolicy,
      });
      if (res.ok) {
        setFeedback({ type: 'ok', text: 'Store settings saved and cache revalidated.' });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const handleCreateZone = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createDeliveryZoneAction({
        name: zName,
        postcodes: zPostcodes,
        feeCents: Math.round((Number(zFeeDollars) || 0) * 100),
        minOrderCents: Math.round((Number(zMinOrderDollars) || 0) * 100),
        travelMinutes: Number(zTravelMins) || 20,
      });
      if (res.ok) {
        setZName('');
        setZPostcodes('');
        setFeedback({ type: 'ok', text: `Delivery zone "${res.data.name}" added.` });
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

      {/* Store Settings Form */}
      <form
        onSubmit={handleSaveSettings}
        className="rounded-2xl border border-border-warm bg-white p-6 shadow-xs space-y-6"
      >
        <div>
          <h2 className="font-display text-xl font-bold text-char">
            Business & Australian Tax Settings
          </h2>
          <p className="text-xs text-smoke">
            Displayed on AU GST Tax Invoices and customer storefront ({data.store.timezone}).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-smoke">Business Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">ABN</label>
            <input
              type="text"
              value={abn}
              onChange={(e) => setAbn(e.target.value)}
              placeholder="12 345 678 901"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-smoke">Street Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            />
          </div>
        </div>

        {/* GST & Surcharges */}
        <div className="grid gap-4 border-t border-border-warm pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-smoke">GST Rate (%)</label>
            <input
              type="number"
              min="0"
              max="30"
              value={gstRatePct}
              onChange={(e) => setGstRatePct(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">
              Card Surcharge (bps, 150 = 1.5%)
            </label>
            <input
              type="number"
              min="0"
              max="1000"
              value={cardSurchargeBps}
              onChange={(e) => setCardSurchargeBps(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">
              Public Holiday Surcharge (bps)
            </label>
            <input
              type="number"
              min="0"
              max="5000"
              value={holidaySurchargeBps}
              onChange={(e) => setHolidaySurchargeBps(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">Negative Stock Policy</label>
            <select
              value={negativeStockPolicy}
              onChange={(e) => setNegativeStockPolicy(e.target.value as 'warn' | 'block')}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            >
              <option value="warn">Warn only</option>
              <option value="block">Block checkout</option>
            </select>
          </div>
        </div>

        {/* Operational Toggles */}
        <div className="grid gap-3 border-t border-border-warm pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2.5 rounded-xl border border-border-warm bg-cream/60 p-3 text-xs font-semibold text-char">
            <input
              type="checkbox"
              checked={gstRegistered}
              onChange={(e) => setGstRegistered(e.target.checked)}
              className="h-4 w-4 accent-ember"
            />
            GST Registered (AU)
          </label>
          <label className="flex items-center gap-2.5 rounded-xl border border-border-warm bg-cream/60 p-3 text-xs font-semibold text-char">
            <input
              type="checkbox"
              checked={soloMode}
              onChange={(e) => setSoloMode(e.target.checked)}
              className="h-4 w-4 accent-ember"
            />
            Solo Operator Mode
          </label>
          <label className="flex items-center gap-2.5 rounded-xl border border-border-warm bg-cream/60 p-3 text-xs font-semibold text-char">
            <input
              type="checkbox"
              checked={autoAcceptWeb}
              onChange={(e) => setAutoAcceptWeb(e.target.checked)}
              className="h-4 w-4 accent-ember"
            />
            Auto-Accept Web Orders
          </label>
          <label className="flex items-center gap-2.5 rounded-xl border border-chilli/30 bg-chilli/10 p-3 text-xs font-semibold text-chilli">
            <input
              type="checkbox"
              checked={onlinePaused}
              onChange={(e) => setOnlinePaused(e.target.checked)}
              className="h-4 w-4 accent-chilli"
            />
            <ShieldAlert className="h-4 w-4 shrink-0" />
            Pause Online Ordering
          </label>
        </div>

        {onlinePaused && (
          <div>
            <label className="block text-xs font-semibold text-chilli">
              Storefront Pause Message
            </label>
            <input
              type="text"
              value={pauseMessage}
              onChange={(e) => setPauseMessage(e.target.value)}
              placeholder="Kitchen is slammed — online ordering resumes in 20 mins!"
              className="mt-1 w-full rounded-xl border border-chilli/40 bg-chilli/5 px-3 py-2 text-sm text-char"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-ember px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ember-dark disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isPending ? 'Saving…' : 'Save Store Settings'}
          </button>
        </div>
      </form>

      {/* Delivery Zones */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-ember" />
            <h2 className="font-display text-lg font-bold text-char">
              Delivery Zones ({data.deliveryZones.length})
            </h2>
          </div>
          <div className="mt-3 space-y-2.5">
            {data.deliveryZones.map((z) => (
              <div
                key={z.id}
                className="rounded-xl border border-border-warm bg-cream/50 p-3.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-char">{z.name}</span>
                  <span className="font-mono font-bold text-ember">
                    {formatAUD(z.feeCents)} fee
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-smoke">
                  Postcodes: {z.postcodes}
                </div>
                <div className="mt-1 text-smoke">
                  Min order {formatAUD(z.minOrderCents)} · ~{z.travelMinutes} mins travel
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleCreateZone}
          className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
        >
          <h2 className="font-display text-lg font-bold text-char">Add Delivery Zone</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-smoke">Zone Name</label>
              <input
                type="text"
                required
                value={zName}
                onChange={(e) => setZName(e.target.value)}
                placeholder="Inner West & CBD"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-smoke">
                AU Postcodes (comma-separated)
              </label>
              <input
                type="text"
                required
                value={zPostcodes}
                onChange={(e) => setZPostcodes(e.target.value)}
                placeholder="2000,2010,2015,2042"
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Delivery Fee ($)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                required
                value={zFeeDollars}
                onChange={(e) => setZFeeDollars(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-smoke">Min Order ($)</label>
              <input
                type="number"
                step="1"
                min="0"
                required
                value={zMinOrderDollars}
                onChange={(e) => setZMinOrderDollars(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-smoke">Est. Travel (mins)</label>
              <input
                type="number"
                min="5"
                max="180"
                value={zTravelMins}
                onChange={(e) => setZTravelMins(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
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
              Add Zone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
