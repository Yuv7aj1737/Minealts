import "server-only";

import { Prisma, type ListingStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { discordAvatarUrl } from "@/lib/auth/discord";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";
import {
  DECISION_TRANSITIONS,
  LISTING_STATUS_META,
  type ListingDecision,
} from "@/lib/listings/schema";

/**
 * Owner listing and seller moderation.
 *
 * Every rule here is enforced in the service, not in the page:
 *
 *  1. Only `OWNER` may act. The check reads the role off the caller that
 *     `getSession()` resolved, which is a live database read on every request —
 *     so a demotion takes effect immediately rather than at cookie expiry.
 *  2. The client sends a *decision*, never a status. `DECISION_TRANSITIONS` maps
 *     each decision to the one status it is allowed to produce, and the write is
 *     a compare-and-set gated on the listing still being in a `from` state. A
 *     crafted POST asking for `status: "ACTIVE"` on a SOLD listing cannot get
 *     there: the field is not in the schema, and the update cannot match.
 *  3. Removal is a state change, never a `delete`. Orders point at listings, and
 *     cascading them away would destroy the delivery history that disputes and
 *     payouts are settled from.
 */

/* ------------------------------------------------------------------------- */
/* Outcomes                                                                   */
/* ------------------------------------------------------------------------- */

export type ListingReviewFailure =
  | "FORBIDDEN"
  | "NOT_FOUND"
  /** The listing is not in a state this decision may move it from. */
  | "INVALID_TRANSITION";

export type ListingReviewOutcome =
  | { ok: true; status: ListingStatus }
  | { ok: false; code: ListingReviewFailure; message: string };

export type SellerModerationFailure =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NOT_A_SELLER"
  /** An owner cannot suspend or reinstate another owner. */
  | "CANNOT_MODIFY_OWNER";

export type SellerModerationOutcome =
  | { ok: true; suspended: boolean }
  | { ok: false; code: SellerModerationFailure; message: string };

/* ------------------------------------------------------------------------- */
/* Reads — owner only                                                        */
/* ------------------------------------------------------------------------- */

export type OwnerListingRow = {
  id: string;
  title: string;
  minecraftUsername: string | null;
  price: Prisma.Decimal;
  status: ListingStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  seller: {
    id: string;
    username: string;
    suspended: boolean;
  };
  /** Which decisions make sense for this listing's current status. */
  availableDecisions: ListingDecision[];
};

export type OwnerListingSummary = {
  listings: OwnerListingRow[];
  counts: Record<ListingStatus, number>;
  /** Statuses an owner should look at first. */
  queueCount: number;
};

/**
 * Every listing on the platform, newest first.
 *
 * The whole point of this view: it is deliberately *not* filtered by seller, so
 * a suspended or departed seller cannot hide stock from the owner. Status order
 * is applied in JS rather than in `orderBy` so the queue does not silently
 * depend on Postgres enum comparison order.
 */
export async function listAllListingsForOwner(reviewer: AuthUser): Promise<OwnerListingSummary | null> {
  if (!can(reviewer.role, PERMISSIONS.LISTING_MANAGE_ALL)) return null;

  const rows = await prisma.listing.findMany({
    select: {
      id: true,
      title: true,
      minecraftUsername: true,
      price: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      reviewNote: true,
      seller: { select: { id: true, username: true, suspendedAt: true } },
    },
  });

  const byNewest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Needs an owner's attention: submitted, or was live and is not any more.
  const queueFirst = byNewest.filter((row) => row.status === "PROCESSING");
  const rest = byNewest.filter((row) => row.status !== "PROCESSING");

  const counts: Record<ListingStatus, number> = {
    DRAFT: 0,
    PROCESSING: 0,
    ACTIVE: 0,
    REJECTED: 0,
    SOLD: 0,
    REMOVED: 0,
  };
  for (const row of byNewest) counts[row.status]++;

  return {
    listings: [...queueFirst, ...rest].map((row) => ({
      id: row.id,
      title: row.title,
      minecraftUsername: row.minecraftUsername,
      price: row.price,
      status: row.status,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      reviewNote: row.reviewNote,
      seller: {
        id: row.seller.id,
        username: row.seller.username,
        suspended: row.seller.suspendedAt !== null,
      },
      availableDecisions: decisionsFor(row.status),
    })),
    counts,
    queueCount: counts.PROCESSING,
  };
}

function decisionsFor(status: ListingStatus): ListingDecision[] {
  return (Object.keys(DECISION_TRANSITIONS) as ListingDecision[]).filter(
    (decision) => DECISION_TRANSITIONS[decision].from.includes(status),
  );
}

/* ------------------------------------------------------------------------- */
/* Write — listing decisions                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Applies one owner decision to one listing.
 *
 * Compare-and-set: the `where` clause includes the set of statuses the decision
 * is legal from, so two owners clicking Approve at once cannot both win, and a
 * listing that moved underneath the button cannot be stomped.
 */
export async function reviewListing(
  reviewer: AuthUser,
  input: { listingId: string; decision: ListingDecision; note?: string },
): Promise<ListingReviewOutcome> {
  if (!can(reviewer.role, PERMISSIONS.LISTING_MANAGE_ALL)) {
    return { ok: false, code: "FORBIDDEN", message: "Only an owner can review listings." };
  }

  const transition = DECISION_TRANSITIONS[input.decision];
  if (!transition) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "That decision is not recognised.",
    };
  }

  // A blank note clears any previous one, so restoring a listing does not keep
  // displaying the rejection reason that got it taken down.
  const note = input.note?.trim() ? input.note.trim() : null;
  const now = new Date();

  const updated = await prisma.listing.updateMany({
    where: {
      id: input.listingId,
      status: { in: [...transition.from] },
    },
    data: {
      status: transition.to,
      // The reviewer is the session's owner id, never a submitted field.
      reviewedById: reviewer.id,
      reviewedAt: now,
      reviewNote: note,
    },
  });

  if (updated.count === 0) {
    // Either the id is wrong or the listing is no longer in a legal state.
    // Distinguished for the owner's benefit, but the id is not confirmed to
    // exist in the NOT_FOUND case beyond what they typed themselves.
    const exists = await prisma.listing.count({ where: { id: input.listingId } });
    return exists === 0
      ? { ok: false, code: "NOT_FOUND", message: "No such listing." }
      : {
          ok: false,
          code: "INVALID_TRANSITION",
          message: `Cannot ${input.decision.toLowerCase()} a listing that is ${LISTING_STATUS_META[transition.to].label.toLowerCase()}-state. Refresh and try again.`,
        };
  }

  return { ok: true, status: transition.to };
}

/* ------------------------------------------------------------------------- */
/* Write — seller suspension                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Suspends or reinstates a seller.
 *
 * Suspension is a nullable timestamp rather than a role so it can never collide
 * with OWNER, and it takes effect in one update: `requireSeller` refuses a
 * suspended seller, and the marketplace filters their listings out.
 *
 * An owner cannot be suspended by another owner, and cannot suspend themselves
 * by accident — both are refused rather than silently ignored.
 */
export async function moderateSeller(
  reviewer: AuthUser,
  input: { sellerId: string; action: "SUSPEND" | "REINSTATE"; reason?: string },
): Promise<SellerModerationOutcome> {
  if (!can(reviewer.role, PERMISSIONS.SELLER_MANAGE)) {
    return { ok: false, code: "FORBIDDEN", message: "Only an owner can manage sellers." };
  }

  const target = await prisma.user.findUnique({
    where: { id: input.sellerId },
    select: { id: true, role: true, suspendedAt: true },
  });

  if (!target) {
    return { ok: false, code: "NOT_FOUND", message: "No such seller." };
  }

  if (target.role !== "SELLER") {
    return {
      ok: false,
      code: "NOT_A_SELLER",
      message: "That account is not a seller, so there is nothing to suspend.",
    };
  }

  const reason = input.reason?.trim() ? input.reason.trim() : null;

  if (input.action === "SUSPEND") {
    if (target.suspendedAt) {
      return { ok: true, suspended: true };
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { suspendedAt: new Date(), suspendedReason: reason },
    });

    return { ok: true, suspended: true };
  }

  // Reinstate. Clears both columns so the profile does not keep showing a stale
  // reason after the seller is back in good standing.
  await prisma.user.update({
    where: { id: target.id },
    data: { suspendedAt: null, suspendedReason: null },
  });

  return { ok: true, suspended: false };
}

/* ------------------------------------------------------------------------- */
/* Single listing — owner preview                                             */
/* ------------------------------------------------------------------------- */

export type OwnerListingDetail = {
  id: string;
  title: string;
  minecraftUsername: string | null;
  description: string | null;
  price: Prisma.Decimal;
  status: ListingStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  seller: { id: string; username: string; suspended: boolean };
  availableDecisions: ListingDecision[];
};

/**
 * One listing for an owner, whatever its state.
 *
 * Used by the owner preview on `/listing/[id]`, where a draft still has to be
 * viewable but the page must not pretend it is for sale. Returns `null` for a
 * non-owner, so a leaked link cannot be used to read drafts.
 */
export async function getListingForOwner(
  reviewer: AuthUser,
  listingId: string,
): Promise<OwnerListingDetail | null> {
  if (!can(reviewer.role, PERMISSIONS.LISTING_MANAGE_ALL)) return null;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      minecraftUsername: true,
      description: true,
      price: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      reviewNote: true,
      reviewedBy: { select: { username: true } },
      seller: {
        select: { id: true, username: true, suspendedAt: true },
      },
    },
  });

  if (!listing) return null;

  return {
    id: listing.id,
    title: listing.title,
    minecraftUsername: listing.minecraftUsername,
    description: listing.description,
    price: listing.price,
    status: listing.status,
    createdAt: listing.createdAt,
    reviewedAt: listing.reviewedAt,
    reviewNote: listing.reviewNote,
    reviewedBy: listing.reviewedBy?.username ?? null,
    seller: {
      id: listing.seller.id,
      username: listing.seller.username,
      suspended: listing.seller.suspendedAt !== null,
    },
    availableDecisions: decisionsFor(listing.status),
  };
}

/* ------------------------------------------------------------------------- */
/* Seller directory                                                          */
/* ------------------------------------------------------------------------- */

export type OwnerSellerRow = {
  id: string;
  username: string;
  displayName: string | null;
  discordId: string;
  avatarUrl: string | null;
  createdAt: Date;
  suspended: boolean;
  suspendedReason: string | null;
  listingCount: number;
  activeCount: number;
  completedSales: number;
  /** Gross delivered revenue, for the owner's overview only. */
  grossRevenue: Prisma.Decimal;
  availableBalance: Prisma.Decimal;
  pendingBalance: Prisma.Decimal;
};

export type OwnerSellerDetail = {
  seller: OwnerSellerRow;
  listings: OwnerListingRow[];
  counts: Record<ListingStatus, number>;
};

/** Every seller, with the aggregates the directory table shows. */
export async function listSellersForOwner(reviewer: AuthUser): Promise<OwnerSellerRow[] | null> {
  if (!can(reviewer.role, PERMISSIONS.SELLER_MANAGE)) return null;

  const sellers = await prisma.user.findMany({
    where: { role: "SELLER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      discordId: true,
      avatar: true,
      createdAt: true,
      suspendedAt: true,
      suspendedReason: true,
      listings: { select: { status: true } },
      sales: { where: { status: "DELIVERED" }, select: { amount: true } },
      wallet: { select: { availableBalance: true, pendingBalance: true } },
    },
  });

  return sellers.map((seller) => ({
    id: seller.id,
    username: seller.username,
    displayName: seller.displayName,
    discordId: seller.discordId,
    avatarUrl: discordAvatarUrl(seller.discordId, seller.avatar),
    createdAt: seller.createdAt,
    suspended: seller.suspendedAt !== null,
    suspendedReason: seller.suspendedReason,
    listingCount: seller.listings.length,
    activeCount: seller.listings.filter((l) => l.status === "ACTIVE").length,
    completedSales: seller.sales.length,
    grossRevenue: seller.sales.reduce(
      (total, sale) => total.add(sale.amount),
      new Prisma.Decimal(0),
    ),
    // A seller promoted before Phase 4, or one whose wallet was removed, must
    // not break the table.
    availableBalance: seller.wallet?.availableBalance ?? new Prisma.Decimal(0),
    pendingBalance: seller.wallet?.pendingBalance ?? new Prisma.Decimal(0),
  }));
}

/** One seller's full profile: aggregates plus every listing, whatever its state. */
export async function getSellerForOwner(
  reviewer: AuthUser,
  sellerId: string,
): Promise<OwnerSellerDetail | null> {
  if (!can(reviewer.role, PERMISSIONS.SELLER_MANAGE)) return null;

  const seller = await prisma.user.findFirst({
    where: { id: sellerId, role: "SELLER" },
    select: {
      id: true,
      username: true,
      displayName: true,
      discordId: true,
      avatar: true,
      createdAt: true,
      suspendedAt: true,
      suspendedReason: true,
      listings: { select: { status: true } },
      sales: { where: { status: "DELIVERED" }, select: { amount: true } },
      wallet: { select: { availableBalance: true, pendingBalance: true } },
    },
  });

  if (!seller) return null;

  const listings = await prisma.listing.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      minecraftUsername: true,
      price: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      reviewNote: true,
    },
  });

  const counts: Record<ListingStatus, number> = {
    DRAFT: 0,
    PROCESSING: 0,
    ACTIVE: 0,
    REJECTED: 0,
    SOLD: 0,
    REMOVED: 0,
  };
  for (const listing of listings) counts[listing.status]++;

  return {
    seller: {
      id: seller.id,
      username: seller.username,
      displayName: seller.displayName,
      discordId: seller.discordId,
      avatarUrl: discordAvatarUrl(seller.discordId, seller.avatar),
      createdAt: seller.createdAt,
      suspended: seller.suspendedAt !== null,
      suspendedReason: seller.suspendedReason,
      listingCount: seller.listings.length,
      activeCount: seller.listings.filter((l) => l.status === "ACTIVE").length,
      completedSales: seller.sales.length,
      grossRevenue: seller.sales.reduce(
        (total, sale) => total.add(sale.amount),
        new Prisma.Decimal(0),
      ),
      availableBalance: seller.wallet?.availableBalance ?? new Prisma.Decimal(0),
      pendingBalance: seller.wallet?.pendingBalance ?? new Prisma.Decimal(0),
    },
    listings: listings.map((listing) => ({
      ...listing,
      seller: { id: seller.id, username: seller.username, suspended: seller.suspendedAt !== null },
      availableDecisions: decisionsFor(listing.status),
    })),
    counts,
  };
}
