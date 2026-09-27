import "server-only";

import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/db";
import { generateToken, sha256 } from "@/lib/auth/crypto";
import type { AuthSession, AuthUser } from "@/types/auth";

/**
 * Session cookie.
 *
 * - httpOnly: unreachable from client JavaScript, so XSS cannot steal it.
 * - sameSite "lax": sent on the top-level GET navigation back from Discord's
 *   consent screen, but not on cross-site POSTs (CSRF hardening).
 * - secure in production: never sent over plain HTTP outside development.
 */
export const SESSION_COOKIE_NAME = "minealts_session";

/** Rolling 30-day session lifetime. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Renew when less than half the lifetime remains. */
const RENEWAL_THRESHOLD_MS = SESSION_TTL_MS / 2;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

function futureDate(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

/** Best-effort request context, stored for auditing only. */
async function getRequestContext(): Promise<{
  userAgent: string | null;
  ipAddress: string | null;
}> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return {
    userAgent: headerList.get("user-agent")?.slice(0, 255) ?? null,
    ipAddress: forwarded?.split(",")[0]?.trim().slice(0, 45) ?? null,
  };
}

/**
 * Issues a brand-new session and writes the cookie.
 *
 * A fresh token is minted on every login, so an attacker who obtained a
 * pre-login cookie value gains nothing, and the previous session is left
 * untouched (users can stay signed in on several devices).
 */
export async function createSession(userId: string): Promise<AuthSession> {
  const token = generateToken(32);
  const { userAgent, ipAddress } = await getRequestContext();

  const session = await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: futureDate(),
      userAgent,
      ipAddress,
    },
    include: { user: true },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return { id: session.id, expiresAt: session.expiresAt, user: session.user };
}

/**
 * Resolves the current session, or null when there is none.
 *
 * Expired sessions are deleted as they are encountered, so no background job
 * is required to keep the table clean.
 */
export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({ where: { id: session.id } })
      .catch(() => undefined);
    return null;
  }

  // Sliding expiry: extend an actively used session.
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < RENEWAL_THRESHOLD_MS) {
    const expiresAt = futureDate();
    await prisma.session
      .update({ where: { id: session.id }, data: { expiresAt } })
      .catch(() => undefined);
    session.expiresAt = expiresAt;
  }

  return { id: session.id, expiresAt: session.expiresAt, user: session.user };
}

/** The signed-in user, or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/** Invalidates the current session and clears its cookie. Idempotent. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: sha256(token) } })
      .catch(() => undefined);
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
}

/** Invalidates every session for a user (used for "sign out everywhere"). */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } }).catch(() => undefined);
}
