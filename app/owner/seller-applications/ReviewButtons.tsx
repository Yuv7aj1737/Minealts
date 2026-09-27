"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { reviewSellerApplicationAction } from "./actions";

/**
 * Accept / Reject controls for one application.
 *
 * A single Server Action serves both buttons; the decision comes from the
 * submitter's own `value`. `ReviewSubmitButton` reads `useFormStatus` from the
 * enclosing `<form>`, so a pending state disables *both* buttons — an
 * accidental double-click cannot fire two decisions.
 *
 * The application id travels as a hidden field, which is untrusted input. It
 * is used only to select the row; the service re-reads the row, re-checks the
 * reviewer is an owner, and writes the literal role `"SELLER"`.
 */
export function ReviewButtons({
  applicationId,
  applicantUsername,
}: {
  applicationId: string;
  applicantUsername: string;
}) {
  return (
    <form action={reviewSellerApplicationAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />

      <label
        htmlFor={`note-${applicationId}`}
        className="block text-xs font-semibold text-ink-400"
      >
        Note to applicant (optional)
      </label>
      <textarea
        id={`note-${applicationId}`}
        name="note"
        rows={2}
        maxLength={2000}
        placeholder="Shown on the applicant's own page."
        className="w-full rounded-xl border border-surface-300/70 bg-surface-200/60 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus-visible:border-brand-500/60 focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        <ReviewSubmitButton
          name="decision"
          value="ACCEPT"
          variant="accent"
          pendingLabel="Accepting…"
        >
          {`Accept @${applicantUsername}`}
        </ReviewSubmitButton>

        <ReviewSubmitButton
          name="decision"
          value="REJECT"
          variant="outline"
          pendingLabel="Rejecting…"
        >
          Reject
        </ReviewSubmitButton>
      </div>
    </form>
  );
}

function ReviewSubmitButton({
  name,
  value,
  variant,
  pendingLabel,
  children,
}: {
  name: string;
  value: "ACCEPT" | "REJECT";
  variant: "accent" | "outline";
  pendingLabel: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" name={name} value={value} variant={variant} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
