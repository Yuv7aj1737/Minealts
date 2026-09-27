"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, ReadOnlyValue, Textarea } from "@/components/ui/Field";
import { initialSellerApplicationFormState } from "@/lib/seller-applications/schema";
import { submitSellerApplication } from "./actions";

/**
 * The seller application form.
 *
 * Note what is *not* here: no `role` input, no hidden `userId`, no editable
 * Discord id. Identity is displayed read-only and the action derives the real
 * values from the session, so this form is incapable of expressing an
 * escalation even if someone rewrites it in devtools.
 */
export function SellerApplicationForm({
  discordUsername,
  discordId,
}: {
  discordUsername: string;
  discordId: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitSellerApplication,
    initialSellerApplicationFormState,
  );

  const { fieldErrors, values, message } = state;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {message ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm text-brand-200"
        >
          {message}
        </div>
      ) : null}

      {/* ---------------------------------------------------------- Identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="block text-sm font-semibold text-ink-200">
            Discord username
          </span>
          <ReadOnlyValue>
            <span className="font-medium text-ink-100">@{discordUsername}</span>
            <span className="mt-1 block text-xs text-ink-500">
              Taken from your signed-in Discord account. Not editable.
            </span>
          </ReadOnlyValue>
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-semibold text-ink-200">Discord ID</span>
          <ReadOnlyValue>
            <span className="font-mono text-sm break-all text-ink-100">
              {discordId}
            </span>
            <span className="mt-1 block text-xs text-ink-500">
              Recorded automatically so owners can identify you.
            </span>
          </ReadOnlyValue>
        </div>
      </div>

      {/* ------------------------------------------------------------ Answers */}
      <Field
        id="reason"
        label="Why do you want to become a seller?"
        hint="A few sentences is plenty. Owners read every answer before deciding."
        error={fieldErrors.reason}
      >
        {({ id, invalid, describedBy }) => (
          <Textarea
            id={id}
            name="reason"
            required
            maxLength={2000}
            invalid={invalid}
            describedBy={describedBy}
            defaultValue={values.reason}
            placeholder="I have been playing Minecraft since 1.5 and want to sell spare accounts and server slots I no longer use."
          />
        )}
      </Field>

      <Field
        id="whatToSell"
        label="What will you sell?"
        hint="Accounts, server slots, boosts, items — be specific about the categories and roughly what stock you have."
        error={fieldErrors.whatToSell}
      >
        {({ id, invalid, describedBy }) => (
          <Textarea
            id={id}
            name="whatToSell"
            required
            maxLength={2000}
            invalid={invalid}
            describedBy={describedBy}
            defaultValue={values.whatToSell}
            placeholder="Full-access Minecraft accounts (Java) and a couple of survival server slots."
          />
        )}
      </Field>

      <Field
        id="extraInfo"
        label="Additional information"
        hint="Optional. Delivery method, proof of stock, server IP, anything that helps."
        error={fieldErrors.extraInfo}
      >
        {({ id, invalid, describedBy }) => (
          <Textarea
            id={id}
            name="extraInfo"
            maxLength={2000}
            invalid={invalid}
            describedBy={describedBy}
            defaultValue={values.extraInfo}
            placeholder="I can hand over accounts instantly through the Discord bot. Happy to verify ownership with a screenshot."
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-4 border-t border-surface-300/70 pt-5">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Submitting…" : "Submit application"}
        </Button>

        <p className="text-xs text-ink-500">
          One active application at a time. You can apply again if rejected.
        </p>
      </div>
    </form>
  );
}
