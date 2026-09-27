import "server-only";

import { redirect } from "next/navigation";

import { can, type Permission, type RoleName } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_POST_LOGIN_REDIRECT, routes } from "@/lib/constants";
import { safeInternalPathOr } from "@/lib/auth/redirects";
import type { AuthSession, AuthUser } from "@/types/auth";

export type { AuthSession, AuthUser };

/**
 * Requires a signed-in user.
 *
 * Server Components only: it uses `redirect()`. Route handlers should validate
 * with {@link getSession} directly so they can return a 401 instead of a
 * redirect, and actions should check the returned user.
 */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const session = await getSession();
  if (session) return session.user;

  const target = safeInternalPathOr(nextPath, DEFAULT_POST_LOGIN_REDIRECT);
  redirect(`${routes.login}?next=${encodeURIComponent(target)}`);
}

/** Requires one of the given roles; otherwise redirects to the dashboard. */
export async function requireRole(
  ...allowed: readonly RoleName[]
): Promise<AuthUser> {
  const user = await requireUser();

  if (!allowed.includes(user.role)) {
    redirect(`${routes.dashboard}?error=forbidden`);
  }

  return user;
}

/** Requires a capability; otherwise redirects to the dashboard. */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireUser();

  if (!can(user.role, permission)) {
    redirect(`${routes.dashboard}?error=forbidden`);
  }

  return user;
}

/** Owner-only guard. The single entry point for the /owner area. */
export async function requireOwner(): Promise<AuthUser> {
  return requireRole("OWNER");
}

/**
 * Seller-only guard. The single entry point for the /seller area.
 *
 * Sends a plain USER to the dashboard with `?error=seller_only` rather than the
 * generic `?error=forbidden`, so the dashboard can explain how to become a
 * seller instead of showing a dead end.
 *
 * OWNER is deliberately excluded — see the note in `app/seller/layout.tsx`.
 *
 * A suspended seller is turned away with `?error=account_suspended`, which
 * renders their suspension reason. They keep their session and their history;
 * the check is here rather than in the layout so that no server action can be
 * reached by skipping a page.
 */
export async function requireSeller(): Promise<AuthUser> {
  const user = await requireUser();

  if (user.role !== "SELLER") {
    redirect(`${routes.dashboard}?error=seller_only`);
  }

  if (user.suspendedAt) {
    redirect(`${routes.dashboard}?error=account_suspended`);
  }

  return user;
}
