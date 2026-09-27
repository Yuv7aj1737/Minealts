"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { moderateSellerAction } from "./actions";

/**
 * Suspend / reinstate controls for one seller.
 *
 * Suspending is the destructive direction, so it is not a single click: the form
 * starts collapsed, and a reason has to be typed before the confirm button
 * appears. An owner who fat-fingers a row in a long table should not be able to
 * pull a seller's whole catalogue off the marketplace by accident.
 */
export function SellerModerationForm({
  sellerId,
  username,
  suspended,
  returnTo,
  reason,
}: {
  sellerId: string;
  username: string;
  suspended: boolean;
  returnTo: string;
  /** Existing reason, shown while suspended so it is not lost on re-suspend. */
  reason?: string | null;
}) {
  return (
    <form action={moderateSellerAction} className="space-y-3">
      <input type="hidden" name="sellerId" value={sellerId} />
      <input type="hidden" name="action" value={suspended ? "REINSTATE" : "SUSPEND"} />
      <input type="hidden" name="returnTo" value={returnTo} />

      {suspended ? (
        <>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
          >
            Reinstate @{username}
          </button>
          <p className="text-xs text-ink-500">
            Restores the seller dashboard, and their active listings return to the
            marketplace.
          </p>
        </>
      ) : (
        <SuspensionControl reason={reason} username={username} />
      )}
    </form>
  );
}

/**
 * The two-step suspend control.
 *
 * A plain `<details>` gives the disclosure behaviour and keyboard support without
 * shipping any state, which matters on a page the owner may be reading on a
 * phone.
 */
function SuspensionControl({
  reason,
  username,
}: {
  reason?: string | null;
  username: string;
}) {
  return (
    <details className="group">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-xl border border-brand-500/40 bg-brand-500/10 px-3.5 text-sm font-semibold text-brand-200 transition-colors hover:bg-brand-500/20">
        Suspend @{username}
      </summary>

      <div className="mt-3 space-y-2">
        <label htmlFor={`reason-${username}`} className="block text-xs font-semibold text-ink-400">
          Reason (shown to the seller)
        </label>
        <textarea
          id={`reason-${username}`}
          name="reason"
          rows={2}
          maxLength={500}
          defaultValue={reason ?? ""}
          placeholder="Required in practice: the seller sees this on their dashboard."
          className="w-full rounded-xl border border-surface-300/70 bg-surface-200/60 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus-visible:border-brand-500/60 focus:outline-none"
        />

        <ConfirmButton />
      </div>
    </details>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Suspending…" : "Confirm suspension"}
    </Button>
  );
}
