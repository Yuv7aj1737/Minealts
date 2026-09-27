import { z } from "zod";
import type { SellerApplicationStatus } from "@prisma/client";

import type { BadgeTone } from "@/components/ui/Badge";

/**
 * Seller application contract.
 *
 * This module is intentionally free of `server-only` and of any Prisma access
 * so it can be imported by both the client form and the server action.
 *
 * The schema is a *strict* object and covers exactly the three free-text
 * answers. That strictness is a security property, not a formality:
 *
 *   - There is no `role`, `userId`, `discordId`, `status` or `reviewedById`
 *     field to accept. Identity comes from the session and the target status
 *     comes from a separate, owner-only action, so there is no code path in
 *     which a member can submit a role or submit on someone else's behalf.
 *   - `strictObject` rejects unexpected keys outright rather than stripping
 *     them, so an injected `role=OWNER` field is a validation error instead of
 *     a silently ignored value.
 */

/** Discord's username shape, only used to validate what a member types. */
const discordUsernamePattern = /^[\w.\s]{2,32}$/;

export const sellerApplicationSchema = z.strictObject({
  /** "Why do you want to become a seller?" */
  reason: z
    .string()
    .trim()
    .min(20, "Tell us a little more — at least 20 characters.")
    .max(2000, "Please keep this under 2000 characters."),

  /** "What will you sell?" */
  whatToSell: z
    .string()
    .trim()
    .min(10, "Describe your stock — at least 10 characters.")
    .max(2000, "Please keep this under 2000 characters."),

  /** "Additional information" — genuinely optional. */
  extraInfo: z
    .string()
    .trim()
    .max(2000, "Please keep this under 2000 characters.")
    .optional(),
});

export type SellerApplicationInput = z.infer<typeof sellerApplicationSchema>;

/** Field names, used to map validation errors back onto inputs. */
export const SELLER_APPLICATION_FIELDS = [
  "reason",
  "whatToSell",
  "extraInfo",
] as const satisfies readonly (keyof SellerApplicationInput)[];

export type SellerApplicationField = (typeof SELLER_APPLICATION_FIELDS)[number];

/** Per-field error map returned to the form. */
export type SellerApplicationFieldErrors = Partial<Record<SellerApplicationField, string>>;

/**
 * Reads the three answer fields out of a `FormData`.
 *
 * `formData.get` can also yield a `File`; anything that is not a plain string
 * becomes `""` so a crafted multipart body cannot smuggle a non-string through
 * the schema. The `discordUsername` field is accepted here purely so the form
 * can round-trip its value on a validation error — it is never trusted.
 */
export function readSellerApplicationFormData(formData: FormData): {
  reason: string;
  whatToSell: string;
  extraInfo: string;
  discordUsername: string;
} {
  const text = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  return {
    reason: text("reason"),
    whatToSell: text("whatToSell"),
    extraInfo: text("extraInfo"),
    discordUsername: text("discordUsername"),
  };
}

/** Parses form input, returning a flat per-field error map on failure. */
export function validateSellerApplication(
  raw: { reason: string; whatToSell: string; extraInfo: string },
):
  | { ok: true; data: SellerApplicationInput }
  | { ok: false; fieldErrors: SellerApplicationFieldErrors } {
  const result = sellerApplicationSchema.safeParse({
    reason: raw.reason,
    whatToSell: raw.whatToSell,
    // An untouched optional textarea posts as "", which must not become the
    // literal string "" in the database.
    extraInfo: raw.extraInfo === "" ? undefined : raw.extraInfo,
  });

  if (result.success) return { ok: true, data: result.data };

  const { fieldErrors } = z.flattenError(result.error);
  const errors: SellerApplicationFieldErrors = {};

  for (const field of SELLER_APPLICATION_FIELDS) {
    const message = fieldErrors[field]?.[0];
    if (message) errors[field] = message;
  }

  return { ok: false, fieldErrors: errors };
}

/** Sanitises the username a member typed, for redisplay on a validation error. */
export function sanitiseDiscordUsername(value: string): string {
  const trimmed = value.trim();
  return discordUsernamePattern.test(trimmed) ? trimmed : "";
}

/* ------------------------------------------------------------------------- */
/* Form state                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Returned by the submit action and consumed by `useActionState`.
 *
 * Lives here rather than in the `"use server"` module because that module may
 * only export async functions.
 *
 * `values` echoes the typed answers so a validation error does not wipe the
 * form. Note what is absent: no `userId`, no `role`, no `discordId`. Nothing
 * that reaches the database comes back through this channel.
 */
export type SellerApplicationFormState = {
  status: "idle" | "error";
  message: string | null;
  fieldErrors: SellerApplicationFieldErrors;
  values: { reason: string; whatToSell: string; extraInfo: string };
};

export const initialSellerApplicationFormState: SellerApplicationFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  values: { reason: "", whatToSell: "", extraInfo: "" },
};

/* ------------------------------------------------------------------------- */
/* Review state metadata                                                     */
/* ------------------------------------------------------------------------- */

export type ApplicationStatusMeta = {
  label: string;
  tone: BadgeTone;
  description: string;
};

export const APPLICATION_STATUS_META: Record<
  SellerApplicationStatus,
  ApplicationStatusMeta
> = {
  PENDING: {
    label: "Pending",
    tone: "warning",
    description: "Waiting for an owner to review this application.",
  },
  ACCEPTED: {
    label: "Accepted",
    tone: "success",
    description: "Approved — the applicant is now a seller.",
  },
  REJECTED: {
    label: "Rejected",
    tone: "neutral",
    description: "Not approved. This account may apply again later.",
  },
};

/** The only two decisions an owner may take. */
export const REVIEW_DECISIONS = ["ACCEPT", "REJECT"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/**
 * Maps a review decision onto the status it writes.
 *
 * `as const satisfies` is what narrows the value type to
 * `"ACCEPTED" | "REJECTED"`: a plain `Record<ReviewDecision,
 * SellerApplicationStatus>` annotation would widen each entry back to the full
 * enum, and `ReviewOutcome` needs to know PENDING is unreachable here.
 */
export const DECISION_TO_STATUS = {
  ACCEPT: "ACCEPTED",
  REJECT: "REJECTED",
} as const satisfies Record<ReviewDecision, SellerApplicationStatus>;

/* ------------------------------------------------------------------------- */
/* Review queue page copy                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Failure text for the review queue, keyed by the `?error=` value the review
 * action redirects with. Lives in this shared module because a `"use server"`
 * file may only export async functions, and the page needs to render it.
 */
export const REVIEW_PAGE_ERRORS = {
  forbidden: "Only owners can review seller applications.",
  not_found: "That application no longer exists.",
  already_decided: "That application was already reviewed by someone else.",
  invalid: "That request was malformed.",
} as const;

export type ReviewPageError = keyof typeof REVIEW_PAGE_ERRORS;
