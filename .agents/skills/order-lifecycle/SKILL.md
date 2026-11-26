---
name: order-lifecycle
description: Order pricing, the status state machine, the three fulfilment flows (dine-in pay-after, pickup, delivery), Kitchen tab (Preparing/Ready), Ready tab, Served/Collected/Dispatched, Till payments (cash/card/split), automatic completion on payment, Order History, station routing, "mark all ready", solo mode, pre-orders and side effects. Use for any work in orders, till, kitchen/stations, payments at the till, order history, scheduling or checkout.
---

# Order lifecycle

## 1. Pricing (`orders/pricing.ts`, pure function, heavily unit-tested)
`price(cartInput, catalogSnapshot, context) → { lines, subtotal, discounts, deliveryFee, surcharges, gst, total }` — all integer cents.
- Load active variants/modifiers/deals fresh from DB (not cache) at checkout and on Till submit.
- Validate modifier min/max per group, availability, deal eligibility, coupon rules, staff discount limit.
- GST: inclusive; `gst = round(taxableTotal / 11)` per ATO rounding; GST-free lines excluded. Rate from settings.

## 2. Two independent fields
- `status` = where the order is in the operation (kitchen → ready → served/collected/dispatched → completed).
- `paymentStatus` = `UNPAID | PARTIALLY_PAID | PAID | PARTIALLY_REFUNDED | REFUNDED`, derived from `Payment` rows.
- **`COMPLETED` = fulfilment step done AND fully paid.** Nobody sets it by hand.

## 3. State machine (`orders/state.ts`) — a table, not if/else
```ts
type Who = Permission | 'system';
export const transitions: Record<Status, Partial<Record<Status, Who>>> = {
  PENDING_PAYMENT:  { PLACED: 'system', CANCELLED: 'system' },                 // web; PLACED only via Stripe webhook
  PLACED:           { SCHEDULED: 'system', IN_KITCHEN: 'system', CANCELLED: 'orders.cancel' },
  SCHEDULED:        { IN_KITCHEN: 'system', CANCELLED: 'orders.cancel' },
  IN_KITCHEN:       { PREPARING: 'kitchen.prepare', READY: 'system', CANCELLED: 'orders.cancel' },
  PREPARING:        { READY: 'system', CANCELLED: 'orders.cancel' },          // READY when all tickets READY
  READY:            { SERVED: 'orders.serve', COLLECTED: 'orders.dispatch', OUT_FOR_DELIVERY: 'orders.dispatch',
                      PREPARING: 'kitchen.recall', CANCELLED: 'orders.cancel' },
  SERVED:           { COMPLETED: 'system', IN_KITCHEN: 'orders.create' },      // IN_KITCHEN = dine-in "add items" round
  COLLECTED:        { COMPLETED: 'system' },
  OUT_FOR_DELIVERY: { COMPLETED: 'system' },
  COMPLETED:        { PARTIALLY_REFUNDED: 'orders.refund', REFUNDED: 'orders.refund' },
  PARTIALLY_REFUNDED:{ REFUNDED: 'orders.refund' },
  CANCELLED:        {},
};
// fulfilment guard: SERVED only for DINE_IN, COLLECTED only for PICKUP, OUT_FOR_DELIVERY only for DELIVERY.
// COMPLETED is 'system' everywhere → no action, button or API can request it.
```
`transition(tx, orderId, from | from[], to, actor)`: check table + fulfilment guard + permission → `updateMany({ where: { id, status: { in: from } }, data: { status: to, [milestoneAt]: now } })` → `count !== 1` ⇒ `Conflict` → insert `OrderStatusHistory` → `effects[to]` in tx → queue post-commit effects.

`SCHEDULED → IN_KITCHEN` happens lazily (read-time): tickets carry `releaseAt`, the Kitchen query filters `releaseAt <= now()`, and the order status is moved on the first kitchen interaction or board load. No cron.

## 4. Entry points by flow
| Flow | Created as | Goes to kitchen when |
|---|---|---|
| Dine-in (Till, sales rep) | `PLACED`, `UNPAID`, `tableNumber` required | immediately (`IN_KITCHEN`) |
| Till/phone pickup or delivery | `PLACED`, paid now or `UNPAID` (pay on collection/delivery) | immediately, or at `releaseAt` if scheduled |
| Web pickup or delivery | `PENDING_PAYMENT` — **hidden from board & kitchen** | after Stripe webhook → `PLACED` → `IN_KITCHEN`/`SCHEDULED` |

## 5. Station tickets (`kitchen/service.ts`)
Ticket status: `NEW → PREPARING → READY`.
```ts
const stationOf = (i) => i.variant.stationId ?? i.product.stationId ?? i.category.defaultStationId ?? store.defaultStationId;

async function sendToKitchen(tx, order, round = 1) {            // creates tickets for one round
  for (const [stationId, items] of groupBy(order.items.filter(i => i.round === round), i => i.stationId))
    await tx.stationTicket.create({ data: { orderId: order.id, stationId, round, releaseAt: order.releaseAt,
      status: stations[stationId].autoComplete ? 'READY' : 'NEW' } });   // unique (orderId, stationId, round)
}

// Kitchen tab: auto-listed, Ready tickets drop off
const kitchenTab = (stationId) => db.stationTicket.findMany({
  where: { stationId, status: { in: ['NEW', 'PREPARING'] }, releaseAt: { lte: now() } },
  orderBy: { order: { promisedAt: 'asc' } }, take: 50, select: ticketCardSelect });

async function setTicket(tx, ticketId, to: 'PREPARING' | 'READY', actor, viaTill = false) {
  const from = to === 'PREPARING' ? ['NEW'] : ['NEW', 'PREPARING'];
  const r = await tx.stationTicket.updateMany({ where: { id: ticketId, status: { in: from } },
    data: { status: to, [`${to.toLowerCase()}At`]: now(), [`${to.toLowerCase()}ById`]: actor.id, bumpedFromTill: viaTill } });
  if (r.count === 0) return;                                     // double tap / other device → idempotent
  const { orderId } = await tx.stationTicket.findUniqueOrThrow({ where: { id: ticketId }, select: { orderId: true } });
  if (to === 'PREPARING') return transitionIf(tx, orderId, ['IN_KITCHEN'], 'PREPARING', actor);   // first one wins
  const open = await tx.stationTicket.count({ where: { orderId, status: { not: 'READY' } } });
  if (open === 0) await transition(tx, orderId, ['IN_KITCHEN', 'PREPARING'], 'READY', system);  // → Ready tab
}
```
- **Mark all ready** (Till, `till.mark_all_ready`): checklist by station → confirm → `setTicket(..., 'READY', actor, true)` for each open ticket in one tx → audited.
- **Solo mode**: same functions, Till shows the make-list with Preparing/Ready buttons.
- **Dine-in add items**: new `OrderItem`s with `round = n+1` → reprice → `sendToKitchen(tx, order, n+1)` → order back to `IN_KITCHEN`; earlier rounds untouched.

## 6. Cashier actions on the Ready tab
```ts
serve(orderId)    // DINE_IN:  READY → SERVED            then tryComplete
collect(orderId)  // PICKUP:   READY → COLLECTED          (dialog takes payment first if balanceDue > 0) then tryComplete
dispatch(orderId) // DELIVERY: READY → OUT_FOR_DELIVERY   (+driver name)  then tryComplete
```

## 7. Payments & automatic completion (`payments/service.ts`)
```ts
async function recordTender(tx, { orderId, method, amount, tendered, reference, idempotencyKey }, actor) {
  // method: CASH | CARD_EFTPOS (Till) ; CARD_ONLINE only from the Stripe webhook handler
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { total: true, amountPaid: true, status: true } });
  if (['CANCELLED', 'COMPLETED'].includes(o.status)) throw new Conflict('Order is closed');
  const due = o.total - o.amountPaid;
  if (amount <= 0 || amount > due) throw new ValidationError('Amount exceeds balance due');
  await tx.payment.create({ data: { orderId, method, amount, tendered, change: method === 'CASH' ? tendered - amount : null,
    reference, status: 'SUCCEEDED', takenById: actor.id, cashSessionId: actor.cashSessionId, idempotencyKey } }); // unique key
  const paid = await tx.order.update({ where: { id: orderId }, data: { amountPaid: { increment: amount } }, select: { amountPaid: true, total: true } });
  await tx.order.update({ where: { id: orderId }, data: { paymentStatus: paid.amountPaid >= paid.total ? 'PAID' : 'PARTIALLY_PAID' } });
  await tryComplete(tx, orderId);
}

const FULFILLED = { DINE_IN: 'SERVED', PICKUP: 'COLLECTED', DELIVERY: 'OUT_FOR_DELIVERY' } as const;
export async function tryComplete(tx, orderId) {                 // called after every tender and every serve/collect/dispatch
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { fulfilment: true } });
  const r = await tx.order.updateMany({
    where: { id: orderId, status: FULFILLED[o.fulfilment], paymentStatus: 'PAID' },
    data: { status: 'COMPLETED', completedAt: now() } });
  if (r.count === 1) { await history(tx, orderId, FULFILLED[o.fulfilment], 'COMPLETED', system); await effects.COMPLETED(tx, orderId); }
}
```
Concurrency: two tenders at once → the `amount > due` check plus a conditional update on `amountPaid` (or `SELECT … FOR UPDATE` on the order row) prevents over-payment; `tryComplete` is a conditional update, so completion happens once.

## 8. Board tabs (`/till`) — all fulfilment types together, tagged
| Tab | Query |
|---|---|
| Kitchen | status in `IN_KITCHEN, PREPARING` (+ per-station chips) |
| Ready | `READY` |
| Served – awaiting payment | `SERVED` and paymentStatus ≠ `PAID` |
| Out for delivery | `OUT_FOR_DELIVERY` (badge "payment due" if unpaid) |
| Scheduled | `SCHEDULED` / releaseAt > now |
| Order History | `COMPLETED`, `CANCELLED`, refunded — never live orders |
Tags on every card: `DINE-IN · T5` / `PICKUP` / `DELIVERY`, channel icon, ⏰ for pre-orders. `PENDING_PAYMENT` never shown.

**Order History detail** = items/modifiers/notes, totals + GST, payments (method, amount, tendered/change, card brand+last4 or terminal ref, Stripe id, time, staff), refunds, full timeline from `OrderStatusHistory` + ticket timestamps per station; actions reprint/email receipt, refund, reorder; filters + export; totals by method feed the Z report.

## 9. Pre-orders & slots
- `scheduledFor` validated: opening hours (store tz, DST-aware), ≥ now + minLead, ≤ maxDaysAhead, not in a closure, slot capacity (counted in tx; reject when full).
- `releaseAt = scheduledFor − max(prepMinutes) − (delivery ? zone.travelMinutes : 0)`; ASAP: `releaseAt = now`.

## 10. Side-effect table (`orders/effects.ts`)
| To | In tx | After commit |
|---|---|---|
| PLACED | reserve stock, order number, create round-1 tickets | notify `received`/`scheduled`, publish till + stations |
| PREPARING | — | notify `preparing` (push/live page only), publish |
| READY | — | notify `ready` (pickup) , publish, till chime |
| SERVED / COLLECTED | — | publish |
| OUT_FOR_DELIVERY | — | notify `out_for_delivery`, publish |
| COMPLETED | award loyalty (unique ledger key), finance inflow rows already written per payment | publish, receipt email if requested |
| CANCELLED | release stock, reverse loyalty, void/refund payments | notify `cancelled`, publish |
| REFUNDED | refund ledger, finance outflow, reverse points | notify `refunded` |

## Tests you must keep green
MASTER_PROMPT §18 scenarios 2, 3, 9–13 and 16–20, plus: two devices mark the last two tickets Ready at once → order READY once, one notification; two tenders submitted together → no over-payment, completed once.
