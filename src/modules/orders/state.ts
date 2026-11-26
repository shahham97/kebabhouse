import type { Permission } from '@/config/permissions';
import { ConflictError, ForbiddenError } from '@/lib/errors';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'SCHEDULED'
  | 'IN_KITCHEN'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COLLECTED'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export type FulfilmentType = 'DINE_IN' | 'PICKUP' | 'DELIVERY';

type Who = Permission | 'system';

/**
 * Single source of truth for all order state transitions.
 * COMPLETED is strictly 'system' — never triggered directly by any user/button.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Who>>> = {
  PENDING_PAYMENT: { PLACED: 'system', CANCELLED: 'system' },
  PLACED: { SCHEDULED: 'system', IN_KITCHEN: 'system', CANCELLED: 'orders.cancel' },
  SCHEDULED: { IN_KITCHEN: 'system', CANCELLED: 'orders.cancel' },
  IN_KITCHEN: { PREPARING: 'kitchen.prepare', READY: 'system', CANCELLED: 'orders.cancel' },
  PREPARING: { READY: 'system', CANCELLED: 'orders.cancel' },
  READY: {
    SERVED: 'orders.serve',
    COLLECTED: 'orders.dispatch',
    OUT_FOR_DELIVERY: 'orders.dispatch',
    PREPARING: 'kitchen.recall',
    CANCELLED: 'orders.cancel',
  },
  SERVED: { COMPLETED: 'system', IN_KITCHEN: 'orders.create' },
  COLLECTED: { COMPLETED: 'system' },
  OUT_FOR_DELIVERY: { COMPLETED: 'system' },
  COMPLETED: { PARTIALLY_REFUNDED: 'orders.refund', REFUNDED: 'orders.refund' },
  PARTIALLY_REFUNDED: { REFUNDED: 'orders.refund' },
  REFUNDED: {},
  CANCELLED: {},
};

export const FULFILLED_STATUS: Record<FulfilmentType, OrderStatus> = {
  DINE_IN: 'SERVED',
  PICKUP: 'COLLECTED',
  DELIVERY: 'OUT_FOR_DELIVERY',
};

export function assertValidTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfilment: FulfilmentType,
  actorPerms: Set<Permission> | 'system'
): void {
  const required = ORDER_TRANSITIONS[from]?.[to];
  if (!required) {
    throw new ConflictError(`Cannot transition order from ${from} to ${to}`);
  }

  // Fulfilment-specific terminal handoff guards
  if (to === 'SERVED' && fulfilment !== 'DINE_IN') {
    throw new ConflictError('Only DINE_IN orders can be marked Served');
  }
  if (to === 'COLLECTED' && fulfilment !== 'PICKUP') {
    throw new ConflictError('Only PICKUP orders can be marked Collected');
  }
  if (to === 'OUT_FOR_DELIVERY' && fulfilment !== 'DELIVERY') {
    throw new ConflictError('Only DELIVERY orders can be dispatched');
  }

  if (required === 'system') {
    if (actorPerms !== 'system') {
      throw new ForbiddenError(`Transition to ${to} is system-controlled only`);
    }
    return;
  }

  if (actorPerms !== 'system' && !actorPerms.has(required)) {
    throw new ForbiddenError(`Missing permission ${required} to move order to ${to}`);
  }
}

export function resolveStationId(args: {
  variantStationId?: string | null;
  productStationId?: string | null;
  categoryStationId?: string | null;
  storeDefaultStationId?: string | null;
}): string {
  const id =
    args.variantStationId ??
    args.productStationId ??
    args.categoryStationId ??
    args.storeDefaultStationId;
  if (!id) throw new ConflictError('No kitchen station configured for item');
  return id;
}
