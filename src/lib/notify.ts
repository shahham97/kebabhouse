import { db } from './db';

export type NotifyEvent =
  | 'RECEIVED'
  | 'SCHEDULED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

const EMAIL_EVENTS = new Set<NotifyEvent>(['RECEIVED', 'SCHEDULED', 'READY', 'OUT_FOR_DELIVERY', 'CANCELLED', 'REFUNDED']);

/**
 * Single notification dispatcher with DB-enforced idempotency on (orderId, event, channel).
 * Respects Resend free tier by skipping non-critical emails.
 */
export async function notifyOrder(
  event: NotifyEvent,
  order: { id: string; number: string; publicId: string; customerEmail: string; customerName: string }
): Promise<void> {
  const channels: Array<'LIVE' | 'EMAIL'> = ['LIVE'];
  if (order.customerEmail && EMAIL_EVENTS.has(event)) {
    channels.push('EMAIL');
  }

  for (const channel of channels) {
    try {
      await db.notificationLog.create({
        data: {
          orderId: order.id,
          event,
          channel,
          recipient: channel === 'EMAIL' ? order.customerEmail : order.publicId,
          status: 'SENT',
          detail: `Order ${order.number} — ${event}`,
        },
      });
    } catch {
      // Unique constraint (orderId, event, channel) -> already sent, idempotent no-op
    }
  }
}
