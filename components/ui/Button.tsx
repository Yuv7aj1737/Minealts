import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "accent" | "discord" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold " +
  "whitespace-nowrap transition-all duration-200 ease-out select-none " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "active:translate-y-px";

const VARIANTS: Record<ButtonVariant, string> = {
  // Red gradient with a soft red bloom on hover.
  primary:
    "bg-linear-to-b from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-900/50 " +
    "hover:from-brand-300 hover:to-brand-500 hover:shadow-brand-800/60 " +
    "hover:-translate-y-0.5",

  // Yellow used sparingly for the highest-intent action.
  accent:
    "bg-linear-to-b from-accent-300 to-accent-500 text-surface-0 shadow-lg shadow-accent-700/25 " +
    "hover:from-accent-200 hover:to-accent-400 hover:-translate-y-0.5",

  discord:
    "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/25 " +
    "hover:bg-[#4752c4] hover:-translate-y-0.5",

  outline:
    "border border-surface-300 bg-surface-100/60 text-ink-100 backdrop-blur " +
    "hover:border-brand-500/60 hover:bg-surface-200 hover:-translate-y-0.5",

  ghost: "text-ink-300 hover:bg-surface-200 hover:text-ink-100",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={buttonStyles({ variant, size, className })} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
