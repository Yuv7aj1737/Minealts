/**
 * Minimal class-name joiner.
 *
 * Deliberately dependency-free: the project only needs string concatenation
 * with falsy filtering. Swap for `clsx` + `tailwind-merge` if variant
 * overriding ever becomes a requirement.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  for (const input of inputs) {
    if (!input) continue;
    if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else {
      out.push(String(input));
    }
  }

  return out.join(" ");
}
