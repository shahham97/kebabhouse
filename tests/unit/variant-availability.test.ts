import { describe, expect, it } from 'vitest';
import {
  computeVariantAvailability,
  normalizeVariantFlags,
  toCustomerVariantView,
} from '@/modules/catalog/availability';

describe('TDD Slice 1 — Runtime Variant Stock & Availability Seam', () => {
  it('computes exact maxServings from limiting ingredient recipe line', () => {
    const res = computeVariantAvailability({
      active: true,
      soldOut: false,
      comingSoon: false,
      recipeLines: [
        { quantity: 0.25, onHand: 1.0 }, // 4 servings
        { quantity: 1, onHand: 2 },      // 2 servings (limiting!)
      ],
    });
    expect(res.maxServings).toBe(2);
    expect(res.computedOutOfStock).toBe(false);
    expect(res.isOrderable).toBe(true);
    expect(res.customerStatus).toBe('AVAILABLE');
  });

  it('auto-toggles Stock Out when any required ingredient cannot cover 1 serving', () => {
    const res = computeVariantAvailability({
      active: true,
      soldOut: false,
      comingSoon: false,
      recipeLines: [
        { quantity: 0.25, onHand: 0.1 }, // 0 servings
        { quantity: 1, onHand: 50 },
      ],
    });
    expect(res.maxServings).toBe(0);
    expect(res.computedOutOfStock).toBe(true);
    expect(res.isOrderable).toBe(false);
    expect(res.customerStatus).toBe('UNAVAILABLE');
  });

  it('treats variants with no recipe lines as unlimited unless manually soldOut/disabled', () => {
    const res = computeVariantAvailability({
      active: true,
      soldOut: false,
      comingSoon: false,
      recipeLines: [],
    });
    expect(res.maxServings).toBeNull();
    expect(res.computedOutOfStock).toBe(false);
    expect(res.isOrderable).toBe(true);
  });

  it('automatically disables variant when comingSoon is toggled ON', () => {
    const normalized = normalizeVariantFlags({ active: true, comingSoon: true, soldOut: false });
    expect(normalized.comingSoon).toBe(true);
    expect(normalized.active).toBe(false);

    const avail = computeVariantAvailability({
      ...normalized,
      recipeLines: [{ quantity: 0.2, onHand: 10 }],
    });
    expect(avail.isOrderable).toBe(false);
    expect(avail.customerStatus).toBe('COMING_SOON');
  });

  it('redacts numeric stock count from customer view while keeping unavailable status', () => {
    const avail = computeVariantAvailability({
      active: true,
      soldOut: false,
      comingSoon: false,
      recipeLines: [{ quantity: 0.25, onHand: 5 }],
    });
    const customerView = toCustomerVariantView(avail);
    expect(customerView).toEqual({
      isOrderable: true,
      status: 'AVAILABLE',
    });
    expect('maxServings' in customerView).toBe(false);
  });
});
