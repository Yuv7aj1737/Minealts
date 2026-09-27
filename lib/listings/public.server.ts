import "server-only";

import { OrderStatus, Prisma, type ListingStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { discordAvatarUrl } from "@/lib/auth/discord";
import { normaliseSearch, PUBLIC_LISTING_STATUSES } from "@/lib/listings/schema";

/**
 * Public marketplace reads.
 *
 * Two rules, both enforced by the `where` clauses rather than by filtering in
 * JS:
 *
 *  1. Only `ACTIVE` listings reach the grid. `SOLD` is reachable by direct link
 *     so a shared link to a sold item renders a "Sold" overlay instead of a
 *     404, but it must not appear in the grid — the grid is a shopping list,
 *     and a page full of sold items is a page full of dead ends.
 *  2. A suspended seller's listings vanish with them. Suspension that left the
 *     listings buyable would be theatre.
 *
 * No function here takes a user id, because nothing here is per-user.
 */

/** Rows per marketplace page. */
const PAGE_SIZE = 24;

export type MarketplaceCard = {
  id: string;
  title: string;
  minecraftUsername: string | null;
  price: Prisma.Decimal;
  status: ListingStatus;
  createdAt: Date;
  /** Completed sales for this exact listing. Honest, derived, not invented. */
  soldCount: number;
  seller: {
    username: string;
    displayName: string | null;
    /** Discord CDN avatar URL, or null to fall back to initials. */
    avatarUrl: string | null;
    /** Sells that have completed for this seller, across all listings. */
    completedSales: number;
  };
};

export type MarketplaceResult = {
  listings: MarketplaceCard[];
  total: number;
  page: number;
  pageCount: number;
  query: string;
};

/** Platform-wide figures for the marketplace header. */
export type MarketplaceStats = {
  activeListings: number;
  completedSales: number;
  sellerCount: number;
};

const cardSelect = {
  id: true,
  title: true,
  minecraftUsername: true,
  price: true,
  status: true,
  createdAt: true,
  seller: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      discordId: true,
    },
  },
} as const;

/**
 * One page of the marketplace.
 *
 * `page` is clamped rather than trusted: a negative or absurd value would
 * otherwise become a negative `skip`, which Prisma rejects with a 500 instead
 * of showing the user an empty grid.
 */
export async function getMarketplaceListings(input?: {
  query?: string | null;
  page?: number;
}): Promise<MarketplaceResult> {
  const query = normaliseSearch(input?.query);
  const pageCount0 = Math.max(1, Math.floor(input?.page ?? 1)) - 1;

  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
    // The catalogue is seller stock and nothing else. `role: "SELLER"` is not
    // decoration: the seed and the demo script both move one account between
    // SELLER and OWNER, and an owner's listings are not for sale. A suspended
    // seller's stock is not for sale either, so both are required — filtering
    // on either alone would publish stock that is not on sale.
    seller: { role: "SELLER", suspendedAt: null },
    ...(query
      ? {
          // `mode: "insensitive"` is required, not a nicety: Prisma compiles a
          // bare `contains` to `LIKE '%q%'`, which is case-*sensitive* on
          // Postgres. Without this, searching "creeper" would not find
          // "Creeper Rare".
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { minecraftUsername: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pageCount0 * PAGE_SIZE,
      take: PAGE_SIZE,
      select: cardSelect,
    }),
  ]);

  // Per-card counts need a second query; two grouped counts are cheaper than N
  // per-row `count` calls, which is the difference between one round trip and
  // twenty-four on a full page.
  const listingIds = rows.map((row) => row.id);
  const sellerIds = [...new Set(rows.map((row) => row.seller.id))];

  const [soldByListing, completedBySeller] = await Promise.all([
    listingIds.length
      ? prisma.order.groupBy({
          by: ["listingId"],
          where: { listingId: { in: listingIds }, status: OrderStatus.DELIVERED },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    sellerIds.length
      ? prisma.order.groupBy({
          by: ["sellerId"],
          where: { sellerId: { in: sellerIds }, status: OrderStatus.DELIVERED },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const soldCounts = new Map(soldByListing.map((g) => [g.listingId, g._count._all]));
  const sellerSales = new Map(completedBySeller.map((g) => [g.sellerId, g._count._all]));

  const listings: MarketplaceCard[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    minecraftUsername: row.minecraftUsername,
    price: row.price,
    status: row.status,
    createdAt: row.createdAt,
    soldCount: soldCounts.get(row.id) ?? 0,
    seller: {
      username: row.seller.username,
      displayName: row.seller.displayName,
      avatarUrl: discordAvatarUrl(row.seller.discordId, row.seller.avatar),
      completedSales: sellerSales.get(row.seller.id) ?? 0,
    },
  }));

  return {
    listings,
    total,
    page: pageCount0 + 1,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    query,
  };
}

/** Headline figures. Derived from the same filters the grid uses. */
export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  const [activeListings, completedSales, sellerCount] = await Promise.all([
    // Must match `getMarketplaceListings` exactly. If the count filters on
    // suspension but not on role, the page advertises listings it is not showing.
    prisma.listing.count({
      where: { status: "ACTIVE", seller: { role: "SELLER", suspendedAt: null } },
    }),
    prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
    prisma.user.count({ where: { role: "SELLER", suspendedAt: null } }),
  ]);

  return { activeListings, completedSales, sellerCount };
}

export type PublicListing = {
  id: string;
  title: string;
  minecraftUsername: string | null;
  description: string | null;
  price: Prisma.Decimal;
  status: ListingStatus;
  createdAt: Date;
  /**
   * When an owner last made a decision on this listing.
   *
   * Public on purpose: it is the evidence behind the "Approved by an owner"
   * claim. The note that may accompany it is not, because a rejection reason is
   * internal feedback, not marketing.
   */
  reviewedAt: Date | null;
  soldCount: number;
  seller: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    /** True when the seller is suspended, so the page can say so. */
    suspended: boolean;
    completedSales: number;
    activeListings: number;
    memberSince: Date;
  };
};

/**
 * One listing for the public detail page.
 *
 * Returns `null` for a listing that is not publicly reachable **and** for one
 * that does not exist, so the page can answer both with a single `notFound()`.
 *
 * Note what is *not* selected: no `reviewNote`, no wallet, no other listings.
 * An owner's rejection reason is internal, and a public page that leaks either
 * would be a disclosure bug rather than a styling choice.
 *
 * `role: "SELLER"` is required here for the same reason it is required in the
 * grid: the public catalogue is seller stock, and a `USER` or `OWNER` row in the
 * table is not stock. It is a *status* filter only — a suspended seller is not
 * hidden, because the page's job is to say why, and a page that 404s a sold item
 * because of a suspension flag destroys the record that the item ever existed.
 * Buy is disabled further up the page for that case.
 */
export async function getPublicListing(listingId: string): Promise<PublicListing | null> {
  const listing = await prisma.listing.findFirst({
    where: {
      id: listingId,
      status: { in: [...PUBLIC_LISTING_STATUSES] },
      seller: { role: "SELLER" },
    },
    select: {
      id: true,
      title: true,
      minecraftUsername: true,
      description: true,
      price: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      seller: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          discordId: true,
          suspendedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!listing) return null;

  const [soldCount, completedSales, activeListings] = await Promise.all([
    prisma.order.count({ where: { listingId, status: OrderStatus.DELIVERED } }),
    prisma.order.count({
      where: { sellerId: listing.seller.id, status: OrderStatus.DELIVERED },
    }),
    prisma.listing.count({
      // "Listings on sale" must agree with the grid, so a suspended seller
      // reports zero rather than a number for stock that is not purchasable.
      // `suspendedAt` is a User column, so the filter belongs on the relation.
      where: {
        sellerId: listing.seller.id,
        status: "ACTIVE",
        seller: { suspendedAt: null },
      },
    }),
  ]);

  return {
    id: listing.id,
    title: listing.title,
    minecraftUsername: listing.minecraftUsername,
    description: listing.description,
    price: listing.price,
    status: listing.status,
    createdAt: listing.createdAt,
    reviewedAt: listing.reviewedAt,
    soldCount,
    seller: {
      username: listing.seller.username,
      displayName: listing.seller.displayName,
      avatarUrl: discordAvatarUrl(listing.seller.discordId, listing.seller.avatar),
      suspended: listing.seller.suspendedAt !== null,
      completedSales,
      activeListings,
      memberSince: listing.seller.createdAt,
    },
  };
}

/**
 * Whether the current viewer may see a non-public listing.
 *
 * Used by `/listing/[id]` so an owner can preview anything and a seller can
 * preview their own drafts. `viewer` is always the server session — never a
 * request parameter, which is the whole point of passing it in separately.
 */
export async function canViewNonPublicListing(input: {
  listingId: string;
  viewer: { id: string; role: "USER" | "SELLER" | "OWNER" } | null;
}): Promise<boolean> {
  if (!input.viewer) return false;
  if (input.viewer.role === "OWNER") return true;

  const listing = await prisma.listing.findFirst({
    where: { id: input.listingId },
    select: { sellerId: true },
  });

  return listing?.sellerId === input.viewer.id;
}
