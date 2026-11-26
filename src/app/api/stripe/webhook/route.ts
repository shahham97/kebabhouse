import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { confirmWebOrderPayment } from '@/modules/orders/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PaymentIntentPayload {
  id: string;
  amount_received?: number;
  amount?: number;
  metadata?: Record<string, string | undefined>;
  charges?: {
    data?: Array<{
      payment_method_details?: {
        card?: {
          brand?: string;
          last4?: string;
        };
      };
    }>;
  };
}

interface ParsedStripeEvent {
  id: string;
  type: string;
  data: {
    object: PaymentIntentPayload;
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  let event: ParsedStripeEvent;

  if (webhookSecret && stripeKey) {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }
    try {
      const stripe = new Stripe(stripeKey);
      const verified = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      event = verified as unknown as ParsedStripeEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid Stripe signature';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else {
    try {
      const parsed = JSON.parse(rawBody) as Partial<ParsedStripeEvent>;
      if (!parsed.id || !parsed.type || !parsed.data?.object) {
        return NextResponse.json({ error: 'Malformed webhook payload' }, { status: 400 });
      }
      event = parsed as ParsedStripeEvent;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  // Idempotent StripeEvent insert
  try {
    await db.stripeEvent.create({
      data: {
        id: event.id,
        type: event.type,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const orderId = pi.metadata?.orderId;
    if (orderId) {
      const card = pi.charges?.data?.[0]?.payment_method_details?.card;
      const amountCents = pi.amount_received ?? pi.amount ?? 0;

      await confirmWebOrderPayment({
        orderId,
        amountCents,
        stripePiId: pi.id,
        cardBrand: card?.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card',
        cardLast4: card?.last4 ?? '4242',
        idempotencyKey: `stripe:${pi.id}`,
      });
    }
  }

  return NextResponse.json({ received: true, eventId: event.id });
}
