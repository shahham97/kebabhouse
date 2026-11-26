import { NextRequest } from 'next/server';
import { realtimeBus, type RealtimeEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get('channel') || '*';
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (eventName: string, data: unknown) => {
        try {
          const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream already closed
        }
      };

      send('connected', { channel, at: Date.now() });

      const onEvent = (msg: RealtimeEvent) => {
        if (channel === '*' || msg.channel === channel) {
          send(msg.event, msg);
        }
      };

      const eventKey = channel === '*' ? 'event' : channel;
      realtimeBus.on(eventKey, onEvent);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          // Ignore closed stream
        }
      }, 25_000);

      cleanup = () => {
        clearInterval(heartbeat);
        realtimeBus.off(eventKey, onEvent);
      };

      req.signal.addEventListener('abort', () => {
        cleanup?.();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
