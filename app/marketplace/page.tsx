import type { Metadata } from "next";
import Link from "next/link";

import { MarketplaceCard } from "@/components/listings/MarketplaceCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PLATFORM_CURRENCY } from "@/lib/money";
import { routes } from "@/lib/constants";
import { MAX_SEARCH_LENGTH, normaliseSearch } from "@/lib/listings/schema";
import { getMarketplaceListings, getMarketplaceStats } from "@/lib/listings/public.server";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Browse Minecraft accounts, server slots and boosts from approved MineAlts sellers.",
};

/**
 * Server-rendered on every request.
 *
 * Deliberately not cached: the grid is the site's main public surface, prices
 * and stock change, and a stale marketplace is worse than a slightly slower one.
 * Caching becomes worth it if the catalogue grows large enough to matter, and
 * then it belongs on the query rather than the page.
 */
export const dynamic = "force-dynamic";

/**
 * The public marketplace grid.
 *
 * Reachable without signing in — the whole page is built from
 * `lib/listings/public.server.ts`, which takes no user id and can only return
 * `ACTIVE` listings from non-suspended sellers. There is no branch on the
 * session here, so there is nothing to get wrong by an unauthenticated visitor.
 */
export default async function MarketplacePage({ searchParams }: PageProps<"/marketplace">) {
  const params = await searchParams;

  const query = normaliseSearch(typeof params?.q === "string" ? params.q : "");
  const pageParam = typeof params?.page === "string" ? Number(params.page) : 1;

  const [result, stats] = await Promise.all([
    getMarketplaceListings({ query, page: Number.isFinite(pageParam) ? pageParam : 1 }),
    getMarketplaceStats(),
  ]);

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------------------- Header */}
      <section className="space-y-5">
        <div>
          <span className="text-xs font-bold tracking-[0.2em] text-brand-400 uppercase">
            Marketplace
          </span>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance text-ink-100">
            Alt accounts, servers and boosts
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-ink-300">
            Every listing here was submitted by a seller and approved by our owner
            team. Prices are in {PLATFORM_CURRENCY} and delivery is handled through
            our bot.
          </p>
        </div>

        {/* -------------------------------------------------- Platform figures */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Figure
            label="Active listings"
            value={stats.activeListings}
            hint="Live and buyable right now"
          />
          <Figure
            label="Completed sales"
            value={stats.completedSales}
            hint="Delivered orders, all time"
          />
          <Figure
            label="Approved sellers"
            value={stats.sellerCount}
            hint="Not suspended"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------- Search */}
      <SearchBar query={result.query} />

      {/* --------------------------------------------------------------- Grid */}
      {result.listings.length === 0 ? (
        <EmptyState query={result.query} />
      ) : (
        <>
          <p className="text-sm text-ink-400">
            {result.total} listing{result.total === 1 ? "" : "s"}
            {result.query ? (
              <>
                {" "}
                for <span className="text-ink-200">“{result.query}”</span>
              </>
            ) : null}
            {result.pageCount > 1 ? (
              <> · page {result.page} of {result.pageCount}</>
            ) : null}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.listings.map((listing) => (
              <MarketplaceCard key={listing.id} listing={listing} />
            ))}
          </div>

          {result.pageCount > 1 ? <Pagination page={result.page} pageCount={result.pageCount} query={result.query} /> : null}
        </>
      )}

      <p className="text-xs text-ink-500">
        Buying is not enabled yet. Checkout, delivery and payouts arrive with the
        next phase — nothing on this page takes payment today.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Figure({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink-100">
        {value}
      </p>
      <p className="mt-1 text-xs text-ink-500">{hint}</p>
    </Card>
  );
}

/**
 * A plain GET form: the search runs on the server and the result is a real URL,
 * so results are shareable and the back button works. No client state, no
 * fetch, nothing to hydrate.
 */
function SearchBar({ query }: { query: string }) {
  return (
    <form action={routes.marketplace} method="get" role="search" className="flex flex-wrap gap-2">
      <label htmlFor="marketplace-q" className="sr-only">
        Search listings
      </label>
      <input
        id="marketplace-q"
        name="q"
        type="search"
        defaultValue={query}
        maxLength={MAX_SEARCH_LENGTH}
        placeholder="Search by title or Minecraft username…"
        className="min-w-0 flex-1 rounded-xl border border-surface-300/70 bg-surface-200/60 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 transition-colors hover:border-surface-300/90 focus-visible:border-brand-500/60 focus:outline-none"
      />
      <button
        type="submit"
        className="inline-flex h-11 items-center rounded-xl bg-linear-to-b from-brand-400 to-brand-600 px-5 text-sm font-semibold text-white shadow-lg shadow-brand-900/50 transition-all hover:from-brand-300 hover:to-brand-500 active:translate-y-px"
      >
        Search
      </button>
      {query ? (
        <Link
          href={routes.marketplace}
          className="inline-flex h-11 items-center rounded-xl border border-surface-300 bg-surface-100/60 px-4 text-sm font-medium text-ink-300 transition-colors hover:border-brand-500/60 hover:text-ink-100"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        {query ? (
          <>
            <h2 className="font-display text-lg font-semibold text-ink-100">
              Nothing matches “{query}”
            </h2>
            <p className="mt-2 text-sm text-ink-400">
              Try a shorter search, or browse everything we have.
            </p>
            <p className="mt-4">
              <ButtonLink href={routes.marketplace} variant="outline" size="sm">
                Clear search
              </ButtonLink>
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-semibold text-ink-100">
              No listings are live yet
            </h2>
            <p className="mt-2 text-sm text-pretty text-ink-400">
              Sellers submit listings for owner review, and approved listings appear
              here automatically. There is nothing on sale at this moment.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Pagination({
  page,
  pageCount,
  query,
}: {
  page: number;
  pageCount: number;
  query: string;
}) {
  return (
    <nav aria-label="Marketplace pages" className="flex items-center justify-between gap-3">
      <PageLink
        href={hrefFor(page - 1, query)}
        disabled={page <= 1}
        label="Previous"
      />
      <span className="text-sm text-ink-400">
        Page {page} of {pageCount}
      </span>
      <PageLink
        href={hrefFor(page + 1, query)}
        disabled={page >= pageCount}
        label="Next"
      />
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="rounded-xl border border-surface-300/50 bg-surface-100/40 px-4 py-2 text-sm font-medium text-ink-500 opacity-50"
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      rel="prev"
      className="rounded-xl border border-surface-300 bg-surface-100/60 px-4 py-2 text-sm font-medium text-ink-200 transition-colors hover:border-brand-500/60 hover:text-ink-100"
    >
      {label}
    </Link>
  );
}

function hrefFor(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${routes.marketplace}?${search}` : routes.marketplace;
}
