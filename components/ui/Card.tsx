import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Dark surface card with a hairline border, rounded corners and a 1px top
 * highlight so it reads as a physical panel on a near-black background.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "card-sheen rounded-2xl border border-surface-300/70 bg-surface-100/80",
        "shadow-xl shadow-black/40 backdrop-blur-sm",
        interactive &&
          "transition-all duration-200 ease-out hover:-translate-y-1 hover:border-brand-500/50 hover:shadow-brand-950/50",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-6 pb-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn("font-display text-lg font-semibold text-ink-100", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm leading-relaxed text-ink-300", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-surface-300/70 p-6 pt-4", className)}
      {...props}
    />
  );
}

export function CardIcon({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid size-11 place-items-center rounded-xl",
        "border border-brand-500/25 bg-brand-500/10 text-brand-300",
        className,
      )}
    >
      {children}
    </div>
  );
}
