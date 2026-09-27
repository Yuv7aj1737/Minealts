import Link from "next/link";

import { SellerAvatar } from "@/components/listings/SellerAvatar";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/display";
import { formatMoney } from "@/lib/money";
import { routes } from "@/lib/constants";
import type { MarketplaceCard as MarketplaceCardData } from "@/lib/listings/public.server";

/**
 * One tile in the marketplace grid.
 *
 * A server component: it renders inside the grid without shipping any client
 * JavaScript, which matters because a marketplace page is the most-visited
 * public surface on the site.
 *
 * The whole tile is one link. Nesting the price and seller inside a single
 * anchor (rather than several separate links) keeps the tab order to one stop
 * per listing.
 */
export function MarketplaceCard({ listing }: { listing: MarketplaceCardData }) {
  return (
    <Link
      href={routes.listing(listing.id)}
      className="group block h-full rounded-2xl focus-visible:outline-none"
    >
      <article
        className="card-sheen flex h-full flex-col rounded-2xl border border-surface-300/70 bg-surface-100/80 p-5 shadow-xl shadow-black/40 backdrop-blur-sm transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:border-brand-500/50 group-hover:shadow-brand-950/50 group-focus-visible:border-brand-400"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-balance text-ink-100 group-hover:text-ink-50">
            {listing.title}
          </h3>

          {listing.status === "SOLD" ? <Badge tone="neutral">Sold</Badge> : null}
        </div>

        <p className="mt-1.5 font-mono text-sm text-ink-400">
          {listing.minecraftUsername ?? "Username on request"}
        </p>

        {/* Push the price and seller to the bottom so cards of different title
            lengths still line up in a grid. */}
        <div className="mt-auto pt-5">
          <p className="font-display text-2xl font-bold tabular-nums text-brand-300">
            {formatMoney(listing.price)}
          </p>

          <div className="mt-4 flex items-center gap-3 border-t border-surface-300/60 pt-4">
            <SellerAvatar
              username={listing.seller.username}
              displayName={listing.seller.displayName}
              avatarUrl={listing.seller.avatarUrl}
              size="sm"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-200">
                {listing.seller.displayName || listing.seller.username}
              </p>
              <p className="truncate text-xs text-ink-500">
                {listing.seller.completedSales > 0
                  ? `${listing.seller.completedSales} completed sale${listing.seller.completedSales === 1 ? "" : "s"}`
                  : `Listed ${formatDate(listing.createdAt)}`}
              </p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
