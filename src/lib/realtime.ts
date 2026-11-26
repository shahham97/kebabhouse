import { EventEmitter } from 'events';

export interface RealtimeEvent {
  channel: string;
  event: string;
  payload: { orderId?: string; ticketId?: string; status?: string; stationCode?: string };
  at: number;
}

const globalForRealtime = globalThis as unknown as {
  skEventBus?: EventEmitter;
};

export const realtimeBus = globalForRealtime.skEventBus ?? new EventEmitter();
realtimeBus.setMaxListeners(100);
if (process.env.NODE_ENV !== 'production') {
  globalForRealtime.skEventBus = realtimeBus;
}

/**
 * Publish a lightweight ID-only realtime event (no PII, no prices).
 * Uses Ably REST API when ABLY_API_KEY is configured, plus local EventEmitter for SSE.
 */
export async function publishRealtime(
  channel: string,
  event: string,
  payload: RealtimeEvent['payload']
): Promise<void> {
  const msg: RealtimeEvent = { channel, event, payload, at: Date.now() };
  realtimeBus.emit('event', msg);
  realtimeBus.emit(channel, msg);

  const ablyKey = process.env.ABLY_API_KEY;
  if (ablyKey && ablyKey.includes(':')) {
    try {
      const auth = Buffer.from(ablyKey).toString('base64');
      await fetch(`https://rest.ably.io/channels/${encodeURIComponent(channel)}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: event, data: payload }),
      });
    } catch (err) {
      console.error('[Realtime] Ably publish error:', err);
    }
  }
}
