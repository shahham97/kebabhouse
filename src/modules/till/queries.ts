import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { CACHE_TAGS } from '@/lib/cache';

export interface TillModifierSnapshot {
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaCents: number;
}

export interface TillOrderItemDTO {
  id: string;
  productId: string | null;
  variantId: string | null;
  stationId: string;
  stationName: string;
  productName: string;
  variantName: string;
  modifiers: TillModifierSnapshot[];
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  taxCode: string;
  notes: string;
  round: number;
  ticketId: string | null;
}

export interface TillTicketDTO {
  id: string;
  stationId: string;
  stationCode: string;
  stationName: string;
  stationColor: string;
  round: number;
  status: string;
  releaseAt: string;
  preparingAt: string | null;
  readyAt: string | null;
  bumpedFromTill: boolean;
}

export interface TillPaymentDTO {
  id: string;
  method: string;
  amountCents: number;
  tenderedCents: number | null;
  changeCents: number | null;
  reference: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  status: string;
  takenByName: string | null;
  createdAt: string;
}

export interface TillStatusHistoryDTO {
  id: string;
  fromState: string | null;
  toState: string;
  actorType: string;
  actorName: string;
  note: string;
  createdAt: string;
}

export interface TillOrderDTO {
  id: string;
  publicId: string;
  number: string;
  channel: string;
  fulfilment: string;
  tableNumber: string | null;
  covers: number | null;
  timing: string;
  scheduledFor: string | null;
  releaseAt: string;
  promisedAt: string;
  status: string;
  paymentStatus: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string | null;
  deliverySuburb: string | null;
  deliveryPostcode: string | null;
  driverName: string | null;
  notes: string;
  subtotalCents: number;
  discountCents: number;
  discountReason: string | null;
  couponCode: string | null;
  deliveryFeeCents: number;
  surchargeCents: number;
  gstCents: number;
  totalCents: number;
  amountPaidCents: number;
  currentRound: number;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: TillOrderItemDTO[];
  tickets: TillTicketDTO[];
  payments: TillPaymentDTO[];
  statusHistory: TillStatusHistoryDTO[];
}

export interface TillModifierOptionDTO {
  id: string;
  name: string;
  priceDeltaCents: number;
  isDefault: boolean;
  soldOut: boolean;
}

export interface TillModifierGroupDTO {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  options: TillModifierOptionDTO[];
}

export interface TillVariantDTO {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  prepMinutes: number;
  soldOut: boolean;
}

export interface TillProductDTO {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  soldOut: boolean;
  isBestSeller: boolean;
  spicyLevel: number;
  variants: TillVariantDTO[];
  modifierGroups: TillModifierGroupDTO[];
}

export interface TillCategoryDTO {
  id: string;
  name: string;
  slug: string;
  products: TillProductDTO[];
}

export interface TillCashSessionDTO {
  id: string;
  openedByName: string;
  openingFloatCents: number;
  cashSalesCents: number;
  expectedCashCents: number;
  openedAt: string;
  notes: string;
}

export interface TillWorkspaceData {
  store: {
    id: string;
    name: string;
    abn: string;
    phone: string;
    address: string;
    timezone: string;
    soloMode: boolean;
    onlinePaused: boolean;
    pauseMessage: string | null;
    gstRatePct: number;
    gstRegistered: boolean;
  };
  receiptTemplate: {
    headerText: string;
    footerText: string;
    showAbn: boolean;
    showGstLine: boolean;
  };
  stations: Array<{
    id: string;
    code: string;
    name: string;
    color: string;
    sortOrder: number;
    autoComplete: boolean;
  }>;
  deliveryZones: Array<{
    id: string;
    name: string;
    postcodes: string;
    feeCents: number;
    minOrderCents: number;
  }>;
  categories: TillCategoryDTO[];
  activeCashSession: TillCashSessionDTO | null;
  orders: {
    kitchen: TillOrderDTO[];
    ready: TillOrderDTO[];
    served: TillOrderDTO[];
    delivery: TillOrderDTO[];
    scheduled: TillOrderDTO[];
    history: TillOrderDTO[];
  };
}

function parseModifiers(raw: unknown): TillModifierSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m) => ({
      groupName: String(m.groupName ?? ''),
      optionId: String(m.optionId ?? ''),
      optionName: String(m.optionName ?? ''),
      priceDeltaCents: Number(m.priceDeltaCents ?? 0),
    }));
}

const orderInclude = {
  items: {
    orderBy: [{ round: 'asc' as const }, { id: 'asc' as const }],
  },
  tickets: {
    include: { station: true },
    orderBy: [{ round: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  payments: {
    include: { takenBy: { select: { name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
  },
};

function mapOrder(o: {
  id: string;
  publicId: string;
  number: string;
  channel: string;
  fulfilment: string;
  tableNumber: string | null;
  covers: number | null;
  timing: string;
  scheduledFor: Date | null;
  releaseAt: Date;
  promisedAt: Date;
  status: string;
  paymentStatus: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string | null;
  deliverySuburb: string | null;
  deliveryPostcode: string | null;
  driverName: string | null;
  notes: string;
  subtotalCents: number;
  discountCents: number;
  discountReason: string | null;
  couponCode: string | null;
  deliveryFeeCents: number;
  surchargeCents: number;
  gstCents: number;
  totalCents: number;
  amountPaidCents: number;
  currentRound: number;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    productId: string | null;
    variantId: string | null;
    stationId: string;
    stationName: string;
    productName: string;
    variantName: string;
    modifiersJson: unknown;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    taxCode: string;
    notes: string;
    round: number;
    ticketId: string | null;
  }>;
  tickets: Array<{
    id: string;
    stationId: string;
    round: number;
    status: string;
    releaseAt: Date;
    preparingAt: Date | null;
    readyAt: Date | null;
    bumpedFromTill: boolean;
    station: { code: string; name: string; color: string };
  }>;
  payments: Array<{
    id: string;
    method: string;
    amountCents: number;
    tenderedCents: number | null;
    changeCents: number | null;
    reference: string | null;
    cardBrand: string | null;
    cardLast4: string | null;
    status: string;
    createdAt: Date;
    takenBy: { name: string } | null;
  }>;
  statusHistory: Array<{
    id: string;
    fromState: string | null;
    toState: string;
    actorType: string;
    actorName: string;
    note: string;
    createdAt: Date;
  }>;
}): TillOrderDTO {
  return {
    id: o.id,
    publicId: o.publicId,
    number: o.number,
    channel: o.channel,
    fulfilment: o.fulfilment,
    tableNumber: o.tableNumber,
    covers: o.covers,
    timing: o.timing,
    scheduledFor: o.scheduledFor ? o.scheduledFor.toISOString() : null,
    releaseAt: o.releaseAt.toISOString(),
    promisedAt: o.promisedAt.toISOString(),
    status: o.status,
    paymentStatus: o.paymentStatus,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    deliveryAddress: o.deliveryAddress,
    deliverySuburb: o.deliverySuburb,
    deliveryPostcode: o.deliveryPostcode,
    driverName: o.driverName,
    notes: o.notes,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    discountReason: o.discountReason,
    couponCode: o.couponCode,
    deliveryFeeCents: o.deliveryFeeCents,
    surchargeCents: o.surchargeCents,
    gstCents: o.gstCents,
    totalCents: o.totalCents,
    amountPaidCents: o.amountPaidCents,
    currentRound: o.currentRound,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: o.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      stationId: item.stationId,
      stationName: item.stationName,
      productName: item.productName,
      variantName: item.variantName,
      modifiers: parseModifiers(item.modifiersJson),
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      taxCode: item.taxCode,
      notes: item.notes,
      round: item.round,
      ticketId: item.ticketId,
    })),
    tickets: o.tickets.map((t) => ({
      id: t.id,
      stationId: t.stationId,
      stationCode: t.station.code,
      stationName: t.station.name,
      stationColor: t.station.color,
      round: t.round,
      status: t.status,
      releaseAt: t.releaseAt.toISOString(),
      preparingAt: t.preparingAt ? t.preparingAt.toISOString() : null,
      readyAt: t.readyAt ? t.readyAt.toISOString() : null,
      bumpedFromTill: t.bumpedFromTill,
    })),
    payments: o.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amountCents: p.amountCents,
      tenderedCents: p.tenderedCents,
      changeCents: p.changeCents,
      reference: p.reference,
      cardBrand: p.cardBrand,
      cardLast4: p.cardLast4,
      status: p.status,
      takenByName: p.takenBy?.name ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    statusHistory: o.statusHistory.map((h) => ({
      id: h.id,
      fromState: h.fromState,
      toState: h.toState,
      actorType: h.actorType,
      actorName: h.actorName,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

const getCachedTillStatic = unstable_cache(
  async (storeId: string) => {
    const [receiptTemplate, stations, deliveryZones, categories] = await Promise.all([
      db.receiptTemplate.findFirst({
        where: { storeId, active: true },
        orderBy: { version: 'desc' },
        select: { headerText: true, footerText: true, showAbn: true, showGstLine: true },
      }),
      db.station.findMany({
        where: { storeId, active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, code: true, name: true, color: true, sortOrder: true, autoComplete: true },
      }),
      db.deliveryZone.findMany({
        where: { storeId, active: true },
        orderBy: { feeCents: 'asc' },
        select: { id: true, name: true, postcodes: true, feeCents: true, minOrderCents: true },
      }),
      db.category.findMany({
        where: { storeId },
        orderBy: { sortOrder: 'asc' },
        include: {
          products: {
            where: { active: true, visibility: { in: ['TILL', 'BOTH'] } },
            orderBy: { sortOrder: 'asc' },
            include: {
              variants: {
                where: { active: true },
                orderBy: { sortOrder: 'asc' },
              },
              modifierGroups: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  modifierGroup: {
                    include: {
                      options: {
                        where: { active: true },
                        orderBy: { sortOrder: 'asc' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    return { receiptTemplate, stations, deliveryZones, categories };
  },
  ['till-static-catalogue'],
  { revalidate: 300, tags: [CACHE_TAGS.menu, CACHE_TAGS.stations, CACHE_TAGS.settings] }
);

export async function getTillWorkspaceData(storeId: string): Promise<TillWorkspaceData> {
  const [store, staticData, openCashSession, liveOrders, historyOrders] = await Promise.all([
    db.store.findUniqueOrThrow({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        abn: true,
        phone: true,
        address: true,
        timezone: true,
        soloMode: true,
        onlinePaused: true,
        pauseMessage: true,
        gstRatePct: true,
        gstRegistered: true,
      },
    }),
    getCachedTillStatic(storeId),
    db.cashSession.findFirst({
      where: { storeId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
      include: {
        openedBy: { select: { name: true } },
        payments: {
          where: { method: 'CASH', status: 'SUCCEEDED' },
          select: { amountCents: true },
        },
        movements: {
          select: { kind: true, amountCents: true },
        },
      },
    }),
    db.order.findMany({
      where: {
        storeId,
        status: {
          in: ['IN_KITCHEN', 'PREPARING', 'READY', 'SERVED', 'OUT_FOR_DELIVERY', 'SCHEDULED'],
        },
      },
      include: orderInclude,
      orderBy: [{ promisedAt: 'asc' }, { createdAt: 'asc' }],
    }),
    db.order.findMany({
      where: {
        storeId,
        status: { in: ['COMPLETED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
      },
      include: orderInclude,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
  ]);
  const { receiptTemplate, stations, deliveryZones, categories } = staticData;

  let activeCashSession: TillCashSessionDTO | null = null;
  if (openCashSession) {
    const cashSalesCents = openCashSession.payments.reduce((sum, p) => sum + p.amountCents, 0);
    const movementsNet = openCashSession.movements.reduce(
      (sum, m) => sum + (m.kind === 'IN' ? m.amountCents : -m.amountCents),
      0
    );
    activeCashSession = {
      id: openCashSession.id,
      openedByName: openCashSession.openedBy.name,
      openingFloatCents: openCashSession.openingFloatCents,
      cashSalesCents,
      expectedCashCents: openCashSession.openingFloatCents + cashSalesCents + movementsNet,
      openedAt: openCashSession.openedAt.toISOString(),
      notes: openCashSession.notes,
    };
  }

  const mappedLive = liveOrders.map(mapOrder);
  const mappedHistory = historyOrders.map(mapOrder);

  return {
    store,
    receiptTemplate: receiptTemplate ?? {
      headerText: 'TAX INVOICE',
      footerText: 'Thanks for dining with Star Kebab! Halal certified.',
      showAbn: true,
      showGstLine: true,
    },
    stations,
    deliveryZones,
    categories: categories
      .filter((c) => c.products.length > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        products: c.products.map((p) => ({
          id: p.id,
          categoryId: p.categoryId,
          name: p.name,
          slug: p.slug,
          description: p.description,
          soldOut: p.soldOut,
          isBestSeller: p.isBestSeller,
          spicyLevel: p.spicyLevel,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            priceCents: v.priceCents,
            prepMinutes: v.prepMinutes,
            soldOut: v.soldOut,
          })),
          modifierGroups: p.modifierGroups.map((pmg) => ({
            id: pmg.modifierGroup.id,
            name: pmg.modifierGroup.name,
            minSelect: pmg.modifierGroup.minSelect,
            maxSelect: pmg.modifierGroup.maxSelect,
            required: pmg.modifierGroup.required,
            options: pmg.modifierGroup.options.map((o) => ({
              id: o.id,
              name: o.name,
              priceDeltaCents: o.priceDeltaCents,
              isDefault: o.isDefault,
              soldOut: o.soldOut,
            })),
          })),
        })),
      })),
    activeCashSession,
    orders: {
      kitchen: mappedLive.filter((o) => o.status === 'IN_KITCHEN' || o.status === 'PREPARING'),
      ready: mappedLive.filter((o) => o.status === 'READY'),
      served: mappedLive.filter((o) => o.status === 'SERVED' && o.paymentStatus !== 'PAID'),
      delivery: mappedLive.filter((o) => o.status === 'OUT_FOR_DELIVERY'),
      scheduled: mappedLive.filter((o) => o.status === 'SCHEDULED'),
      history: mappedHistory,
    },
  };
}
