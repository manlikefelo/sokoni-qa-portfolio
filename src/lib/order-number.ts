/**
 * Human-facing order reference, e.g. SK-2026-000142. The sequence is derived from
 * the count of orders already placed in the calendar year, computed inside the
 * same transaction that creates the order so two concurrent checkouts cannot
 * land on the same number.
 */
export function formatOrderNumber(year: number, sequence: number): string {
  return `SK-${year}-${String(sequence).padStart(6, '0')}`;
}
