import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Allow importing server-only modules inside Vitest Node environment
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));
// Increase interactive transaction timeout for remote TiDB Cloud latency (ap-northeast-1)
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({
    transactionOptions: { maxWait: 20000, timeout: 30000 },
  });
  return { db };
});

import { db } from '@/lib/db';
import { ALL_PERMISSION_KEYS, type Permission } from '@/config/permissions';
import {
  addDineInRound,
  cancelOrder,
  confirmWebOrderPayment,
  createOrder,
  handoffReadyOrder,
  markAllTicketsReadyFromTill,
  recordTillPayment,
  setStationTicketStatus,
  tryCompleteOrder,
} from '@/modules/orders/service';
import { receivePurchaseOrderGoods, reserveStockForOrder } from '@/modules/inventory/service';

interface SeedFixtures {
  storeId: string;
  adminId: string;
  adminName: string;
  vendorId: string;
  kebabRegVariantId: string;
  pideFullVariantId: string;
  drinkCanVariantId: string;
  lambInvId: string;
  breadInvId: string;
  chipsInvId: string;
}

const allPerms = new Set<Permission>(ALL_PERMISSION_KEYS);

describe('Star Kebab — Real TiDB Cloud Order & Inventory Lifecycle Integration', () => {
  let fx: SeedFixtures;

  beforeAll(async () => {
    const store = await db.store.findUniqueOrThrow({ where: { slug: 'star-kebab' } });
    const admin = await db.staffUser.findUniqueOrThrow({ where: { email: 'admin@starkebab.com.au' } });
    const vendor = await db.vendor.findFirstOrThrow({ where: { storeId: store.id } });

    const kebabReg = await db.variant.findFirstOrThrow({
      where: { sku: 'SK-KEB-REG', product: { storeId: store.id } },
    });
    const pideFull = await db.variant.findFirstOrThrow({
      where: { sku: 'SK-PID-FUL', product: { storeId: store.id } },
    });
    const drinkCan = await db.variant.findFirstOrThrow({
      where: { sku: 'SK-DRK-COK', product: { storeId: store.id } },
    });

    const lambInv = await db.inventoryItem.findUniqueOrThrow({
      where: { storeId_code: { storeId: store.id, code: 'ING-LAMB' } },
    });
    const breadInv = await db.inventoryItem.findUniqueOrThrow({
      where: { storeId_code: { storeId: store.id, code: 'ING-BREAD' } },
    });
    const chipsInv = await db.inventoryItem.findUniqueOrThrow({
      where: { storeId_code: { storeId: store.id, code: 'ING-CHIPS' } },
    });

    fx = {
      storeId: store.id,
      adminId: admin.id,
      adminName: admin.name,
      vendorId: vendor.id,
      kebabRegVariantId: kebabReg.id,
      pideFullVariantId: pideFull.id,
      drinkCanVariantId: drinkCan.id,
      lambInvId: lambInv.id,
      breadInvId: breadInv.id,
      chipsInvId: chipsInv.id,
    };
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('Scenario 2 & 3: deducts exact Decimal stock on placement, ignores idempotent replay, and restores exact stock on cancel', async () => {
    const beforeLamb = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.lambInvId } })).onHand;
    const beforeBread = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.breadInvId } })).onHand;

    const order = await createOrder({
      storeId: fx.storeId,
      channel: 'TILL',
      fulfilment: 'PICKUP',
      timing: 'ASAP',
      customerName: 'Stock Test Customer',
      idempotencyKey: `int_s23_${crypto.randomUUID()}`,
      createdById: fx.adminId,
      createdByName: fx.adminName,
      items: [{ variantId: fx.kebabRegVariantId, quantity: 2 }], // 2 x 0.180 kg lamb = 0.360 kg, 2 x 1.000 bread = 2.000
    });

    const afterPlaceLamb = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.lambInvId } })).onHand;
    const afterPlaceBread = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.breadInvId } })).onHand;

    expect(afterPlaceLamb.toFixed(3)).toBe(beforeLamb.sub(new Prisma.Decimal('0.360')).toFixed(3));
    expect(afterPlaceBread.toFixed(3)).toBe(beforeBread.sub(new Prisma.Decimal('2.000')).toFixed(3));

    // Idempotent replay of reserveStockForOrder must not double-deduct
    await db.$transaction(async (tx) => {
      await reserveStockForOrder(
        tx,
        order.id,
        [{ variantId: fx.kebabRegVariantId, quantity: 2 }],
        fx.adminId
      );
    });
    const afterReplayLamb = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.lambInvId } })).onHand;
    expect(afterReplayLamb.toFixed(3)).toBe(afterPlaceLamb.toFixed(3));

    // Cancel order -> restores exact reserved stock
    const cancelled = await cancelOrder({
      orderId: order.id,
      reason: 'Integration test stock reversal',
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    expect(cancelled.status).toBe('CANCELLED');

    const afterCancelLamb = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.lambInvId } })).onHand;
    const afterCancelBread = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.breadInvId } })).onHand;
    expect(afterCancelLamb.toFixed(3)).toBe(beforeLamb.toFixed(3));
    expect(afterCancelBread.toFixed(3)).toBe(beforeBread.toFixed(3));
  }, 60_000);

  it('Scenario 4: Purchase Order partial goods receipt (12kg then 8kg -> +20kg, PARTIALLY_RECEIVED -> RECEIVED)', async () => {
    const beforeChips = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.chipsInvId } })).onHand;
    const poNumber = `PO-INT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const po = await db.purchaseOrder.create({
      data: {
        storeId: fx.storeId,
        vendorId: fx.vendorId,
        number: poNumber,
        status: 'ORDERED',
        totalCents: 20 * 380,
        lines: {
          create: [
            {
              inventoryItemId: fx.chipsInvId,
              orderedQty: new Prisma.Decimal('20.000'),
              unitCostCents: 380,
            },
          ],
        },
      },
      include: { lines: true },
    });
    const poLine = po.lines[0]!;

    // Delivery 1: 12 kg
    const first = await db.$transaction((tx) =>
      receivePurchaseOrderGoods(tx, {
        purchaseOrderId: po.id,
        invoiceRef: 'INV-PART-1',
        actorId: fx.adminId,
        lines: [{ purchaseOrderLineId: poLine.id, receivedQty: 12 }],
      })
    );
    expect(first.status).toBe('PARTIALLY_RECEIVED');

    const midChips = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.chipsInvId } })).onHand;
    expect(midChips.toFixed(3)).toBe(beforeChips.add(new Prisma.Decimal('12.000')).toFixed(3));

    // Delivery 2: 8 kg
    const second = await db.$transaction((tx) =>
      receivePurchaseOrderGoods(tx, {
        purchaseOrderId: po.id,
        invoiceRef: 'INV-PART-2',
        actorId: fx.adminId,
        lines: [{ purchaseOrderLineId: poLine.id, receivedQty: 8 }],
      })
    );
    expect(second.status).toBe('RECEIVED');

    const finalChips = (await db.inventoryItem.findUniqueOrThrow({ where: { id: fx.chipsInvId } })).onHand;
    expect(finalChips.toFixed(3)).toBe(beforeChips.add(new Prisma.Decimal('20.000')).toFixed(3));
  }, 60_000);

  it('Scenario 9: Multi-station split (Kebab + Pizza + Counter drink) auto-readies Counter and moves Order to READY on last station', async () => {
    const order = await createOrder({
      storeId: fx.storeId,
      channel: 'TILL',
      fulfilment: 'PICKUP',
      timing: 'ASAP',
      customerName: 'Multi Station Guest',
      idempotencyKey: `int_s9_${crypto.randomUUID()}`,
      createdById: fx.adminId,
      createdByName: fx.adminName,
      items: [
        { variantId: fx.kebabRegVariantId, quantity: 1 },
        { variantId: fx.pideFullVariantId, quantity: 1 },
        { variantId: fx.drinkCanVariantId, quantity: 1 },
      ],
    });

    expect(order.status).toBe('IN_KITCHEN');
    const ticketsWithStation = await db.stationTicket.findMany({
      where: { orderId: order.id },
      include: { station: true },
    });
    expect(ticketsWithStation).toHaveLength(3);

    const counterTicket = ticketsWithStation.find((t) => t.station.code === 'counter')!;
    const kebabTicket = ticketsWithStation.find((t) => t.station.code === 'kebab')!;
    const pizzaTicket = ticketsWithStation.find((t) => t.station.code === 'pizza')!;

    expect(counterTicket.status).toBe('READY');
    expect(kebabTicket.status).toBe('NEW');
    expect(pizzaTicket.status).toBe('NEW');

    // Kebab starts preparing -> Order moves to PREPARING
    const afterPrep = await setStationTicketStatus({
      ticketId: kebabTicket.id,
      to: 'PREPARING',
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    expect(afterPrep.status).toBe('PREPARING');

    // Kebab ready -> Pizza still NEW, so Order stays PREPARING
    const afterFirstReady = await setStationTicketStatus({
      ticketId: kebabTicket.id,
      to: 'READY',
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    expect(afterFirstReady.status).toBe('PREPARING');

    // Pizza ready (last open ticket) -> Order automatically transitions to READY
    const afterLastReady = await setStationTicketStatus({
      ticketId: pizzaTicket.id,
      to: 'READY',
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    expect(afterLastReady.status).toBe('READY');
    expect(afterLastReady.readyAt).not.toBeNull();
  }, 60_000);

  it('Scenario 10: Solo mode Till "Mark all ready" sets bumpedFromTill=true and moves order to READY', async () => {
    const order = await createOrder({
      storeId: fx.storeId,
      channel: 'TILL',
      fulfilment: 'PICKUP',
      timing: 'ASAP',
      customerName: 'Solo Mode Customer',
      idempotencyKey: `int_s10_${crypto.randomUUID()}`,
      createdById: fx.adminId,
      createdByName: fx.adminName,
      items: [
        { variantId: fx.kebabRegVariantId, quantity: 1 },
        { variantId: fx.pideFullVariantId, quantity: 1 },
      ],
    });

    const readyOrder = await markAllTicketsReadyFromTill({
      orderId: order.id,
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    expect(readyOrder.status).toBe('READY');

    const tickets = await db.stationTicket.findMany({ where: { orderId: order.id } });
    expect(tickets.length).toBe(2);
    expect(tickets.every((t) => t.status === 'READY' && t.bumpedFromTill === true)).toBe(true);
  }, 60_000);

  it('Scenario 13: createOrder idempotency returns the exact same order on duplicate key', async () => {
    const key = `int_s13_${crypto.randomUUID()}`;
    const input = {
      storeId: fx.storeId,
      channel: 'TILL' as const,
      fulfilment: 'PICKUP' as const,
      timing: 'ASAP' as const,
      customerName: 'Idempotent Guest',
      idempotencyKey: key,
      createdById: fx.adminId,
      createdByName: fx.adminName,
      items: [{ variantId: fx.drinkCanVariantId, quantity: 1 }],
    };

    const first = await createOrder(input);
    const second = await createOrder(input);

    expect(second.id).toBe(first.id);
    expect(second.publicId).toBe(first.publicId);
    expect(second.number).toBe(first.number);
  }, 60_000);

  it('Scenario 16: Dine-In cash tender calculates change and auto-completes only after payment', async () => {
    const dineInCash = await createOrder({
      storeId: fx.storeId,
      channel: 'TILL',
      fulfilment: 'DINE_IN',
      tableNumber: '5',
      covers: 1,
      timing: 'ASAP',
      customerName: 'Table 5 Cash',
      idempotencyKey: `int_s16_${crypto.randomUUID()}`,
      createdById: fx.adminId,
      createdByName: fx.adminName,
      items: [{ variantId: fx.kebabRegVariantId, quantity: 1 }], // 1450 cents
    });
    expect(dineInCash.paymentStatus).toBe('UNPAID');

    await markAllTicketsReadyFromTill({
      orderId: dineInCash.id,
      actorId: fx.adminId,
      actorName: fx.adminName,
    });

    const served = await handoffReadyOrder({
      orderId: dineInCash.id,
      to: 'SERVED',
      actorId: fx.adminId,
      actorName: fx.adminName,
      actorPerms: allPerms,
    });
    // Still UNPAID -> must remain SERVED, not COMPLETED
    expect(served.status).toBe('SERVED');

    const completedEarly = await db.$transaction((tx) => tryCompleteOrder(tx, dineInCash.id));
    expect(completedEarly).toBe(false);

    // Take $20.00 cash for $14.50 bill -> change $5.50 -> auto-COMPLETED
    const paidCash = await recordTillPayment({
      orderId: dineInCash.id,
      method: 'CASH',
      amountCents: dineInCash.totalCents,
      tenderedCents: 2000,
      idempotencyKey: `pay_s16_${crypto.randomUUID()}`,
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    expect(paidCash.status).toBe('COMPLETED');
    expect(paidCash.paymentStatus).toBe('PAID');
    expect(paidCash.payments[0]?.changeCents).toBe(2000 - dineInCash.totalCents);
  }, 60_000);

  it('Scenario 17: Dine-In split payment (Cash + EFTPOS) completes only when balance hits $0', async () => {
    const dineInSplit = await createOrder({
      storeId: fx.storeId,
      channel: 'TILL',
      fulfilment: 'DINE_IN',
      tableNumber: '6',
      covers: 2,
      timing: 'ASAP',
      customerName: 'Table 6 Split',
      idempotencyKey: `int_s17_${crypto.randomUUID()}`,
      createdById: fx.adminId,
      createdByName: fx.adminName,
      items: [{ variantId: fx.kebabRegVariantId, quantity: 2 }], // 2900 cents
    });

    await markAllTicketsReadyFromTill({
      orderId: dineInSplit.id,
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    await handoffReadyOrder({
      orderId: dineInSplit.id,
      to: 'SERVED',
      actorId: fx.adminId,
      actorName: fx.adminName,
      actorPerms: allPerms,
    });

    // First half: $14.50 Cash -> PARTIALLY_PAID, stays SERVED
    const part1 = await recordTillPayment({
      orderId: dineInSplit.id,
      method: 'CASH',
      amountCents: 1450,
      tenderedCents: 1450,
      idempotencyKey: `pay_s17a_${crypto.randomUUID()}`,
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    expect(part1.paymentStatus).toBe('PARTIALLY_PAID');
    expect(part1.status).toBe('SERVED');

    // Second half: remaining EFTPOS -> PAID & auto-COMPLETED
    const part2 = await recordTillPayment({
      orderId: dineInSplit.id,
      method: 'CARD_EFTPOS',
      amountCents: dineInSplit.totalCents - 1450,
      reference: 'EFTPOS-9911',
      idempotencyKey: `pay_s17b_${crypto.randomUUID()}`,
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    expect(part2.paymentStatus).toBe('PAID');
    expect(part2.status).toBe('COMPLETED');
    expect(part2.payments).toHaveLength(2);
  }, 60_000);

  it('Scenario 18: Web Pickup (PENDING_PAYMENT) -> idempotent confirmWebOrderPayment -> Ready -> Collected auto-COMPLETED', async () => {
    const webOrder = await createOrder({
      storeId: fx.storeId,
      channel: 'WEB',
      fulfilment: 'PICKUP',
      timing: 'ASAP',
      customerName: 'Web Pickup Customer',
      customerEmail: 'web@example.com.au',
      customerPhone: '0400 111 222',
      idempotencyKey: `int_s18_${crypto.randomUUID()}`,
      items: [{ variantId: fx.kebabRegVariantId, quantity: 1 }],
    });

    expect(webOrder.status).toBe('PENDING_PAYMENT');
    expect(webOrder.paymentStatus).toBe('UNPAID');

    const payKey = `stripe_pi_${crypto.randomUUID()}`;
    const confirmed = await confirmWebOrderPayment({
      orderId: webOrder.id,
      amountCents: webOrder.totalCents,
      stripePiId: payKey,
      idempotencyKey: payKey,
    });
    expect(confirmed.status).toBe('IN_KITCHEN');
    expect(confirmed.paymentStatus).toBe('PAID');

    // Idempotent replay of webhook confirmation
    const replayed = await confirmWebOrderPayment({
      orderId: webOrder.id,
      amountCents: webOrder.totalCents,
      stripePiId: payKey,
      idempotencyKey: payKey,
    });
    expect(replayed.amountPaidCents).toBe(webOrder.totalCents);

    await markAllTicketsReadyFromTill({
      orderId: webOrder.id,
      actorId: fx.adminId,
      actorName: fx.adminName,
    });

    // Handoff COLLECTED -> auto-COMPLETED immediately because already PAID
    const collected = await handoffReadyOrder({
      orderId: webOrder.id,
      to: 'COLLECTED',
      actorId: fx.adminId,
      actorName: fx.adminName,
      actorPerms: allPerms,
    });
    expect(collected.status).toBe('COMPLETED');
    expect(collected.completedAt).not.toBeNull();
  }, 60_000);

  it('Scenario 20: Dine-In Round 2 creates round 2 tickets only, reopens to IN_KITCHEN, and combines bill', async () => {
    const order = await createOrder({
      storeId: fx.storeId,
      channel: 'TILL',
      fulfilment: 'DINE_IN',
      tableNumber: '12',
      covers: 2,
      timing: 'ASAP',
      customerName: 'Table 12 Rounds',
      idempotencyKey: `int_s20_${crypto.randomUUID()}`,
      createdById: fx.adminId,
      createdByName: fx.adminName,
      items: [{ variantId: fx.kebabRegVariantId, quantity: 1 }], // 1450
    });
    const round1Total = order.totalCents;

    await markAllTicketsReadyFromTill({
      orderId: order.id,
      actorId: fx.adminId,
      actorName: fx.adminName,
    });
    await handoffReadyOrder({
      orderId: order.id,
      to: 'SERVED',
      actorId: fx.adminId,
      actorName: fx.adminName,
      actorPerms: allPerms,
    });

    // Add Round 2: 1x Full Pide (2200)
    const updated = await addDineInRound({
      orderId: order.id,
      items: [{ variantId: fx.pideFullVariantId, quantity: 1 }],
      actorId: fx.adminId,
      actorName: fx.adminName,
    });

    expect(updated.currentRound).toBe(2);
    expect(updated.status).toBe('IN_KITCHEN');
    expect(updated.totalCents).toBe(round1Total + 2200);
    expect(updated.items.filter((i) => i.round === 1)).toHaveLength(1);
    expect(updated.items.filter((i) => i.round === 2)).toHaveLength(1);

    const round1Tickets = updated.tickets.filter((t) => t.round === 1);
    const round2Tickets = updated.tickets.filter((t) => t.round === 2);
    expect(round1Tickets.every((t) => t.status === 'READY')).toBe(true);
    expect(round2Tickets).toHaveLength(1);
    expect(round2Tickets[0]?.status).toBe('NEW');
  }, 60_000);
});
