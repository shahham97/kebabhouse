import { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';

/**
 * Append-only inventory reservation when an order is PLACED.
 * Uses DB unique constraint (sourceType, sourceId, inventoryItemId, kind) for idempotency.
 */
export async function reserveStockForOrder(
  tx: Tx,
  orderId: string,
  items: Array<{ variantId?: string | null; quantity: number; modifierOptionIds?: string[] }>,
  actorId?: string | null
): Promise<void> {
  const variantIds = items.map((i) => i.variantId).filter((v): v is string => !!v);
  const modOptionIds = items.flatMap((i) => i.modifierOptionIds ?? []);

  if (variantIds.length === 0 && modOptionIds.length === 0) return;

  const recipeLines = await tx.recipeLine.findMany({
    where: {
      OR: [
        ...(variantIds.length > 0 ? [{ variantId: { in: variantIds } }] : []),
        ...(modOptionIds.length > 0 ? [{ modifierOptionId: { in: modOptionIds } }] : []),
      ],
    },
  });

  if (recipeLines.length === 0) return;

  // Aggregate total required qty per inventory item using Prisma.Decimal
  const needed = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    const qtyDec = new Prisma.Decimal(item.quantity);
    for (const rl of recipeLines) {
      if (rl.variantId && rl.variantId === item.variantId) {
        const prev = needed.get(rl.inventoryItemId) ?? new Prisma.Decimal(0);
        needed.set(rl.inventoryItemId, prev.add(rl.quantity.mul(qtyDec)));
      }
      if (rl.modifierOptionId && item.modifierOptionIds?.includes(rl.modifierOptionId)) {
        const prev = needed.get(rl.inventoryItemId) ?? new Prisma.Decimal(0);
        needed.set(rl.inventoryItemId, prev.add(rl.quantity.mul(qtyDec)));
      }
    }
  }

  for (const [inventoryItemId, totalQty] of needed) {
    if (totalQty.lte(0)) continue;
    try {
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId,
          kind: 'ORDER_RESERVE',
          quantity: totalQty.neg(),
          sourceType: 'ORDER',
          sourceId: orderId,
          actorId: actorId ?? null,
          reason: `Order reservation`,
        },
      });
      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { onHand: { decrement: totalQty } },
      });
    } catch (err) {
      // P2002 unique violation -> already reserved for this order, idempotent no-op
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        continue;
      }
      throw err;
    }
  }
}

/**
 * Reverse exact reserved quantities when an order is CANCELLED.
 * Reads original ORDER_RESERVE ledger rows rather than recomputing from current recipes.
 */
export async function releaseStockForOrder(
  tx: Tx,
  orderId: string,
  actorId?: string | null
): Promise<void> {
  const reserved = await tx.inventoryTransaction.findMany({
    where: { sourceType: 'ORDER', sourceId: orderId, kind: 'ORDER_RESERVE' },
  });

  for (const row of reserved) {
    const restoreQty = row.quantity.abs();
    try {
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: row.inventoryItemId,
          kind: 'ORDER_RELEASE',
          quantity: restoreQty,
          sourceType: 'ORDER',
          sourceId: orderId,
          actorId: actorId ?? null,
          reason: `Order cancellation reversal`,
        },
      });
      await tx.inventoryItem.update({
        where: { id: row.inventoryItemId },
        data: { onHand: { increment: restoreQty } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        continue;
      }
      throw err;
    }
  }
}

/**
 * Receive goods against a PurchaseOrder line (supports partial deliveries).
 */
export async function receivePurchaseOrderGoods(
  tx: Tx,
  args: {
    purchaseOrderId: string;
    invoiceRef?: string;
    notes?: string;
    actorId?: string | null;
    lines: Array<{ purchaseOrderLineId: string; receivedQty: number }>;
  }
) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id: args.purchaseOrderId },
    include: { lines: true },
  });

  const receipt = await tx.goodsReceipt.create({
    data: {
      purchaseOrderId: po.id,
      invoiceRef: args.invoiceRef ?? po.invoiceRef,
      receivedById: args.actorId ?? null,
      notes: args.notes ?? '',
    },
  });

  for (const input of args.lines) {
    if (input.receivedQty <= 0) continue;
    const poLine = po.lines.find((l) => l.id === input.purchaseOrderLineId);
    if (!poLine) continue;

    const qtyDec = new Prisma.Decimal(input.receivedQty);
    await tx.goodsReceiptLine.create({
      data: {
        goodsReceiptId: receipt.id,
        purchaseOrderLineId: poLine.id,
        inventoryItemId: poLine.inventoryItemId,
        receivedQty: qtyDec,
        unitCostCents: poLine.unitCostCents,
      },
    });

    await tx.purchaseOrderLine.update({
      where: { id: poLine.id },
      data: { receivedQty: { increment: qtyDec } },
    });

    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId: poLine.inventoryItemId,
        kind: 'PURCHASE_RECEIPT',
        quantity: qtyDec,
        unitCostCents: poLine.unitCostCents,
        sourceType: 'PO_RECEIPT',
        sourceId: receipt.id,
        actorId: args.actorId ?? null,
        reason: `PO ${po.number} receipt`,
      },
    });

    await tx.inventoryItem.update({
      where: { id: poLine.inventoryItemId },
      data: {
        onHand: { increment: qtyDec },
        costPerUnitCents: poLine.unitCostCents > 0 ? poLine.unitCostCents : undefined,
      },
    });
  }

  // Derive PO status
  const updatedLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: po.id } });
  const allReceived = updatedLines.every((l) => l.receivedQty.gte(l.orderedQty));
  const anyReceived = updatedLines.some((l) => l.receivedQty.gt(0));
  const newStatus = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status;

  await tx.purchaseOrder.update({
    where: { id: po.id },
    data: { status: newStatus, invoiceRef: args.invoiceRef || po.invoiceRef },
  });

  return { receiptId: receipt.id, status: newStatus };
}
