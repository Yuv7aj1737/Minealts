import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { SellerAvatar } from "@/components/listings/SellerAvatar";
import { requireOwner } from "@/lib/auth/guards";
import { getSellerForOwner } from "@/lib/listings/admin.server";
import { LISTING_STATUS_META } from "@/lib/listings/schema";
import { formatDate } from "@/lib/display";
import { formatMoney } from "@/lib/money";
import { routes } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ListingDecisionForm } from "../../listings/ListingDecisionForm";
import { SellerModerationForm } from "../SellerModerationForm";

export const metadata: Metadata = {
  title: "Owner · Seller",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * One seller's profile, for an owner.
 *
 * The seller id comes from the route segment, which is unavoidable — but it is
 * only ever used as a lookup key. `getSellerForOwner` re-checks the reviewer's
 * role on every call and additionally requires the target's role to be
 * `SELLER`, so this URL cannot be used to read an owner's or a plain member's
 * record, and the directory link is not a capability.
 *
 * Balances are shown because an owner deciding whether to reinstate someone needs
 * to know whether money is involved.
 */
const NOTICES: Record<string, string> = {
  suspended: "Seller suspended.",
  reinstated: "Seller reinstated.",
  forbidden: "That area is restricted to a different role.",
  not_found: "No such seller.",
  not_a_seller: "That account is not a seller.",
  invalid: "That request was malformed, so nothing was changed.",
};

const NOTICE_KEYS = Object.keys(NOTICES);

export default async function OwnerSellerPage({
  params,
  searchParams,
}: PageProps<"/owner/sellers/[id]">) {
  const owner = await requireOwner();
  const { id } = await params;
  const query = await searchParams;

  const detail = await getSellerForOwner(owner, id);
  if (!detail) notFound();

  const { seller, listings, counts } = detail;
  const noticeKey = NOTICE_KEYS.find((key) => key in query);
  const notice = noticeKey ? NOTICES[noticeKey] : undefined;

  const grossShare = formatMoney(seller.grossRevenue);

  return (
    <div className="space-y-8">
      {/* -------------------------------------------------------------- Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <SellerAvatar
            username={seller.username}
            displayName={seller.displayName}
            avatarUrl={seller.avatarUrl}
            size="xl"
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink-100">
                {seller.displayName || seller.username}
              </h1>
              {seller.suspended ? <Badge tone="brand">Suspended</Badge> : null}
            </div>
            <p className="text-sm text-ink-400">@{seller.username}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              Joined {formatDate(seller.createdAt)}
            </p>
          </div>
        </div>

        <ButtonLink href={routes.ownerPages.sellers} variant="outline" size="sm">
          All sellers
        </ButtonLink>
      </div>

      {notice ? (
        <p
          role="status"
          className="animate-fade-in rounded-xl border border-accent-400/40 bg-accent-400/10 px-4 py-3 text-sm text-accent-100"
        >
          {notice}
        </p>
      ) : null}

      {/* ----------------------------------------------------------- Balances */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Listings" value={String(seller.listingCount)} hint={`${seller.activeCount} live`} />
        <Figure label="Completed sales" value={String(seller.completedSales)} hint={grossShare + " gross"} />
        <Figure label="Available balance" value={formatMoney(seller.availableBalance)} hint="Ready to withdraw" />
        <Figure label="Pending balance" value={formatMoney(seller.pendingBalance)} hint="Held until delivery" />
      </div>

      {/* --------------------------------------------------------- Suspension */}
      <Card className={seller.suspended ? "border-brand-500/30" : undefined}>
        <CardHeader>
          <CardTitle>Account standing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-pretty text-ink-300">
            {seller.suspended
              ? "This seller is suspended. They cannot open their seller dashboard, and every listing they own is hidden from the marketplace."
              : "This seller is in good standing. Suspending hides their listings and locks their dashboard, but leaves their orders and balances intact."}
          </p>

          {seller.suspended && seller.suspendedReason ? (
            <p className="mt-3 rounded-xl border border-brand-500/35 bg-brand-500/10 px-3 py-2 text-sm text-brand-200">
              <span className="font-semibold">Reason shown to the seller:</span>{" "}
              {seller.suspendedReason}
            </p>
          ) : null}

          <div className="mt-4 max-w-md">
            <SellerModerationForm
              sellerId={seller.id}
              username={seller.username}
              suspended={seller.suspended}
              reason={seller.suspendedReason}
              returnTo={routes.ownerPages.seller(seller.id)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ Listings */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink-100">
            Listings
            <span className="ml-2 text-sm font-normal text-ink-500">{listings.length}</span>
          </h2>

          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
            {(Object.keys(counts) as (keyof typeof counts)[]).map((status) => (
              <span key={status}>
                {LISTING_STATUS_META[status].label}: <span className="text-ink-300">{counts[status]}</span>
              </span>
            ))}
          </p>
        </div>

        {listings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-ink-400">This seller has no listings yet.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {listings.map((listing) => (
              <li key={listing.id}>
                <Card className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-ink-100">
                          {listing.title}
                        </h3>
                        <Badge tone={LISTING_STATUS_META[listing.status].tone}>
                          {LISTING_STATUS_META[listing.status].label}
                        </Badge>
                      </div>

                      <p className="mt-1.5 font-mono text-sm text-ink-400">
                        {listing.minecraftUsername ?? "No username"}
                      </p>

                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                        <span className="font-semibold text-brand-300">
                          {formatMoney(listing.price)}
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
                        compact
                      />
                      <ButtonLink
                        href={routes.listing(listing.id)}
                        variant="ghost"
                        size="sm"
                        className="w-full"
                      >
                        Open preview
                      </ButtonLink>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-ink-500">
        Order-level tools and the wallet ledger are Phase 5 and 7.{" "}
        <Link href={routes.owner} className="text-brand-300 underline-offset-4 hover:underline">
          Owner home
        </Link>
        .
      </p>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink-100">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{hint}</p>
    </Card>
  );
}
