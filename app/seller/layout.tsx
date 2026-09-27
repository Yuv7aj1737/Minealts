import type { Metadata } from "next";

import { requireSeller } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Seller",
  robots: { index: false, follow: false },
};

/**
 * Seller-only shell (Phase 3).
 *
 * The guard lives in the layout, so every page nested under `/seller` is
 * protected by construction — a new seller page cannot ship unprotected.
 *
 * `requireSeller()` admits only SELLER. OWNER accounts are *not* admitted: an
 * owner who wants to inspect a seller's view can go through the owner area, and
 * widening this to accept OWNER would quietly give every owner a second
 * dashboard that is easy to mistake for their own.
 *
 * A plain USER is sent to their dashboard with `?error=seller_only`, where they
 * can apply to become a seller. An anonymous visitor is sent to sign in. Both
 * are decided on the server: hiding the link in the UI is presentation, not a
 * security boundary.
 */
export default async function SellerLayout({ children }: LayoutProps<"/seller">) {
  await requireSeller();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>
  );
}
