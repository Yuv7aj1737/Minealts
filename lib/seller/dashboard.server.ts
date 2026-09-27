import "server-only";

import { ListingStatus, OrderStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

/**
 * Seller dashboard reads.
 *
 * The single rule this module exists to enforce:
 *
 *   Every query is scoped by the `sellerId` taken from the server session.
 *   No function here accepts a seller id as an argument, so there is no call
 *   site a future change could point at somebody else's rows. The `userId`
 *   parameter *is* the seller id, and it is only ever populated from
 *   `getSession()` in a server component or action.
 *
 * Counts and sums run in the database via `count`/`aggregate` rather than by
 * loading rows, so dashboard cost stays flat as a seller accumulates listings
 * and orders.
 */

/* ------------------------------------------------------------------------- */
/* Shapes — shaped for rendering, never raw database rows                     */
/* ------------------------------------------------------------------------- */

export type SellerStats = {
  /** Orders that reached DELIVERED. */
  totalSales: number;
  /** Sum of delivered order amounts, before the seller's share is split out. */
  totalRevenue: Prisma.Decimal;
  activeListings: number;
  soldListings: number;
  pendingOrders: number;
  availableBalance: Prisma.Decimal;
  pendingBalance: Prisma.Decimal;
};

export type SellerListingRow = {
  id: string;
  title: string;
  minecraftUsername: string | null;
  /** Optional listing copy, shown on the seller's own detail page. */
  description: string | null;
  price: Prisma.Decimal;
  status: ListingStatus;
  createdAt: Date;
};

export type SellerOrderRow = {
  id: string;
  listingTitle: string;
  amount: Prisma.Decimal;
  status: OrderStatus;
  createdAt: Date;
};

export type SellerDashboardData = {
  stats: SellerStats;
  listings: SellerListingRow[];
  sales: SellerOrderRow[];
};

/** How many rows the dashboard tables render. Full lists come with Phase 4. */
const PREVIEW_LIMIT = 8;

const ZERO = () => new Prisma.Decimal(0);

/* ------------------------------------------------------------------------- */
/* Aggregates                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Everything the metric cards need, in one batch of parallel queries.
 *
 * Revenue and sales count DELIVERED orders only. A pending or cancelled order
 * has not earned the seller anything, and counting it would put a number on
 * the Total Sales card that the wallet card then contradicts.
 */
export async function getSellerStats(sellerId: string): Promise<SellerStats> {
  const [sales, revenue, activeListings, soldListings, pendingOrders, wallet] =
    await Promise.all([
      prisma.order.count({
        where: { sellerId, status: OrderStatus.DELIVERED },
      }),
      prisma.order.aggregate({
        where: { sellerId, status: OrderStatus.DELIVERED },
        _sum: { amount: true },
      }),
      prisma.listing.count({
        where: { sellerId, status: ListingStatus.ACTIVE },
      }),
      prisma.listing.count({
        where: { sellerId, status: ListingStatus.SOLD },
      }),
      prisma.order.count({
        where: {
          sellerId,
          status: { in: [OrderStatus.PENDING, OrderStatus.AWAITING_DELIVERY] },
        },
      }),
      prisma.wallet.findUnique({ where: { userId: sellerId } }),
    ]);

  return {
    totalSales: sales,
    // A seller who has never sold has a null sum rather than a zero sum; both
    // render as the same value, but null would break the Decimal type.
    totalRevenue: revenue._sum.amount ?? ZERO(),
    activeListings,
    soldListings,
    pendingOrders,
    // Wallets are created on promotion, so a missing row means a stale account
    // rather than a seller with no balance. Treat it as zero instead of
    // crashing the dashboard.
    availableBalance: wallet?.availableBalance ?? ZERO(),
    pendingBalance: wallet?.pendingBalance ?? ZERO(),
  };
}

/* ------------------------------------------------------------------------- */
/* Lists                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * The signed-in seller's listings, newest first.
 *
 * `sellerId` is a required filter with no default and no "all sellers" mode —
 * see the module comment.
 */
export async function getSellerListings(
  sellerId: string,
  limit = PREVIEW_LIMIT,
): Promise<SellerListingRow[]> {
  return prisma.listing.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      minecraftUsername: true,
      description: true,
      price: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * The signed-in seller's orders, newest first, flattened for the table.
 *
 * The listing title is joined in and renamed to a plain field so callers never
 * have to reach through a relation.
 */
export async function getSellerSales(
  sellerId: string,
  limit = PREVIEW_LIMIT,
): Promise<SellerOrderRow[]> {
  const orders = await prisma.order.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      status: true,
      createdAt: true,
      listing: { select: { title: true } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    listingTitle: order.listing.title,
    amount: order.amount,
    status: order.status,
    createdAt: order.createdAt,
  }));
}

/* ------------------------------------------------------------------------- */
/* Single owner-owned lookup, for the Phase 4 listing pages                  */
/* ------------------------------------------------------------------------- */

/**
 * Fetch one listing only if the requester owns it.
 *
 * Returns `null` for a missing listing *and* for someone else's listing, and
 * callers turn both into `notFound()`. Keeping them indistinguishable is the
 * point: returning "forbidden" for a real id would confirm that the id exists.
 */
export async function getOwnedListing(
  sellerId: string,
  listingId: string,
): Promise<SellerListingRow | null> {
  return prisma.listing.findFirst({
    where: { id: listingId, sellerId },
    select: {
      id: true,
      title: true,
      minecraftUsername: true,
      description: true,
      price: true,
      status: true,
      createdAt: true,
    },
  });
}

/** One call for the whole dashboard, so the page makes a single round trip. */
export async function getSellerDashboardData(
  sellerId: string,
): Promise<SellerDashboardData> {
  const [stats, listings, sales] = await Promise.all([
    getSellerStats(sellerId),
    getSellerListings(sellerId),
    getSellerSales(sellerId),
  ]);

  return { stats, listings, sales };
}
