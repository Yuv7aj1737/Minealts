"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonVariant } from "@/components/ui/Button";
import { reviewListingAction } from "./actions";
import { DECISION_LABEL, type ListingDecision } from "@/lib/listings/schema";

/**
 * Review controls for one listing in the owner queue.
 *
 * A single Server Action backs every button; the decision is the submitter's own
 * `value`, so there is no endpoint per decision to get wrong.
 *
 * `DecisionButton` reads `useFormStatus` from the enclosing form, which disables
 * *all* of them while a request is in flight. Two owners clicking Approve on the
 * same row is exactly the case the service's compare-and-set handles, but not
 * sending the second request is cheaper than rejecting it.
 */
export function ListingDecisionForm({
  listingId,
  decisions,
  defaultNote,
  compact = false,
}: {
  listingId: string;
  /** Whitelisted by the service; the page computes this from the listing status. */
  decisions: readonly ListingDecision[];
  defaultNote?: string | null;
  compact?: boolean;
}) {
  if (decisions.length === 0) {
    return (
      <p className="text-xs text-ink-500">
        No actions available in this state.
      </p>
    );
  }

  return (
    <form action={reviewListingAction} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />

      {/*
        The note is editable rather than fixed, because rejecting with no reason
        is the least useful thing an owner can do. It is capped by the schema at
        1000 characters, matching the column.
      */}
      <label htmlFor={`note-${listingId}`} className="block text-xs font-semibold text-ink-400">
        Review note (optional)
      </label>
      <textarea
        id={`note-${listingId}`}
        name="note"
        rows={compact ? 1 : 2}
        maxLength={1000}
        defaultValue={defaultNote ?? ""}
        placeholder="Shown to the seller. Cleared when you approve."
        className="w-full rounded-xl border border-surface-300/70 bg-surface-200/60 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus-visible:border-brand-500/60 focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        {decisions.map((decision) => (
          <DecisionButton
            key={decision}
            value={decision}
            variant={DECISION_VARIANT[decision]}
          >
            {DECISION_LABEL[decision]}
          </DecisionButton>
        ))}
      </div>
    </form>
  );
}

/** Approve is the positive path; everything else is neutral or destructive. */
const DECISION_VARIANT: Record<ListingDecision, ButtonVariant> = {
  APPROVE: "accent",
  REJECT: "outline",
  REMOVE: "outline",
  RESTORE: "ghost",
};

function DecisionButton({
  value,
  variant,
  children,
}: {
  value: ListingDecision;
  variant: ButtonVariant;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" name="decision" value={value} variant={variant} disabled={pending}>
      {pending ? "Working…" : children}
    </Button>
  );
}
