'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { defineAction } from '@/lib/action';
import type { StaffActor } from '@/lib/auth';
import { db } from '@/lib/db';
import { ConflictError, NotFoundError, UnauthorizedError } from '@/lib/errors';
import { publishRealtime } from '@/lib/realtime';
import { setStationTicketStatus } from '@/modules/orders/service';

function asStaff(actor: { type: string }): StaffActor {
  if (actor.type !== 'staff') {
    throw new UnauthorizedError('Staff sign-in required');
  }
  return actor as StaffActor;
}

export const setTicketStatusAction = defineAction({
  name: 'kitchen.ticket.set_status',
  permission: 'kitchen.prepare',
  schema: z.object({
    ticketId: z.string().min(1),
    to: z.enum(['PREPARING', 'READY']),
    bumpedFromTill: z.boolean().optional().default(false),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);
    const updatedOrder = await setStationTicketStatus({
      ticketId: input.ticketId,
      to: input.to,
      actorId: staff.id,
      actorName: staff.name,
      bumpedFromTill: input.bumpedFromTill,
    });

    revalidatePath('/station', 'layout');
    revalidatePath('/till');

    return {
      orderId: updatedOrder.id,
      orderStatus: updatedOrder.status,
    };
  },
});

export const recallTicketAction = defineAction({
  name: 'kitchen.ticket.recall',
  permission: 'kitchen.recall',
  schema: z.object({
    ticketId: z.string().min(1),
  }),
  handler: async (input, { actor }) => {
    const staff = asStaff(actor);

    const result = await db.$transaction(async (tx) => {
      const ticket = await tx.stationTicket.findUnique({
        where: { id: input.ticketId },
        include: { order: true, station: true },
      });
      if (!ticket || ticket.order.storeId !== staff.storeId) {
        throw new NotFoundError('Kitchen ticket not found');
      }
      if (ticket.status !== 'READY') {
        throw new ConflictError('Only READY tickets can be recalled');
      }
      if (!['IN_KITCHEN', 'PREPARING', 'READY'].includes(ticket.order.status)) {
        throw new ConflictError('Order has already been handed off and cannot be recalled');
      }

      await tx.stationTicket.update({
        where: { id: ticket.id },
        data: {
          status: 'PREPARING',
          readyAt: null,
          bumpedFromTill: false,
          preparingAt: ticket.preparingAt ?? new Date(),
        },
      });

      if (ticket.order.status === 'READY') {
        await tx.order.update({
          where: { id: ticket.orderId },
          data: { status: 'PREPARING', readyAt: null },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: ticket.orderId,
          fromState: ticket.order.status,
          toState: 'PREPARING',
          actorType: 'STAFF',
          actorId: staff.id,
          actorName: staff.name,
          note: `Recalled ${ticket.station.name} ticket back to kitchen`,
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: ticket.orderId } });
    });

    await publishRealtime(`store:${result.storeId}:till`, 'order.updated', {
      orderId: result.id,
      status: result.status,
    });
    await publishRealtime(`order:${result.publicId}`, 'order.status', {
      orderId: result.id,
      status: result.status,
    });

    revalidatePath('/station', 'layout');
    revalidatePath('/till');

    return {
      orderId: result.id,
      orderStatus: result.status,
    };
  },
});
