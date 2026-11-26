import 'server-only';
import { db } from '@/lib/db';

export interface KitchenModifierDTO {
  groupName: string;
  optionName: string;
}

export interface KitchenTicketItemDTO {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  notes: string;
  modifiers: KitchenModifierDTO[];
}

export interface KitchenTicketDTO {
  id: string;
  orderId: string;
  orderNumber: string;
  fulfilment: string;
  tableNumber: string | null;
  customerName: string;
  orderNotes: string;
  round: number;
  status: string;
  stationId: string;
  stationCode: string;
  stationName: string;
  stationColor: string;
  releaseAt: string;
  promisedAt: string;
  preparingAt: string | null;
  createdAt: string;
  items: KitchenTicketItemDTO[];
}

export interface KitchenAllDayItemDTO {
  key: string;
  label: string;
  count: number;
}

export interface KitchenScreenData {
  store: {
    id: string;
    name: string;
    timezone: string;
  };
  stationCode: string;
  currentStation: {
    id: string;
    code: string;
    name: string;
    color: string;
  } | null;
  stations: Array<{
    id: string;
    code: string;
    name: string;
    color: string;
    openCount: number;
  }>;
  tickets: KitchenTicketDTO[];
  recentlyReady: Array<{
    id: string;
    orderNumber: string;
    stationName: string;
    readyAt: string;
  }>;
  allDaySummary: KitchenAllDayItemDTO[];
}

function parseKitchenModifiers(raw: unknown): KitchenModifierDTO[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m) => ({
      groupName: String(m.groupName ?? ''),
      optionName: String(m.optionName ?? ''),
    }));
}

export async function getKitchenScreenData(
  storeId: string,
  stationCode: string
): Promise<KitchenScreenData> {
  const now = new Date();
  const normalizedCode = stationCode.toLowerCase();

  const [store, stations, openCounts, tickets, recentlyReady] = await Promise.all([
    db.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { id: true, name: true, timezone: true },
    }),
    db.station.findMany({
      where: { storeId, active: true, autoComplete: false },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, color: true },
    }),
    db.stationTicket.groupBy({
      by: ['stationId'],
      where: {
        status: { in: ['NEW', 'PREPARING'] },
        releaseAt: { lte: now },
        order: {
          storeId,
          status: { in: ['IN_KITCHEN', 'PREPARING'] },
        },
      },
      _count: { _all: true },
    }),
    db.stationTicket.findMany({
      where: {
        status: { in: ['NEW', 'PREPARING'] },
        releaseAt: { lte: now },
        order: {
          storeId,
          status: { in: ['IN_KITCHEN', 'PREPARING'] },
        },
        ...(normalizedCode !== 'all' ? { station: { code: normalizedCode } } : {}),
      },
      include: {
        station: { select: { id: true, code: true, name: true, color: true } },
        order: {
          select: {
            id: true,
            number: true,
            fulfilment: true,
            tableNumber: true,
            customerName: true,
            notes: true,
            promisedAt: true,
          },
        },
        items: {
          orderBy: { id: 'asc' },
        },
      },
      orderBy: [{ order: { promisedAt: 'asc' } }, { createdAt: 'asc' }],
    }),
    db.stationTicket.findMany({
      where: {
        status: 'READY',
        readyAt: { gte: new Date(now.getTime() - 20 * 60000) },
        order: {
          storeId,
          status: { in: ['IN_KITCHEN', 'PREPARING', 'READY'] },
        },
        ...(normalizedCode !== 'all' ? { station: { code: normalizedCode } } : {}),
      },
      include: {
        station: { select: { name: true } },
        order: { select: { number: true } },
      },
      orderBy: { readyAt: 'desc' },
      take: 6,
    }),
  ]);

  const countMap = new Map(openCounts.map((c) => [c.stationId, c._count._all]));
  const currentStation =
    normalizedCode === 'all' ? null : stations.find((s) => s.code === normalizedCode) ?? null;

  const allDayMap = new Map<string, KitchenAllDayItemDTO>();
  const ticketDTOs: KitchenTicketDTO[] = tickets.map((t) => {
    const items: KitchenTicketItemDTO[] = t.items.map((item) => {
      const label =
        item.variantName && item.variantName !== 'Regular' && item.variantName !== 'Standard'
          ? `${item.variantName} ${item.productName}`
          : item.productName;
      const existing = allDayMap.get(label);
      if (existing) {
        existing.count += item.quantity;
      } else {
        allDayMap.set(label, { key: label, label, count: item.quantity });
      }

      return {
        id: item.id,
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        notes: item.notes,
        modifiers: parseKitchenModifiers(item.modifiersJson),
      };
    });

    return {
      id: t.id,
      orderId: t.order.id,
      orderNumber: t.order.number,
      fulfilment: t.order.fulfilment,
      tableNumber: t.order.tableNumber,
      customerName: t.order.customerName,
      orderNotes: t.order.notes,
      round: t.round,
      status: t.status,
      stationId: t.station.id,
      stationCode: t.station.code,
      stationName: t.station.name,
      stationColor: t.station.color,
      releaseAt: t.releaseAt.toISOString(),
      promisedAt: t.order.promisedAt.toISOString(),
      preparingAt: t.preparingAt ? t.preparingAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      items,
    };
  });

  const allDaySummary = [...allDayMap.values()].sort((a, b) => b.count - a.count);

  return {
    store,
    stationCode: normalizedCode,
    currentStation,
    stations: stations.map((s) => ({
      ...s,
      openCount: countMap.get(s.id) ?? 0,
    })),
    tickets: ticketDTOs,
    recentlyReady: recentlyReady.map((r) => ({
      id: r.id,
      orderNumber: r.order.number,
      stationName: r.station.name,
      readyAt: (r.readyAt ?? now).toISOString(),
    })),
    allDaySummary,
  };
}
