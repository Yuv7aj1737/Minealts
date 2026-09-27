import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "brand" | "accent" | "success" | "warning";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-surface-300 bg-surface-200 text-ink-300",
  brand: "border-brand-500/35 bg-brand-500/12 text-brand-300",
  accent: "border-accent-400/35 bg-accent-400/12 text-accent-200",
  success: "border-emerald-500/35 bg-emerald-500/12 text-emerald-300",
  warning: "border-amber-500/35 bg-amber-500/12 text-amber-300",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-xs font-semibold tracking-wide uppercase",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
