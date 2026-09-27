import Link from "next/link";

import { cn } from "@/lib/cn";
import { siteConfig } from "@/lib/constants";

/**
 * Original wordmark.
 *
 * The mark is a simple isometric "block" — an original construction, not a
 * reproduction of Minecraft textures or any other product's branding.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-hidden="true"
      className={cn("size-9", className)}
    >
      <defs>
        <linearGradient id="minealts-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="100%" stopColor="#d61a1a" />
        </linearGradient>
        <linearGradient id="minealts-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ad1414" />
          <stop offset="100%" stopColor="#7f1212" />
        </linearGradient>
        <linearGradient id="minealts-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8f1010" />
          <stop offset="100%" stopColor="#5c0d0d" />
        </linearGradient>
      </defs>

      {/* top face */}
      <path d="M20 3 38 12.5 20 22 2 12.5Z" fill="url(#minealts-top)" />
      {/* left face */}
      <path d="M2 12.5 20 22v15L2 27.5Z" fill="url(#minealts-left)" />
      {/* right face */}
      <path d="M38 12.5 20 22v15l18-10.5Z" fill="url(#minealts-right)" />
      {/* yellow accent seam */}
      <path d="M2 12.5 20 22l18-9.5" fill="none" stroke="#ffd233" strokeWidth="1.6" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  showWordmark = true,
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90",
        className,
      )}
    >
      <LogoMark className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-6" />
      {showWordmark ? (
        <span className="font-display text-xl font-bold tracking-tight text-ink-100">
          Mine<span className="text-brand-400">Alts</span>
        </span>
      ) : null}
      <span className="sr-only">{siteConfig.name} home</span>
    </Link>
  );
}
