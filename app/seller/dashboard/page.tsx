import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireSeller } from "@/lib/auth/guards";
import { getSellerDashboardData } from "@/lib/seller/dashboard.server";
import { LISTING_STATUS_META, ORDER_STATUS_META, SELLER_SHARE_PERCENT } from "@/lib/seller/status";
import { formatDate } from "@/lib/display";
import { formatMoney } from "@/lib/money";
import { routes } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Seller Dashboard",
  robots: { index: false, follow: false },
};

/** Always server-rendered: the numbers are per-session. */
export const dynamic = "force-dynamic";

/**
 * Phase 3 — the seller dashboard.
 *
 * The layout already admitted only SELLER. This page re-asserts it, so it
 * stays safe if it is ever mounted outside that layout.
 *
 * The seller id passed to the data layer is `user.id` from the server session.
 * It is never read from a search param, a prop, or anything the browser can
 * influence — see `lib/seller/dashboard.server.ts`, where no query accepts a
 * seller id it did not receive from the session.
 */
export default async function SellerDashboardPage() {
  const user = await requireSeller();

  const { stats, listings, sales } = await getSellerDashboardData(user.id);

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------------------- Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-[0.2em] text-brand-400 uppercase">
              Seller
            </span>
            <Badge tone="brand">Active</Badge>
          </div>

          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-100">
            Seller dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-ink-300">
            Everything about your listings, orders and balance, in one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={routes.dashboard} variant="outline" size="md">
            Member dashboard
          </ButtonLink>
          <ButtonLink href={routes.seller.listingsNew} variant="accent" size="md">
            Create Listing
          </ButtonLink>
        </div>
      </div>

      {/* -------------------------------------------------------- Quick links */}
      <nav aria-label="Seller sections" className="flex flex-wrap gap-2">
        <SectionLink href="#listings">My Listings</SectionLink>
        <SectionLink href="#wallet">Wallet Summary</SectionLink>
        <SectionLink href="#sales">Sales History</SectionLink>
      </nav>

      {/* ------------------------------------------------------- Metric cards */}
      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Sales"
          value={String(stats.totalSales)}
          hint={`${formatMoney(stats.totalRevenue)} gross delivered`}
          tone="brand"
        />
        <StatCard
          label="Active Listings"
          value={String(stats.activeListings)}
          hint="Live and visible to buyers"
          tone="success"
        />
        <StatCard
          label="Sold Listings"
          value={String(stats.soldListings)}
          hint="Completed by a buyer"
          tone="brand"
        />
        <StatCard
          label="Pending Orders"
          value={String(stats.pendingOrders)}
          hint="Waiting to be fulfilled"
          tone={stats.pendingOrders > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Available Balance"
          value={formatMoney(stats.availableBalance)}
          hint="Ready to withdraw"
          tone="success"
          id="wallet"
        />
        <StatCard
          label="Pending Balance"
          value={formatMoney(stats.pendingBalance)}
          hint="Held until delivery is confirmed"
          tone="warning"
        />
      </section>

      {/* ------------------------------------------------------------ Wallet */}
      <section id="wallet" className="scroll-mt-24 space-y-4">
        <Card className="border-accent-400/30 bg-accent-400/5">
          <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-accent-100">
                Wallet summary
              </h2>

              {/* Requirement: state the seller's rate, without the word
                  "commission". */}
              <p className="mt-1 text-sm text-pretty text-accent-100/85">
                You will receive {SELLER_SHARE_PERCENT}% of every sale. The
                remaining {100 - SELLER_SHARE_PERCENT}% is retained by the site.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
                  Available
                </p>
                <p className="font-display text-2xl font-bold text-emerald-300">
                  {formatMoney(stats.availableBalance)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
                  Pending
                </p>
                <p className="font-display text-2xl font-bold text-accent-300">
                  {formatMoney(stats.pendingBalance)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <p className="text-xs text-ink-500">
          Withdrawals, the payout ledger and sales eligibility arrive with Phase 7.
        </p>
      </section>

      {/* ----------------------------------------------------------- Listings */}
      <section id="listings" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink-100">My Listings</h2>
          <ButtonLink href={routes.seller.listingsNew} variant="outline" size="sm">
            Create Listing
          </ButtonLink>
        </div>

        {listings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-ink-400">
                You have not created any listings yet.
              </p>
              <p className="mt-3">
                <ButtonLink href={routes.seller.listingsNew} variant="accent" size="sm">
                  Create your first listing
                </ButtonLink>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-surface-300/70">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Your listings</caption>
              <thead>
                <tr className="border-b border-surface-300/70 bg-surface-200/40 text-xs tracking-wide text-ink-500 uppercase">
                  <th scope="col" className="px-4 py-3 font-semibold">Title</th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">
                    Minecraft Username
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">Price</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">
                    Created
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-surface-300/60">
                {listings.map((listing) => (
                  <tr key={listing.id} className="bg-surface-100/60 transition-colors hover:bg-surface-200/40">
                    <td className="px-4 py-3 font-medium text-ink-100">
                      <span className="block max-w-64 truncate">{listing.title}</span>
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-ink-300 sm:table-cell">
                      {listing.minecraftUsername ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-200">
                      {formatMoney(listing.price)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={LISTING_STATUS_META[listing.status].tone}>
                        {LISTING_STATUS_META[listing.status].label}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-400 md:table-cell">
                      {formatDate(listing.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ButtonLink
                          href={routes.seller.listing(listing.id)}
                          variant="outline"
                          size="sm"
                        >
                          View
                        </ButtonLink>
                        <ButtonLink
                          href={routes.seller.listingEdit(listing.id)}
                          variant="ghost"
                          size="sm"
                        >
                          Edit
                        </ButtonLink>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------- Sales */}
      <section id="sales" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-lg font-semibold text-ink-100">Sales History</h2>

        {sales.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-ink-400">
                No orders yet. Sales appear here as soon as a buyer purchases one of
                your listings.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-surface-300/70">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Your sales</caption>
              <thead>
                <tr className="border-b border-surface-300/70 bg-surface-200/40 text-xs tracking-wide text-ink-500 uppercase">
                  <th scope="col" className="px-4 py-3 font-semibold">Listing</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Amount</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">
                    Date
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-surface-300/60">
                {sales.map((order) => (
                  <tr key={order.id} className="bg-surface-100/60">
                    <td className="px-4 py-3 font-medium text-ink-100">
                      <span className="block max-w-64 truncate">{order.listingTitle}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-200">{formatMoney(order.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ORDER_STATUS_META[order.status].tone}>
                        {ORDER_STATUS_META[order.status].label}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-400 sm:table-cell">
                      {formatDate(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-xl border border-surface-300/70 bg-surface-100/60 px-4 py-2 text-sm font-medium text-ink-200 transition-colors hover:border-brand-500/50 hover:bg-surface-200 hover:text-ink-100"
    >
      {children}
    </a>
  );
}

/** Colour for a metric value, keyed by the card's tone. */
const VALUE_TONE: Record<BadgeTone, string> = {
  neutral: "text-ink-100",
  brand: "text-brand-300",
  accent: "text-accent-200",
  success: "text-emerald-300",
  warning: "text-accent-300",
};

function StatCard({
  label,
  value,
  hint,
  tone,
  id,
}: {
  label: string;
  value: string;
  hint: string;
  tone: BadgeTone;
  id?: string;
}) {
  return (
    <Card id={id} interactive className="scroll-mt-24 p-5">
      <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
        {label}
      </p>

      <p
        className={cn("mt-2 font-display text-3xl font-bold tabular-nums", VALUE_TONE[tone])}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-ink-500">{hint}</p>
    </Card>
  );
}
