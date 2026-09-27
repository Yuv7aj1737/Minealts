"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { routes } from "@/lib/constants";
import { moderateSeller } from "@/lib/listings/admin.server";
import { validateSellerModeration } from "@/lib/listings/schema";

/**
 * Server Action — suspend or reinstate a seller.
 *
 * The request carries a seller id, an action and a reason. It does **not** carry
 * a role, a `suspendedAt` value, or a listing id:
 *
 *  - the role is never written, so suspension cannot be turned into a demotion
 *    and cannot collide with `OWNER`;
 *  - the timestamp is the server's clock, so a client cannot backdate or
 *    future-date it;
 *  - the seller's listings are not touched. They disappear from the marketplace
 *    because every public query filters on `suspendedAt`, which is one
 *    authoritative flag instead of N listing rows that can drift apart.
 *
 * `moderateSeller` refuses a target that is not a SELLER, which also means an
 * owner cannot be suspended through this form.
 */

const ERROR_KEYS = {
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  NOT_A_SELLER: "not_a_seller",
  CANNOT_MODIFY_OWNER: "forbidden",
} as const;

export async function moderateSellerAction(formData: FormData): Promise<void> {
  const session = await getSession();

  if (!session) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.ownerPages.sellers)}`);
  }

  const reviewer = session.user;

  if (!can(reviewer.role, PERMISSIONS.SELLER_MANAGE)) {
    redirect(`${routes.ownerPages.sellers}?error=forbidden`);
  }

  const parsed = validateSellerModeration(formData);

  if (!parsed.ok) {
    redirect(`${routes.ownerPages.sellers}?error=invalid`);
  }

  const { sellerId, action, reason } = parsed.data;

  // The action returns to the directory, which is where an owner starts and
  // where the seller's row visibly changes. A profile URL is also accepted so
  // the form on the profile page does not need to know its own route.
  const returnTo = safeReturnTo(formData.get("returnTo"), sellerId);

  const outcome = await moderateSeller(reviewer, { sellerId, action, reason });

  if (!outcome.ok) {
    const query = new URLSearchParams({ error: ERROR_KEYS[outcome.code] });
    redirect(`${returnTo}?${query.toString()}`);
  }

  // Suspension hides the seller's listings and locks their dashboard, so the
  // grid, the owner pages and the seller's own view are all now stale.
  revalidatePath(routes.ownerPages.sellers);
  revalidatePath(routes.ownerPages.seller(sellerId));
  revalidatePath(routes.owner);
  revalidatePath(routes.marketplace);
  revalidatePath(routes.seller.dashboard);

  const result = action === "SUSPEND" ? "suspended" : "reinstated";
  redirect(`${returnTo}?${result}=1`);
}

/**
 * Where to send the owner afterwards.
 *
 * Only two destinations are accepted: the seller directory and this seller's own
 * profile. Anything else falls back to the directory, because an open redirect
 * would turn every moderation form into a phishing link.
 */
function safeReturnTo(raw: FormDataEntryValue | null, sellerId: string): string {
  const value = typeof raw === "string" ? raw : "";
  if (value === routes.ownerPages.seller(sellerId)) return value;
  return routes.ownerPages.sellers;
}
