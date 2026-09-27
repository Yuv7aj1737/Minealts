import type { Metadata } from "next";
import Link from "next/link";

import { SellerAvatar } from "@/components/listings/SellerAvatar";
import { requireOwner } from "@/lib/auth/guards";
import { listSellersForOwner, type OwnerSellerRow } from "@/lib/listings/admin.server";
import { formatDate } from "@/lib/display";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { routes } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { SellerModerationForm } from "./SellerModerationForm";

export const metadata: Metadata = {
  title: "Owner · Sellers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The seller directory.
 *
 * Reading is delegated to `listSellersForOwner`, which returns `null` for
 * anything but an OWNER — so even a mistake in this page's JSX cannot leak the
 * table. The seller id in every row link comes from the database, and the
 * moderation form's `returnTo` is pinned to the directory by the action, so
 * there is no path in this page that a client can redirect elsewhere.
 *
 * A suspended seller stays in this table on purpose. Removing the row would hide
 * the seller's history from the owner, which is the opposite of useful when
 * someone is deciding whether to reinstate them.
 */
const NOTICES: Record<string, string> = {
  suspended: "Seller suspended. Their listings are hidden and their seller dashboard is locked.",
  reinstated: "Seller reinstated. Their active listings are back on the marketplace.",
  forbidden: "That area is restricted to a different role.",
  not_found: "No such seller.",
  not_a_seller: "That account is not a seller, so there was nothing to change.",
  invalid: "That request was malformed, so nothing was changed.",
};

const NOTICE_KEYS = Object.keys(NOTICES);

export default async function OwnerSellersPage({ searchParams }: PageProps<"/owner/sellers">) {
  const user = await requireOwner();
  const params = await searchParams;

  const sellers = await listSellersForOwner(user);
  if (!sellers) return null;

  const noticeKey = NOTICE_KEYS.find((key) => key in params);
  const notice = noticeKey ? NOTICES[noticeKey] : undefined;

  const suspended = sellers.filter((seller) => seller.suspended);
  const active = sellers.filter((seller) => !seller.suspended);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-[0.2em] text-accent-400 uppercase">
              Owner
            </span>
            {suspended.length > 0 ? (
              <Badge tone="brand">{suspended.length} suspended</Badge>
            ) : (
              <Badge tone="success">None suspended</Badge>
            )}
          </div>

          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-100">
            Sellers
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-ink-300">
            {sellers.length} seller{sellers.length === 1 ? "" : "s"} on the platform.
            Suspension hides a seller&apos;s listings immediately and locks their
            dashboard; reinstating reverses both.
          </p>
        </div>

        <ButtonLink href={routes.owner} variant="outline" size="sm">
          Owner home
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

      {sellers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-ink-400">
              Nobody has been approved as a seller yet.{" "}
              <Link
                href={routes.ownerPages.sellerApplications}
                className="text-brand-300 underline-offset-4 hover:underline"
              >
                Review applications
              </Link>{" "}
              to promote the first one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {suspended.length > 0 ? (
            <SellerGroup title="Suspended" sellers={suspended} suspended />
          ) : null}
          <SellerGroup title="In good standing" sellers={active} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function SellerGroup({
  title,
  sellers,
  suspended = false,
}: {
  title: string;
  sellers: OwnerSellerRow[];
  suspended?: boolean;
}) {
  if (sellers.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink-100">
        {title}
        <span className="ml-2 text-sm font-normal text-ink-500">{sellers.length}</span>
      </h2>

      <ul className="space-y-3">
        {sellers.map((seller) => (
          <li key={seller.id}>
            <Card className={cn("p-5", suspended && "border-brand-500/30")}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <SellerAvatar
                    username={seller.username}
                    displayName={seller.displayName}
                    avatarUrl={seller.avatarUrl}
                    size="lg"
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={routes.ownerPages.seller(seller.id)}
                        className="font-display text-base font-semibold text-ink-100 underline-offset-4 hover:underline"
                      >
                        {seller.displayName || seller.username}
                      </Link>
                      {seller.suspended ? <Badge tone="brand">Suspended</Badge> : null}
                    </div>

                    <p className="text-sm text-ink-400">@{seller.username}</p>

                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
                      <Stat label="Listings" value={String(seller.listingCount)} />
                      <Stat label="Live" value={String(seller.activeCount)} />
                      <Stat label="Sales" value={String(seller.completedSales)} />
                      <Stat
                        label="Gross"
                        value={formatMoneyCompact(seller.grossRevenue)}
                      />
                      <Stat label="Available" value={formatMoney(seller.availableBalance)} />
                      <Stat label="Pending" value={formatMoney(seller.pendingBalance)} />
                      <Stat label="Joined" value={formatDate(seller.createdAt)} />
                    </dl>

                    {seller.suspended && seller.suspendedReason ? (
                      <p className="mt-3 rounded-xl border border-brand-500/35 bg-brand-500/10 px-3 py-2 text-sm text-brand-200">
                        <span className="font-semibold">Reason:</span> {seller.suspendedReason}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="w-full shrink-0 lg:w-72">
                  <SellerModerationForm
                    sellerId={seller.id}
                    username={seller.username}
                    suspended={seller.suspended}
                    reason={seller.suspendedReason}
                    returnTo={routes.ownerPages.sellers}
                  />
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-semibold tracking-wide uppercase">{label}</dt>{" "}
      <dd className="inline text-ink-300">{value}</dd>
    </div>
  );
}
