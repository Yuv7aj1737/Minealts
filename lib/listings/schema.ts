import type { ListingStatus } from "@prisma/client";
import { z } from "zod";

import type { BadgeTone } from "@/components/ui/Badge";

/**
 * Listing contract shared by the public pages, the owner panel and the actions.
 *
 * Client-safe: type-only Prisma import, so a client component can read the
 * status labels and submit a decision.
 */

export type StatusMeta = {
  label: string;
  tone: BadgeTone;
  description: string;
  /** Whether the listing is reachable by a member of the public. */
  public: boolean;
};

export const LISTING_STATUS_META: Record<ListingStatus, StatusMeta> = {
  DRAFT: {
    label: "Draft",
    tone: "neutral",
    description: "Not submitted for review yet. Only the seller can see this.",
    public: false,
  },
  PROCESSING: {
    label: "Processing",
    tone: "warning",
    description: "With the owner team for review.",
    public: false,
  },
  ACTIVE: {
    label: "Active",
    tone: "success",
    description: "Live on the marketplace and available to buy.",
    public: true,
  },
  REJECTED: {
    label: "Rejected",
    tone: "brand",
    description: "An owner declined this listing. The seller can edit and resubmit.",
    public: false,
  },
  SOLD: {
    label: "Sold",
    tone: "neutral",
    description: "Already sold. Kept visible as a record.",
    public: true,
  },
  REMOVED: {
    label: "Removed",
    tone: "neutral",
    description: "Taken down by an owner or withdrawn by the seller.",
    public: false,
  },
};

/**
 * Statuses a member of the public may open.
 *
 * `SOLD` is included on purpose: a sold listing page renders a "Sold" overlay
 * rather than a 404, because a shared link to a sold item is a normal thing for
 * a buyer to follow. Everything that was never published (`DRAFT`, `PROCESSING`,
 * `REJECTED`) plus `REMOVED` are not guessable from the outside, so those 404.
 */
export const PUBLIC_LISTING_STATUSES = [
  "ACTIVE",
  "SOLD",
] as const satisfies readonly ListingStatus[];

/** Statuses a seller can still edit. Mirrors the Phase 4 write path. */
export const SELLER_EDITABLE_STATUSES = [
  "DRAFT",
  "REJECTED",
  "REMOVED",
] as const satisfies readonly ListingStatus[];

/* ------------------------------------------------------------------------- */
/* Owner decisions                                                            */
/* ------------------------------------------------------------------------- */

/**
 * Owner actions on a listing.
 *
 * The client picks a decision; the service decides which status that maps to
 * and writes it. The client never sends a status.
 */
export const LISTING_DECISIONS = ["APPROVE", "REJECT", "REMOVE", "RESTORE"] as const;
export type ListingDecision = (typeof LISTING_DECISIONS)[number];

/** The status each decision is allowed to move a listing *from* and *to*. */
export const DECISION_TRANSITIONS: Record<
  ListingDecision,
  { from: readonly ListingStatus[]; to: ListingStatus }
> = {
  APPROVE: { from: ["PROCESSING", "REJECTED", "REMOVED"], to: "ACTIVE" },
  REJECT: { from: ["PROCESSING", "DRAFT"], to: "REJECTED" },
  // Removal is a state, not a delete. Orders keep pointing at this row, so the
  // history stays readable instead of vanishing with a cascade.
  REMOVE: { from: ["ACTIVE", "PROCESSING", "DRAFT", "REJECTED"], to: "REMOVED" },
  RESTORE: { from: ["REMOVED", "REJECTED"], to: "DRAFT" },
};

export const DECISION_LABEL: Record<ListingDecision, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  REMOVE: "Remove",
  RESTORE: "Restore to draft",
};

/* ------------------------------------------------------------------------- */
/* Validation                                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Strict input for the owner action.
 *
 * `strictObject` with no `status`, `sellerId` or `reviewedById` key, and
 * `validateListingReview` rebuilds the payload from three whitelisted keys. An
 * injected `status` is dropped before it can reach the service.
 */
export const listingReviewSchema = z.strictObject({
  listingId: z.string().min(1, "Missing listing").max(64),
  decision: z.enum(LISTING_DECISIONS, { error: "Unknown decision" }),
  note: z.string().trim().max(1000, "Note is too long").optional(),
});

export type ListingReviewInput = z.infer<typeof listingReviewSchema>;

/** Rebuilds the payload from whitelisted keys only. */
export function validateListingReview(
  formData: FormData,
): { ok: true; data: ListingReviewInput } | { ok: false; error: string } {
  const parsed = listingReviewSchema.safeParse({
    listingId: formData.get("listingId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  return { ok: true, data: parsed.data };
}

/** Strict input for the owner seller action. */
export const sellerModerationSchema = z.strictObject({
  sellerId: z.string().min(1, "Missing seller").max(64),
  action: z.enum(["SUSPEND", "REINSTATE"], { error: "Unknown action" }),
  reason: z.string().trim().max(500, "Reason is too long").optional(),
});

export type SellerModerationInput = z.infer<typeof sellerModerationSchema>;

export function validateSellerModeration(
  formData: FormData,
): { ok: true; data: SellerModerationInput } | { ok: false; error: string } {
  const parsed = sellerModerationSchema.safeParse({
    sellerId: formData.get("sellerId"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  return { ok: true, data: parsed.data };
}

/* ------------------------------------------------------------------------- */
/* Search                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Normalises the marketplace search box.
 *
 * Truncated rather than rejected: a long query is a typo, and returning an
 * error page for one is hostile. Length is bounded so the `contains` filter
 * cannot be used as a cheap way to hammer the index.
 */
export const MAX_SEARCH_LENGTH = 64;

export function normaliseSearch(raw: string | string[] | undefined | null): string {
  const value = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return value.trim().slice(0, MAX_SEARCH_LENGTH);
}

/** The seller share of a sale, as a percentage. */
export const SELLER_SHARE_PERCENT = 94;
