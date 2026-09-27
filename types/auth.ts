import type { Role } from "@prisma/client";

/**
 * The user shape exposed to the application.
 *
 * Deliberately excludes Discord access/refresh tokens: we never persist them,
 * because a website session does not need them after the callback.
 */
export type AuthUser = {
  id: string;
  discordId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  role: Role;
  /**
   * When the owner suspended this seller, or null.
   *
   * Carried on the session because `getSession()` re-reads the user row on every
   * request, so a suspension takes effect on the seller's very next request
   * instead of waiting for their cookie to expire.
   */
  suspendedAt: Date | null;
  /**
   * Why the owner suspended this seller, or null.
   *
   * Carried alongside `suspendedAt` rather than being a lookup so the seller can
   * be told the reason. The alternative — bouncing them to a page with a generic
   * message — is what makes a suspension look like an unexplained outage, and
   * sends them to Discord support instead of fixing the thing that was wrong.
   */
  suspendedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A validated, non-expired session plus its owner. */
export type AuthSession = {
  id: string;
  expiresAt: Date;
  user: AuthUser;
};

/** Serialisable form returned by the session API route. */
export type PublicAuthUser = Pick<
  AuthUser,
  "id" | "username" | "displayName" | "avatar" | "role" | "createdAt"
>;

/**
 * The subset of the session passed from server components to client
 * components. Contains no token material of any kind.
 */
export type SessionUserView = {
  username: string;
  displayName: string | null;
  /** Fully-resolved Discord CDN URL, or null when the user has no avatar. */
  avatarUrl: string | null;
  role: Role;
};
