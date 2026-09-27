import type { Metadata } from "next";

import { requireOwner } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Owner",
  robots: { index: false, follow: false },
};

/**
 * Owner-only shell (Phase 4).
 *
 * `requireOwner()` redirects any non-OWNER account to
 * `/dashboard?error=forbidden` before a single child renders. Because the guard
 * lives in the layout, every future page nested under `/owner` is protected by
 * construction — a new admin page cannot accidentally ship unprotected.
 *
 * The check is server-side only: hiding a link in the UI is presentation, never
 * the security boundary.
 */
export default async function OwnerLayout({ children }: LayoutProps<"/owner">) {
  await requireOwner();

  return <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>;
}
