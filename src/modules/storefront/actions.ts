'use server';

import { z } from 'zod';
import crypto from 'crypto';
import { defineAction } from '@/lib/action';
import {
  createCustomerSession,
  destroyCustomerSession,
  hashSecret,
  verifySecret,
} from '@/lib/auth';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { confirmWebOrderPayment, createOrder } from '@/modules/orders/service';
import { STORE_SLUG } from './queries';

const postcodeSchema = z.object({
  postcode: z.string().trim().min(3, 'Enter a valid Australian postcode').max(10),
});

export const checkDeliveryPostcodeAction = defineAction({
  name: 'storefront.checkPostcode',
  permission: 'public',
  schema: postcodeSchema,
  audit: false,
  handler: async (input, { db }) => {
    const store = await db.store.findUnique({
      where: { slug: STORE_SLUG },
      select: { id: true },
    });
    if (!store) throw new NotFoundError('Store not found');

    const zones = await db.deliveryZone.findMany({
      where: { storeId: store.id, active: true },
    });

    const postcode = input.postcode.trim();
    const matched = zones.find((z) =>
      z.postcodes
        .split(',')
        .map((p) => p.trim())
        .includes(postcode)
    );

    if (!matched) {
      return {
        deliverable: false as const,
        postcode,
        message: "We don't deliver there yet, try Pickup!",
      };
    }

    return {
      deliverable: true as const,
      postcode,
      zone: {
        id: matched.id,
        name: matched.name,
        feeCents: matched.feeCents,
        minOrderCents: matched.minOrderCents,
        travelMinutes: matched.travelMinutes,
      },
    };
  },
});

const validateCouponSchema = z.object({
  code: z.string().trim().min(2, 'Enter a coupon code').max(40),
  subtotalCents: z.number().int().min(0),
});

export const validateCouponAction = defineAction({
  name: 'storefront.validateCoupon',
  permission: 'public',
  rateLimit: 'coupon',
  schema: validateCouponSchema,
  audit: false,
  handler: async (input, { db }) => {
    const store = await db.store.findUnique({
      where: { slug: STORE_SLUG },
      select: { id: true },
    });
    if (!store) throw new NotFoundError('Store not found');

    const code = input.code.trim().toUpperCase();
    const coupon = await db.coupon.findFirst({
      where: { storeId: store.id, code, active: true },
    });

    if (!coupon) {
      throw new ValidationError(`Coupon "${code}" is invalid or no longer active`);
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new ValidationError(`Coupon "${code}" is not active yet`);
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      throw new ValidationError(`Coupon "${code}" has expired`);
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      throw new ValidationError(`Coupon "${code}" has reached its redemption limit`);
    }
    if (input.subtotalCents < coupon.minSpendCents) {
      const minDollars = (coupon.minSpendCents / 100).toFixed(2);
      throw new ValidationError(`Minimum spend of $${minDollars} required for "${code}"`);
    }

    const discountCents =
      coupon.kind === 'PERCENT'
        ? Math.min(input.subtotalCents, Math.round((input.subtotalCents * coupon.value) / 100))
        : Math.min(input.subtotalCents, coupon.value);

    return {
      code: coupon.code,
      kind: coupon.kind as 'PERCENT' | 'FIXED',
      value: coupon.value,
      minSpendCents: coupon.minSpendCents,
      discountCents,
      label:
        coupon.kind === 'PERCENT'
          ? `${coupon.value}% off`
          : `$${(coupon.value / 100).toFixed(2)} off`,
    };
  },
});

const placeWebOrderSchema = z.object({
  fulfilment: z.enum(['PICKUP', 'DELIVERY']),
  timing: z.enum(['ASAP', 'SCHEDULED']),
  scheduledFor: z.string().nullable().optional(),
  customerName: z.string().trim().min(2, 'Please enter your name').max(120),
  customerPhone: z.string().trim().min(6, 'Please enter a contact phone number').max(30),
  customerEmail: z.string().trim().email('Please enter a valid email address'),
  deliveryAddress: z.string().trim().max(300).nullable().optional(),
  deliverySuburb: z.string().trim().max(100).nullable().optional(),
  deliveryPostcode: z.string().trim().max(10).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
  couponCode: z.string().trim().max(40).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
  paymentMode: z.enum(['TEST_CARD', 'STRIPE']).default('TEST_CARD'),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        modifierOptionIds: z.array(z.string()).default([]),
        notes: z.string().max(300).optional(),
      })
    )
    .min(1, 'Your basket is empty'),
});

export const placeWebOrderAction = defineAction({
  name: 'storefront.placeWebOrder',
  permission: 'public',
  rateLimit: 'checkout',
  schema: placeWebOrderSchema,
  audit: false,
  handler: async (input, { actor, db }) => {
    const store = await db.store.findUnique({
      where: { slug: STORE_SLUG },
      select: { id: true },
    });
    if (!store) throw new NotFoundError('Store not found');

    if (input.fulfilment === 'DELIVERY') {
      if (!input.deliveryAddress?.trim()) {
        throw new ValidationError('Street address is required for delivery');
      }
      if (!input.deliveryPostcode?.trim()) {
        throw new ValidationError('Postcode is required for delivery');
      }
    }

    let scheduledDate: Date | null = null;
    if (input.timing === 'SCHEDULED') {
      if (!input.scheduledFor) {
        throw new ValidationError('Please select a scheduled date and time');
      }
      scheduledDate = new Date(input.scheduledFor);
      if (Number.isNaN(scheduledDate.getTime())) {
        throw new ValidationError('Invalid scheduled date/time');
      }
    }

    const order = await createOrder({
      storeId: store.id,
      channel: 'WEB',
      fulfilment: input.fulfilment,
      timing: input.timing,
      scheduledFor: scheduledDate,
      customerId: actor.type === 'customer' ? actor.id : null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      deliveryAddress: input.fulfilment === 'DELIVERY' ? input.deliveryAddress : null,
      deliverySuburb: input.fulfilment === 'DELIVERY' ? input.deliverySuburb : null,
      deliveryPostcode: input.fulfilment === 'DELIVERY' ? input.deliveryPostcode : null,
      notes: input.notes,
      couponCode: input.couponCode || null,
      idempotencyKey: input.idempotencyKey,
      items: input.items,
    });

    const isTestMode = !process.env.STRIPE_SECRET_KEY || input.paymentMode === 'TEST_CARD';
    if (isTestMode && order.paymentStatus !== 'PAID') {
      const paymentKey = `pay_web_${input.idempotencyKey}`;
      const stripePiId = `pi_test_${crypto.createHash('sha256').update(paymentKey).digest('hex').slice(0, 16)}`;
      await confirmWebOrderPayment({
        orderId: order.id,
        amountCents: order.totalCents,
        stripePiId,
        cardBrand: 'Visa',
        cardLast4: '4242',
        idempotencyKey: paymentKey,
      });
    }

    return {
      publicId: order.publicId,
      number: order.number,
      trackingToken: order.trackingToken,
      totalCents: order.totalCents,
    };
  },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(30).optional().default(''),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const customerRegisterAction = defineAction({
  name: 'customer.register',
  permission: 'public',
  rateLimit: 'login',
  schema: registerSchema,
  audit: false,
  handler: async (input, { db }) => {
    const email = input.email.toLowerCase();
    const existing = await db.customer.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('An account with this email already exists. Please sign in.');
    }

    const passwordHash = await hashSecret(input.password);
    const customer = await db.customer.create({
      data: {
        email,
        name: input.name,
        phone: input.phone,
        passwordHash,
        loyaltyAccount: {
          create: { balance: 0 },
        },
      },
    });

    await createCustomerSession(customer.id, customer.sessionVersion);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
    };
  },
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const customerLoginAction = defineAction({
  name: 'customer.login',
  permission: 'public',
  rateLimit: 'login',
  schema: loginSchema,
  audit: false,
  handler: async (input, { db }) => {
    const email = input.email.toLowerCase();
    const customer = await db.customer.findUnique({ where: { email } });
    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const ok = await verifySecret(input.password, customer.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await createCustomerSession(customer.id, customer.sessionVersion);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
    };
  },
});

export const customerLogoutAction = defineAction({
  name: 'customer.logout',
  permission: 'public',
  schema: z.object({}).optional(),
  audit: false,
  handler: async () => {
    await destroyCustomerSession();
    return { loggedOut: true };
  },
});
