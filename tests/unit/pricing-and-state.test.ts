import { describe, expect, it } from 'vitest';
import { applyBps, calcInclusiveGst, formatAUD, roundCashAU } from '@/lib/money';
import { calculateOrderPricing, type PricingLineInput } from '@/modules/orders/pricing';
import {
  assertValidTransition,
  resolveStationId,
  type FulfilmentType,
  type OrderStatus,
} from '@/modules/orders/state';
import { ALL_PERMISSION_KEYS, type Permission } from '@/config/permissions';
import { ConflictError, ForbiddenError } from '@/lib/errors';

function makeLine(overrides: Partial<PricingLineInput> = {}): PricingLineInput {
  return {
    productId: 'prod_kebab',
    productName: 'Signature Charcoal Kebab',
    variantId: 'var_reg',
    variantName: 'Regular',
    basePriceCents: 1450,
    taxCode: 'GST',
    stationId: 'st_kebab',
    stationName: 'Kebab Station',
    quantity: 1,
    modifiers: [],
    ...overrides,
  };
}

describe('Australian Money & ATO GST Helpers (src/lib/money.ts)', () => {
  it('formats integer AUD cents accurately with formatAUD', () => {
    expect(formatAUD(0)).toBe('$0.00');
    expect(formatAUD(1450)).toBe('$14.50');
    expect(formatAUD(10000)).toBe('$100.00');
    expect(formatAUD(123456)).toBe('$1,234.56');
  });

  it('calculates ATO 1/11 GST-inclusive tax component with calcInclusiveGst', () => {
    // $11.00 GST-inclusive => exactly $1.00 GST
    expect(calcInclusiveGst(1100)).toBe(100);
    // $18.50 GST-inclusive => 1850 * 10 / 110 = 168.18... => 168 cents ($1.68)
    expect(calcInclusiveGst(1850)).toBe(168);
    // $0 or negative => 0
    expect(calcInclusiveGst(0)).toBe(0);
    expect(calcInclusiveGst(-500)).toBe(0);
    // Custom rate 0% => 0
    expect(calcInclusiveGst(1100, 0)).toBe(0);
  });

  it('applies Australian 5-cent Swedish rounding for cash tenders', () => {
    expect(roundCashAU(100)).toBe(100);
    expect(roundCashAU(101)).toBe(100);
    expect(roundCashAU(102)).toBe(100);
    expect(roundCashAU(103)).toBe(105);
    expect(roundCashAU(104)).toBe(105);
    expect(roundCashAU(105)).toBe(105);
    expect(roundCashAU(107)).toBe(105);
    expect(roundCashAU(108)).toBe(110);
  });

  it('computes basis points accurately with applyBps', () => {
    // 150 bps = 1.50% of $20.00 = $0.30
    expect(applyBps(2000, 150)).toBe(30);
    // 1000 bps = 10% of $15.55 = $1.56 (rounded)
    expect(applyBps(1555, 1000)).toBe(156);
    expect(applyBps(0, 150)).toBe(0);
    expect(applyBps(2000, 0)).toBe(0);
  });
});

describe('Server-Side Order Pricing Engine (calculateOrderPricing)', () => {
  it('prices variants and modifier deltas across quantities', () => {
    const result = calculateOrderPricing(
      [
        makeLine({
          basePriceCents: 1450,
          quantity: 2,
          modifiers: [
            { groupName: 'Meat', optionId: 'm1', optionName: 'Mixed Lamb & Chicken', priceDeltaCents: 100 },
            { groupName: 'Extras', optionId: 'e1', optionName: 'Melted Tasty Cheese', priceDeltaCents: 150 },
          ],
        }),
      ],
      { deliveryFeeCents: 0, gstRatePct: 10, gstRegistered: true }
    );

    // (1450 + 100 + 150) * 2 = 3400
    expect(result.lines[0]?.unitPriceCents).toBe(1700);
    expect(result.lines[0]?.lineTotalCents).toBe(3400);
    expect(result.subtotalCents).toBe(3400);
    expect(result.discountCents).toBe(0);
    expect(result.totalCents).toBe(3400);
    expect(result.gstCents).toBe(calcInclusiveGst(3400));
  });

  it('applies PERCENT coupon when minSpendCents is satisfied and skips when below minSpend', () => {
    const line = makeLine({ basePriceCents: 1500, quantity: 1 });

    // Below $20.00 minSpend -> coupon ignored
    const belowMin = calculateOrderPricing([line], {
      deliveryFeeCents: 0,
      coupon: { kind: 'PERCENT', value: 15, minSpendCents: 2000 },
    });
    expect(belowMin.discountCents).toBe(0);
    expect(belowMin.totalCents).toBe(1500);

    // At $30.00 (>= $20.00 minSpend) -> 15% off = 450 cents
    const meetsMin = calculateOrderPricing([makeLine({ basePriceCents: 1500, quantity: 2 })], {
      deliveryFeeCents: 0,
      coupon: { kind: 'PERCENT', value: 15, minSpendCents: 2000 },
    });
    expect(meetsMin.subtotalCents).toBe(3000);
    expect(meetsMin.discountCents).toBe(450);
    expect(meetsMin.totalCents).toBe(2550);
  });

  it('applies FIXED coupon, manual discount, delivery fee, and card surcharge', () => {
    const result = calculateOrderPricing(
      [makeLine({ basePriceCents: 2000, quantity: 2 })], // subtotal 4000
      {
        deliveryFeeCents: 495,
        coupon: { kind: 'FIXED', value: 500, minSpendCents: 2500 }, // -500
        manualDiscountPct: 10, // -400 (10% of 4000)
        cardSurchargeBps: 150, // 1.50%
        gstRatePct: 10,
        gstRegistered: true,
      }
    );

    // subtotal 4000, discount 900, delivery 495 => preSurcharge = 3595
    // surcharge = round(3595 * 150 / 10000) = round(53.925) = 54
    // total = 3595 + 54 = 3649
    expect(result.subtotalCents).toBe(4000);
    expect(result.discountCents).toBe(900);
    expect(result.deliveryFeeCents).toBe(495);
    expect(result.surchargeCents).toBe(54);
    expect(result.totalCents).toBe(3649);
    expect(result.gstCents).toBe(calcInclusiveGst(3649));
  });

  it('caps combined discounts at subtotalCents so totals never go negative', () => {
    const result = calculateOrderPricing([makeLine({ basePriceCents: 1000, quantity: 1 })], {
      deliveryFeeCents: 0,
      coupon: { kind: 'FIXED', value: 2000, minSpendCents: 0 },
      manualDiscountPct: 50,
    });
    expect(result.discountCents).toBe(1000);
    expect(result.totalCents).toBe(0);
    expect(result.gstCents).toBe(0);
  });

  it('prorates GST using taxable ratio when basket contains GST_FREE items', () => {
    // $22.00 GST item + $22.00 GST_FREE item = $44.00 subtotal (50% taxable)
    const result = calculateOrderPricing(
      [
        makeLine({ basePriceCents: 2200, taxCode: 'GST' }),
        makeLine({ productId: 'prod_water', basePriceCents: 2200, taxCode: 'GST_FREE' }),
      ],
      {
        deliveryFeeCents: 0,
        gstRatePct: 10,
        gstRegistered: true,
      }
    );

    expect(result.totalCents).toBe(4400);
    // Only $22.00 is GST-taxable => 1/11 of $22.00 = $2.00 (200 cents)
    expect(result.gstCents).toBe(200);

    // If store is not GST registered => 0 GST
    const unregistered = calculateOrderPricing(
      [makeLine({ basePriceCents: 2200, taxCode: 'GST' })],
      { deliveryFeeCents: 0, gstRegistered: false }
    );
    expect(unregistered.gstCents).toBe(0);
  });
});

describe('Order State Machine Guards (assertValidTransition)', () => {
  const allStaffPerms = new Set<Permission>(ALL_PERMISSION_KEYS);

  it('strictly restricts COMPLETED to system only — rejects even Super Admin staff permissions', () => {
    const pairs: Array<[OrderStatus, FulfilmentType]> = [
      ['SERVED', 'DINE_IN'],
      ['COLLECTED', 'PICKUP'],
      ['OUT_FOR_DELIVERY', 'DELIVERY'],
    ];

    for (const [from, fulfilment] of pairs) {
      expect(() => assertValidTransition(from, 'COMPLETED', fulfilment, allStaffPerms)).toThrow(
        ForbiddenError
      );
      expect(() => assertValidTransition(from, 'COMPLETED', fulfilment, 'system')).not.toThrow();
    }
  });

  it('enforces fulfilment-specific handoffs (SERVED=DINE_IN, COLLECTED=PICKUP, OUT_FOR_DELIVERY=DELIVERY)', () => {
    // SERVED
    expect(() => assertValidTransition('READY', 'SERVED', 'DINE_IN', allStaffPerms)).not.toThrow();
    expect(() => assertValidTransition('READY', 'SERVED', 'PICKUP', allStaffPerms)).toThrow(
      ConflictError
    );
    expect(() => assertValidTransition('READY', 'SERVED', 'DELIVERY', allStaffPerms)).toThrow(
      ConflictError
    );

    // COLLECTED
    expect(() => assertValidTransition('READY', 'COLLECTED', 'PICKUP', allStaffPerms)).not.toThrow();
    expect(() => assertValidTransition('READY', 'COLLECTED', 'DINE_IN', allStaffPerms)).toThrow(
      ConflictError
    );
    expect(() => assertValidTransition('READY', 'COLLECTED', 'DELIVERY', allStaffPerms)).toThrow(
      ConflictError
    );

    // OUT_FOR_DELIVERY
    expect(() =>
      assertValidTransition('READY', 'OUT_FOR_DELIVERY', 'DELIVERY', allStaffPerms)
    ).not.toThrow();
    expect(() =>
      assertValidTransition('READY', 'OUT_FOR_DELIVERY', 'PICKUP', allStaffPerms)
    ).toThrow(ConflictError);
    expect(() =>
      assertValidTransition('READY', 'OUT_FOR_DELIVERY', 'DINE_IN', allStaffPerms)
    ).toThrow(ConflictError);
  });

  it('enforces PENDING_PAYMENT -> PLACED as system-only', () => {
    expect(() =>
      assertValidTransition('PENDING_PAYMENT', 'PLACED', 'PICKUP', allStaffPerms)
    ).toThrow(ForbiddenError);
    expect(() =>
      assertValidTransition('PENDING_PAYMENT', 'PLACED', 'PICKUP', 'system')
    ).not.toThrow();
  });

  it('rejects missing staff permission for staff-controlled transitions', () => {
    const emptyPerms = new Set<Permission>();
    expect(() => assertValidTransition('READY', 'SERVED', 'DINE_IN', emptyPerms)).toThrow(
      ForbiddenError
    );
    expect(() => assertValidTransition('IN_KITCHEN', 'CANCELLED', 'PICKUP', emptyPerms)).toThrow(
      ForbiddenError
    );
  });
});

describe('Station Routing Fallback (resolveStationId)', () => {
  it('resolves in strict priority order: variant -> product -> category -> store default', () => {
    expect(
      resolveStationId({
        variantStationId: 'st_variant',
        productStationId: 'st_product',
        categoryStationId: 'st_category',
        storeDefaultStationId: 'st_default',
      })
    ).toBe('st_variant');

    expect(
      resolveStationId({
        variantStationId: null,
        productStationId: 'st_product',
        categoryStationId: 'st_category',
        storeDefaultStationId: 'st_default',
      })
    ).toBe('st_product');

    expect(
      resolveStationId({
        variantStationId: null,
        productStationId: null,
        categoryStationId: 'st_category',
        storeDefaultStationId: 'st_default',
      })
    ).toBe('st_category');

    expect(
      resolveStationId({
        variantStationId: null,
        productStationId: null,
        categoryStationId: null,
        storeDefaultStationId: 'st_default',
      })
    ).toBe('st_default');
  });

  it('throws ConflictError when no station is configured at any level', () => {
    expect(() =>
      resolveStationId({
        variantStationId: null,
        productStationId: null,
        categoryStationId: null,
        storeDefaultStationId: null,
      })
    ).toThrow(ConflictError);
  });
});
