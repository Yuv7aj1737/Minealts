import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Labelled form controls for the dark theme.
 *
 * `Field` wires up the `label` -> control -> error relationship with ids, so
 * screen readers announce the error alongside the input and a click on the
 * label focuses the right control. Error text is rendered inside a live region
 * so a Server Action validation failure is announced.
 */

const CONTROL_BASE =
  "w-full rounded-xl border bg-surface-200/60 px-3.5 py-2.5 text-sm text-ink-100 " +
  "placeholder:text-ink-500 transition-colors duration-200 " +
  "hover:border-surface-300/90 focus:bg-surface-200 focus:outline-none " +
  "focus-visible:border-brand-500/60 disabled:cursor-not-allowed disabled:opacity-60";

function controlTone(invalid: boolean): string {
  return invalid
    ? "border-brand-500/70 focus-visible:border-brand-400"
    : "border-surface-300/70";
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  /**
   * Explicit control id. Required rather than generated: a counter would
   * differ between the server render and the client render, and React would
   * report a hydration mismatch on every `aria-describedby` reference.
   */
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  children: (props: { id: string; invalid: boolean; describedBy?: string }) => ReactNode;
  className?: string;
}) {
  const fieldId = id;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={fieldId} className="block text-sm font-semibold text-ink-200">
        {label}
      </label>

      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-400">
          {hint}
        </p>
      ) : null}

      {children({ id: fieldId, invalid: Boolean(error), describedBy })}

      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="flex items-start gap-1.5 text-xs font-medium text-brand-300"
        >
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

type TextareaProps = Omit<ComponentProps<"textarea">, "id"> & {
  id: string;
  invalid: boolean;
  describedBy?: string;
};

export function Textarea({ invalid, describedBy, className, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(CONTROL_BASE, controlTone(invalid), "min-h-28 resize-y", className)}
      {...props}
    />
  );
}

type InputProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  invalid: boolean;
  describedBy?: string;
};

export function Input({ invalid, describedBy, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(CONTROL_BASE, controlTone(invalid), className)}
      {...props}
    />
  );
}

/** Read-only value display, styled to match the controls above. */
export function ReadOnlyValue({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-surface-300/50 bg-surface-200/30 px-3.5 py-2.5 text-sm text-ink-200",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
