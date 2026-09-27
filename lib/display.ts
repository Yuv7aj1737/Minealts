/**
 * Presentation helpers.
 *
 * Deliberately free of `server-only` and of any dependency on Prisma, so both
 * Server and Client Components can import them.
 */

/** Fallback avatar: the first letter of the display name. */
export function avatarInitials(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || "?";
}

/** Formats a date for display, returning a dash when the value is absent. */
export function formatDate(
  value: Date | string | null | undefined,
  locale = "en-GB",
): string {
  if (!value) return "—";

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
