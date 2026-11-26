'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { defineAction } from '@/lib/action';
import {
  createStaffSession,
  destroyStaffSession,
  verifySecret,
  type StaffActor,
} from '@/lib/auth';
import { db } from '@/lib/db';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors';
import { CACHE_TAGS, safeRevalidateTag } from '@/lib/cache';
import { publishRealtime } from '@/lib/realtime';
import {
  addDineInRound,
  cancelOrder,
  createOrder,
  handoffReadyOrder,
  markAllTicketsReadyFromTill,
  recordTillPayment,
} from '@/modules/orders/service';
import { resolveStaffPortalAccess, staffLoginSchema } from '@/modules/auth/schemas';

function resolveStaffRedirect(
  isSystem: boolean,
  permKeys: Set<string>
): string {
  const decision = resolveStaffPortalAccess({
    portal: 'staff',
    isSuperAdmin: isSystem,
    permissions: permKeys,
  });
  return decision.allowed ? decision.redirectTo : '/till';
}

function asStaff(actor: { type: string }): StaffActor {
  if (actor.type !== 'staff') {
    throw new UnauthorizedError('Staff sign-in required');
  }
  return actor as StaffActor;
}

export const staffLoginAction = defineAction({
  name: 'staff.login',
  permission: 'public',
  rateLimit: 'login',
  audit: false,
  schema: staffLoginSchema,
  handler: async (input) => {
    const user = await db.staffUser.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        grants: { include: { permission: true } },
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await verifySecret(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const permKeys = new Set<string>([
      ...user.role.permissions.map((rp) => rp.permission.key),
      ...user.grants.map((g) => g.permission.key),
    ]);

    const access = resolveStaffPortalAccess({
      portal: input.portal ?? 'staff',
      isSuperAdmin: user.role.isSystem,
      permissions: permKeys,
    });
    if (!access.allowed) {
      throw new ForbiddenError(access.reason);
    }

    await db.staffUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), pinFailedCount: 0, pinLockedUntil: null },
    });

    await createStaffSession(user.id, user.sessionVersion);

    return {
      staffName: user.name,
      roleName: user.role.name,
      redirectTo: access.redirectTo,
    };
  },
});

const staffPinLoginSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
  staffUserId: z.string().min(1).optional(),
});

export const staffPinLoginAction = defineAction({
  name: 'staff.pin_login',
  permission: 'public',
  rateLimit: 'pin',
  audit: false,
  schema: staffPinLoginSchema,
  handler: async (input) => {
    const now = new Date();
    const candidates = await db.staffUser.findMany({
      where: {
        active: true,
        pinHash: { not: null },
        ...(input.staffUserId ? { id: input.staffUserId } : {}),
      },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        grants: { include: { permission: true } },
      },
    });

    let matched: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (!candidate.pinHash) continue;
      if (await verifySecret(input.pin, candidate.pinHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      const target = input.staffUserId && candidates.length === 1 ? candidates[0] : undefined;
      if (target) {
        const nextFails = target.pinFailedCount + 1;
        const lockUntil =
          nextFails >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null;
        await db.staffUser.update({
          where: { id: target.id },
          data: {
            pinFailedCount: nextFails,
            ...(lockUntil ? { pinLockedUntil: lockUntil } : {}),
          },
        });
        if (lockUntil) {
          throw new RateLimitedError(
            'Too many failed PIN attempts. Account PIN locked for 15 minutes.'
          );
        }
      }
      throw new UnauthorizedError('Invalid staff PIN');
    }

    if (matched.pinLockedUntil && matched.pinLockedUntil > now) {
      throw new RateLimitedError(
        'This staff PIN is temporarily locked due to failed attempts. Sign in with email and password.'
      );
    }

    await db.staffUser.update({
      where: { id: matched.id },
      data: {
        lastLoginAt: now,
        pinFailedCount: 0,
        pinLockedUntil: null,
      },
    });

    await createStaffSession(matched.id, matched.sessionVersion);

    const permKeys = new Set<string>([
      ...matched.role.permissions.map((rp) => rp.permission.key),
      ...matched.grants.map((g) => g.permission.key),
    ]);

    return {
      staffName: matched.name,
      roleName: matched.role.name,
      redirectTo: resolveStaffRedirect(matched.role.isSystem, permKeys),
    };
  },
});

export const staffLogoutAction = defineAction({
  name: 'staff.logout',
  permission: 'staff',
  schema: z.object({}).optional().default({}),
  handler: async () => {
    await destroyStaffSession();
    return { loggedOut: true };
  },
});

const orderItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  modifierOptionIds: z.array(z.string().min(1)).optional().default([]),
  notes: z.string().max(300).optional().default(''),
});

const createTillOrderSchema = z.object({
  channel: z.enum(['TILL', 'PHONE']).default('TILL'),
  fulfilment: z.enum(['DINE_IN', 'PICKUP', 'DELIVERY']),
  tableNumber: z.string().max(20).optional().nullable(),
  covers: z.number().int().min(1).max(50).optional().nullable(),
  timing: z.enum(['ASAP', 'SCHEDULED']).default('ASAP'),
  scheduledFor: z.string().optional().nullable(),
  customerName: z.string().max(120).optional().default('Walk-in'),
  customerPhone: z.string().max(40).optional().default(''),
  customerEmail: z.string().max(120).optional().default(''),
  deliveryAddress: z.string().max(300).optional().nullable(),
  deliverySuburb: z.string().max(100).optional().nullable(),
  deliveryPostcode: z.string().max(12).optional().nullable(),
  notes: z.string().max(1000).optional().default(''),
  manualDiscountPct: z.number().min(0).max(100).optional().default(0),
  discountReason: z.string().max(120).optional().nullable(),
  idempotencyKey: z.string().min(8).max(120),
  items: z.array(orderItemSchema).min(1, 'Add at least one item to place an order'),
});

export const createTillOrderAction = defineAction({
  name: 'till.order.create',
  permission: 'orders.create',
  schema: createTillOrderSchema,
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);

    let appliedDiscountPct = 0;
    if (input.manualDiscountPct > 0) {
      if (!staff.isSuperAdmin && !staff.permissions.has('discounts.apply')) {
        throw new ForbiddenError('You do not have permission to apply discounts');
      }
      if (!staff.isSuperAdmin && input.manualDiscountPct > staff.maxDiscountPct) {
        throw new ValidationError(
          `Your role allows a maximum discount of ${staff.maxDiscountPct}%`
        );
      }
      appliedDiscountPct = Math.min(input.manualDiscountPct, staff.maxDiscountPct);
    }

    const scheduledDate =
      input.timing === 'SCHEDULED' && input.scheduledFor
        ? new Date(input.scheduledFor)
        : null;

    const order = await createOrder({
      storeId: staff.storeId,
      channel: input.channel,
      fulfilment: input.fulfilment,
      tableNumber: input.tableNumber,
      covers: input.covers,
      timing: input.timing,
      scheduledFor: scheduledDate,
      customerName: input.customerName || 'Walk-in',
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      deliveryAddress: input.deliveryAddress,
      deliverySuburb: input.deliverySuburb,
      deliveryPostcode: input.deliveryPostcode,
      notes: input.notes,
      manualDiscountPct: appliedDiscountPct,
      discountReason: input.discountReason ?? (appliedDiscountPct > 0 ? `Staff ${appliedDiscountPct}% discount` : null),
      idempotencyKey: input.idempotencyKey,
      createdById: staff.id,
      createdByName: staff.name,
      items: input.items,
    });

    revalidatePath('/till');
    revalidatePath('/station', 'layout');

    return {
      orderId: order.id,
      publicId: order.publicId,
      number: order.number,
      status: order.status,
      totalCents: order.totalCents,
    };
  },
});

export const markAllReadyAction = defineAction({
  name: 'till.order.mark_all_ready',
  permission: 'till.mark_all_ready',
  schema: z.object({ orderId: z.string().min(1) }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const updated = await markAllTicketsReadyFromTill({
      orderId: input.orderId,
      actorId: staff.id,
      actorName: staff.name,
    });
    revalidatePath('/till');
    revalidatePath('/station', 'layout');
    return { orderId: updated.id, status: updated.status };
  },
});

export const handoffOrderAction = defineAction({
  name: 'till.order.handoff',
  permission: 'till.use',
  schema: z.object({
    orderId: z.string().min(1),
    to: z.enum(['SERVED', 'COLLECTED', 'OUT_FOR_DELIVERY']),
    driverName: z.string().max(120).optional(),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const updated = await handoffReadyOrder({
      orderId: input.orderId,
      to: input.to,
      driverName: input.driverName,
      actorId: staff.id,
      actorName: staff.name,
      actorPerms: staff.permissions,
    });
    revalidatePath('/till');
    return { orderId: updated.id, status: updated.status };
  },
});

export const recordTillPaymentAction = defineAction({
  name: 'till.payment.record',
  permission: 'payments.take',
  schema: z.object({
    orderId: z.string().min(1),
    method: z.enum(['CASH', 'CARD_EFTPOS', 'OTHER']),
    amountCents: z.number().int().positive('Amount must be greater than $0.00'),
    tenderedCents: z.number().int().positive().optional(),
    reference: z.string().max(120).optional(),
    idempotencyKey: z.string().min(8).max(120),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const updated = await recordTillPayment({
      orderId: input.orderId,
      method: input.method,
      amountCents: input.amountCents,
      tenderedCents: input.tenderedCents,
      reference: input.reference,
      idempotencyKey: input.idempotencyKey,
      actorId: staff.id,
      actorName: staff.name,
    });
    revalidatePath('/till');
    return {
      orderId: updated.id,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      amountPaidCents: updated.amountPaidCents,
      totalCents: updated.totalCents,
    };
  },
});

export const addDineInRoundAction = defineAction({
  name: 'till.order.add_round',
  permission: 'orders.create',
  schema: z.object({
    orderId: z.string().min(1),
    items: z.array(orderItemSchema).min(1, 'Select at least one item for the new round'),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const updated = await addDineInRound({
      orderId: input.orderId,
      items: input.items,
      actorId: staff.id,
      actorName: staff.name,
    });
    revalidatePath('/till');
    revalidatePath('/station', 'layout');
    return {
      orderId: updated.id,
      currentRound: updated.currentRound,
      status: updated.status,
      totalCents: updated.totalCents,
    };
  },
});

export const cancelOrderAction = defineAction({
  name: 'till.order.cancel',
  permission: 'orders.cancel',
  schema: z.object({
    orderId: z.string().min(1),
    reason: z.string().trim().min(2, 'Please provide a cancellation reason').max(300),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const updated = await cancelOrder({
      orderId: input.orderId,
      reason: input.reason,
      actorId: staff.id,
      actorName: staff.name,
    });
    revalidatePath('/till');
    revalidatePath('/station', 'layout');
    return { orderId: updated.id, status: updated.status };
  },
});

export const toggleSoldOutAction = defineAction({
  name: 'till.product.toggle_sold_out',
  permission: 'catalog.manage',
  schema: z.object({
    productId: z.string().min(1),
    soldOut: z.boolean(),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const product = await db.product.findFirst({
      where: { id: input.productId, storeId: staff.storeId },
      select: { id: true, name: true },
    });
    if (!product) throw new NotFoundError('Product not found');

    const updated = await db.product.update({
      where: { id: product.id },
      data: { soldOut: input.soldOut },
      select: { id: true, soldOut: true },
    });

    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/till');
    await publishRealtime(`store:${staff.storeId}:till`, 'catalog.updated', {});
    return updated;
  },
});

export const toggleOnlinePauseAction = defineAction({
  name: 'till.store.toggle_online_pause',
  permission: 'till.use',
  schema: z.object({
    onlinePaused: z.boolean(),
    pauseMessage: z.string().max(500).optional().nullable(),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const updated = await db.store.update({
      where: { id: staff.storeId },
      data: {
        onlinePaused: input.onlinePaused,
        pauseMessage: input.onlinePaused
          ? input.pauseMessage?.trim() || 'Online ASAP ordering is temporarily paused due to high kitchen demand.'
          : null,
      },
      select: { onlinePaused: true, pauseMessage: true },
    });

    safeRevalidateTag(CACHE_TAGS.settings);
    revalidatePath('/till');
    await publishRealtime(`store:${staff.storeId}:till`, 'store.updated', {});
    return updated;
  },
});

export const toggleSoloModeAction = defineAction({
  name: 'till.store.toggle_solo_mode',
  permission: 'till.use',
  schema: z.object({
    soloMode: z.boolean(),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const updated = await db.store.update({
      where: { id: staff.storeId },
      data: { soloMode: input.soloMode },
      select: { soloMode: true },
    });

    safeRevalidateTag(CACHE_TAGS.settings);
    revalidatePath('/till');
    await publishRealtime(`store:${staff.storeId}:till`, 'store.updated', {});
    return updated;
  },
});

export const fireScheduledOrderAction = defineAction({
  name: 'till.order.fire_scheduled',
  permission: 'till.use',
  schema: z.object({ orderId: z.string().min(1) }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const now = new Date();

    const updated = await db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: input.orderId, storeId: staff.storeId },
      });
      if (!order) throw new NotFoundError('Order not found');
      if (order.status !== 'SCHEDULED') {
        throw new ConflictError('Order is no longer in SCHEDULED state');
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'IN_KITCHEN',
          releaseAt: now,
          sentToKitchenAt: now,
        },
      });

      await tx.stationTicket.updateMany({
        where: { orderId: order.id },
        data: { releaseAt: now },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromState: 'SCHEDULED',
          toState: 'IN_KITCHEN',
          actorType: 'STAFF',
          actorId: staff.id,
          actorName: staff.name,
          note: 'Fired scheduled order to kitchen immediately from Till',
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    });

    await publishRealtime(`store:${staff.storeId}:till`, 'order.fired', {
      orderId: updated.id,
      status: updated.status,
    });
    await publishRealtime(`order:${updated.publicId}`, 'order.status', {
      orderId: updated.id,
      status: updated.status,
    });
    revalidatePath('/till');
    revalidatePath('/station', 'layout');

    return { orderId: updated.id, status: updated.status };
  },
});

export const openCashSessionAction = defineAction({
  name: 'till.cash_session.open',
  permission: 'payments.take',
  schema: z.object({
    openingFloatCents: z.number().int().min(0).max(10_000_000),
    notes: z.string().max(300).optional().default(''),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);

    const existing = await db.cashSession.findFirst({
      where: { storeId: staff.storeId, status: 'OPEN' },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('A cash drawer session is already open');
    }

    const session = await db.cashSession.create({
      data: {
        storeId: staff.storeId,
        openedById: staff.id,
        openingFloatCents: input.openingFloatCents,
        status: 'OPEN',
        notes: input.notes,
      },
      select: { id: true, openingFloatCents: true, openedAt: true },
    });

    revalidatePath('/till');
    return {
      id: session.id,
      openingFloatCents: session.openingFloatCents,
      openedAt: session.openedAt.toISOString(),
    };
  },
});

export const closeCashSessionAction = defineAction({
  name: 'till.cash_session.close',
  permission: 'payments.take',
  schema: z.object({
    cashSessionId: z.string().min(1),
    countedCashCents: z.number().int().min(0).max(50_000_000),
    notes: z.string().max(300).optional().default(''),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);

    const session = await db.cashSession.findFirst({
      where: { id: input.cashSessionId, storeId: staff.storeId, status: 'OPEN' },
      include: {
        payments: {
          where: { method: 'CASH', status: 'SUCCEEDED' },
          select: { amountCents: true },
        },
        movements: {
          select: { kind: true, amountCents: true },
        },
      },
    });
    if (!session) {
      throw new NotFoundError('Open cash drawer session not found');
    }

    const cashSalesCents = session.payments.reduce((sum, p) => sum + p.amountCents, 0);
    const movementsNet = session.movements.reduce(
      (sum, m) => sum + (m.kind === 'IN' ? m.amountCents : -m.amountCents),
      0
    );
    const expectedCashCents = session.openingFloatCents + cashSalesCents + movementsNet;
    const varianceCents = input.countedCashCents - expectedCashCents;

    const closed = await db.cashSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        countedCashCents: input.countedCashCents,
        expectedCashCents,
        varianceCents,
        notes: input.notes ? `${session.notes ? `${session.notes} | ` : ''}${input.notes}` : session.notes,
      },
      select: {
        id: true,
        expectedCashCents: true,
        countedCashCents: true,
        varianceCents: true,
      },
    });

    revalidatePath('/till');
    return closed;
  },
});
