"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { routes } from "@/lib/constants";
import { reviewListing } from "@/lib/listings/admin.server";
import { validateListingReview } from "@/lib/listings/schema";

/**
 * Server Action — one decision on one listing.
 *
 * The `/owner` layout already guards the route, but a Server Action is a POST
 * endpoint that any signed-in account can aim at directly, so the check is
 * repeated here. The service checks it a third time.
 *
 * The form supplies three fields: which listing, which decision, and an optional
 * note. There is deliberately no `status` field, no `sellerId` field and no
 * `reviewedById` field:
 *
 *  - the resulting status comes from `DECISION_TRANSITIONS` in the service;
 *  - the reviewer comes from the session;
 *  - the write is a compare-and-set, so an illegal `from` state matches nothing.
 *
 * A crafted POST that adds `status=ACTIVE` to the body is dropped by
 * `z.strictObject` in `validateListingReview`, and even if it were not, the
 * service would ignore it.
 */

/** Service failure code -> the `?error=` key the page knows how to render. */
const ERROR_KEYS = {
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  INVALID_TRANSITION: "conflict",
} as const;

/** Result slug shown in the success banner, so the owner sees what happened. */
const RESULT_KEYS = {
  APPROVE: "approved",
  REJECT: "rejected",
  REMOVE: "removed",
  RESTORE: "restored",
} as const;

export async function reviewListingAction(formData: FormData): Promise<void> {
  const session = await getSession();

  if (!session) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.ownerPages.listings)}`);
  }

  const reviewer = session.user;

  if (!can(reviewer.role, PERMISSIONS.LISTING_MANAGE_ALL)) {
    redirect(`${routes.ownerPages.listings}?error=forbidden`);
  }

  const parsed = validateListingReview(formData);

  if (!parsed.ok) {
    redirect(`${routes.ownerPages.listings}?error=invalid`);
  }

  const { listingId, decision, note } = parsed.data;

  // Needed before the write so the seller's own dashboard can be revalidated
  // afterwards. A read of a single id, not a way to see anything else.
  const outcome = await reviewListing(reviewer, { listingId, decision, note });

  if (!outcome.ok) {
    redirect(`${routes.ownerPages.listings}?error=${ERROR_KEYS[outcome.code]}`);
  }

  // The status changed, so four things are now stale: the owner queue, the owner
  // overview, the public grid (if the listing was approved) and the seller's own
  // dashboard. The listing page itself re-renders from the request.
  revalidatePath(routes.ownerPages.listings);
  revalidatePath(routes.owner);
  revalidatePath(routes.marketplace);
  revalidatePath(routes.seller.dashboard);

  redirect(`${routes.ownerPages.listings}?${RESULT_KEYS[decision]}=1`);
}
