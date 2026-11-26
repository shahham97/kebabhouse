import { RateLimitedError } from './errors';

export type LimitName =
  | 'login'
  | 'pin'
  | 'checkout'
  | 'coupon'
  | 'contact'
  | 'ably';

const LIMITS: Record<LimitName, { max: number; windowMs: number }> = {
  login: { max: 5, windowMs: 15 * 60 * 1000 },
  pin: { max: 5, windowMs: 60 * 1000 },
  checkout: { max: 10, windowMs: 60 * 1000 },
  coupon: { max: 10, windowMs: 60 * 1000 },
  contact: { max: 3, windowMs: 10 * 60 * 1000 },
  ably: { max: 30, windowMs: 60 * 1000 },
};

const buckets = new Map<string, number[]>();

export async function checkRateLimit(name: LimitName, identifier: string): Promise<void> {
  const cfg = LIMITS[name];
  const now = Date.now();
  const key = `${name}:${identifier}`;
  const cutoff = now - cfg.windowMs;

  const existing = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (existing.length >= cfg.max) {
    throw new RateLimitedError(`Too many ${name} attempts. Please wait a moment.`);
  }
  existing.push(now);
  buckets.set(key, existing);
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
