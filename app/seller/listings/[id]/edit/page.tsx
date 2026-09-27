import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireSeller } from "@/lib/auth/guards";
import { getOwnedListing } from "@/lib/seller/dashboard.server";
import { routes } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardTitle } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Edit Listing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Placeholder for Phase 4 (listing editing).
 *
 * Reached from the dashboard's Edit action. It is read-only on purpose: there
 * is no server action bound to this route, so no `update` can be triggered.
 *
 * Ownership is checked before rendering, using the same session-scoped lookup
 * as the view page, so this stub does not become a way to confirm that another
 * seller's listing id exists.
 */
export default async function EditListingPage({
  params,
}: PageProps<"/seller/listings/[id]/edit">) {
  const user = await requireSeller();
  const { id } = await params;

  const listing = await getOwnedListing(user.id, id);
  if (!listing) notFound();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold tracking-[0.2em] text-brand-400 uppercase">Seller</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-100">
          Edit listing
        </h1>
        <p className="mt-2 text-pretty text-ink-300">{listing.title}</p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <CardTitle>Editing is not available yet</CardTitle>
          <p className="mt-2 text-pretty text-ink-300">
            The listing editor arrives with Phase 4. Until then this listing
            cannot be changed or withdrawn.
          </p>

          <p className="mt-6 flex flex-wrap gap-2">
            <ButtonLink
              href={routes.seller.listing(listing.id)}
              variant="outline"
              size="sm"
            >
              View listing
            </ButtonLink>
            <ButtonLink href={routes.seller.dashboard} variant="ghost" size="sm">
              Back to dashboard
            </ButtonLink>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
