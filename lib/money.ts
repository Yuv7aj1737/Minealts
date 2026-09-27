import type { Prisma } from "@prisma/client";

/**
 * Money formatting.
 *
 * Amounts are stored as `Decimal(12,2)` and must never be coerced to a
 * JavaScript number: 0.1 + 0.2 problems would show up as miscredited
 * balances, and the 94/6 split in Phase 7 depends on exact arithmetic.
 *
 * One platform currency. There is no `currency` column on `Listing.price` or
 * `Wallet.*Balance`, so every amount in the database is rupees and the symbol
 * lives here rather than being chosen per row. Introducing a second currency
 * later means adding that column *and* an FX table — retrofitting it into
 * free-text rendering is how marketplaces end up showing "$" next to "₹".
 *
 * Type-only import of Prisma, so this module is safe in a client bundle.
 */

export type Money = Prisma.Decimal | number | string;

/** ISO code of the single supported currency. */
export const PLATFORM_CURRENCY = "INR";

const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: PLATFORM_CURRENCY,
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Renders a stored amount, e.g. `₹1,23,456.78`. Bad input becomes `₹0.00`. */
export function formatMoney(value: Money | null | undefined): string {
  if (value === null || value === undefined) return formatter.format(0);
  return formatter.format(toNumber(value));
}

/**
 * Compact form for stat cards, e.g. `₹1.2L`.
 *
 * Indian numbering: `L` (lakh) is 1e5 and `Cr` (crore) is 1e7. `Intl` with
 * `notation: "compact"` gets this right for the locale, which is why it is
 * preferred over hand-rolled lakh/crore maths.
 */
const compactFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: PLATFORM_CURRENCY,
  currencyDisplay: "narrowSymbol",
  notation: "compact",
  maximumFractionDigits: 2,
});

/** Compact money for headline figures, falling back to the full form. */
export function formatMoneyCompact(value: Money | null | undefined): string {
  if (value === null || value === undefined) return compactFormatter.format(0);
  return compactFormatter.format(toNumber(value));
}

function toNumber(value: Money): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  // Prisma.Decimal: `toNumber` is safe here purely for display. Never use a
  // converted value in arithmetic.
  return value.toNumber();
}
