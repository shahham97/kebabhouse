'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Flame,
  LayoutDashboard,
  LogOut,
  MapPin,
  Minus,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  UtensilsCrossed,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import type {
  TillOrderDTO,
  TillProductDTO,
  TillVariantDTO,
  TillWorkspaceData,
} from '@/modules/till/queries';
import {
  addDineInRoundAction,
  cancelOrderAction,
  closeCashSessionAction,
  createTillOrderAction,
  fireScheduledOrderAction,
  handoffOrderAction,
  markAllReadyAction,
  openCashSessionAction,
  recordTillPaymentAction,
  staffLogoutAction,
  toggleOnlinePauseAction,
  toggleSoldOutAction,
  toggleSoloModeAction,
} from '@/modules/till/actions';
import { setTicketStatusAction } from '@/modules/kitchen/actions';
import { calcInclusiveGst, formatAUD } from '@/lib/money';
import { formatStoreDateTime, formatStoreTime, minutesSince } from '@/lib/time';
import { BrandMark } from '@/components/BrandMark';

interface TillStaffCaps {
  id: string;
  name: string;
  roleName: string;
  maxDiscountPct: number;
  canCreateOrder: boolean;
  canMarkAllReady: boolean;
  canServe: boolean;
  canDispatch: boolean;
  canTakePayment: boolean;
  canCancel: boolean;
  canManageCatalog: boolean;
  canApplyDiscount: boolean;
  canViewKitchen: boolean;
  canPrepareKitchen: boolean;
  canViewAdmin: boolean;
}

interface CartLine {
  uid: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  basePriceCents: number;
  modifierOptionIds: string[];
  modifierLabels: string[];
  modifiersDeltaCents: number;
  quantity: number;
  notes: string;
}

type BoardTab = 'kitchen' | 'ready' | 'served' | 'delivery' | 'scheduled' | 'history';

function makeIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getFulfilmentBadge(order: TillOrderDTO): { label: string; cls: string } {
  if (order.fulfilment === 'DINE_IN') {
    return {
      label: `DINE-IN · T${order.tableNumber || '?'}`,
      cls: 'bg-saffron/25 text-char border border-saffron/50',
    };
  }
  if (order.fulfilment === 'DELIVERY') {
    return {
      label: 'DELIVERY',
      cls: 'bg-ember/15 text-ember border border-ember/30',
    };
  }
  return {
    label: 'PICKUP',
    cls: 'bg-char text-cream',
  };
}

export function TillWorkspace({
  data,
  staff,
}: {
  data: TillWorkspaceData;
  staff: TillStaffCaps;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'pos' | 'board'>('pos');
  const [boardTab, setBoardTab] = useState<BoardTab>('kitchen');
  const [sseConnected, setSseConnected] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // POS state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    data.categories[0]?.id ?? ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [fulfilment, setFulfilment] = useState<'DINE_IN' | 'PICKUP' | 'DELIVERY'>('PICKUP');
  const [isPhoneOrder, setIsPhoneOrder] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [covers, setCovers] = useState('');
  const [timing, setTiming] = useState<'ASAP' | 'SCHEDULED'>('ASAP');
  const [scheduledFor, setScheduledFor] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliverySuburb, setDeliverySuburb] = useState('');
  const [deliveryPostcode, setDeliveryPostcode] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [discountPct, setDiscountPct] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);

  // Modals state
  const [configProduct, setConfigProduct] = useState<TillProductDTO | null>(null);
  const [configVariant, setConfigVariant] = useState<TillVariantDTO | null>(null);
  const [configMods, setConfigMods] = useState<Record<string, string[]>>({});
  const [configQty, setConfigQty] = useState(1);
  const [configNotes, setConfigNotes] = useState('');

  const [markAllOrder, setMarkAllOrder] = useState<TillOrderDTO | null>(null);
  const [markAllChecked, setMarkAllChecked] = useState<Record<string, boolean>>({});

  const [paymentOrder, setPaymentOrder] = useState<TillOrderDTO | null>(null);
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD_EFTPOS' | 'OTHER'>('CASH');
  const [payAmountDollars, setPayAmountDollars] = useState('');
  const [payTenderedDollars, setPayTenderedDollars] = useState('');
  const [payReference, setPayReference] = useState('');

  const [dispatchOrder, setDispatchOrder] = useState<TillOrderDTO | null>(null);
  const [driverNameInput, setDriverNameInput] = useState('');

  const [roundOrder, setRoundOrder] = useState<TillOrderDTO | null>(null);
  const [roundItems, setRoundItems] = useState<CartLine[]>([]);

  const [cancelTarget, setCancelTarget] = useState<TillOrderDTO | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [receiptOrder, setReceiptOrder] = useState<TillOrderDTO | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [floatDollars, setFloatDollars] = useState('200.00');
  const [countedCashDollars, setCountedCashDollars] = useState('');
  const [cashNotes, setCashNotes] = useState('');

  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseMessageInput, setPauseMessageInput] = useState(
    data.store.pauseMessage || 'Kitchen at peak capacity — online ASAP orders paused for 20 mins.'
  );

  // Realtime SSE + 30s safety refresh
  useEffect(() => {
    const channel = `store:${data.store.id}:till`;
    const es = new EventSource(`/api/realtime/stream?channel=${encodeURIComponent(channel)}`);
    const refresh = () => router.refresh();

    es.addEventListener('connected', () => setSseConnected(true));
    es.addEventListener('order.created', refresh);
    es.addEventListener('order.paid', refresh);
    es.addEventListener('order.updated', refresh);
    es.addEventListener('order.ready', refresh);
    es.addEventListener('order.fired', refresh);
    es.addEventListener('order.cancelled', refresh);
    es.addEventListener('catalog.updated', refresh);
    es.addEventListener('store.updated', refresh);
    es.onerror = () => setSseConnected(false);

    const safety = setInterval(refresh, 30_000);
    return () => {
      es.close();
      clearInterval(safety);
    };
  }, [data.store.id, router]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Keep paymentOrder synced with refreshed server data
  const allLiveOrders = useMemo(
    () => [
      ...data.orders.kitchen,
      ...data.orders.ready,
      ...data.orders.served,
      ...data.orders.delivery,
      ...data.orders.scheduled,
    ],
    [data.orders]
  );

  useEffect(() => {
    if (!paymentOrder) return;
    const updated = allLiveOrders.find((o) => o.id === paymentOrder.id);
    if (!updated) {
      setPaymentOrder(null);
      return;
    }
    if (updated.amountPaidCents !== paymentOrder.amountPaidCents || updated.status !== paymentOrder.status) {
      setPaymentOrder(updated);
      const rem = Math.max(0, updated.totalCents - updated.amountPaidCents);
      if (rem === 0) {
        setPaymentOrder(null);
      } else {
        setPayAmountDollars((rem / 100).toFixed(2));
        setPayTenderedDollars((rem / 100).toFixed(2));
      }
    }
  }, [allLiveOrders, paymentOrder]);

  function notify(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text });
  }

  // Delivery zone fee match
  const matchedZone = useMemo(() => {
    if (fulfilment !== 'DELIVERY') return null;
    const pc = deliveryPostcode.trim();
    if (!pc) return null;
    return (
      data.deliveryZones.find((z) =>
        z.postcodes
          .split(',')
          .map((p) => p.trim())
          .includes(pc)
      ) ?? null
    );
  }, [fulfilment, deliveryPostcode, data.deliveryZones]);

  // Cart calculations
  const cartSubtotalCents = cart.reduce(
    (sum, line) => sum + (line.basePriceCents + line.modifiersDeltaCents) * line.quantity,
    0
  );
  const cartDiscountCents =
    discountPct > 0 ? Math.round((cartSubtotalCents * discountPct) / 100) : 0;
  const cartDeliveryFeeCents = matchedZone ? matchedZone.feeCents : 0;
  const cartTotalCents = Math.max(0, cartSubtotalCents - cartDiscountCents + cartDeliveryFeeCents);
  const cartGstCents = data.store.gstRegistered
    ? calcInclusiveGst(cartTotalCents, data.store.gstRatePct)
    : 0;

  // Filtered products
  const visibleProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return data.categories
        .flatMap((c) => c.products)
        .filter((p) => p.name.toLowerCase().includes(q));
    }
    const cat = data.categories.find((c) => c.id === selectedCategoryId) ?? data.categories[0];
    return cat?.products ?? [];
  }, [data.categories, selectedCategoryId, searchQuery]);

  // Open product modal or quick-add if single variant and no modifier groups
  function handleProductTap(product: TillProductDTO, forRound = false) {
    if (product.soldOut) {
      notify('err', `${product.name} is currently 86'd (sold out)`);
      return;
    }
    const availableVariants = product.variants.filter((v) => !v.soldOut);
    const firstVariant = availableVariants[0];
    if (!firstVariant) {
      notify('err', `All variants of ${product.name} are sold out`);
      return;
    }

    if (availableVariants.length === 1 && product.modifierGroups.length === 0) {
      const v = firstVariant;
      const line: CartLine = {
        uid: makeIdempotencyKey('line'),
        productId: product.id,
        productName: product.name,
        variantId: v.id,
        variantName: v.name,
        basePriceCents: v.priceCents,
        modifierOptionIds: [],
        modifierLabels: [],
        modifiersDeltaCents: 0,
        quantity: 1,
        notes: '',
      };
      if (forRound) {
        setRoundItems((prev) => [...prev, line]);
      } else {
        setCart((prev) => {
          const existing = prev.find(
            (l) =>
              l.variantId === line.variantId &&
              l.modifierOptionIds.length === 0 &&
              l.notes === ''
          );
          if (existing) {
            return prev.map((l) =>
              l.uid === existing.uid ? { ...l, quantity: l.quantity + 1 } : l
            );
          }
          return [...prev, line];
        });
      }
      return;
    }

    // Open configurator modal
    const defaultMods: Record<string, string[]> = {};
    for (const grp of product.modifierGroups) {
      const defs = grp.options
        .filter((o) => o.isDefault && !o.soldOut)
        .map((o) => o.id)
        .slice(0, grp.maxSelect);
      defaultMods[grp.id] = defs;
    }
    setConfigProduct(product);
    setConfigVariant(firstVariant);
    setConfigMods(defaultMods);
    setConfigQty(1);
    setConfigNotes('');
  }

  function toggleConfigMod(groupId: string, optionId: string, maxSelect: number) {
    setConfigMods((prev) => {
      const curr = prev[groupId] ?? [];
      if (curr.includes(optionId)) {
        return { ...prev, [groupId]: curr.filter((id) => id !== optionId) };
      }
      if (maxSelect === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (curr.length >= maxSelect) {
        return prev;
      }
      return { ...prev, [groupId]: [...curr, optionId] };
    });
  }

  function confirmConfiguredItem() {
    if (!configProduct || !configVariant) return;
    for (const grp of configProduct.modifierGroups) {
      const chosen = configMods[grp.id] ?? [];
      if (grp.required && chosen.length < Math.max(1, grp.minSelect)) {
        notify('err', `Please select at least ${Math.max(1, grp.minSelect)} option for ${grp.name}`);
        return;
      }
    }

    const modIds: string[] = [];
    const modLabels: string[] = [];
    let modDelta = 0;

    for (const grp of configProduct.modifierGroups) {
      const chosenIds = configMods[grp.id] ?? [];
      for (const opt of grp.options) {
        if (chosenIds.includes(opt.id)) {
          modIds.push(opt.id);
          modLabels.push(opt.name);
          modDelta += opt.priceDeltaCents;
        }
      }
    }

    const line: CartLine = {
      uid: makeIdempotencyKey('line'),
      productId: configProduct.id,
      productName: configProduct.name,
      variantId: configVariant.id,
      variantName: configVariant.name,
      basePriceCents: configVariant.priceCents,
      modifierOptionIds: modIds,
      modifierLabels: modLabels,
      modifiersDeltaCents: modDelta,
      quantity: configQty,
      notes: configNotes.trim(),
    };

    if (roundOrder) {
      setRoundItems((prev) => [...prev, line]);
    } else {
      setCart((prev) => [...prev, line]);
    }
    setConfigProduct(null);
  }

  function handlePlaceOrder() {
    if (cart.length === 0) {
      notify('err', 'Add at least one item before placing the order');
      return;
    }
    if (fulfilment === 'DINE_IN' && !tableNumber.trim()) {
      notify('err', 'Enter a table number for Dine-In orders');
      return;
    }
    if (fulfilment === 'DELIVERY' && !deliveryPostcode.trim()) {
      notify('err', 'Enter a delivery postcode');
      return;
    }

    const idempotencyKey = makeIdempotencyKey('till_ord');
    startTransition(async () => {
      const res = await createTillOrderAction({
        channel: isPhoneOrder ? 'PHONE' : 'TILL',
        fulfilment,
        tableNumber: fulfilment === 'DINE_IN' ? tableNumber.trim() : null,
        covers: fulfilment === 'DINE_IN' && covers ? Number(covers) : null,
        timing,
        scheduledFor: timing === 'SCHEDULED' && scheduledFor ? new Date(scheduledFor).toISOString() : null,
        customerName: customerName.trim() || (fulfilment === 'DINE_IN' ? `Table ${tableNumber.trim()}` : 'Walk-in'),
        customerPhone: customerPhone.trim(),
        deliveryAddress: fulfilment === 'DELIVERY' ? deliveryAddress.trim() : null,
        deliverySuburb: fulfilment === 'DELIVERY' ? deliverySuburb.trim() : null,
        deliveryPostcode: fulfilment === 'DELIVERY' ? deliveryPostcode.trim() : null,
        notes: orderNotes.trim(),
        manualDiscountPct: discountPct,
        idempotencyKey,
        items: cart.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          modifierOptionIds: l.modifierOptionIds,
          notes: l.notes,
        })),
      });

      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }

      notify('ok', `Order ${res.data.number} sent (${res.data.status.replaceAll('_', ' ')})`);
      setCart([]);
      setTableNumber('');
      setCovers('');
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setDeliverySuburb('');
      setDeliveryPostcode('');
      setOrderNotes('');
      setDiscountPct(0);
      setTiming('ASAP');
      setScheduledFor('');
      setMode('board');
      setBoardTab(res.data.status === 'SCHEDULED' ? 'scheduled' : res.data.status === 'READY' ? 'ready' : 'kitchen');
      router.refresh();
    });
  }

  function handleToggleSoloMode() {
    startTransition(async () => {
      const res = await toggleSoloModeAction({ soloMode: !data.store.soloMode });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      notify('ok', res.data.soloMode ? 'Solo Mode enabled' : 'Solo Mode disabled');
      router.refresh();
    });
  }

  function handleSaveOnlinePause(nextPaused: boolean) {
    startTransition(async () => {
      const res = await toggleOnlinePauseAction({
        onlinePaused: nextPaused,
        pauseMessage: nextPaused ? pauseMessageInput : null,
      });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      setPauseModalOpen(false);
      notify('ok', res.data.onlinePaused ? 'Online ASAP ordering paused' : 'Online ordering resumed');
      router.refresh();
    });
  }

  function handleToggle86(product: TillProductDTO, e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const res = await toggleSoldOutAction({
        productId: product.id,
        soldOut: !product.soldOut,
      });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      notify('ok', `${product.name} marked ${res.data.soldOut ? 'SOLD OUT (86)' : 'IN STOCK'}`);
      router.refresh();
    });
  }

  function openMarkAllModal(order: TillOrderDTO) {
    const initial: Record<string, boolean> = {};
    for (const t of order.tickets) {
      initial[t.id] = t.status === 'READY';
    }
    setMarkAllChecked(initial);
    setMarkAllOrder(order);
  }

  function handleConfirmMarkAllReady() {
    if (!markAllOrder) return;
    const orderId = markAllOrder.id;
    const orderNum = markAllOrder.number;
    startTransition(async () => {
      const res = await markAllReadyAction({ orderId });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      setMarkAllOrder(null);
      notify('ok', `${orderNum} marked ALL READY`);
      router.refresh();
    });
  }

  function handleSoloTicketStatus(ticketId: string, to: 'PREPARING' | 'READY') {
    startTransition(async () => {
      const res = await setTicketStatusAction({ ticketId, to, bumpedFromTill: true });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleHandoff(order: TillOrderDTO, to: 'SERVED' | 'COLLECTED' | 'OUT_FOR_DELIVERY', driverName?: string) {
    startTransition(async () => {
      const res = await handoffOrderAction({
        orderId: order.id,
        to,
        driverName,
      });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      setDispatchOrder(null);
      setDriverNameInput('');
      notify(
        'ok',
        `${order.number} → ${res.data.status.replaceAll('_', ' ')}`
      );
      router.refresh();
    });
  }

  function openPaymentModal(order: TillOrderDTO) {
    const balance = Math.max(0, order.totalCents - order.amountPaidCents);
    setPaymentOrder(order);
    setPayMethod('CASH');
    setPayAmountDollars((balance / 100).toFixed(2));
    setPayTenderedDollars((balance / 100).toFixed(2));
    setPayReference('');
  }

  function handleRecordPayment() {
    if (!paymentOrder) return;
    const amountCents = Math.round(parseFloat(payAmountDollars || '0') * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      notify('err', 'Enter a valid payment amount');
      return;
    }
    const tenderedCents =
      payMethod === 'CASH'
        ? Math.round(parseFloat(payTenderedDollars || payAmountDollars || '0') * 100)
        : undefined;

    if (payMethod === 'CASH' && tenderedCents !== undefined && tenderedCents < amountCents) {
      notify('err', 'Cash tendered must be at least the payment amount');
      return;
    }

    startTransition(async () => {
      const res = await recordTillPaymentAction({
        orderId: paymentOrder.id,
        method: payMethod,
        amountCents,
        tenderedCents,
        reference: payMethod !== 'CASH' ? payReference.trim() || undefined : undefined,
        idempotencyKey: makeIdempotencyKey('pay'),
      });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      const remaining = Math.max(0, res.data.totalCents - res.data.amountPaidCents);
      if (remaining === 0) {
        setPaymentOrder(null);
        notify(
          'ok',
          res.data.status === 'COMPLETED'
            ? `${paymentOrder.number} paid in full & auto-completed!`
            : `${paymentOrder.number} paid in full!`
        );
      } else {
        setPayAmountDollars((remaining / 100).toFixed(2));
        setPayTenderedDollars((remaining / 100).toFixed(2));
        notify('ok', `Partial payment recorded. Remaining balance: ${formatAUD(remaining)}`);
      }
      router.refresh();
    });
  }

  function handleSubmitRound() {
    if (!roundOrder || roundItems.length === 0) return;
    startTransition(async () => {
      const res = await addDineInRoundAction({
        orderId: roundOrder.id,
        items: roundItems.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          modifierOptionIds: l.modifierOptionIds,
          notes: l.notes,
        })),
      });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      notify('ok', `Round ${res.data.currentRound} sent to kitchen for ${roundOrder.number}`);
      setRoundOrder(null);
      setRoundItems([]);
      router.refresh();
    });
  }

  function handleFireScheduled(order: TillOrderDTO) {
    startTransition(async () => {
      const res = await fireScheduledOrderAction({ orderId: order.id });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      notify('ok', `${order.number} fired to Kitchen immediately!`);
      setBoardTab('kitchen');
      router.refresh();
    });
  }

  function handleConfirmCancel() {
    if (!cancelTarget || !cancelReason.trim()) {
      notify('err', 'Please enter a cancellation reason');
      return;
    }
    startTransition(async () => {
      const res = await cancelOrderAction({
        orderId: cancelTarget.id,
        reason: cancelReason.trim(),
      });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      notify('ok', `${cancelTarget.number} cancelled`);
      setCancelTarget(null);
      setCancelReason('');
      router.refresh();
    });
  }

  function handleOpenCashDrawer() {
    const openingFloatCents = Math.round(parseFloat(floatDollars || '0') * 100);
    if (!Number.isFinite(openingFloatCents) || openingFloatCents < 0) {
      notify('err', 'Enter a valid opening float');
      return;
    }
    startTransition(async () => {
      const res = await openCashSessionAction({
        openingFloatCents,
        notes: cashNotes.trim(),
      });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      setCashModalOpen(false);
      setCashNotes('');
      notify('ok', `Cash drawer opened with ${formatAUD(res.data.openingFloatCents)} float`);
      router.refresh();
    });
  }

  function handleCloseCashDrawer() {
    if (!data.activeCashSession) return;
    const countedCashCents = Math.round(parseFloat(countedCashDollars || '0') * 100);
    if (!Number.isFinite(countedCashCents) || countedCashCents < 0) {
      notify('err', 'Enter the counted cash amount');
      return;
    }
    startTransition(async () => {
      const res = await closeCashSessionAction({
        cashSessionId: data.activeCashSession!.id,
        countedCashCents,
        notes: cashNotes.trim(),
      });
      if (!res.ok) {
        notify('err', res.error.message);
        return;
      }
      setCashModalOpen(false);
      setCountedCashDollars('');
      setCashNotes('');
      const variance = res.data.varianceCents ?? 0;
      notify(
        'ok',
        `Cash drawer closed. Variance: ${variance >= 0 ? '+' : ''}${formatAUD(variance)}`
      );
      router.refresh();
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await staffLogoutAction({});
      router.push('/staff/login');
      router.refresh();
    });
  }

  const liveBoardCount =
    data.orders.kitchen.length +
    data.orders.ready.length +
    data.orders.served.length +
    data.orders.delivery.length +
    data.orders.scheduled.length;

  const payAmountCentsPreview = Math.round(parseFloat(payAmountDollars || '0') * 100) || 0;
  const payTenderedCentsPreview = Math.round(parseFloat(payTenderedDollars || '0') * 100) || 0;
  const cashChangePreview = Math.max(0, payTenderedCentsPreview - payAmountCentsPreview);

  return (
    <div className="min-h-screen bg-cream text-char flex flex-col">
      {/* Top Bar */}
      <header className="no-print sticky top-0 z-30 bg-char text-cream border-b border-char-soft px-4 py-2.5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Brand & Staff */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-ember flex items-center justify-center text-cream">
              <BrandMark className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-extrabold tracking-tight leading-none">
                  STAR KEBAB TILL
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    sseConnected ? 'bg-herb/25 text-herb' : 'bg-saffron/25 text-saffron'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      sseConnected ? 'bg-herb' : 'bg-saffron'
                    }`}
                  />
                  {sseConnected ? 'LIVE' : 'SYNC'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-cream/75">
                <span className="font-semibold text-cream">{staff.name}</span>
                <span className="rounded bg-saffron/20 text-saffron px-1.5 py-0.2 text-[10px] font-bold uppercase">
                  {staff.roleName}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Solo Mode Toggle */}
            <button
              type="button"
              disabled={isPending}
              onClick={handleToggleSoloMode}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                data.store.soloMode
                  ? 'bg-saffron text-char border-saffron'
                  : 'bg-char-soft text-cream/80 border-cream/15 hover:text-cream'
              }`}
              title="Solo Mode lets one operator bump kitchen tickets directly from the Till"
            >
              <Zap className="h-3.5 w-3.5" />
              Solo Mode: {data.store.soloMode ? 'ON' : 'OFF'}
            </button>

            {/* Pause Online Toggle */}
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (data.store.onlinePaused) {
                  handleSaveOnlinePause(false);
                } else {
                  setPauseModalOpen(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                data.store.onlinePaused
                  ? 'bg-chilli text-cream border-chilli'
                  : 'bg-char-soft text-cream/80 border-cream/15 hover:text-cream'
              }`}
            >
              {data.store.onlinePaused ? (
                <>
                  <PlayCircle className="h-3.5 w-3.5" />
                  Online PAUSED
                </>
              ) : (
                <>
                  <PauseCircle className="h-3.5 w-3.5" />
                  Pause Online
                </>
              )}
            </button>

            {/* Cash Drawer */}
            {staff.canTakePayment && (
              <button
                type="button"
                onClick={() => {
                  if (data.activeCashSession) {
                    setCountedCashDollars(
                      (data.activeCashSession.expectedCashCents / 100).toFixed(2)
                    );
                  }
                  setCashModalOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                  data.activeCashSession
                    ? 'bg-herb/25 text-cream border-herb/50 hover:bg-herb/35'
                    : 'bg-char-soft text-saffron border-saffron/40 hover:bg-saffron/15'
                }`}
              >
                <Wallet className="h-3.5 w-3.5" />
                {data.activeCashSession
                  ? `Drawer ${formatAUD(data.activeCashSession.expectedCashCents)}`
                  : 'Open Drawer'}
              </button>
            )}

            {staff.canViewKitchen && (
              <Link
                href="/station/all"
                className="inline-flex items-center gap-1.5 rounded-xl bg-char-soft hover:bg-cream/15 border border-cream/15 px-3 py-1.5 text-xs font-bold text-cream transition-colors"
              >
                <ChefHat className="h-3.5 w-3.5 text-saffron" />
                Kitchen KDS
              </Link>
            )}

            {staff.canViewAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-xl bg-char-soft hover:bg-cream/15 border border-cream/15 px-3 py-1.5 text-xs font-bold text-cream transition-colors"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-saffron" />
                Admin
              </Link>
            )}

            <button
              type="button"
              onClick={() => router.refresh()}
              className="rounded-xl bg-char-soft hover:bg-cream/15 border border-cream/15 p-1.5 text-cream cursor-pointer"
              title="Refresh data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-xl bg-char-soft hover:bg-chilli/40 border border-cream/15 px-2.5 py-1.5 text-xs font-bold text-cream/80 hover:text-cream transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Out
            </button>
          </div>
        </div>

        {/* Main Mode Switcher */}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('pos')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition-all cursor-pointer ${
              mode === 'pos'
                ? 'bg-ember text-cream shadow'
                : 'bg-char-soft text-cream/75 hover:text-cream'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            New Order POS
            {cart.length > 0 && (
              <span className="rounded-md bg-char/40 px-1.5 py-0.5 font-mono text-xs tabular-nums">
                {cart.reduce((s, l) => s + l.quantity, 0)}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMode('board')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition-all cursor-pointer ${
              mode === 'board'
                ? 'bg-saffron text-char shadow'
                : 'bg-char-soft text-cream/75 hover:text-cream'
            }`}
          >
            <Flame className="h-4 w-4" />
            Live Operations Board
            <span
              className={`rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                mode === 'board' ? 'bg-char/20 text-char' : 'bg-ember text-cream'
              }`}
            >
              {liveBoardCount}
            </span>
          </button>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="no-print fixed bottom-4 right-4 z-50 max-w-sm">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-bold shadow-xl border flex items-center gap-2.5 ${
              toast.kind === 'ok'
                ? 'bg-herb text-cream border-herb'
                : 'bg-chilli text-cream border-chilli'
            }`}
          >
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-auto opacity-80 hover:opacity-100 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          MODE 1: NEW ORDER POS
         ========================================================= */}
      {mode === 'pos' && (
        <main className="no-print flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 max-w-[1600px] w-full mx-auto">
          {/* Left 8 cols: Catalogue */}
          <section className="lg:col-span-8 flex flex-col gap-3">
            {/* Search + Category Tabs */}
            <div className="rounded-2xl bg-white border border-border-warm p-3 shadow-sm space-y-2.5">
              <div className="relative">
                <Search className="h-4 w-4 text-smoke absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Quick search kebabs, HSP, pide, drinks…"
                  className="w-full rounded-xl border border-border-warm bg-cream/50 pl-9 pr-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {data.categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setSearchQuery('');
                    }}
                    className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                      selectedCategoryId === cat.id && !searchQuery
                        ? 'bg-char text-cream'
                        : 'bg-cream-deep text-char hover:bg-border-warm'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {visibleProducts.map((product) => {
                const minPrice = Math.min(...product.variants.map((v) => v.priceCents));
                return (
                  <div
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleProductTap(product)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleProductTap(product);
                      }
                    }}
                    className={`relative rounded-2xl border p-3.5 text-left transition-all select-none cursor-pointer flex flex-col justify-between min-h-[118px] ${
                      product.soldOut
                        ? 'bg-cream-deep/70 border-border-warm opacity-65'
                        : 'bg-white border-border-warm hover:border-ember hover:shadow-md active:scale-[0.98]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-bold text-sm text-char leading-snug">
                          {product.name}
                        </p>
                        {staff.canManageCatalog && (
                          <button
                            type="button"
                            onClick={(e) => handleToggle86(product, e)}
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase cursor-pointer ${
                              product.soldOut
                                ? 'bg-chilli text-cream'
                                : 'bg-cream-deep text-smoke hover:bg-chilli/15 hover:text-chilli'
                            }`}
                            title="Toggle Sold Out (86)"
                          >
                            {product.soldOut ? '86' : 'In'}
                          </button>
                        )}
                      </div>
                      {product.variants.length > 1 && (
                        <p className="text-[11px] text-smoke mt-1">
                          {product.variants.length} sizes
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-sm font-extrabold text-ember tabular-nums">
                        {product.variants.length > 1 ? `From ${formatAUD(minPrice)}` : formatAUD(minPrice)}
                      </span>
                      {product.soldOut && (
                        <span className="text-[10px] font-extrabold uppercase text-chilli">
                          SOLD OUT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right 4 cols: Order Builder & Cart */}
          <aside className="lg:col-span-4 rounded-2xl bg-white border border-border-warm shadow-sm flex flex-col overflow-hidden h-fit lg:sticky lg:top-[112px]">
            {/* Fulfilment & Channel */}
            <div className="p-3.5 border-b border-border-warm bg-cream/60 space-y-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { key: 'DINE_IN', label: 'Dine-in', icon: UtensilsCrossed },
                    { key: 'PICKUP', label: 'Pickup', icon: ShoppingBag },
                    { key: 'DELIVERY', label: 'Delivery', icon: Truck },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setFulfilment(opt.key)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                        fulfilment === opt.key
                          ? 'bg-char text-cream'
                          : 'bg-white border border-border-warm text-char hover:bg-cream-deep'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Phone + Timing row */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPhoneOrder((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold border cursor-pointer ${
                    isPhoneOrder
                      ? 'bg-saffron/30 border-saffron text-char'
                      : 'bg-white border-border-warm text-smoke'
                  }`}
                >
                  <Phone className="h-3 w-3" />
                  Phone
                </button>
                <div className="flex-1 grid grid-cols-2 rounded-lg border border-border-warm bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setTiming('ASAP')}
                    className={`rounded-md py-1 text-xs font-bold cursor-pointer ${
                      timing === 'ASAP' ? 'bg-ember text-cream' : 'text-smoke'
                    }`}
                  >
                    ASAP
                  </button>
                  <button
                    type="button"
                    onClick={() => setTiming('SCHEDULED')}
                    className={`rounded-md py-1 text-xs font-bold cursor-pointer ${
                      timing === 'SCHEDULED' ? 'bg-ember text-cream' : 'text-smoke'
                    }`}
                  >
                    Schedule
                  </button>
                </div>
              </div>

              {timing === 'SCHEDULED' && (
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs text-char"
                />
              )}

              {fulfilment === 'DINE_IN' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Table # (e.g. 5) *"
                    className="rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs font-bold text-char focus:border-ember focus:outline-none"
                  />
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={covers}
                    onChange={(e) => setCovers(e.target.value)}
                    placeholder="Covers (opt)"
                    className="rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs text-char focus:border-ember focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs text-char focus:border-ember focus:outline-none"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone (opt)"
                  className="rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs text-char focus:border-ember focus:outline-none"
                />
              </div>

              {fulfilment === 'DELIVERY' && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Street address"
                    className="w-full rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs text-char focus:border-ember focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={deliverySuburb}
                      onChange={(e) => setDeliverySuburb(e.target.value)}
                      placeholder="Suburb"
                      className="rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs text-char focus:border-ember focus:outline-none"
                    />
                    <input
                      type="text"
                      value={deliveryPostcode}
                      onChange={(e) => setDeliveryPostcode(e.target.value)}
                      placeholder="Postcode *"
                      className="rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs text-char focus:border-ember focus:outline-none"
                    />
                  </div>
                  {deliveryPostcode.trim() && (
                    <p
                      className={`text-[11px] font-bold ${
                        matchedZone ? 'text-herb' : 'text-chilli'
                      }`}
                    >
                      {matchedZone
                        ? `Zone: ${matchedZone.name} (${formatAUD(matchedZone.feeCents)})`
                        : `Postcode ${deliveryPostcode.trim()} outside delivery zones`}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Cart Lines */}
            <div className="p-3.5 max-h-[300px] overflow-y-auto divide-y divide-border-warm/60">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-xs text-smoke">
                  Tap menu items on the left to build an order.
                </p>
              ) : (
                cart.map((line) => {
                  const unitCents = line.basePriceCents + line.modifiersDeltaCents;
                  return (
                    <div key={line.uid} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-char leading-snug">
                            {line.productName}
                            {line.variantName !== 'Regular' && line.variantName !== 'Standard' && (
                              <span className="text-smoke font-normal"> ({line.variantName})</span>
                            )}
                          </p>
                          {line.modifierLabels.length > 0 && (
                            <p className="text-[11px] text-smoke truncate">
                              {line.modifierLabels.join(', ')}
                            </p>
                          )}
                          {line.notes && (
                            <p className="text-[11px] font-semibold text-chilli">
                              Note: {line.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-mono text-xs font-bold text-char tabular-nums shrink-0">
                          {formatAUD(unitCents * line.quantity)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1 rounded-lg border border-border-warm bg-cream/60">
                          <button
                            type="button"
                            onClick={() =>
                              setCart((prev) =>
                                prev
                                  .map((l) =>
                                    l.uid === line.uid ? { ...l, quantity: l.quantity - 1 } : l
                                  )
                                  .filter((l) => l.quantity > 0)
                              )
                            }
                            className="p-1 text-char hover:text-ember cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-1.5 font-mono text-xs font-bold tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCart((prev) =>
                                prev.map((l) =>
                                  l.uid === line.uid ? { ...l, quantity: l.quantity + 1 } : l
                                )
                              )
                            }
                            className="p-1 text-char hover:text-ember cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) => prev.filter((l) => l.uid !== line.uid))
                          }
                          className="text-smoke hover:text-chilli p-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Notes, Discount & Totals */}
            <div className="p-3.5 border-t border-border-warm bg-cream/40 space-y-2.5">
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Order kitchen notes / allergy alert…"
                className="w-full rounded-xl border border-border-warm bg-white px-3 py-1.5 text-xs text-char focus:border-ember focus:outline-none"
              />

              {staff.canApplyDiscount && staff.maxDiscountPct > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-smoke">
                    Discount % (max {staff.maxDiscountPct}%)
                  </span>
                  <div className="flex items-center gap-1">
                    {[0, 5, 10]
                      .filter((p) => p <= staff.maxDiscountPct)
                      .map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDiscountPct(p)}
                          className={`rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer ${
                            discountPct === p
                              ? 'bg-char text-cream'
                              : 'bg-white border border-border-warm text-char'
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    <input
                      type="number"
                      min={0}
                      max={staff.maxDiscountPct}
                      value={discountPct}
                      onChange={(e) =>
                        setDiscountPct(
                          Math.min(staff.maxDiscountPct, Math.max(0, Number(e.target.value) || 0))
                        )
                      }
                      className="w-14 rounded-lg border border-border-warm bg-white px-2 py-1 text-right font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1 text-xs pt-1 border-t border-border-warm">
                <div className="flex justify-between text-smoke">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatAUD(cartSubtotalCents)}</span>
                </div>
                {cartDiscountCents > 0 && (
                  <div className="flex justify-between text-herb font-semibold">
                    <span>Discount ({discountPct}%)</span>
                    <span className="font-mono tabular-nums">-{formatAUD(cartDiscountCents)}</span>
                  </div>
                )}
                {cartDeliveryFeeCents > 0 && (
                  <div className="flex justify-between text-smoke">
                    <span>Delivery Fee</span>
                    <span className="font-mono tabular-nums">{formatAUD(cartDeliveryFeeCents)}</span>
                  </div>
                )}
                {data.store.gstRegistered && (
                  <div className="flex justify-between text-smoke text-[11px]">
                    <span>Includes GST ({data.store.gstRatePct}%)</span>
                    <span className="font-mono tabular-nums">{formatAUD(cartGstCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-char pt-1">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{formatAUD(cartTotalCents)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={isPending || cart.length === 0 || !staff.canCreateOrder}
                onClick={handlePlaceOrder}
                className="w-full rounded-xl bg-ember hover:bg-ember-dark disabled:opacity-50 text-cream font-display text-lg font-extrabold py-3 shadow-sm transition-colors cursor-pointer"
              >
                {isPending
                  ? 'Sending Order…'
                  : timing === 'SCHEDULED'
                  ? `Schedule Order · ${formatAUD(cartTotalCents)}`
                  : `Place Order · ${formatAUD(cartTotalCents)}`}
              </button>
            </div>
          </aside>
        </main>
      )}

      {/* =========================================================
          MODE 2: LIVE OPERATIONS BOARD (6 TABS)
         ========================================================= */}
      {mode === 'board' && (
        <main className="no-print flex-1 p-4 max-w-[1600px] w-full mx-auto space-y-4">
          {/* 6-tab bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(
              [
                { key: 'kitchen', label: 'Kitchen', count: data.orders.kitchen.length, tone: 'ember' },
                { key: 'ready', label: 'Ready', count: data.orders.ready.length, tone: 'herb' },
                {
                  key: 'served',
                  label: 'Served – Awaiting Payment',
                  count: data.orders.served.length,
                  tone: 'saffron',
                },
                {
                  key: 'delivery',
                  label: 'Out for Delivery',
                  count: data.orders.delivery.length,
                  tone: 'char',
                },
                {
                  key: 'scheduled',
                  label: 'Scheduled',
                  count: data.orders.scheduled.length,
                  tone: 'char',
                },
                {
                  key: 'history',
                  label: 'Order History',
                  count: data.orders.history.length,
                  tone: 'smoke',
                },
              ] as const
            ).map((t) => {
              const active = boardTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setBoardTab(t.key)}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer ${
                    active
                      ? 'bg-char text-cream border-char shadow'
                      : 'bg-white text-char border-border-warm hover:bg-cream-deep'
                  }`}
                >
                  <span>{t.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums ${
                      active
                        ? 'bg-saffron text-char'
                        : t.tone === 'herb' && t.count > 0
                        ? 'bg-herb text-cream'
                        : t.tone === 'ember' && t.count > 0
                        ? 'bg-ember text-cream'
                        : 'bg-cream-deep text-char'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: KITCHEN */}
          {boardTab === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.orders.kitchen.length === 0 ? (
                <EmptyBoardState text="No active orders in the kitchen right now." />
              ) : (
                data.orders.kitchen.map((order) => {
                  const badge = getFulfilmentBadge(order);
                  const balance = Math.max(0, order.totalCents - order.amountPaidCents);
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl bg-white border border-border-warm shadow-sm p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-lg font-extrabold text-char tabular-nums">
                                {order.number}
                              </span>
                              <span className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${badge.cls}`}>
                                {badge.label}
                              </span>
                              <span className="rounded-md bg-cream-deep px-2 py-0.5 text-[11px] font-bold text-smoke">
                                {minutesSince(order.releaseAt)}m ago
                              </span>
                            </div>
                            <p className="text-xs text-smoke mt-1">
                              {order.customerName}
                              {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-extrabold text-char tabular-nums">
                              {formatAUD(order.totalCents)}
                            </p>
                            <span
                              className={`text-[10px] font-extrabold uppercase ${
                                order.paymentStatus === 'PAID' ? 'text-herb' : 'text-ember'
                              }`}
                            >
                              {order.paymentStatus}
                            </span>
                          </div>
                        </div>

                        {/* Per-station status chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {order.tickets.map((tk) => (
                            <span
                              key={tk.id}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                                tk.status === 'READY'
                                  ? 'bg-herb/15 text-herb border-herb/30'
                                  : tk.status === 'PREPARING'
                                  ? 'bg-saffron/25 text-char border-saffron'
                                  : 'bg-cream-deep text-smoke border-border-warm'
                              }`}
                            >
                              <span>{tk.stationName}</span>
                              {tk.status === 'READY' ? (
                                <Check className="h-3.5 w-3.5 text-herb" />
                              ) : tk.status === 'PREPARING' ? (
                                <Flame className="h-3.5 w-3.5 text-ember" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-smoke" />
                              )}
                            </span>
                          ))}
                        </div>

                        {/* Solo Mode Inline Controls */}
                        {data.store.soloMode && staff.canPrepareKitchen && (
                          <div className="rounded-xl bg-saffron/10 border border-saffron/40 p-2.5 space-y-1.5">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-smoke">
                              Solo Mode Quick Bump
                            </p>
                            {order.tickets
                              .filter((tk) => tk.status !== 'READY')
                              .map((tk) => (
                                <div
                                  key={tk.id}
                                  className="flex items-center justify-between gap-2 text-xs"
                                >
                                  <span className="font-bold text-char">{tk.stationName}</span>
                                  <div className="flex items-center gap-1.5">
                                    {tk.status === 'NEW' && (
                                      <button
                                        type="button"
                                        disabled={isPending}
                                        onClick={() => handleSoloTicketStatus(tk.id, 'PREPARING')}
                                        className="rounded-lg bg-saffron text-char px-2.5 py-1 text-[11px] font-extrabold cursor-pointer"
                                      >
                                        Preparing
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={isPending}
                                      onClick={() => handleSoloTicketStatus(tk.id, 'READY')}
                                      className="rounded-lg bg-herb text-cream px-2.5 py-1 text-[11px] font-extrabold cursor-pointer"
                                    >
                                      Ready
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}

                        {/* Items summary */}
                        <ul className="text-xs space-y-1 border-t border-border-warm/60 pt-2">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex justify-between gap-2">
                              <span>
                                <strong className="font-mono">{item.quantity}×</strong>{' '}
                                {item.productName}{' '}
                                {item.variantName !== 'Regular' && item.variantName !== 'Standard'
                                  ? `(${item.variantName})`
                                  : ''}
                              </span>
                              <span className="text-smoke shrink-0">{item.stationName}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-warm">
                        {staff.canMarkAllReady && (
                          <button
                            type="button"
                            onClick={() => openMarkAllModal(order)}
                            className="flex-1 rounded-xl bg-herb hover:brightness-110 text-cream py-2 px-3 text-xs font-extrabold transition-all cursor-pointer"
                          >
                            Mark All Ready
                          </button>
                        )}
                        {staff.canTakePayment && balance > 0 && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(order)}
                            className="rounded-xl bg-char hover:bg-char-soft text-cream py-2 px-3 text-xs font-bold cursor-pointer"
                          >
                            Pay {formatAUD(balance)}
                          </button>
                        )}
                        {staff.canCancel && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelTarget(order);
                              setCancelReason('');
                            }}
                            className="rounded-xl border border-chilli/30 text-chilli hover:bg-chilli/10 py-2 px-2.5 text-xs font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: READY */}
          {boardTab === 'ready' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.orders.ready.length === 0 ? (
                <EmptyBoardState text="No orders waiting at the pass." />
              ) : (
                data.orders.ready.map((order) => {
                  const badge = getFulfilmentBadge(order);
                  const balance = Math.max(0, order.totalCents - order.amountPaidCents);
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl bg-white border-2 border-herb shadow-md p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-herb text-cream px-2 py-0.5 text-[11px] font-extrabold uppercase">
                                <CheckCircle2 className="h-3 w-3" /> READY
                              </span>
                              <span className="font-mono text-lg font-extrabold text-char tabular-nums">
                                {order.number}
                              </span>
                              <span className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-xs text-smoke mt-1">
                              {order.customerName}
                              {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-extrabold tabular-nums">
                              {formatAUD(order.totalCents)}
                            </p>
                            <span
                              className={`text-[10px] font-extrabold uppercase ${
                                balance === 0 ? 'text-herb' : 'text-ember'
                              }`}
                            >
                              {balance === 0 ? 'PAID' : `DUE ${formatAUD(balance)}`}
                            </span>
                          </div>
                        </div>

                        {order.fulfilment === 'DELIVERY' && order.deliveryAddress && (
                          <p className="inline-flex items-center gap-1.5 text-xs bg-cream-deep/60 rounded-lg px-2.5 py-1.5 text-char">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-ember" />
                            <span>
                              {order.deliveryAddress}
                              {order.deliverySuburb ? `, ${order.deliverySuburb}` : ''}{' '}
                              {order.deliveryPostcode ?? ''}
                            </span>
                          </p>
                        )}

                        <ul className="text-xs space-y-1 border-t border-border-warm/60 pt-2">
                          {order.items.map((item) => (
                            <li key={item.id}>
                              <strong className="font-mono">{item.quantity}×</strong>{' '}
                              {item.productName}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-warm">
                        {order.fulfilment === 'DINE_IN' && staff.canServe && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleHandoff(order, 'SERVED')}
                            className="flex-1 rounded-xl bg-herb hover:brightness-110 text-cream py-2.5 px-3 text-xs font-extrabold cursor-pointer"
                          >
                            Mark Served (Table {order.tableNumber})
                          </button>
                        )}

                        {order.fulfilment === 'PICKUP' && staff.canDispatch && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleHandoff(order, 'COLLECTED')}
                            className="flex-1 rounded-xl bg-herb hover:brightness-110 text-cream py-2.5 px-3 text-xs font-extrabold cursor-pointer"
                          >
                            Mark Collected
                          </button>
                        )}

                        {order.fulfilment === 'DELIVERY' && staff.canDispatch && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setDispatchOrder(order);
                              setDriverNameInput(order.driverName || '');
                            }}
                            className="flex-1 rounded-xl bg-ember hover:bg-ember-dark text-cream py-2.5 px-3 text-xs font-extrabold cursor-pointer"
                          >
                            Dispatch Driver
                          </button>
                        )}

                        {staff.canTakePayment && balance > 0 && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(order)}
                            className="rounded-xl bg-char hover:bg-char-soft text-cream py-2.5 px-3 text-xs font-bold cursor-pointer"
                          >
                            Take Payment
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: SERVED – AWAITING PAYMENT */}
          {boardTab === 'served' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.orders.served.length === 0 ? (
                <EmptyBoardState text="No served dine-in tables awaiting payment." />
              ) : (
                data.orders.served.map((order) => {
                  const balance = Math.max(0, order.totalCents - order.amountPaidCents);
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl bg-white border-2 border-saffron shadow-sm p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg font-extrabold text-char tabular-nums">
                                {order.number}
                              </span>
                              <span className="rounded-lg bg-saffron/30 text-char px-2 py-0.5 text-xs font-extrabold">
                                TABLE {order.tableNumber || '?'}
                              </span>
                              <span className="rounded-md bg-cream-deep px-2 py-0.5 text-[11px] font-bold text-smoke">
                                Round {order.currentRound}
                              </span>
                            </div>
                            <p className="text-xs text-smoke mt-1">{order.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-smoke">Balance Due</p>
                            <p className="font-mono text-lg font-extrabold text-ember tabular-nums">
                              {formatAUD(balance)}
                            </p>
                          </div>
                        </div>

                        <ul className="text-xs space-y-1 border-t border-border-warm/60 pt-2">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex justify-between gap-2">
                              <span>
                                <strong className="font-mono">{item.quantity}×</strong>{' '}
                                {item.productName}
                                {item.round > 1 && (
                                  <span className="ml-1 text-[10px] font-bold text-ember">
                                    R{item.round}
                                  </span>
                                )}
                              </span>
                              <span className="font-mono tabular-nums text-smoke">
                                {formatAUD(item.lineTotalCents)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border-warm">
                        {staff.canTakePayment && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(order)}
                            className="flex-1 rounded-xl bg-herb hover:brightness-110 text-cream py-2.5 px-3 text-xs font-extrabold cursor-pointer"
                          >
                            Take Payment ({formatAUD(balance)})
                          </button>
                        )}
                        {staff.canCreateOrder && (
                          <button
                            type="button"
                            onClick={() => {
                              setRoundOrder(order);
                              setRoundItems([]);
                            }}
                            className="rounded-xl bg-char hover:bg-char-soft text-cream py-2.5 px-3 text-xs font-extrabold cursor-pointer"
                          >
                            + Add Round {order.currentRound + 1}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: OUT FOR DELIVERY */}
          {boardTab === 'delivery' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.orders.delivery.length === 0 ? (
                <EmptyBoardState text="No orders currently out for delivery." />
              ) : (
                data.orders.delivery.map((order) => {
                  const balance = Math.max(0, order.totalCents - order.amountPaidCents);
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl bg-white border border-border-warm shadow-sm p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg font-extrabold text-char tabular-nums">
                                {order.number}
                              </span>
                              <span className="rounded-lg bg-ember/15 text-ember px-2 py-0.5 text-[11px] font-extrabold">
                                OUT FOR DELIVERY
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-char mt-1">
                              Driver: {order.driverName || 'Store Driver'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-extrabold tabular-nums">
                              {formatAUD(order.totalCents)}
                            </p>
                            <span
                              className={`text-[10px] font-extrabold uppercase ${
                                balance === 0 ? 'text-herb' : 'text-ember'
                              }`}
                            >
                              {balance === 0 ? 'PREPAID' : `COD ${formatAUD(balance)}`}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-xl bg-cream/70 p-2.5 text-xs space-y-0.5">
                          <p className="font-bold text-char">{order.customerName}</p>
                          {order.customerPhone && <p className="text-smoke">{order.customerPhone}</p>}
                          <p className="text-char">
                            {order.deliveryAddress}
                            {order.deliverySuburb ? `, ${order.deliverySuburb}` : ''}{' '}
                            {order.deliveryPostcode ?? ''}
                          </p>
                        </div>
                      </div>

                      {staff.canTakePayment && balance > 0 && (
                        <button
                          type="button"
                          onClick={() => openPaymentModal(order)}
                          className="w-full rounded-xl bg-herb hover:brightness-110 text-cream py-2.5 px-3 text-xs font-extrabold cursor-pointer"
                        >
                          Record COD Payment ({formatAUD(balance)})
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 5: SCHEDULED */}
          {boardTab === 'scheduled' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.orders.scheduled.length === 0 ? (
                <EmptyBoardState text="No scheduled pre-orders queued." />
              ) : (
                data.orders.scheduled.map((order) => {
                  const badge = getFulfilmentBadge(order);
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl bg-white border border-border-warm shadow-sm p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg font-extrabold text-char tabular-nums">
                                {order.number}
                              </span>
                              <span className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-xs text-smoke mt-1">{order.customerName}</p>
                          </div>
                          <span className="font-mono text-sm font-extrabold tabular-nums">
                            {formatAUD(order.totalCents)}
                          </span>
                        </div>

                        <div className="rounded-xl bg-saffron/15 border border-saffron/40 p-2.5 text-xs space-y-0.5">
                          <p className="font-bold text-char flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5 text-ember" />
                            Scheduled:{' '}
                            {order.scheduledFor
                              ? formatStoreDateTime(order.scheduledFor, data.store.timezone)
                              : '—'}
                          </p>
                          <p className="text-smoke">
                            Auto-releases to kitchen:{' '}
                            {formatStoreTime(order.releaseAt, data.store.timezone)}
                          </p>
                        </div>

                        <ul className="text-xs space-y-1">
                          {order.items.map((item) => (
                            <li key={item.id}>
                              <strong className="font-mono">{item.quantity}×</strong>{' '}
                              {item.productName}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border-warm">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleFireScheduled(order)}
                          className="flex-1 rounded-xl bg-ember hover:bg-ember-dark text-cream py-2.5 px-3 text-xs font-extrabold cursor-pointer"
                        >
                          Fire to Kitchen Now
                        </button>
                        {staff.canCancel && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelTarget(order);
                              setCancelReason('');
                            }}
                            className="rounded-xl border border-chilli/30 text-chilli hover:bg-chilli/10 py-2.5 px-3 text-xs font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 6: ORDER HISTORY */}
          {boardTab === 'history' && (
            <div className="rounded-2xl bg-white border border-border-warm shadow-sm overflow-hidden">
              {data.orders.history.length === 0 ? (
                <div className="p-10 text-center text-sm text-smoke">
                  No completed or cancelled orders yet.
                </div>
              ) : (
                <div className="divide-y divide-border-warm">
                  {data.orders.history.map((order) => {
                    const expanded = expandedHistoryId === order.id;
                    const badge = getFulfilmentBadge(order);
                    return (
                      <div key={order.id} className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-sm font-extrabold text-char tabular-nums">
                              {order.number}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                                order.status === 'COMPLETED'
                                  ? 'bg-herb/15 text-herb'
                                  : 'bg-chilli/15 text-chilli'
                              }`}
                            >
                              {order.status}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${badge.cls}`}>
                              {badge.label}
                            </span>
                            <span className="text-xs font-semibold text-char">
                              {order.customerName}
                            </span>
                            <span className="text-xs text-smoke">
                              {formatStoreDateTime(order.createdAt, data.store.timezone)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-extrabold text-char tabular-nums">
                              {formatAUD(order.totalCents)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setReceiptOrder(order)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border-warm bg-cream hover:bg-cream-deep px-2.5 py-1.5 text-xs font-bold text-char cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              80mm Invoice
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedHistoryId(expanded ? null : order.id)
                              }
                              className="rounded-lg border border-border-warm p-1.5 text-smoke hover:text-char cursor-pointer"
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div className="mt-4 pt-4 border-t border-border-warm grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            {/* Items */}
                            <div>
                              <h4 className="font-extrabold uppercase tracking-wider text-smoke mb-2">
                                Items
                              </h4>
                              <ul className="space-y-1.5">
                                {order.items.map((item) => (
                                  <li key={item.id} className="flex justify-between gap-2">
                                    <span>
                                      <strong className="font-mono">{item.quantity}×</strong>{' '}
                                      {item.productName} ({item.variantName})
                                    </span>
                                    <span className="font-mono tabular-nums">
                                      {formatAUD(item.lineTotalCents)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              {order.cancelReason && (
                                <p className="mt-2 text-chilli font-bold">
                                  Cancel reason: {order.cancelReason}
                                </p>
                              )}
                            </div>

                            {/* Payments */}
                            <div>
                              <h4 className="font-extrabold uppercase tracking-wider text-smoke mb-2">
                                Payments
                              </h4>
                              {order.payments.length === 0 ? (
                                <p className="text-smoke">No payments recorded.</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {order.payments.map((p) => (
                                    <li
                                      key={p.id}
                                      className="rounded-lg bg-cream/70 p-2 space-y-0.5"
                                    >
                                      <div className="flex justify-between font-bold">
                                        <span>{p.method}</span>
                                        <span className="font-mono tabular-nums">
                                          {formatAUD(p.amountCents)}
                                        </span>
                                      </div>
                                      {p.tenderedCents !== null && (
                                        <p className="text-[11px] text-smoke">
                                          Tendered {formatAUD(p.tenderedCents)} · Change{' '}
                                          {formatAUD(p.changeCents ?? 0)}
                                        </p>
                                      )}
                                      {p.reference && (
                                        <p className="text-[11px] text-smoke font-mono">
                                          Ref: {p.reference}
                                        </p>
                                      )}
                                      {p.takenByName && (
                                        <p className="text-[11px] text-smoke">
                                          By {p.takenByName}
                                        </p>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {/* Status Timeline */}
                            <div>
                              <h4 className="font-extrabold uppercase tracking-wider text-smoke mb-2">
                                Status Timeline
                              </h4>
                              <ol className="space-y-1.5 border-l-2 border-border-warm pl-3">
                                {order.statusHistory.map((h) => (
                                  <li key={h.id}>
                                    <p className="font-bold text-char">
                                      {h.toState.replaceAll('_', ' ')}{' '}
                                      <span className="font-normal text-smoke">
                                        · {formatStoreTime(h.createdAt, data.store.timezone)}
                                      </span>
                                    </p>
                                    <p className="text-[11px] text-smoke">
                                      {h.actorName}: {h.note}
                                    </p>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* =========================================================
          MODALS
         ========================================================= */}

      {/* 1. Product Variant & Modifier Configurator Modal */}
      {configProduct && configVariant && (
        <ModalShell
          title={configProduct.name}
          onClose={() => setConfigProduct(null)}
        >
          <div className="space-y-4">
            {/* Variants */}
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-smoke mb-2">
                Select Size / Option
              </p>
              <div className="grid grid-cols-2 gap-2">
                {configProduct.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={v.soldOut}
                    onClick={() => setConfigVariant(v)}
                    className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                      configVariant.id === v.id
                        ? 'border-ember bg-ember/10'
                        : 'border-border-warm bg-white hover:bg-cream'
                    } disabled:opacity-50`}
                  >
                    <p className="text-xs font-bold text-char">{v.name}</p>
                    <p className="font-mono text-xs font-extrabold text-ember tabular-nums mt-0.5">
                      {formatAUD(v.priceCents)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Modifier Groups */}
            {configProduct.modifierGroups.map((grp) => {
              const selected = configMods[grp.id] ?? [];
              return (
                <div key={grp.id}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-smoke">
                      {grp.name}
                    </p>
                    <span className="text-[11px] text-smoke">
                      {grp.required ? 'Required' : 'Optional'} · Max {grp.maxSelect}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {grp.options.map((opt) => {
                      const active = selected.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={opt.soldOut}
                          onClick={() => toggleConfigMod(grp.id, opt.id, grp.maxSelect)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                            active
                              ? 'bg-char text-cream border-char'
                              : 'bg-white text-char border-border-warm hover:bg-cream-deep'
                          } disabled:opacity-40`}
                        >
                          {opt.name}
                          {opt.priceDeltaCents > 0 && (
                            <span className="ml-1 font-mono text-[11px] opacity-80">
                              +{formatAUD(opt.priceDeltaCents)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Qty & Item Notes */}
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-border-warm bg-cream px-2 py-1">
                <button
                  type="button"
                  onClick={() => setConfigQty((q) => Math.max(1, q - 1))}
                  className="p-1 cursor-pointer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-mono text-sm font-extrabold w-6 text-center tabular-nums">
                  {configQty}
                </span>
                <button
                  type="button"
                  onClick={() => setConfigQty((q) => q + 1)}
                  className="p-1 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <input
                type="text"
                value={configNotes}
                onChange={(e) => setConfigNotes(e.target.value)}
                placeholder="Item note (e.g. extra crispy, no onion)…"
                className="flex-1 rounded-xl border border-border-warm bg-white px-3 py-2 text-xs text-char"
              />
            </div>

            <button
              type="button"
              onClick={confirmConfiguredItem}
              className="w-full rounded-xl bg-ember hover:bg-ember-dark text-cream font-bold py-3 text-sm cursor-pointer"
            >
              Add to {roundOrder ? `Round ${roundOrder.currentRound + 1}` : 'Order'}
            </button>
          </div>
        </ModalShell>
      )}

      {/* 2. Mark All Ready Checklist Modal */}
      {markAllOrder && (
        <ModalShell
          title={`Mark All Ready · ${markAllOrder.number}`}
          onClose={() => setMarkAllOrder(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-smoke">
              Confirm all kitchen stations below are plated and ready at the pass:
            </p>
            <div className="space-y-2">
              {markAllOrder.tickets.map((tk) => (
                <label
                  key={tk.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border-warm bg-cream/50 p-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={!!markAllChecked[tk.id]}
                      onChange={(e) =>
                        setMarkAllChecked((prev) => ({ ...prev, [tk.id]: e.target.checked }))
                      }
                      className="h-4 w-4 accent-herb"
                    />
                    <span className="text-sm font-bold text-char">{tk.stationName}</span>
                  </div>
                  <span className="text-xs font-bold text-smoke">{tk.status}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMarkAllOrder(null)}
                className="flex-1 rounded-xl border border-border-warm py-2.5 text-xs font-bold text-char cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmMarkAllReady}
                className="flex-1 rounded-xl bg-herb hover:brightness-110 text-cream py-2.5 text-xs font-extrabold cursor-pointer"
              >
                {isPending ? 'Updating…' : 'Confirm All Ready'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* 3. Take Payment Modal (Cash / EFTPOS / Split) */}
      {paymentOrder && (
        <ModalShell
          title={`Take Payment · ${paymentOrder.number}`}
          onClose={() => setPaymentOrder(null)}
        >
          {(() => {
            const balanceDue = Math.max(0, paymentOrder.totalCents - paymentOrder.amountPaidCents);
            return (
              <div className="space-y-4">
                <div className="rounded-xl bg-char text-cream p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-cream/60">
                      Balance Due
                    </p>
                    <p className="font-mono text-2xl font-extrabold tabular-nums text-saffron">
                      {formatAUD(balanceDue)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-cream/75">
                    <p>Total: {formatAUD(paymentOrder.totalCents)}</p>
                    <p>Paid: {formatAUD(paymentOrder.amountPaidCents)}</p>
                  </div>
                </div>

                {/* Method selector */}
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'CASH', label: 'Cash', icon: Banknote },
                      { key: 'CARD_EFTPOS', label: 'Card EFTPOS', icon: CreditCard },
                      { key: 'OTHER', label: 'Other', icon: Wallet },
                    ] as const
                  ).map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setPayMethod(m.key)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold border cursor-pointer ${
                          payMethod === m.key
                            ? 'bg-ember text-cream border-ember'
                            : 'bg-white text-char border-border-warm'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                {/* Amount (supports Split Payment) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-smoke">
                      Payment Amount (AUD) — edit for split payment
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const half = Math.ceil(balanceDue / 2);
                        setPayAmountDollars((half / 100).toFixed(2));
                        setPayTenderedDollars((half / 100).toFixed(2));
                      }}
                      className="text-[11px] font-bold text-ember hover:underline cursor-pointer"
                    >
                      Split 50/50
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(balanceDue / 100).toFixed(2)}
                    value={payAmountDollars}
                    onChange={(e) => {
                      setPayAmountDollars(e.target.value);
                      if (payMethod === 'CASH') setPayTenderedDollars(e.target.value);
                    }}
                    className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 font-mono text-lg font-extrabold text-char"
                  />
                </div>

                {payMethod === 'CASH' ? (
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-smoke">
                      Cash Tendered (AUD)
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPayTenderedDollars(payAmountDollars)}
                        className="rounded-lg bg-cream-deep hover:bg-border-warm py-2 text-xs font-extrabold text-char cursor-pointer"
                      >
                        Exact
                      </button>
                      {[20, 50, 100].map((note) => (
                        <button
                          key={note}
                          type="button"
                          onClick={() => setPayTenderedDollars(note.toFixed(2))}
                          className="rounded-lg bg-cream-deep hover:bg-border-warm py-2 font-mono text-xs font-extrabold text-char cursor-pointer"
                        >
                          ${note}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={payTenderedDollars}
                      onChange={(e) => setPayTenderedDollars(e.target.value)}
                      className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2 font-mono text-base font-bold text-char"
                    />
                    <div className="rounded-xl bg-herb/10 border border-herb/30 px-3.5 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-herb">Change Due</span>
                      <span className="font-mono text-lg font-extrabold text-herb tabular-nums">
                        {formatAUD(cashChangePreview)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-smoke mb-1">
                      Terminal / Reference # (optional)
                    </label>
                    <input
                      type="text"
                      value={payReference}
                      onChange={(e) => setPayReference(e.target.value)}
                      placeholder="e.g. EFTPOS-4821"
                      className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2 text-sm text-char"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleRecordPayment}
                  className="w-full rounded-xl bg-herb hover:brightness-110 disabled:opacity-50 text-cream font-display text-lg font-extrabold py-3 cursor-pointer"
                >
                  {isPending
                    ? 'Recording…'
                    : `Record ${payMethod.replace('_', ' ')} · ${formatAUD(payAmountCentsPreview)}`}
                </button>
              </div>
            );
          })()}
        </ModalShell>
      )}

      {/* 4. Dispatch Driver Modal */}
      {dispatchOrder && (
        <ModalShell
          title={`Dispatch Delivery · ${dispatchOrder.number}`}
          onClose={() => setDispatchOrder(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-cream p-3 text-xs space-y-1">
              <p className="font-bold text-char">{dispatchOrder.customerName}</p>
              <p className="text-smoke">
                {dispatchOrder.deliveryAddress}
                {dispatchOrder.deliverySuburb ? `, ${dispatchOrder.deliverySuburb}` : ''}{' '}
                {dispatchOrder.deliveryPostcode ?? ''}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-smoke mb-1">
                Driver Name
              </label>
              <input
                type="text"
                value={driverNameInput}
                onChange={(e) => setDriverNameInput(e.target.value)}
                placeholder="e.g. Sam / Uber Direct"
                className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char"
              />
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleHandoff(dispatchOrder, 'OUT_FOR_DELIVERY', driverNameInput)}
              className="w-full rounded-xl bg-ember hover:bg-ember-dark text-cream font-extrabold py-3 text-sm cursor-pointer"
            >
              {isPending ? 'Dispatching…' : 'Confirm Dispatch'}
            </button>
          </div>
        </ModalShell>
      )}

      {/* 5. Add Dine-In Round Modal */}
      {roundOrder && (
        <ModalShell
          title={`Add Round ${roundOrder.currentRound + 1} · ${roundOrder.number} (Table ${roundOrder.tableNumber})`}
          onClose={() => {
            setRoundOrder(null);
            setRoundItems([]);
          }}
          wide
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-smoke">
                Tap items to add
              </p>
              <div className="grid grid-cols-2 gap-2">
                {data.categories
                  .flatMap((c) => c.products)
                  .filter((p) => !p.soldOut)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductTap(p, true)}
                      className="rounded-xl border border-border-warm bg-white hover:border-ember p-2.5 text-left cursor-pointer"
                    >
                      <p className="text-xs font-bold text-char leading-snug">{p.name}</p>
                      <p className="font-mono text-[11px] font-bold text-ember mt-0.5">
                        {formatAUD(Math.min(...p.variants.map((v) => v.priceCents)))}
                      </p>
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-border-warm bg-cream/50 p-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-smoke mb-2">
                  New Round Items ({roundItems.length})
                </p>
                {roundItems.length === 0 ? (
                  <p className="text-xs text-smoke py-6 text-center">
                    No items selected yet.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {roundItems.map((l) => (
                      <li key={l.uid} className="flex items-center justify-between gap-2">
                        <span>
                          <strong className="font-mono">{l.quantity}×</strong> {l.productName}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRoundItems((prev) => prev.filter((x) => x.uid !== l.uid))
                          }
                          className="text-chilli cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                disabled={isPending || roundItems.length === 0}
                onClick={handleSubmitRound}
                className="mt-4 w-full rounded-xl bg-ember hover:bg-ember-dark disabled:opacity-50 text-cream font-extrabold py-2.5 text-xs cursor-pointer"
              >
                {isPending ? 'Sending…' : `Send Round ${roundOrder.currentRound + 1} to Kitchen`}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* 6. Cancel Order Modal */}
      {cancelTarget && (
        <ModalShell
          title={`Cancel Order · ${cancelTarget.number}`}
          onClose={() => setCancelTarget(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-smoke">
              Cancelling will release reserved inventory stock and log this action in the audit trail.
            </p>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (e.g. Customer changed mind, duplicate order)"
              className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 text-sm text-char"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="flex-1 rounded-xl border border-border-warm py-2.5 text-xs font-bold cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmCancel}
                className="flex-1 rounded-xl bg-chilli text-cream py-2.5 text-xs font-extrabold cursor-pointer"
              >
                {isPending ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* 7. Cash Drawer Open / Close Modal */}
      {cashModalOpen && (
        <ModalShell
          title={data.activeCashSession ? 'Close Cash Drawer' : 'Open Cash Drawer'}
          onClose={() => setCashModalOpen(false)}
        >
          {data.activeCashSession ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-cream p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-smoke">Opened by</span>
                  <span className="font-bold">{data.activeCashSession.openedByName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-smoke">Opening Float</span>
                  <span className="font-mono font-bold">
                    {formatAUD(data.activeCashSession.openingFloatCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-smoke">Cash Sales</span>
                  <span className="font-mono font-bold text-herb">
                    {formatAUD(data.activeCashSession.cashSalesCents)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border-warm pt-1.5 text-sm font-extrabold">
                  <span>Expected Cash</span>
                  <span className="font-mono">
                    {formatAUD(data.activeCashSession.expectedCashCents)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-smoke mb-1">
                  Counted Cash in Drawer (AUD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={countedCashDollars}
                  onChange={(e) => setCountedCashDollars(e.target.value)}
                  className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 font-mono text-lg font-extrabold"
                />
              </div>

              <input
                type="text"
                value={cashNotes}
                onChange={(e) => setCashNotes(e.target.value)}
                placeholder="Closing notes (optional)"
                className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2 text-xs"
              />

              <button
                type="button"
                disabled={isPending}
                onClick={handleCloseCashDrawer}
                className="w-full rounded-xl bg-char hover:bg-char-soft text-cream py-3 text-sm font-extrabold cursor-pointer"
              >
                {isPending ? 'Closing…' : 'Close Drawer & Record Variance'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-smoke mb-1">
                  Opening Float (AUD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={floatDollars}
                  onChange={(e) => setFloatDollars(e.target.value)}
                  className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 font-mono text-lg font-extrabold"
                />
              </div>
              <input
                type="text"
                value={cashNotes}
                onChange={(e) => setCashNotes(e.target.value)}
                placeholder="Opening notes (optional)"
                className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2 text-xs"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={handleOpenCashDrawer}
                className="w-full rounded-xl bg-herb text-cream py-3 text-sm font-extrabold cursor-pointer"
              >
                {isPending ? 'Opening…' : 'Open Cash Drawer Session'}
              </button>
            </div>
          )}
        </ModalShell>
      )}

      {/* 8. Pause Online Modal */}
      {pauseModalOpen && (
        <ModalShell
          title="Pause Online ASAP Ordering"
          onClose={() => setPauseModalOpen(false)}
        >
          <div className="space-y-4">
            <p className="text-xs text-smoke">
              Customers can still browse the menu and schedule pre-orders, while ASAP web orders will be paused.
            </p>
            <textarea
              rows={3}
              value={pauseMessageInput}
              onChange={(e) => setPauseMessageInput(e.target.value)}
              className="w-full rounded-xl border border-border-warm bg-white p-3 text-xs text-char"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPauseModalOpen(false)}
                className="flex-1 rounded-xl border border-border-warm py-2.5 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSaveOnlinePause(true)}
                className="flex-1 rounded-xl bg-chilli text-cream py-2.5 text-xs font-extrabold cursor-pointer"
              >
                Pause Online Now
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* 9. Print 80mm AU Tax Invoice Modal */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="no-print flex items-center justify-between px-4 py-3 border-b border-border-warm bg-cream">
              <span className="text-xs font-extrabold uppercase tracking-wider text-char">
                80mm Tax Invoice Preview
              </span>
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="text-smoke hover:text-char cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="receipt-80mm p-5 font-mono text-xs text-char space-y-3">
              <div className="text-center border-b border-dashed border-char/40 pb-3">
                <p className="text-base font-extrabold">{data.store.name}</p>
                <p className="text-[11px]">{data.store.address}</p>
                <p className="text-[11px]">{data.store.phone}</p>
                {data.receiptTemplate.showAbn && data.store.abn && (
                  <p className="text-[11px] font-bold mt-1">ABN {data.store.abn}</p>
                )}
                <p className="text-xs font-extrabold mt-1.5 tracking-widest">
                  {data.receiptTemplate.headerText}
                </p>
              </div>

              <div className="space-y-0.5 text-[11px] border-b border-dashed border-char/40 pb-2">
                <div className="flex justify-between">
                  <span>Order:</span>
                  <span className="font-bold">{receiptOrder.number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{formatStoreDateTime(receiptOrder.createdAt, data.store.timezone)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span>
                    {receiptOrder.fulfilment}
                    {receiptOrder.tableNumber ? ` (T${receiptOrder.tableNumber})` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{receiptOrder.customerName}</span>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-char/40 pb-2">
                {receiptOrder.items.map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between gap-2">
                      <span>
                        {item.quantity}x {item.productName}
                      </span>
                      <span className="tabular-nums">{formatAUD(item.lineTotalCents)}</span>
                    </div>
                    {item.modifiers.length > 0 && (
                      <p className="text-[10px] text-smoke pl-3">
                        {item.modifiers.map((m) => m.optionName).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-b border-dashed border-char/40 pb-2 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatAUD(receiptOrder.subtotalCents)}</span>
                </div>
                {receiptOrder.discountCents > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatAUD(receiptOrder.discountCents)}</span>
                  </div>
                )}
                {receiptOrder.deliveryFeeCents > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span className="tabular-nums">{formatAUD(receiptOrder.deliveryFeeCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold pt-1">
                  <span>TOTAL (AUD)</span>
                  <span className="tabular-nums">{formatAUD(receiptOrder.totalCents)}</span>
                </div>
                {data.receiptTemplate.showGstLine && (
                  <div className="flex justify-between text-[10px]">
                    <span>Includes GST (10%)</span>
                    <span className="tabular-nums">{formatAUD(receiptOrder.gstCents)}</span>
                  </div>
                )}
              </div>

              {receiptOrder.payments.length > 0 && (
                <div className="space-y-1 border-b border-dashed border-char/40 pb-2 text-[11px]">
                  {receiptOrder.payments.map((p) => (
                    <div key={p.id} className="space-y-0.5">
                      <div className="flex justify-between">
                        <span>Paid ({p.method})</span>
                        <span className="tabular-nums">{formatAUD(p.amountCents)}</span>
                      </div>
                      {p.tenderedCents !== null && (
                        <div className="flex justify-between text-[10px]">
                          <span>Tendered / Change</span>
                          <span>
                            {formatAUD(p.tenderedCents)} / {formatAUD(p.changeCents ?? 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-center text-[11px] pt-1">{data.receiptTemplate.footerText}</p>
            </div>

            <div className="no-print p-3 bg-cream border-t border-border-warm flex gap-2">
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="flex-1 rounded-xl border border-border-warm bg-white py-2.5 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-char text-cream py-2.5 text-xs font-extrabold cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyBoardState({ text }: { text: string }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-border-warm bg-white/70 p-10 text-center">
      <Check className="h-8 w-8 text-herb mx-auto mb-2" />
      <p className="text-sm font-semibold text-smoke">{text}</p>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="no-print fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto">
      <div
        className={`w-full ${
          wide ? 'max-w-2xl' : 'max-w-md'
        } rounded-2xl bg-white border border-border-warm shadow-2xl overflow-hidden`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-warm bg-cream">
          <h3 className="font-display text-lg font-extrabold text-char">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-smoke hover:text-char cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
