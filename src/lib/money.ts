/**
 * Every monetary amount in Sokoni is an integer count of cents. Floats are never
 * used for money anywhere in this codebase — not in the database, not in the
 * pricing engine, not in transport between server and client.
 */

const FORMATTER = new Intl.NumberFormat('en-KE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Renders cents as the canonical display string, e.g. 125000 -> "KSh 1,250.00". */
export function formatMoney(cents: number): string {
  if (!Number.isFinite(cents)) throw new Error('formatMoney requires a finite number of cents');
  const negative = cents < 0;
  const body = FORMATTER.format(Math.abs(cents) / 100);
  return `${negative ? '-' : ''}KSh ${body}`;
}

/**
 * Round-half-up on the magnitude of the value. JavaScript's Math.round rounds
 * -0.5 up to -0, which is the wrong direction for a discount, so the sign is
 * handled explicitly.
 */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(Math.abs(value)) : Math.round(value);
}

/** Parses a user-entered shilling amount ("1250.50") into cents. */
export function parseShillingsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole = '0', fraction = ''] = trimmed.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
