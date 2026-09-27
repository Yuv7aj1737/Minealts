import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireSeller } from "@/lib/auth/guards";
import { getOwnedListing } from "@/lib/seller/dashboard.server";
import { LISTING_STATUS_META } from "@/lib/seller/status";
import { formatDate } from "@/lib/display";
import { formatMoney } from "@/lib/money";
import { routes } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Listing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Read-only view of one listing (Phase 3).
 *
 * The listing is fetched through `getOwnedListing(user.id, id)`, which filters
 * on the session's user id. A listing belonging to another seller produces the
 * same `notFound()` as one that does not exist — deliberately, so the page
 * cannot be used to confirm that a guessed id is real.
 */
export default async function SellerListingPage({ params }: PageProps<"/seller/listings/[id]">) {
  const user = await requireSeller();
  const { id } = await params;

  const listing = await getOwnedListing(user.id, id);
  if (!listing) notFound();

  const status = LISTING_STATUS_META[listing.status];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-100">
          {listing.title}
        </h1>
        <div className="flex items-center gap-2">
          <ButtonLink
            href={routes.seller.listingEdit(listing.id)}
            variant="accent"
            size="sm"
          >
            Edit
          </ButtonLink>
          <ButtonLink href={routes.seller.dashboard} variant="outline" size="sm">
            Back
          </ButtonLink>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
                Price
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold text-brand-300">
                {formatMoney(listing.price)}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
                Minecraft Username
              </dt>
              <dd className="mt-1 font-mono text-ink-100">
                {listing.minecraftUsername ?? "—"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
                Status
              </dt>
              <dd className="mt-1">
                <Badge tone={status.tone}>{status.label}</Badge>
                <span className="mt-1 block text-xs text-ink-500">{status.description}</span>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
                Created
              </dt>
              <dd className="mt-1 text-ink-100">{formatDate(listing.createdAt)}</dd>
            </div>
          </dl>

          <p className="mt-6 border-t border-surface-300/70 pt-4 text-xs text-ink-500">
            {listing.description ?? "No description yet."}
          </p>

          <p className="mt-4 text-xs text-ink-500">
            <Link href={routes.marketplace} className="text-brand-300 hover:underline">
              See the public marketplace
            </Link>
            . Creating and editing listings arrives with the next phase, and this
            page shows you what buyers will see once it is live.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
