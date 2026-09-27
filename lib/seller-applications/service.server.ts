import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";
import {
  DECISION_TO_STATUS,
  type ReviewDecision,
  type SellerApplicationInput,
} from "@/lib/seller-applications/schema";

/**
 * Seller application data access and authorisation.
 *
 * Every rule in Phase 2 is enforced here, on the server:
 *
 *  1. Only a `USER` may submit, and only an `OWNER` may review. Both checks
 *     read the role off the caller that `getSession()` resolved, which is a
 *     live database read on every request — so a demotion takes effect
 *     immediately rather than at cookie expiry.
 *  2. Identity is always taken from the session, never from the submitted
 *     payload. There is no parameter through which a member can choose their
 *     own `userId`, `discordId` or role.
 *  3. The only code path that writes `SELLER` is `reviewSellerApplication`,
 *     and the role it writes is the literal `"SELLER"` — never a value that
 *     arrived from the client.
 *
 * UI affordances (a hidden button, a route guard) are presentation. They are
 * duplicated here on purpose: a crafted POST must fail here even if it never
 * touched the page that would have hidden the control.
 */

/* ------------------------------------------------------------------------- */
/* Outcomes                                                                  */
/* ------------------------------------------------------------------------- */

export type CreateFailure =
  /** Caller lacks SELLER_APPLICATION_CREATE. */
  | "FORBIDDEN"
  /** Caller is already a SELLER or OWNER; nothing to apply for. */
  | "ROLE_NOT_ELIGIBLE"
  /** Caller already has a PENDING application. */
  | "ALREADY_PENDING";

export type CreateOutcome =
  | { ok: true; applicationId: string }
  | { ok: false; code: CreateFailure };

export type ReviewFailure =
  /** Caller lacks SELLER_APPLICATION_REVIEW. */
  | "FORBIDDEN"
  /** No such application. */
  | "NOT_FOUND"
  /** Someone already accepted or rejected it. */
  | "ALREADY_DECIDED";

export type ReviewOutcome =
  | {
      ok: true;
      status: "ACCEPTED" | "REJECTED";
      /**
       * False when the applicant was no longer a plain USER, so a stale or
       * duplicated application can never demote a SELLER or OWNER.
       */
      promotedToSeller: boolean;
    }
  | { ok: false; code: ReviewFailure };

/* ------------------------------------------------------------------------- */
/* Views — shaped for rendering, never raw database rows                      */
/* ------------------------------------------------------------------------- */

/** What the applicant is allowed to see about their own application. */
export type UserApplicationView = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  reason: string;
  whatToSell: string;
  extraInfo: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
};

/** What an owner sees for each application. */
export type OwnerApplicationView = {
  id: string;
  discordUsername: string;
  discordId: string;
  createdAt: Date;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  reason: string;
  whatToSell: string;
  extraInfo: string | null;
  reviewedAt: Date | null;
  /** Optional note the owner left when deciding. */
  reviewNote: string | null;
  /** Username of the owner who decided, when decided. */
  reviewerUsername: string | null;
  /** The applicant's role right now, so owners can spot stale applications. */
  applicantRole: "USER" | "SELLER" | "OWNER";
};

export type OwnerApplicationSummary = {
  applications: OwnerApplicationView[];
  counts: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  };
};

/** Drives the apply page: the caller's own application plus eligibility. */
export type SellerApplicationState = {
  /** The caller's most recent application, if they have ever submitted one. */
  application: UserApplicationView | null;
  /** True when the apply form should be rendered. */
  canApply: boolean;
  /** Why the form is hidden, when it is. */
  blockedReason: string | null;
};

/* ------------------------------------------------------------------------- */
/* Reads                                                                     */
/* ------------------------------------------------------------------------- */

const userApplicationSelect = {
  id: true,
  status: true,
  reason: true,
  whatToSell: true,
  extraInfo: true,
  createdAt: true,
  reviewedAt: true,
} as const;

/**
 * The caller's own application history and whether they may submit now.
 *
 * `blockedReason` prefers the most specific explanation available, so the page
 * can tell a member "you already have one pending" instead of the vaguer
 * "you cannot apply".
 */
export async function getSellerApplicationState(
  user: AuthUser,
): Promise<SellerApplicationState> {
  const [application, pendingCount] = await Promise.all([
    // Most recent, purely for display.
    prisma.sellerApplication.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: userApplicationSelect,
    }),
    // Queried directly rather than inferred from `application.status`. It would
    // normally follow that the newest row is the PENDING one, but that relies
    // on reasoning about how the statuses can be reached; asking the database
    // "do you hold an active application?" cannot be wrong.
    prisma.sellerApplication.count({
      where: { userId: user.id, status: "PENDING" },
    }),
  ]);

  if (user.role !== "USER") {
    return {
      application,
      canApply: false,
      blockedReason:
        user.role === "SELLER"
          ? "You are already a seller, so there is nothing to apply for."
          : "You are an owner. Owners can already review seller applications.",
    };
  }

  if (pendingCount > 0) {
    return {
      application,
      canApply: false,
      blockedReason:
        "You already have an application awaiting review. An owner will look at it shortly.",
    };
  }

  return { application, canApply: true, blockedReason: null };
}

/**
 * Every application, for the owner review queue.
 *
 * Pending rows are floated to the top, then everything is newest-first. The
 * partition happens in JS rather than in `orderBy` so the ordering does not
 * quietly depend on Postgres's enum comparison order.
 */
export async function listSellerApplicationsForOwner(): Promise<OwnerApplicationSummary> {
  const rows = await prisma.sellerApplication.findMany({
    select: {
      id: true,
      discordId: true,
      discordUsername: true,
      createdAt: true,
      status: true,
      reason: true,
      whatToSell: true,
      extraInfo: true,
      reviewedAt: true,
      reviewNote: true,
      user: { select: { role: true } },
      reviewedBy: { select: { username: true } },
    },
  });

  const byNewest = [...rows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const ordered = [
    ...byNewest.filter((row) => row.status === "PENDING"),
    ...byNewest.filter((row) => row.status !== "PENDING"),
  ];

  const applications: OwnerApplicationView[] = ordered.map((row) => ({
    id: row.id,
    discordId: row.discordId,
    discordUsername: row.discordUsername,
    createdAt: row.createdAt,
    status: row.status,
    reason: row.reason,
    whatToSell: row.whatToSell,
    extraInfo: row.extraInfo,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    reviewerUsername: row.reviewedBy?.username ?? null,
    applicantRole: row.user.role,
  }));

  return {
    applications,
    counts: {
      total: rows.length,
      pending: rows.filter((row) => row.status === "PENDING").length,
      accepted: rows.filter((row) => row.status === "ACCEPTED").length,
      rejected: rows.filter((row) => row.status === "REJECTED").length,
    },
  };
}

/* ------------------------------------------------------------------------- */
/* Writes                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Records a new application for the signed-in member.
 *
 * `user` must come from `getSession()`. The Discord username and snowflake are
 * snapshotted from that session rather than from the form, so the recorded
 * applicant can never be forged.
 */
export async function createSellerApplication(
  user: AuthUser,
  input: SellerApplicationInput,
): Promise<CreateOutcome> {
  if (!can(user.role, PERMISSIONS.SELLER_APPLICATION_CREATE)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  // A SELLER or OWNER gains nothing by applying. Checked here as well as in the
  // permission map because the map grants CREATE to every role by design.
  if (user.role !== "USER") {
    return { ok: false, code: "ROLE_NOT_ELIGIBLE" };
  }

  // Friendly pre-check so the member gets a readable message. It is not the
  // guarantee — the partial unique index below is.
  const existingPending = await prisma.sellerApplication.findFirst({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true },
  });

  if (existingPending) {
    return { ok: false, code: "ALREADY_PENDING" };
  }

  try {
    const application = await prisma.sellerApplication.create({
      data: {
        userId: user.id,
        // Snapshotted from the session, not the submitted form.
        discordId: user.discordId,
        discordUsername: user.username,
        reason: input.reason,
        whatToSell: input.whatToSell,
        extraInfo: input.extraInfo ?? null,
        // `status` omitted: defaults to PENDING.
        // `reviewedById` omitted: no owner has decided yet.
      },
      select: { id: true },
    });

    return { ok: true, applicationId: application.id };
  } catch (error) {
    // P2002 = unique violation. The only unique index a member can trip is
    // the one-pending-per-user partial index, which fires when two concurrent
    // submissions both passed the pre-check above.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, code: "ALREADY_PENDING" };
    }
    throw error;
  }
}

/**
 * Accepts or rejects an application, promoting the applicant on acceptance.
 *
 * The status change and the role change share one transaction: a member is
 * never left as SELLER with a still-pending application, nor marked ACCEPTED
 * while remaining a USER.
 *
 * The transition is a compare-and-set (`updateMany` gated on the row *still*
 * being PENDING), so two owners clicking Accept at the same moment cannot both
 * win — the second gets `ALREADY_DECIDED`.
 */
export async function reviewSellerApplication(
  reviewer: AuthUser,
  applicationId: string,
  decision: ReviewDecision,
  note?: string,
): Promise<ReviewOutcome> {
  if (!can(reviewer.role, PERMISSIONS.SELLER_APPLICATION_REVIEW)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const application = await prisma.sellerApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true, status: true },
  });

  if (!application) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const nextStatus = DECISION_TO_STATUS[decision];
  const now = new Date();

  const promoted = await prisma.$transaction(async (tx) => {
    // Compare-and-set: only the first reviewer to arrive changes the row.
    const claimed = await tx.sellerApplication.updateMany({
      where: { id: applicationId, status: "PENDING" },
      data: {
        status: nextStatus,
        reviewedById: reviewer.id,
        reviewedAt: now,
        // An omitted or blank note is stored as NULL rather than "".
        reviewNote: note?.trim() ? note.trim() : null,
      },
    });

    if (claimed.count === 0) {
      return null;
    }

    if (decision !== "ACCEPT") {
      // A rejection must leave the account exactly as it was. No write to
      // `users` at all on this path.
      return false;
    }

    // Promotion only, and only from USER. A rejected-then-reaccepted race, or
    // an application left over from before a manual promotion, can therefore
    // never demote an existing SELLER or OWNER back to SELLER.
    const promotedRows = await tx.user.updateMany({
      where: { id: application.userId, role: "USER" },
      data: { role: "SELLER" },
    });

    if (promotedRows.count === 0) return false;

    // Phase 3: open the wallet in the same transaction as the promotion.
    //
    // Inside the transaction is the point. A seller whose role flipped to SELLER
    // without a wallet would have a dashboard reading `NULL` for both balances;
    // doing this in the transaction makes "is a SELLER" and "has a wallet" the
    // same fact rather than two writes that can half-happen.
    //
    // `upsert` rather than `create`, because `userId` is unique and a seller
    // promoted by hand (or re-promoted) may already have one. This also keeps
    // the code correct if the promotion check above is ever widened.
    await tx.wallet.upsert({
      where: { userId: application.userId },
      create: { userId: application.userId },
      // Balances are never reset here. A wallet that somehow already holds
      // money must not be zeroed by approving an application.
      update: {},
    });

    return true;
  });

  if (promoted === null) {
    return { ok: false, code: "ALREADY_DECIDED" };
  }

  return { ok: true, status: nextStatus, promotedToSeller: promoted };
}
