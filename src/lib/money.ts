const audFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format integer cents as Australian dollars (e.g. 1450 -> "$14.50"). */
export function formatAUD(cents: number): string {
  return audFormatter.format((cents || 0) / 100);
}

/**
 * Australian GST-inclusive calculation per ATO rules:
 * GST = 1/11 of GST-inclusive taxable total, rounded to nearest cent.
 */
export function calcInclusiveGst(taxableCents: number, gstRatePct = 10): number {
  if (taxableCents <= 0 || gstRatePct <= 0) return 0;
  return Math.round((taxableCents * gstRatePct) / (100 + gstRatePct));
}

/** Basis points calculation (e.g. 150 bps = 1.50%). */
export function applyBps(amountCents: number, bps: number): number {
  if (amountCents <= 0 || bps <= 0) return 0;
  return Math.round((amountCents * bps) / 10000);
}

/** Australian 5-cent Swedish rounding for cash tenders. */
export function roundCashAU(cents: number): number {
  return Math.round(cents / 5) * 5;
}
