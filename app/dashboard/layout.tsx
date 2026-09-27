import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * Protected shell for the signed-in area.
 *
 * Authorisation happens here, on the server, before any child renders — so
 * every nested route inherits the check automatically and no page has to
 * remember to call it.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await requireUser();

  return <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>;
}
