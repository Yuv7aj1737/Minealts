import type { Metadata } from "next";
import Link from "next/link";

import { requireOwner } from "@/lib/auth/guards";
import { listAllListingsForOwner } from "@/lib/listings/admin.server";
import { LISTING_STATUS_META } from "@/lib/listings/schema";
import { formatDate } from "@/lib/display";
import { formatMoney } from "@/lib/money";
import { routes } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListingDecisionForm } from "./ListingDecisionForm";

export const metadata: Metadata = {
  title: "Owner · Listings",
  robots: { index: false, follow: false },
};

/** Reads a live queue and renders per-owner affordances: never cached. */
export const dynamic = "force-dynamic";

/**
 * Every listing on the platform, with the decisions that are legal from its
 * current status.
 *
 * Filtering happens in the URL, not in the query, so a filtered view is
 * bookmarkable and the owner can share a link to exactly what they are looking
 * at. The status values in the filter bar are hard-coded rather than derived
 * from a database read: they are the enum, and the enum is in the type.
 */
const FILTERS = [
  { value: "", label: "All" },
  { value: "PROCESSING", label: "Needs review" },
  { value: "ACTIVE", label: "Live" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SOLD", label: "Sold" },
  { value: "REMOVED", label: "Removed" },
  { value: "DRAFT", label: "Drafts" },
] as const;

const NOTICES: Record<string, string> = {
  approved: "Listing approved and published to the marketplace.",
  rejected: "Listing rejected. The seller can edit it and resubmit.",
  removed: "Listing removed from the marketplace.",
  restored: "Listing restored to draft for the seller to resubmit.",
  forbidden: "That area is restricted to a different role.",
  not_found: "That listing no longer exists.",
  conflict: "That listing changed state while the page was open. Reload and try again.",
  invalid: "That request was malformed, so nothing was changed.",
};

/** Keys the action can set, used to spot a banner in the query string. */
const NOTICE_KEYS = Object.keys(NOTICES);

export default async function OwnerListingsPage({ searchParams }: PageProps<"/owner/listings">) {
  const user = await requireOwner();
  const params = await searchParams;

  const summary = await listAllListingsForOwner(user);
  if (!summary) {
    // Belt and braces: the layout and the guard both said no. Nothing rendered.
    return null;
  }

  const rawStatus = typeof params?.status === "string" ? params.status : "";
  const statusFilter = FILTERS.some((filter) => filter.value === rawStatus)
    ? rawStatus
    : "";

  // Presence, not value: the action always appends `?flag=1`, so checking for
  // the key is both simpler and immune to a future `?approved=` spelling.
  const noticeKey = NOTICE_KEYS.find((key) => key in params);
  const notice = noticeKey ? NOTICES[noticeKey] : undefined;

  const visible = statusFilter
    ? summary.listings.filter((listing) => listing.status === statusFilter)
    : summary.listings;

  return (
    <div className="space-y-8">
      <Header queueCount={summary.queueCount} />

      {notice ? (
        <p
          role="status"
          className="animate-fade-in rounded-xl border border-accent-400/40 bg-accent-400/10 px-4 py-3 text-sm text-accent-100"
        >
          {notice}
        </p>
      ) : null}

      {/* ------------------------------------------------------ Status counts */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CountTile
          label="Total"
          value={summary.listings.length}
          href={filterHref("")}
          active={statusFilter === ""}
        />
        {FILTERS.filter((filter) => filter.value !== "").map((filter) => (
          <CountTile
            key={filter.value}
            label={filter.label}
            value={summary.counts[filter.value as keyof typeof summary.counts]}
            href={filterHref(filter.value)}
            active={statusFilter === filter.value}
            tone={LISTING_STATUS_META[filter.value as keyof typeof LISTING_STATUS_META].tone}
          />
        ))}
      </div>

      {/* ------------------------------------------------------------- Table */}
      {visible.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-ink-400">
              {statusFilter
                ? "No listings in this state."
                : "No listings exist yet. They appear here as soon as a seller submits one."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((listing) => (
            <li key={listing.id}>
              <Card className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-semibold text-ink-100">
                        {listing.title}
                      </h2>
                      <Badge tone={LISTING_STATUS_META[listing.status].tone}>
                        {LISTING_STATUS_META[listing.status].label}
                      </Badge>
                      {listing.seller.suspended ? (
                        <Badge tone="brand">Seller suspended</Badge>
                      ) : null}
                    </div>

                    <p className="mt-1.5 font-mono text-sm text-ink-400">
                      {listing.minecraftUsername ?? "No username"}
                    </p>

                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span className="font-semibold text-brand-300">
                        {formatMoney(listing.price)}
                      </span>
                      <span>·</span>
                      <span>
                        Seller{" "}
                        <Link
                          href={routes.ownerPages.seller(listing.seller.id)}
                          className="text-brand-300 underline-offset-4 hover:underline"
                        >
                          @{listing.seller.username}
                        </Link>
                      </span>
                      <span>·</span>
                      <span>Created {formatDate(listing.createdAt)}</span>
                      {listing.reviewedAt ? (
                        <>
                          <span>·</span>
                          <span>Reviewed {formatDate(listing.reviewedAt)}</span>
                        </>
                      ) : null}
                    </p>

                    <p className="mt-2 text-xs text-ink-500">
                      {LISTING_STATUS_META[listing.status].description}
                    </p>

                    {listing.reviewNote ? (
                      <p className="mt-3 rounded-xl border border-surface-300/70 bg-surface-200/40 px-3 py-2 text-sm text-ink-300">
                        <span className="font-semibold text-ink-200">Note:</span>{" "}
                        {listing.reviewNote}
                      </p>
                    ) : null}
                  </div>

                  <div className="w-full shrink-0 space-y-3 lg:w-80">
                    <ListingDecisionForm
                      listingId={listing.id}
                      decisions={listing.availableDecisions}
                      defaultNote={listing.reviewNote}
                    />
                    <ButtonLink
                      href={routes.listing(listing.id)}
                      variant="ghost"
                      size="sm"
                      className="w-full"
                    >
                      Open public preview
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Header({ queueCount }: { queueCount: number }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-[0.2em] text-accent-400 uppercase">
            Owner
          </span>
          {queueCount > 0 ? (
            <Badge tone="warning">{queueCount} awaiting review</Badge>
          ) : (
            <Badge tone="success">Queue clear</Badge>
          )}
        </div>

        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-100">
          All listings
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-ink-300">
          Every listing from every seller. Approving publishes it to the marketplace;
          removing hides it without deleting the row, so order history survives.
        </p>
      </div>

      <ButtonLink href={routes.owner} variant="outline" size="sm">
        Owner home
      </ButtonLink>
    </div>
  );
}

function filterHref(status: string): string {
  return status ? `${routes.ownerPages.listings}?status=${status}` : routes.ownerPages.listings;
}

function CountTile({
  label,
  value,
  href,
  active,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  active: boolean;
  tone?: BadgeTone;
}) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      <Card
        interactive
        className={cn(
          "p-4",
          active ? "border-brand-500/60 bg-brand-500/10" : undefined,
        )}
      >
        <p className="text-xs font-semibold tracking-[0.12em] text-ink-500 uppercase">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 font-display text-2xl font-bold tabular-nums",
            tone === "warning" && value > 0 ? "text-accent-300" : "text-ink-100",
          )}
        >
          {value}
        </p>
      </Card>
    </Link>
  );
}
