import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SellerAvatar } from "@/components/listings/SellerAvatar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/display";
import { formatMoney } from "@/lib/money";
import { routes } from "@/lib/constants";
import { LISTING_STATUS_META } from "@/lib/listings/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { getOwnedListing } from "@/lib/seller/dashboard.server";
import { getListingForOwner, type OwnerListingDetail } from "@/lib/listings/admin.server";
import {
  canViewNonPublicListing,
  getPublicListing,
  type PublicListing,
} from "@/lib/listings/public.server";

export const metadata: Metadata = {
  title: "Listing",
  robots: { index: false, follow: false },
};

/** Per-listing content plus a per-request session check: never cached. */
export const dynamic = "force-dynamic";

/**
 * The public listing page.
 *
 * Three outcomes, in order:
 *
 *  1. `ACTIVE` or `SOLD` — rendered for everyone, including signed-out visitors.
 *  2. Not public, but the viewer is an OWNER or the owning SELLER — rendered as a
 *     preview, with a banner saying it is not for sale.
 *  3. Anything else — `notFound()`.
 *
 * The 404 is deliberately indistinguishable from "no such listing". A page that
 * said "this listing was removed" would confirm that a guessed id once existed
 * and would tell a scraper which ids are worth retrying.
 */
export default async function ListingPage({ params }: PageProps<"/listing/[id]">) {
  const { id } = await params;

  const viewer = await getCurrentUser();
  const publicListing = await getPublicListing(id);

  if (publicListing) {
    return <PublicView listing={publicListing} />;
  }

  if (!viewer || !(await canViewNonPublicListing({ listingId: id, viewer }))) {
    notFound();
  }

  if (can(viewer.role, PERMISSIONS.LISTING_MANAGE_ALL)) {
    const detail = await getListingForOwner(viewer, id);
    if (!detail) notFound();
    return <OwnerPreview detail={detail} />;
  }

  // Own draft: the seller-scoped query, so this cannot become a back door onto
  // somebody else's listing.
  const owned = await getOwnedListing(viewer.id, id);
  if (!owned) notFound();
  return <SellerPreview detail={owned} />;
}

/* ------------------------------------------------------------------------- */

function PublicView({ listing }: { listing: PublicListing }) {
  const status = LISTING_STATUS_META[listing.status];
  const sold = listing.status === "SOLD";
  const sellerName = listing.seller.displayName || listing.seller.username;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href={routes.marketplace} variant="ghost" size="sm">
          ← Back to marketplace
        </ButtonLink>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="relative">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-balance text-ink-100">
                    {listing.title}
                  </h1>
                  <p className="mt-1.5 font-mono text-sm text-ink-400">
                    {listing.minecraftUsername ?? "Username on request"}
                  </p>
                </div>

                <p className="font-display text-3xl font-bold tabular-nums text-brand-300">
                  {formatMoney(listing.price)}
                </p>
              </div>
            </CardHeader>

            <CardContent>
              {listing.description ? (
                <p className="text-pretty leading-relaxed whitespace-pre-wrap text-ink-200">
                  {listing.description}
                </p>
              ) : (
                <p className="text-sm text-ink-400 italic">
                  The seller has not written a description for this listing. Ask them
                  any questions before buying.
                </p>
              )}

              <dl className="mt-6 grid gap-5 border-t border-surface-300/70 pt-5 sm:grid-cols-2">
                <Detail label="Listed on">{formatDate(listing.createdAt)}</Detail>
                <Detail label="Times sold">
                  {listing.soldCount === 0 ? "Not sold yet" : listing.soldCount}
                </Detail>
                <Detail label="Review">
                  {/*
                    Derived from a real event rather than asserted: `reviewedAt`
                    is stamped by the owner action that made a listing ACTIVE.
                    A listing from before review tracking existed therefore reads
                    as unrecorded rather than being quietly grandfathered in as
                    "verified".
                  */}
                  {listing.reviewedAt ? "Approved by an owner" : "No recorded review"}
                </Detail>
                <Detail label="Seller standing">
                  {listing.seller.suspended ? "Suspended" : "In good standing"}
                </Detail>
              </dl>
            </CardContent>

            {/* A sold item stays readable — the page doubles as the receipt —
                but it is unmistakably not for sale. */}
            {sold ? <SoldOverlay /> : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Seller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3">
                <SellerAvatar
                  username={listing.seller.username}
                  displayName={listing.seller.displayName}
                  avatarUrl={listing.seller.avatarUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold text-ink-100">
                    {sellerName}
                  </p>
                  <p className="truncate text-sm text-ink-400">@{listing.seller.username}</p>
                </div>
              </div>

              {listing.seller.suspended ? (
                <p className="rounded-xl border border-brand-500/35 bg-brand-500/10 px-3 py-2.5 text-xs text-brand-200">
                  This seller is suspended, so their listings are hidden from the
                  marketplace and they cannot take new orders.
                </p>
              ) : null}

              <dl className="space-y-3">
                <Detail label="Completed sales">{listing.seller.completedSales}</Detail>
                <Detail label="Listings on sale">{listing.seller.activeListings}</Detail>
                <Detail label="Member since">
                  {formatDate(listing.seller.memberSince)}
                </Detail>
              </dl>
            </CardContent>
          </Card>

          <Card className="border-accent-400/30 bg-accent-400/5">
            <CardContent className="pt-6">
              <p className="font-display text-lg font-semibold text-accent-100">
                {sold ? "This one is gone" : "Ready to buy?"}
              </p>
              <p className="mt-1.5 text-sm text-pretty text-accent-100/80">
                {sold
                  ? "It has already sold, so it is no longer available."
                  : "Checkout, delivery and payouts arrive with the next phase of MineAlts. Nothing on this page takes payment today."}
              </p>

              <button
                type="button"
                disabled
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-b from-accent-300 to-accent-500 px-5 text-sm font-semibold text-surface-0 opacity-50"
              >
                {sold ? "Sold" : "Buy now — coming soon"}
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function OwnerPreview({ detail }: { detail: OwnerListingDetail }) {
  const status = LISTING_STATUS_META[detail.status];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href={routes.ownerPages.listings} variant="ghost" size="sm">
          ← Back to owner listings
        </ButtonLink>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink-100">
                {detail.title}
              </h1>
              <p className="mt-1.5 font-mono text-sm text-ink-400">
                {detail.minecraftUsername ?? "—"}
              </p>
            </div>
            <p className="font-display text-3xl font-bold tabular-nums text-brand-300">
              {formatMoney(detail.price)}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {/* The whole point of this branch: the page looks the same, but says
              loudly that nobody else can see it. */}
          <p className="rounded-xl border border-accent-400/35 bg-accent-400/10 px-3 py-2.5 text-sm text-accent-100">
            <strong className="font-semibold">Owner preview.</strong> {status.description}{" "}
            Buyers see a 404 for this listing.
          </p>

          {detail.description ? (
            <p className="mt-5 text-pretty leading-relaxed whitespace-pre-wrap text-ink-200">
              {detail.description}
            </p>
          ) : (
            <p className="mt-5 text-sm text-ink-400 italic">No description provided.</p>
          )}

          <dl className="mt-6 grid gap-5 border-t border-surface-300/70 pt-5 sm:grid-cols-3">
            <Detail label="Seller">
              <Linkish href={routes.ownerPages.seller(detail.seller.id)}>
                @{detail.seller.username}
              </Linkish>
            </Detail>
            <Detail label="Last reviewed">
              {detail.reviewedAt
                ? `${formatDate(detail.reviewedAt)}${detail.reviewedBy ? ` by @${detail.reviewedBy}` : ""}`
                : "Never"}
            </Detail>
            <Detail label="Seller suspended">
              {detail.seller.suspended ? "Yes" : "No"}
            </Detail>
          </dl>

          {detail.reviewNote ? (
            <p className="mt-5 rounded-xl border border-surface-300/70 bg-surface-200/40 px-3 py-2.5 text-sm text-ink-200">
              <span className="font-semibold">Review note:</span> {detail.reviewNote}
            </p>
          ) : null}

          <p className="mt-6 text-sm text-ink-400">
            Review and remove it in{" "}
            <Linkish href={routes.ownerPages.listings}>owner listings</Linkish>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SellerPreview({
  detail,
}: {
  detail: {
    title: string;
    minecraftUsername: string | null;
    description: string | null;
    price: import("@prisma/client").Prisma.Decimal;
    status: keyof typeof LISTING_STATUS_META;
  };
}) {
  const status = LISTING_STATUS_META[detail.status];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href={routes.seller.dashboard} variant="ghost" size="sm">
          ← Back to your listings
        </ButtonLink>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink-100">
                {detail.title}
              </h1>
              <p className="mt-1.5 font-mono text-sm text-ink-400">
                {detail.minecraftUsername ?? "—"}
              </p>
            </div>
            <p className="font-display text-3xl font-bold tabular-nums text-brand-300">
              {formatMoney(detail.price)}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <p className="rounded-xl border border-surface-300/70 bg-surface-200/40 px-3 py-2.5 text-sm text-ink-200">
            {status.description} This is your own listing, so you can preview it here.
          </p>

          {detail.description ? (
            <p className="mt-5 text-pretty leading-relaxed whitespace-pre-wrap text-ink-200">
              {detail.description}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink-100">{children}</dd>
    </div>
  );
}

function Linkish({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-brand-300 underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

/**
 * Scrim over a sold listing, layered on top of the card content so the price and
 * description stay legible underneath it.
 */
function SoldOverlay() {
  return (
    <div
      // Purely decorative: the Sold badge above the card already announces this
      // to assistive tech, and the buy button says "Sold" in text too.
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 grid place-items-center bg-surface-0/70 backdrop-blur-[2px]"
    >
      <span className="rotate-[-6deg] rounded-2xl border-4 border-ink-100/80 px-8 py-3 font-display text-3xl font-bold tracking-widest text-ink-100 uppercase">
        Sold
      </span>
    </div>
  );
}
