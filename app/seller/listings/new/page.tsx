import type { Metadata } from "next";

import { requireSeller } from "@/lib/auth/guards";
import { routes } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardTitle } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Create Listing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Placeholder for Phase 4 (listing creation).
 *
 * It exists because the Phase 3 dashboard links to it. Shipping a stub beats
 * shipping a 404, but it is a stub: there is no form, no action and no write
 * path, so nothing a seller does here can create a listing.
 *
 * The `/seller` layout already admitted only SELLER; re-asserted for the same
 * reason as the dashboard.
 */
export default async function NewListingPage() {
  await requireSeller();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold tracking-[0.2em] text-brand-400 uppercase">Seller</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-100">
          Create Listing
        </h1>
      </header>

      <Card>
        <CardContent className="pt-6">
          <CardTitle>Not available yet</CardTitle>
          <p className="mt-2 text-pretty text-ink-300">
            Creating a listing arrives with Phase 4. New listings start as{" "}
            <strong className="text-ink-100">Draft</strong>, then move to{" "}
            <strong className="text-ink-100">Processing</strong> while the owner
            team reviews them, and go <strong className="text-ink-100">Active</strong> once
            approved.
          </p>

          <p className="mt-6">
            <ButtonLink href={routes.seller.dashboard} variant="outline" size="sm">
              Back to dashboard
            </ButtonLink>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
