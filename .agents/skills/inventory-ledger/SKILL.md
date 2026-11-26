---
name: inventory-ledger
description: Ingredient inventory, recipes, stock reservation/reversal, purchasing receipts, stocktake and waste using an append-only ledger. Use for any inventory, recipe, vendor or purchase-order work.
---

# Inventory ledger

## Invariants
- Stock only changes by inserting `InventoryTransaction` rows; `InventoryItem.onHand` is updated **in the same transaction** by the same delta (or derived by SUM — pick one in DECISIONS.md; maintained column + nightly reconciliation job is recommended for RU cost).
- Ledger rows are never updated or deleted. Corrections are new rows.
- Idempotency: unique `(sourceType, sourceId, inventoryItemId, kind)`.
- Quantities are in the item's base unit, `Decimal(12,3)`; use a decimal library (Prisma `Decimal`) — never JS float maths.

## Reserve when the order is PLACED
```ts
const need = sumRecipes(order.items);           // Map<inventoryItemId, Decimal> incl. modifier recipe impact × qty
for (const [itemId, qty] of need) {
  await tx.inventoryTransaction.create({ data: { inventoryItemId: itemId, kind: 'ORDER_RESERVE',
    qty: qty.neg(), sourceType: 'ORDER', sourceId: order.id, actorId } });   // unique key blocks double reserve
  await tx.inventoryItem.update({ where: { id: itemId }, data: { onHand: { decrement: qty } } });
}
```
Catch unique-violation (P2002) → already reserved → no-op. Cancellation inserts `ORDER_RELEASE` with the opposite quantities read from the original rows (not recomputed from today's recipes).

## Negative stock policy
Configurable: `block` (reject order with a clear message), `warn` (allow, flag on dashboard). Default `warn` for a kitchen (counts are rarely perfect); low-stock alerts at `minThreshold`.

## Purchasing
PO lines ordered → `GoodsReceipt` per delivery → each receipt line posts `PURCHASE_RECEIPT` (+qty, unitCost) and updates PO line `receivedQty`; PO status derived (partial/received). Optionally update item cost (last cost or weighted average — decide in DECISIONS.md). Vendor payments are finance outflows linked to PO/invoice.

## Stocktake & waste
Count sheet → on submit, post `COUNT` rows for the variance (counted − expected). Waste: `WASTE` rows with reason code; both audited.

## Unit change
Explicit admin flow: choose factor (e.g. kg → g ×1000) → in one tx: post `UNIT_CONVERSION` marker, multiply onHand, threshold, cost (÷), and every RecipeLine qty → audit. Never silently change units.

## Tests
Scenario 2 (deduct 0.500 kg once), 3 (reversal), 4 (partial receipts) + modifier impact (+cheese) + concurrent orders on the last unit.
