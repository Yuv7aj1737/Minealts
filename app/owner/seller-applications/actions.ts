"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { routes } from "@/lib/constants";
import { reviewSellerApplication } from "@/lib/seller-applications/service.server";
import {
  REVIEW_DECISIONS,
  type ReviewPageError,
} from "@/lib/seller-applications/schema";

/**
 * Server Action — accept or reject a seller application.
 *
 * The authorisation check is repeated here, inside the action, even though the
 * `/owner` layout already guards the route. A Server Action is a public POST
 * endpoint, so the layout's check is not a boundary: any account can aim a
 * request at it directly.
 *
 * Neither the target status nor the resulting role is taken from the request.
 * The request supplies only *which* application to act on and which of the two
 * allowed decisions to make; the service maps that decision to a status and
 * writes the literal role `"SELLER"`.
 *
 * Only async functions may be exported from a `"use server"` module, so the
 * page's failure copy lives in `lib/seller-applications/schema.ts`.
 */

const reviewSchema = z.object({
  applicationId: z.string().trim().min(1, "Missing application id.").max(64),
  decision: z.enum(REVIEW_DECISIONS),
  /** Optional note shown to the applicant on their own page. */
  note: z
    .string()
    .trim()
    .max(2000, "Please keep the note under 2000 characters.")
    .optional(),
});

/** Reads a FormData value as a plain string, discarding File entries. */
function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Service failure code -> the `?error=` key the page knows how to render. */
const ERROR_KEYS = {
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  ALREADY_DECIDED: "already_decided",
} as const satisfies Record<string, ReviewPageError>;

export async function reviewSellerApplicationAction(formData: FormData): Promise<void> {
  const session = await getSession();

  if (!session) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.ownerPages.sellerApplications)}`);
  }

  const reviewer = session.user;

  if (!can(reviewer.role, PERMISSIONS.SELLER_APPLICATION_REVIEW)) {
    redirect(`${routes.ownerPages.sellerApplications}?error=forbidden`);
  }

  const parsed = reviewSchema.safeParse({
    applicationId: formData.get("applicationId"),
    decision: formData.get("decision"),
    note: text(formData, "note"),
  });

  if (!parsed.success) {
    redirect(`${routes.ownerPages.sellerApplications}?error=invalid`);
  }

  const outcome = await reviewSellerApplication(
    reviewer,
    parsed.data.applicationId,
    parsed.data.decision,
    parsed.data.note,
  );

  if (!outcome.ok) {
    redirect(`${routes.ownerPages.sellerApplications}?error=${ERROR_KEYS[outcome.code]}`);
  }

  // The applicant's role changed and the queue shrank by one, so re-render the
  // owner queue, the owner landing page and the applicant's own views.
  revalidatePath(routes.ownerPages.sellerApplications);
  revalidatePath(routes.owner);
  revalidatePath(routes.dashboard);
  revalidatePath(routes.dashboardPages.sellerApplication);

  const result = outcome.status === "ACCEPTED" ? "accepted" : "rejected";
  redirect(`${routes.ownerPages.sellerApplications}?${result}=1`);
}
