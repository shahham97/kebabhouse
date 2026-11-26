import { applyBps, calcInclusiveGst } from '@/lib/money';

export interface PricedModifierInput {
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaCents: number;
}

export interface PricingLineInput {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  basePriceCents: number;
  taxCode: string;
  stationId: string;
  stationName: string;
  quantity: number;
  notes?: string;
  modifiers: PricedModifierInput[];
}

export interface PricingContext {
  deliveryFeeCents: number;
  coupon?: { kind: 'PERCENT' | 'FIXED'; value: number; minSpendCents: number } | null;
  manualDiscountPct?: number;
  loyaltyRedeemCents?: number;
  cardSurchargeBps?: number;
  holidaySurchargeBps?: number;
  gstRatePct?: number;
  gstRegistered?: boolean;
}

export interface PricedLine extends PricingLineInput {
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  surchargeCents: number;
  gstCents: number;
  totalCents: number;
}

/**
 * Pure server-side pricing engine. All money in integer AUD cents.
 * Never trusts client-supplied totals.
 */
export function calculateOrderPricing(
  items: PricingLineInput[],
  ctx: PricingContext
): PricingResult {
  const lines: PricedLine[] = items.map((item) => {
    const modDelta = item.modifiers.reduce((sum, m) => sum + m.priceDeltaCents, 0);
    const unitPriceCents = Math.max(0, item.basePriceCents + modDelta);
    const qty = Math.max(1, Math.floor(item.quantity));
    return {
      ...item,
      quantity: qty,
      unitPriceCents,
      lineTotalCents: unitPriceCents * qty,
    };
  });

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);

  let discountCents = 0;
  if (ctx.coupon && subtotalCents >= ctx.coupon.minSpendCents) {
    if (ctx.coupon.kind === 'PERCENT') {
      discountCents += Math.round((subtotalCents * ctx.coupon.value) / 100);
    } else {
      discountCents += ctx.coupon.value;
    }
  }

  if (ctx.manualDiscountPct && ctx.manualDiscountPct > 0) {
    discountCents += Math.round((subtotalCents * ctx.manualDiscountPct) / 100);
  }

  if (ctx.loyaltyRedeemCents && ctx.loyaltyRedeemCents > 0) {
    discountCents += ctx.loyaltyRedeemCents;
  }

  discountCents = Math.min(discountCents, subtotalCents);

  const deliveryFeeCents = Math.max(0, ctx.deliveryFeeCents || 0);
  const preSurcharge = Math.max(0, subtotalCents - discountCents + deliveryFeeCents);

  const surchargeCents =
    applyBps(preSurcharge, ctx.cardSurchargeBps ?? 0) +
    applyBps(preSurcharge, ctx.holidaySurchargeBps ?? 0);

  const totalCents = preSurcharge + surchargeCents;

  // Compute GST-inclusive tax only on GST-taxable proportion
  const taxableLinesSubtotal = lines
    .filter((l) => l.taxCode !== 'GST_FREE')
    .reduce((sum, l) => sum + l.lineTotalCents, 0);

  const taxableRatio = subtotalCents > 0 ? taxableLinesSubtotal / subtotalCents : 1;
  const taxableTotal = Math.round((subtotalCents - discountCents) * taxableRatio) + deliveryFeeCents + surchargeCents;
  const gstCents =
    ctx.gstRegistered === false ? 0 : calcInclusiveGst(taxableTotal, ctx.gstRatePct ?? 10);

  return {
    lines,
    subtotalCents,
    discountCents,
    deliveryFeeCents,
    surchargeCents,
    gstCents,
    totalCents,
  };
}
