/**
 * Shopping units.
 *
 * The pantry ledger works in grams throughout, which is right for the
 * arithmetic and wrong for a shopping list - nobody buys 1400 g of flour.
 * This is the one place grams become the unit a shopper thinks in.
 */

/** Grams, shown as kg once that is the more natural reading. */
export function formatMass(grams: number): string {
  if (!Number.isFinite(grams)) return '—';
  if (Math.abs(grams) >= 1000) {
    const kg = grams / 1000;
    // A round kilo loses its decimal; 1.4 kg keeps it.
    return `${kg.toFixed(grams % 1000 === 0 ? 0 : 1)} kg`;
  }
  return `${Math.round(grams)} g`;
}
