import Link from "next/link";
import { Prisma } from "@prisma/client";

import { requireOwner } from "@/lib/auth/guards";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PERMISSIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { listSellerApplicationsForOwner } from "@/lib/seller-applications/service.server";
import { listAllListingsForOwner, listSellersForOwner } from "@/lib/listings/admin.server";
import { routes } from "@/lib/constants";
import { formatMoney, formatMoneyCompact } from "@/lib/money";

/**
 * The owner landing page.
 *
 * Three modules are live — applications, sellers and listings — and two are
 * still placeholders, orders and the wallet ledger. The placeholders stay inert
 * rather than disappearing, because a capability that exists in
 * `lib/auth/permissions.ts` with no page behind it is exactly the sort of thing
 * that gets "finished" by an unlinking button later.
 *
 * Every number here comes from a service call, never from a placeholder, so an
 * owner looking at this page is looking at the database.
 */
const PLANNED_MODULES: {
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
  title: string;
  description: string;
}[] = [
  {
    permission: PERMISSIONS.ORDER_MANAGE_ALL,
    title: "Orders",
    description: "Inspect orders, resolve disputes and force delivery states.",
  },
  {
    permission: PERMISSIONS.WALLET_MANAGE_ALL,
    title: "Wallet and ledger",
    description: "Inspect both ledgers, correct balances and trigger payouts.",
  },
];

export default async function OwnerPage() {
  // The layout already enforces this; asserting again is cheap insurance
  // against the page ever being mounted somewhere unguarded.
  const user = await requireOwner();

  const [{ counts: applicationCounts }, sellers, listings] = await Promise.all([
    listSellerApplicationsForOwner(),
    listSellersForOwner(user),
    listAllListingsForOwner(user),
  ]);

  const sellerRows = sellers ?? [];
  const suspendedSellers = sellerRows.filter((seller) => seller.suspended).length;

  // Summed with Decimal arithmetic, not `+=` on numbers: a rounded float total
  // would disagree with the per-seller figures below it.
  const grossRevenue = sellerRows.reduce(
    (total, seller) => total.add(seller.grossRevenue),
    new Prisma.Decimal(0),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-[0.2em] text-accent-400 uppercase">
              Owner
            </span>
            <Badge tone="accent">{ROLE_LABELS[user.role]}</Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-100">
            Owner control
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-ink-300">
            Applications, sellers and listings are live. Orders and the wallet ledger
            are still to come.
          </p>
        </div>

        <ButtonLink href={routes.dashboard} variant="outline" size="sm">
          Back to dashboard
        </ButtonLink>
      </div>

      {/* ------------------------------------------------------- Headline figures */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={routes.ownerPages.sellerApplications}>
          <Card interactive className="p-5">
            <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
              Applications pending
            </p>
            <p
              className={`mt-2 font-display text-3xl font-bold tabular-nums ${
                applicationCounts.pending > 0 ? "text-accent-300" : "text-ink-100"
              }`}
            >
              {applicationCounts.pending}
            </p>
            <p className="mt-1 text-xs text-ink-500">{applicationCounts.total} submitted in total</p>
          </Card>
        </Link>

        <Link href={routes.ownerPages.sellers}>
          <Card interactive className="p-5">
            <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
              Sellers
            </p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink-100">
              {sellerRows.length}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {suspendedSellers > 0 ? `${suspendedSellers} suspended` : "None suspended"}
            </p>
          </Card>
        </Link>

        <Link href={routes.ownerPages.listings}>
          <Card interactive className="p-5">
            <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
              Listings
            </p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink-100">
              {listings?.listings.length ?? 0}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {listings?.counts.ACTIVE ?? 0} live on the marketplace
            </p>
          </Card>
        </Link>

        <Card className="p-5">
          <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
            Delivered revenue
          </p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink-100">
            {formatMoneyCompact(grossRevenue)}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {formatMoney(grossRevenue)} across all sellers
          </p>
        </Card>
      </div>

      {/* ------------------------------------------------- Live: applications */}
      <Card className="border-accent-400/30 bg-accent-400/5">
        <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-accent-100">
                Seller applications
              </h2>
              <Badge tone={applicationCounts.pending > 0 ? "warning" : "neutral"}>
                {applicationCounts.pending} pending
              </Badge>
            </div>
            <p className="mt-1 text-sm text-pretty text-accent-100/80">
              Read every answer, then accept or reject. Accepting promotes the
              applicant to SELLER immediately.
            </p>
          </div>

          <ButtonLink href={routes.ownerPages.sellerApplications} variant="accent" size="md">
            Open review queue
          </ButtonLink>
        </div>
      </Card>

      {/* ------------------------------------------- Live: sellers and listings */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Seller management</CardTitle>
            <p className="text-sm text-ink-400">
              Suspend or reinstate a seller. Suspension hides their listings and locks
              their dashboard, and leaves their orders and balances intact.
            </p>
          </CardHeader>
          <CardContent>
            <ButtonLink href={routes.ownerPages.sellers} variant="primary" size="md">
              Manage sellers
            </ButtonLink>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listings</CardTitle>
            <p className="text-sm text-ink-400">
              Approve, reject or remove any listing across all sellers. Removal is a
              state, not a delete, so order history survives.
            </p>
          </CardHeader>
          <CardContent>
            <ButtonLink href={routes.ownerPages.listings} variant="primary" size="md">
              Review listings
            </ButtonLink>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLANNED_MODULES.map((module) => (
          <Card key={module.permission} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-ink-100">
                {module.title}
              </h2>
              <Badge tone="neutral">Planned</Badge>
            </div>
            <p className="mt-2 text-sm text-ink-400">{module.description}</p>
            <p className="mt-4 font-mono text-xs text-ink-500">{module.permission}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
