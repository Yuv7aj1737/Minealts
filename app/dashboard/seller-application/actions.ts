"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { routes } from "@/lib/constants";
import { createSellerApplication } from "@/lib/seller-applications/service.server";
import {
  readSellerApplicationFormData,
  validateSellerApplication,
  type SellerApplicationFormState,
} from "@/lib/seller-applications/schema";

/**
 * Server Action — submit a seller application.
 *
 * A Server Action is a public POST endpoint, so this is treated as an
 * untrusted entry point. `getSession()` is called *inside* the action rather
 * than relying on the page that rendered the form, and every value that
 * reaches the database comes from that session.
 *
 * Only async functions may be exported from a `"use server"` module, so the
 * action's state type and initial value live in
 * `lib/seller-applications/schema.ts`.
 */
export async function submitSellerApplication(
  _prevState: SellerApplicationFormState,
  formData: FormData,
): Promise<SellerApplicationFormState> {
  const session = await getSession();

  if (!session) {
    // An anonymous caller cannot apply. Send them to sign in, preserving
    // where they were so they land back on the form.
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.dashboardPages.sellerApplication)}`,
    );
  }

  const user = session.user;
  const raw = readSellerApplicationFormData(formData);

  // Echoed back so a validation error does not wipe what was typed.
  // `discordUsername` is deliberately not read here: the form always renders
  // the session's username, so a submitted value could never matter.
  const values = {
    reason: raw.reason,
    whatToSell: raw.whatToSell,
    extraInfo: raw.extraInfo,
  };

  const validated = validateSellerApplication(raw);
  if (!validated.ok) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: validated.fieldErrors,
      values,
    };
  }

  const outcome = await createSellerApplication(user, validated.data);

  if (!outcome.ok) {
    return {
      status: "error",
      message: FAILURE_MESSAGES[outcome.code] ?? "Something went wrong. Please try again.",
      fieldErrors: {},
      values,
    };
  }

  // The applicant now holds a PENDING row, so both the apply page and the
  // dashboard must re-render in their "awaiting review" state.
  revalidatePath(routes.dashboardPages.sellerApplication);
  revalidatePath(routes.dashboard);

  redirect(`${routes.dashboardPages.sellerApplication}?submitted=1`);
}

const FAILURE_MESSAGES: Record<string, string> = {
  ALREADY_PENDING:
    "You already have an application awaiting review. Only one can be active at a time.",
  ROLE_NOT_ELIGIBLE:
    "Your account is already a seller or an owner, so there is nothing to apply for.",
  FORBIDDEN: "Your account is not allowed to submit a seller application.",
};
