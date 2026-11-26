import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { db, type Tx } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { getStoreDateKey } from '@/lib/time';
import { signTrackingToken } from '@/lib/auth';
import { publishRealtime } from '@/lib/realtime';
import { notifyOrder } from '@/lib/notify';
import { calculateOrderPricing, type PricingLineInput } from './pricing';
import {
  assertValidTransition,
  FULFILLED_STATUS,
  resolveStationId,
  type FulfilmentType,
  type OrderStatus,
} from './state';
import { releaseStockForOrder, reserveStockForOrder } from '@/modules/inventory/service';
import type { Permission } from '@/config/permissions';

export interface CreateOrderItemInput {
  variantId: string;
  quantity: number;
  modifierOptionIds?: string[];
  notes?: string;
}

export interface CreateOrderInput {
  storeId: string;
  channel: 'WEB' | 'TILL' | 'PHONE' | 'ADMIN';
  fulfilment: FulfilmentType;
  tableNumber?: string | null;
  covers?: number | null;
  timing: 'ASAP' | 'SCHEDULED';
  scheduledFor?: Date | null;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string | null;
  deliverySuburb?: string | null;
  deliveryPostcode?: string | null;
  notes?: string;
  couponCode?: string | null;
  manualDiscountPct?: number;
  discountReason?: string | null;
  idempotencyKey: string;
  createdById?: string | null;
  createdByName?: string;
  items: CreateOrderItemInput[];
}

async function nextOrderNumber(tx: Tx, storeId: string, tz: string): Promise<string> {
  const dateKey = getStoreDateKey(new Date(), tz);
  const counter = await tx.orderCounter.upsert({
    where: { storeId_dateKey: { storeId, dateKey } },
    update: { seq: { increment: 1 } },
    create: { storeId, dateKey, seq: 1 },
  });
  return `#SK-${String(counter.seq).padStart(4, '0')}`;
}

async function resolveAndPriceItems(
  tx: Tx,
  storeId: string,
  defaultStationId: string | null,
  rawItems: CreateOrderItemInput[]
): Promise<{
  pricedInputs: PricingLineInput[];
  maxPrepMinutes: number;
  stockItems: Array<{ variantId: string; quantity: number; modifierOptionIds: string[] }>;
}> {
  if (rawItems.length === 0) throw new ValidationError('Order must contain at least one item');

  const variantIds = [...new Set(rawItems.map((i) => i.variantId))];
  const variants = await tx.variant.findMany({
    where: { id: { in: variantIds }, active: true, product: { storeId, active: true } },
    include: {
      product: { include: { category: true } },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const allModIds = [...new Set(rawItems.flatMap((i) => i.modifierOptionIds ?? []))];
  const modOptions = allModIds.length
    ? await tx.modifierOption.findMany({
        where: { id: { in: allModIds }, active: true },
        include: { group: true },
      })
    : [];
  const modMap = new Map(modOptions.map((m) => [m.id, m]));

  const stations = await tx.station.findMany({ where: { storeId } });
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  let maxPrepMinutes = 8;
  const pricedInputs: PricingLineInput[] = [];
  const stockItems: Array<{ variantId: string; quantity: number; modifierOptionIds: string[] }> = [];

  for (const raw of rawItems) {
    const v = variantMap.get(raw.variantId);
    if (!v) throw new ValidationError('One or more selected menu items are unavailable');
    if (v.soldOut || v.product.soldOut) {
      throw new ValidationError(`${v.product.name} (${v.name}) is currently sold out`);
    }

    const stationId = resolveStationId({
      variantStationId: v.stationId,
      productStationId: v.product.stationId,
      categoryStationId: v.product.category.defaultStationId,
      storeDefaultStationId: defaultStationId,
    });
    const station = stationMap.get(stationId);
    if (!station) throw new ConflictError('Configured kitchen station does not exist');

    maxPrepMinutes = Math.max(maxPrepMinutes, v.prepMinutes);

    const mods = (raw.modifierOptionIds ?? [])
      .map((id) => modMap.get(id))
      .filter((m): m is NonNullable<typeof m> => !!m && !m.soldOut)
      .map((m) => ({
        groupName: m.group.name,
        optionId: m.id,
        optionName: m.name,
        priceDeltaCents: m.priceDeltaCents,
      }));

    pricedInputs.push({
      productId: v.productId,
      productName: v.product.name,
      variantId: v.id,
      variantName: v.name,
      basePriceCents: v.priceCents,
      taxCode: v.product.taxCode,
      stationId: station.id,
      stationName: station.name,
      quantity: raw.quantity,
      notes: raw.notes?.trim() || '',
      modifiers: mods,
    });

    stockItems.push({
      variantId: v.id,
      quantity: raw.quantity,
      modifierOptionIds: mods.map((m) => m.optionId),
    });
  }

  return { pricedInputs, maxPrepMinutes, stockItems };
}

export async function createRoundTickets(
  tx: Tx,
  orderId: string,
  round: number,
  releaseAt: Date
): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId, round } });
  const stationIds = [...new Set(items.map((i) => i.stationId))];
  const stations = await tx.station.findMany({ where: { id: { in: stationIds } } });
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  for (const stationId of stationIds) {
    const st = stationMap.get(stationId);
    const autoReady = !!st?.autoComplete;
    const ticket = await tx.stationTicket.upsert({
      where: { orderId_stationId_round: { orderId, stationId, round } },
      update: {},
      create: {
        orderId,
        stationId,
        round,
        status: autoReady ? 'READY' : 'NEW',
        releaseAt,
        readyAt: autoReady ? new Date() : null,
      },
    });

    await tx.orderItem.updateMany({
      where: { orderId, round, stationId },
      data: { ticketId: ticket.id },
    });
  }
}

export async function createOrder(input: CreateOrderInput) {
  // 1. Idempotency check before creating anything
  const existing = await db.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { items: true, tickets: true },
  });
  if (existing) return existing;

  if (input.fulfilment === 'DINE_IN' && !input.tableNumber?.trim()) {
    throw new ValidationError('Table number is required for dine-in orders');
  }

  const created = await db.$transaction(async (tx) => {
    const store = await tx.store.findUniqueOrThrow({ where: { id: input.storeId } });

    if (input.channel === 'WEB' && store.onlinePaused && input.timing === 'ASAP') {
      throw new ConflictError(store.pauseMessage || 'Online ASAP ordering is temporarily paused. Please schedule a pre-order.');
    }

    // Delivery zone check
    let deliveryFeeCents = 0;
    let travelMinutes = 0;
    if (input.fulfilment === 'DELIVERY') {
      const postcode = input.deliveryPostcode?.trim();
      if (!postcode) throw new ValidationError('Delivery postcode is required');
      const zones = await tx.deliveryZone.findMany({ where: { storeId: store.id, active: true } });
      const matched = zones.find((z) =>
        z.postcodes
          .split(',')
          .map((p) => p.trim())
          .includes(postcode)
      );
      if (!matched) {
        throw new ValidationError(`Sorry, we don't deliver to postcode ${postcode} yet. Try Pickup!`);
      }
      deliveryFeeCents = matched.feeCents;
      travelMinutes = matched.travelMinutes;
    }

    // Resolve items & server-side pricing
    const { pricedInputs, maxPrepMinutes, stockItems } = await resolveAndPriceItems(
      tx,
      store.id,
      store.defaultStationId,
      input.items
    );

    // Coupon check
    let couponRecord = null;
    if (input.couponCode?.trim()) {
      const code = input.couponCode.trim().toUpperCase();
      couponRecord = await tx.coupon.findFirst({
        where: { storeId: store.id, code, active: true },
      });
      if (!couponRecord) throw new ValidationError(`Coupon code "${code}" is invalid or expired`);
      const now = new Date();
      if (couponRecord.startsAt && couponRecord.startsAt > now) throw new ValidationError('Coupon is not active yet');
      if (couponRecord.endsAt && couponRecord.endsAt < now) throw new ValidationError('Coupon has expired');
      if (couponRecord.maxUses && couponRecord.usedCount >= couponRecord.maxUses) {
        throw new ValidationError('Coupon usage limit reached');
      }
    }

    const pricing = calculateOrderPricing(pricedInputs, {
      deliveryFeeCents,
      coupon: couponRecord
        ? {
            kind: couponRecord.kind as 'PERCENT' | 'FIXED',
            value: couponRecord.value,
            minSpendCents: couponRecord.minSpendCents,
          }
        : null,
      manualDiscountPct: input.manualDiscountPct,
      cardSurchargeBps: input.channel === 'WEB' ? store.cardSurchargeBps : 0,
      gstRatePct: store.gstRatePct,
      gstRegistered: store.gstRegistered,
    });

    // Timing & slot capacity
    const now = new Date();
    let scheduledFor: Date | null = null;
    let releaseAt = now;
    let promisedAt = new Date(now.getTime() + (maxPrepMinutes + travelMinutes + 5) * 60000);

    if (input.timing === 'SCHEDULED') {
      if (!input.scheduledFor) throw new ValidationError('Scheduled date and time is required');
      scheduledFor = new Date(input.scheduledFor);
      if (Number.isNaN(scheduledFor.getTime()) || scheduledFor <= now) {
        throw new ValidationError('Scheduled time must be in the future');
      }

      // Enforce slot capacity server-side
      const rule = await tx.timeSlotRule.findUnique({
        where: { storeId_fulfilment: { storeId: store.id, fulfilment: input.fulfilment === 'DELIVERY' ? 'DELIVERY' : 'PICKUP' } },
      });
      if (rule) {
        const slotWindowMs = rule.slotMinutes * 60000;
        const slotStart = new Date(Math.floor(scheduledFor.getTime() / slotWindowMs) * slotWindowMs);
        const slotEnd = new Date(slotStart.getTime() + slotWindowMs);
        const existingInSlot = await tx.order.count({
          where: {
            storeId: store.id,
            fulfilment: input.fulfilment,
            status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] },
            scheduledFor: { gte: slotStart, lt: slotEnd },
          },
        });
        if (existingInSlot >= rule.maxOrdersPerSlot) {
          throw new ConflictError('That time slot is now full. Please pick the next available slot.');
        }
      }

      const leadMins = maxPrepMinutes + (input.fulfilment === 'DELIVERY' ? travelMinutes : 0);
      releaseAt = new Date(scheduledFor.getTime() - leadMins * 60000);
      promisedAt = scheduledFor;
    }

    const isWebPending = input.channel === 'WEB';
    const isFutureScheduled = !isWebPending && input.timing === 'SCHEDULED' && releaseAt > now;
    const initialStatus: OrderStatus = isWebPending
      ? 'PENDING_PAYMENT'
      : isFutureScheduled
      ? 'SCHEDULED'
      : 'IN_KITCHEN';

    const publicId = `ord_${crypto.randomBytes(8).toString('hex')}`;
    const number = await nextOrderNumber(tx, store.id, store.timezone);
    const trackingToken = signTrackingToken(publicId);

    const order = await tx.order.create({
      data: {
        publicId,
        number,
        storeId: store.id,
        channel: input.channel,
        fulfilment: input.fulfilment,
        tableNumber: input.tableNumber?.trim() || null,
        covers: input.covers ?? null,
        timing: input.timing,
        scheduledFor,
        releaseAt,
        promisedAt,
        status: initialStatus,
        paymentStatus: 'UNPAID',
        customerId: input.customerId ?? null,
        customerName: input.customerName.trim() || 'Walk-in',
        customerPhone: input.customerPhone?.trim() || '',
        customerEmail: input.customerEmail?.trim() || '',
        deliveryAddress: input.deliveryAddress?.trim() || null,
        deliverySuburb: input.deliverySuburb?.trim() || null,
        deliveryPostcode: input.deliveryPostcode?.trim() || null,
        notes: input.notes?.trim() || '',
        subtotalCents: pricing.subtotalCents,
        discountCents: pricing.discountCents,
        discountReason: input.discountReason ?? null,
        couponCode: couponRecord?.code ?? null,
        deliveryFeeCents: pricing.deliveryFeeCents,
        surchargeCents: pricing.surchargeCents,
        gstCents: pricing.gstCents,
        totalCents: pricing.totalCents,
        amountPaidCents: 0,
        idempotencyKey: input.idempotencyKey,
        trackingToken,
        createdById: input.createdById ?? null,
        sentToKitchenAt: initialStatus === 'IN_KITCHEN' ? now : null,
        items: {
          create: pricing.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            stationId: l.stationId,
            stationName: l.stationName,
            productName: l.productName,
            variantName: l.variantName,
            modifiersJson: l.modifiers as unknown as Prisma.InputJsonValue,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            lineTotalCents: l.lineTotalCents,
            taxCode: l.taxCode,
            notes: l.notes ?? '',
            round: 1,
          })),
        },
        statusHistory: {
          create: {
            fromState: null,
            toState: initialStatus,
            actorType: input.createdById ? 'STAFF' : 'CUSTOMER',
            actorId: input.createdById ?? input.customerId ?? null,
            actorName: input.createdByName || input.customerName || 'Guest',
            note: `Order placed via ${input.channel} (${input.fulfilment})`,
          },
        },
      },
      include: { items: true, tickets: true },
    });

    if (couponRecord) {
      await tx.coupon.update({ where: { id: couponRecord.id }, data: { usedCount: { increment: 1 } } });
      await tx.couponRedemption.create({
        data: { couponId: couponRecord.id, orderId: order.id, customerId: input.customerId ?? null },
      });
    }

    // Immediate non-web orders: reserve stock + create station tickets now
    if (!isWebPending) {
      await reserveStockForOrder(tx, order.id, stockItems, input.createdById);
      await createRoundTickets(tx, order.id, 1, releaseAt);

      // If all tickets auto-completed (e.g. drinks only), move straight to READY
      const openTickets = await tx.stationTicket.count({
        where: { orderId: order.id, status: { not: 'READY' } },
      });
      if (openTickets === 0 && initialStatus === 'IN_KITCHEN') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'READY', readyAt: now },
        });
      }
    }

    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, tickets: { include: { station: true } } },
    });
  });

  if (created.status !== 'PENDING_PAYMENT') {
    await publishRealtime(`store:${created.storeId}:till`, 'order.created', {
      orderId: created.id,
      status: created.status,
    });
    await notifyOrder(created.status === 'SCHEDULED' ? 'SCHEDULED' : 'RECEIVED', created);
  }

  return created;
}

/**
 * Confirm web order payment (called by Stripe webhook or test payment confirmation).
 * Idempotent via payment idempotencyKey. Moves PENDING_PAYMENT -> IN_KITCHEN or SCHEDULED.
 */
export async function confirmWebOrderPayment(args: {
  orderId: string;
  amountCents: number;
  stripePiId: string;
  cardBrand?: string;
  cardLast4?: string;
  idempotencyKey: string;
}) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: args.orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundError('Order not found');

    // Idempotent payment insert
    const existingPay = await tx.payment.findUnique({ where: { idempotencyKey: args.idempotencyKey } });
    if (existingPay) return order;

    await tx.payment.create({
      data: {
        orderId: order.id,
        method: 'CARD_ONLINE',
        amountCents: args.amountCents,
        cardBrand: args.cardBrand ?? 'Visa',
        cardLast4: args.cardLast4 ?? '4242',
        stripePiId: args.stripePiId,
        status: 'SUCCEEDED',
        idempotencyKey: args.idempotencyKey,
      },
    });

    await tx.financialTransaction.create({
      data: {
        storeId: order.storeId,
        direction: 'INFLOW',
        category: 'SALE',
        method: 'CARD_ONLINE',
        amountCents: args.amountCents,
        sourceType: 'PAYMENT',
        sourceId: args.idempotencyKey,
        note: `Online order ${order.number}`,
      },
    });

    const now = new Date();
    const isScheduled = order.timing === 'SCHEDULED' && order.releaseAt > now;
    const nextStatus: OrderStatus = isScheduled ? 'SCHEDULED' : 'IN_KITCHEN';

    const updated = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDING_PAYMENT' },
      data: {
        status: nextStatus,
        paymentStatus: 'PAID',
        amountPaidCents: { increment: args.amountCents },
        sentToKitchenAt: nextStatus === 'IN_KITCHEN' ? now : null,
      },
    });

    if (updated.count === 1) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromState: 'PENDING_PAYMENT',
          toState: nextStatus,
          actorType: 'SYSTEM',
          actorName: 'Stripe Webhook',
          note: `Online payment confirmed (${args.cardBrand ?? 'Card'} •••• ${args.cardLast4 ?? '4242'})`,
        },
      });

      const stockItems = order.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        modifierOptionIds: Array.isArray(i.modifiersJson)
          ? (i.modifiersJson as Array<{ optionId?: string }>).map((m) => m.optionId).filter((x): x is string => !!x)
          : [],
      }));
      await reserveStockForOrder(tx, order.id, stockItems, null);
      await createRoundTickets(tx, order.id, 1, order.releaseAt);

      const openTickets = await tx.stationTicket.count({
        where: { orderId: order.id, status: { not: 'READY' } },
      });
      if (openTickets === 0 && nextStatus === 'IN_KITCHEN') {
        await tx.order.update({ where: { id: order.id }, data: { status: 'READY', readyAt: now } });
      }
    }

    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });

  await publishRealtime(`store:${result.storeId}:till`, 'order.paid', {
    orderId: result.id,
    status: result.status,
  });
  await publishRealtime(`order:${result.publicId}`, 'order.status', {
    orderId: result.id,
    status: result.status,
  });
  await notifyOrder(result.status === 'SCHEDULED' ? 'SCHEDULED' : 'RECEIVED', result);
  return result;
}

/**
 * Kitchen ticket transition: NEW -> PREPARING -> READY.
 * When the LAST open ticket for an order becomes READY, the order transitions to READY automatically.
 */
export async function setStationTicketStatus(args: {
  ticketId: string;
  to: 'PREPARING' | 'READY';
  actorId?: string | null;
  actorName: string;
  bumpedFromTill?: boolean;
}) {
  const result = await db.$transaction(async (tx) => {
    const ticket = await tx.stationTicket.findUnique({
      where: { id: args.ticketId },
      include: { order: true, station: true },
    });
    if (!ticket) throw new NotFoundError('Kitchen ticket not found');

    const fromStatuses = args.to === 'PREPARING' ? ['NEW'] : ['NEW', 'PREPARING'];
    const now = new Date();
    const res = await tx.stationTicket.updateMany({
      where: { id: ticket.id, status: { in: fromStatuses } },
      data: {
        status: args.to,
        ...(args.to === 'PREPARING'
          ? { preparingAt: now, preparedById: args.actorId ?? null }
          : { readyAt: now, readyById: args.actorId ?? null, bumpedFromTill: !!args.bumpedFromTill }),
      },
    });
    if (res.count === 0) return { order: ticket.order, orderBecameReady: false };

    let orderBecameReady = false;
    if (args.to === 'PREPARING') {
      const moved = await tx.order.updateMany({
        where: { id: ticket.orderId, status: { in: ['IN_KITCHEN', 'SCHEDULED'] } },
        data: { status: 'PREPARING' },
      });
      if (moved.count === 1) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: ticket.orderId,
            fromState: ticket.order.status,
            toState: 'PREPARING',
            actorType: 'STAFF',
            actorId: args.actorId ?? null,
            actorName: args.actorName,
            note: `${ticket.station.name} started preparing`,
          },
        });
      }
    } else {
      const remaining = await tx.stationTicket.count({
        where: { orderId: ticket.orderId, status: { not: 'READY' } },
      });
      if (remaining === 0) {
        const moved = await tx.order.updateMany({
          where: { id: ticket.orderId, status: { in: ['IN_KITCHEN', 'PREPARING', 'SCHEDULED'] } },
          data: { status: 'READY', readyAt: now },
        });
        if (moved.count === 1) {
          orderBecameReady = true;
          await tx.orderStatusHistory.create({
            data: {
              orderId: ticket.orderId,
              fromState: ticket.order.status,
              toState: 'READY',
              actorType: args.bumpedFromTill ? 'STAFF' : 'SYSTEM',
              actorId: args.actorId ?? null,
              actorName: args.bumpedFromTill ? args.actorName : 'Kitchen',
              note: args.bumpedFromTill
                ? 'Marked all ready from Till checklist'
                : `All stations ready (final: ${ticket.station.name})`,
            },
          });
        }
      }
    }

    const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id: ticket.orderId } });
    return { order: updatedOrder, orderBecameReady };
  });

  await publishRealtime(`store:${result.order.storeId}:till`, 'order.updated', {
    orderId: result.order.id,
    status: result.order.status,
  });
  await publishRealtime(`order:${result.order.publicId}`, 'order.status', {
    orderId: result.order.id,
    status: result.order.status,
  });
  if (result.orderBecameReady) {
    await notifyOrder('READY', result.order);
  }
  return result.order;
}

/**
 * Till "Mark all ready" override (solo mode / single-operator convenience).
 */
export async function markAllTicketsReadyFromTill(args: {
  orderId: string;
  actorId: string;
  actorName: string;
}) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: args.orderId } });
    const now = new Date();
    await tx.stationTicket.updateMany({
      where: { orderId: order.id, status: { not: 'READY' } },
      data: { status: 'READY', readyAt: now, readyById: args.actorId, bumpedFromTill: true },
    });

    const moved = await tx.order.updateMany({
      where: { id: order.id, status: { in: ['IN_KITCHEN', 'PREPARING', 'SCHEDULED'] } },
      data: { status: 'READY', readyAt: now },
    });
    if (moved.count === 1) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromState: order.status,
          toState: 'READY',
          actorType: 'STAFF',
          actorId: args.actorId,
          actorName: args.actorName,
          note: 'Marked all ready via Till checklist',
        },
      });
    }
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });

  await publishRealtime(`store:${result.storeId}:till`, 'order.ready', {
    orderId: result.id,
    status: result.status,
  });
  await publishRealtime(`order:${result.publicId}`, 'order.status', {
    orderId: result.id,
    status: result.status,
  });
  await notifyOrder('READY', result);
  return result;
}

/**
 * System-only completion rule:
 * An order becomes COMPLETED automatically ONLY when its fulfilment handoff is done
 * AND paymentStatus === 'PAID' (balanceDue === 0). Conditional update guarantees exactly-once.
 */
export async function tryCompleteOrder(tx: Tx, orderId: string): Promise<boolean> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true, storeId: true, fulfilment: true, status: true, paymentStatus: true, customerId: true, subtotalCents: true, discountCents: true },
  });

  const requiredStatus = FULFILLED_STATUS[order.fulfilment as FulfilmentType];
  if (!requiredStatus) return false;

  const now = new Date();
  const res = await tx.order.updateMany({
    where: { id: orderId, status: requiredStatus, paymentStatus: 'PAID' },
    data: { status: 'COMPLETED', completedAt: now },
  });

  if (res.count !== 1) return false;

  await tx.orderStatusHistory.create({
    data: {
      orderId,
      fromState: requiredStatus,
      toState: 'COMPLETED',
      actorType: 'SYSTEM',
      actorName: 'System',
      note: 'Order fulfilled and paid in full — auto-completed',
    },
  });

  // Award loyalty points idempotently if customer is attached
  if (order.customerId) {
    const rule = await tx.loyaltyRule.findFirst({ where: { storeId: order.storeId, active: true } });
    if (rule && rule.pointsPerDollar > 0) {
      const paidDollars = Math.floor(Math.max(0, order.subtotalCents - order.discountCents) / 100);
      const pts = paidDollars * rule.pointsPerDollar;
      if (pts > 0) {
        const acct = await tx.loyaltyAccount.upsert({
          where: { customerId: order.customerId },
          update: {},
          create: { customerId: order.customerId, balance: 0 },
        });
        try {
          await tx.loyaltyTransaction.create({
            data: {
              loyaltyAccountId: acct.id,
              orderId,
              kind: 'EARN',
              points: pts,
              note: `Earned on completed order`,
            },
          });
          await tx.loyaltyAccount.update({
            where: { id: acct.id },
            data: { balance: { increment: pts } },
          });
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
            throw err;
          }
        }
      }
    }
  }

  return true;
}

/**
 * Cashier handoff from Ready tab: SERVED (dine-in), COLLECTED (pickup), OUT_FOR_DELIVERY (delivery).
 * Immediately invokes tryCompleteOrder if already paid in full.
 */
export async function handoffReadyOrder(args: {
  orderId: string;
  to: 'SERVED' | 'COLLECTED' | 'OUT_FOR_DELIVERY';
  driverName?: string;
  actorId: string;
  actorName: string;
  actorPerms: Set<Permission>;
}) {
  const updated = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: args.orderId } });
    assertValidTransition(
      order.status as OrderStatus,
      args.to,
      order.fulfilment as FulfilmentType,
      args.actorPerms
    );

    const now = new Date();
    const res = await tx.order.updateMany({
      where: { id: order.id, status: 'READY' },
      data: {
        status: args.to,
        ...(args.to === 'SERVED' ? { servedAt: now, servedById: args.actorId } : {}),
        ...(args.to === 'COLLECTED' ? { collectedAt: now, dispatchedById: args.actorId } : {}),
        ...(args.to === 'OUT_FOR_DELIVERY'
          ? { dispatchedAt: now, dispatchedById: args.actorId, driverName: args.driverName?.trim() || null }
          : {}),
      },
    });
    if (res.count !== 1) throw new ConflictError('Order is no longer in READY status');

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromState: 'READY',
        toState: args.to,
        actorType: 'STAFF',
        actorId: args.actorId,
        actorName: args.actorName,
        note: args.driverName ? `Dispatched with driver: ${args.driverName}` : `Marked ${args.to.replaceAll('_', ' ').toLowerCase()}`,
      },
    });

    await tryCompleteOrder(tx, order.id);
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });

  await publishRealtime(`store:${updated.storeId}:till`, 'order.updated', {
    orderId: updated.id,
    status: updated.status,
  });
  await publishRealtime(`order:${updated.publicId}`, 'order.status', {
    orderId: updated.id,
    status: updated.status,
  });
  if (args.to === 'OUT_FOR_DELIVERY') {
    await notifyOrder('OUT_FOR_DELIVERY', updated);
  }
  return updated;
}

/**
 * Record Cash / EFTPOS / Split tender at the Till.
 * Concurrency-safe: conditional update ensures no overpayment, calls tryCompleteOrder.
 */
export async function recordTillPayment(args: {
  orderId: string;
  method: 'CASH' | 'CARD_EFTPOS' | 'OTHER';
  amountCents: number;
  tenderedCents?: number;
  reference?: string;
  idempotencyKey: string;
  actorId: string;
  actorName: string;
}) {
  const updated = await db.$transaction(async (tx) => {
    const existingPay = await tx.payment.findUnique({ where: { idempotencyKey: args.idempotencyKey } });
    if (existingPay) {
      return tx.order.findUniqueOrThrow({ where: { id: args.orderId }, include: { payments: true } });
    }

    const order = await tx.order.findUniqueOrThrow({ where: { id: args.orderId } });
    if (['CANCELLED', 'COMPLETED', 'REFUNDED'].includes(order.status)) {
      throw new ConflictError('Order is already closed');
    }

    const balanceDue = order.totalCents - order.amountPaidCents;
    if (args.amountCents <= 0 || args.amountCents > balanceDue) {
      throw new ValidationError(`Payment amount must be between $0.01 and balance due ($${(balanceDue / 100).toFixed(2)})`);
    }

    const tendered = args.method === 'CASH' ? (args.tenderedCents ?? args.amountCents) : null;
    if (args.method === 'CASH' && tendered !== null && tendered < args.amountCents) {
      throw new ValidationError('Cash tendered cannot be less than payment amount');
    }
    const change = args.method === 'CASH' && tendered !== null ? tendered - args.amountCents : null;

    // Atomic balance guard: only increment if amountPaidCents + amountCents <= totalCents
    const newPaid = order.amountPaidCents + args.amountCents;
    const newPaymentStatus = newPaid >= order.totalCents ? 'PAID' : 'PARTIALLY_PAID';
    const guarded = await tx.order.updateMany({
      where: { id: order.id, amountPaidCents: order.amountPaidCents },
      data: { amountPaidCents: newPaid, paymentStatus: newPaymentStatus },
    });
    if (guarded.count !== 1) {
      throw new ConflictError('Concurrent payment detected — please refresh balance');
    }

    const openSession = await tx.cashSession.findFirst({
      where: { storeId: order.storeId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        method: args.method,
        amountCents: args.amountCents,
        tenderedCents: tendered,
        changeCents: change,
        reference: args.reference?.trim() || null,
        status: 'SUCCEEDED',
        idempotencyKey: args.idempotencyKey,
        takenById: args.actorId,
        cashSessionId: openSession?.id ?? null,
      },
    });

    await tx.financialTransaction.create({
      data: {
        storeId: order.storeId,
        direction: 'INFLOW',
        category: 'SALE',
        method: args.method,
        amountCents: args.amountCents,
        sourceType: 'PAYMENT',
        sourceId: payment.id,
        note: `Order ${order.number} (${args.method})`,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromState: order.status,
        toState: order.status,
        actorType: 'STAFF',
        actorId: args.actorId,
        actorName: args.actorName,
        note: `Payment recorded: ${args.method} $${(args.amountCents / 100).toFixed(2)}${change ? ` (change $${(change / 100).toFixed(2)})` : ''}`,
      },
    });

    await tryCompleteOrder(tx, order.id);
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
  });

  await publishRealtime(`store:${updated.storeId}:till`, 'order.paid', {
    orderId: updated.id,
    status: updated.status,
  });
  return updated;
}

/**
 * Add round 2+ items to an open Dine-In order.
 * Only new round tickets go to the kitchen; earlier rounds stay untouched.
 */
export async function addDineInRound(args: {
  orderId: string;
  items: CreateOrderItemInput[];
  actorId: string;
  actorName: string;
}) {
  const updated = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: args.orderId } });
    if (order.fulfilment !== 'DINE_IN' || ['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new ConflictError('Can only add rounds to an open dine-in order');
    }

    const store = await tx.store.findUniqueOrThrow({ where: { id: order.storeId } });
    const { pricedInputs, stockItems } = await resolveAndPriceItems(
      tx,
      store.id,
      store.defaultStationId,
      args.items
    );

    const nextRound = order.currentRound + 1;
    const roundPricing = calculateOrderPricing(pricedInputs, {
      deliveryFeeCents: 0,
      gstRatePct: store.gstRatePct,
      gstRegistered: store.gstRegistered,
    });

    for (const l of roundPricing.lines) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: l.productId,
          variantId: l.variantId,
          stationId: l.stationId,
          stationName: l.stationName,
          productName: l.productName,
          variantName: l.variantName,
          modifiersJson: l.modifiers as unknown as Prisma.InputJsonValue,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          lineTotalCents: l.lineTotalCents,
          taxCode: l.taxCode,
          notes: l.notes ?? '',
          round: nextRound,
        },
      });
    }

    const now = new Date();
    const newSubtotal = order.subtotalCents + roundPricing.subtotalCents;
    const newTotal = order.totalCents + roundPricing.totalCents;
    const newGst = order.gstCents + roundPricing.gstCents;

    await tx.order.update({
      where: { id: order.id },
      data: {
        currentRound: nextRound,
        subtotalCents: newSubtotal,
        totalCents: newTotal,
        gstCents: newGst,
        paymentStatus: order.amountPaidCents >= newTotal ? 'PAID' : order.amountPaidCents > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
        status: 'IN_KITCHEN',
      },
    });

    await reserveStockForOrder(tx, `${order.id}:r${nextRound}`, stockItems, args.actorId);
    await createRoundTickets(tx, order.id, nextRound, now);

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromState: order.status,
        toState: 'IN_KITCHEN',
        actorType: 'STAFF',
        actorId: args.actorId,
        actorName: args.actorName,
        note: `Added round ${nextRound} (${args.items.length} item line(s))`,
      },
    });

    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, tickets: true } });
  });

  await publishRealtime(`store:${updated.storeId}:till`, 'order.updated', {
    orderId: updated.id,
    status: updated.status,
  });
  return updated;
}

/**
 * Cancel an order before completion; releases reserved stock idempotently.
 */
export async function cancelOrder(args: {
  orderId: string;
  reason: string;
  actorId: string;
  actorName: string;
}) {
  const updated = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: args.orderId } });
    if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status)) {
      throw new ConflictError('Cannot cancel a completed or already cancelled order');
    }

    const now = new Date();
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', cancelledAt: now, cancelReason: args.reason },
    });

    await releaseStockForOrder(tx, order.id, args.actorId);

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromState: order.status,
        toState: 'CANCELLED',
        actorType: 'STAFF',
        actorId: args.actorId,
        actorName: args.actorName,
        note: `Cancelled: ${args.reason}`,
      },
    });

    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });

  await publishRealtime(`store:${updated.storeId}:till`, 'order.cancelled', {
    orderId: updated.id,
    status: 'CANCELLED',
  });
  await notifyOrder('CANCELLED', updated);
  return updated;
}
