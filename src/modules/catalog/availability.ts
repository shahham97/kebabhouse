export interface RecipeStockInput {
  quantity: number | string;
  onHand: number | string;
}

export type CustomerAvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'COMING_SOON';

export interface VariantAvailabilityResult {
  maxServings: number | null;
  computedOutOfStock: boolean;
  isOrderable: boolean;
  customerStatus: CustomerAvailabilityStatus;
}

export interface CustomerVariantAvailability {
  isOrderable: boolean;
  status: CustomerAvailabilityStatus;
}

/**
 * Enforces the business invariant:
 * When `comingSoon` is toggled ON, `active` MUST be set to `false` (disabled)
 * so the variant cannot be ordered or quick-added.
 */
export function normalizeVariantFlags(flags: {
  active: boolean;
  comingSoon: boolean;
  soldOut: boolean;
}): { active: boolean; comingSoon: boolean; soldOut: boolean } {
  if (flags.comingSoon) {
    return { active: false, comingSoon: true, soldOut: flags.soldOut };
  }
  return { active: flags.active, comingSoon: false, soldOut: flags.soldOut };
}

/**
 * Computes runtime stock availability for a product variant from its ingredient recipe lines.
 * - If recipeLines exist: maxServings = floor(min(onHand / qty)) across all required ingredients.
 * - If recipeLines is empty: maxServings = null (not recipe-limited).
 * - Stock Out is auto-toggled when maxServings === 0 OR manual soldOut is true.
 */
export function computeVariantAvailability(args: {
  active: boolean;
  soldOut: boolean;
  comingSoon: boolean;
  recipeLines: RecipeStockInput[];
}): VariantAvailabilityResult {
  let maxServings: number | null = null;

  if (args.recipeLines.length > 0) {
    let minPossible = Infinity;
    for (const line of args.recipeLines) {
      const need = Number(line.quantity);
      const have = Number(line.onHand);
      if (!Number.isFinite(need) || need <= 0) continue;
      const possible = Number.isFinite(have) && have > 0 ? Math.floor(have / need) : 0;
      if (possible < minPossible) minPossible = possible;
    }
    maxServings = Number.isFinite(minPossible) ? Math.max(0, minPossible) : null;
  }

  const computedOutOfStock = args.soldOut || (maxServings !== null && maxServings <= 0);
  const isOrderable = args.active && !args.comingSoon && !computedOutOfStock;

  let customerStatus: CustomerAvailabilityStatus = 'AVAILABLE';
  if (args.comingSoon) {
    customerStatus = 'COMING_SOON';
  } else if (!args.active || computedOutOfStock) {
    customerStatus = 'UNAVAILABLE';
  }

  return {
    maxServings,
    computedOutOfStock,
    isOrderable,
    customerStatus,
  };
}

/**
 * Strictly redacts internal stock counts before sending variant availability to customers.
 * Customers NEVER see numeric stock counts — only AVAILABLE / UNAVAILABLE / COMING_SOON.
 */
export function toCustomerVariantView(
  avail: VariantAvailabilityResult
): CustomerVariantAvailability {
  return {
    isOrderable: avail.isOrderable,
    status: avail.customerStatus,
  };
}
