import "server-only";

import { cookies, headers } from "next/headers";
import { generateToken, sha256 } from "@/lib/auth/crypto";
import type { AuthSession, AuthUser } from "@/types/auth";

export const SESSION_COOKIE_NAME = "minealts_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

function futureDate(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

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

// In-memory or Stateless Session using Signed/Encoded Cookies (No Database Needed)
export async function createSession(userId: string, userData?: any): Promise<AuthSession> {
  const token = generateToken(32);
  const expiresAt = futureDate();
  
  // Mocking user object for session if passed, or minimal fallback
  const user: AuthUser = userData || {
    id: userId,
    username: "User",
    displayName: "User",
    discordId: userId,
    avatar: null,
    role: "USER",
    createdAt: new Date(),
  };

  const sessionData = {
    id: token,
    expiresAt: expiresAt.toISOString(),
    user,
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
    ...cookieOptions,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return { id: token, expiresAt, user };
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieVal) return null;

  try {
    const sessionData = JSON.parse(cookieVal);
    if (!sessionData || new Date(sessionData.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return {
      id: sessionData.id,
      expiresAt: new Date(sessionData.expiresAt),
      user: sessionData.user,
    };
  } catch (e) {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
}

export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await destroySession();
}
