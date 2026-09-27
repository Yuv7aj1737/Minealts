import "server-only";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { discordAvatarUrl } from "@/lib/auth/discord";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import type { PublicAuthUser } from "@/types/auth";

/**
 * Read-only view of the current session.
 *
 * Returns only what the UI needs to render. Access tokens, session token
 * hashes and other internals are never serialised.
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user: PublicAuthUser = {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    avatar: discordAvatarUrl(session.user.discordId, session.user.avatar),
    role: session.user.role,
    createdAt: session.user.createdAt,
  };

  return NextResponse.json(
    {
      authenticated: true,
      expiresAt: session.expiresAt.toISOString(),
      user,
      capabilities: {
        canReviewSellerApplications: can(
          session.user.role,
          PERMISSIONS.SELLER_APPLICATION_REVIEW,
        ),
        canAccessOwnerArea: can(session.user.role, PERMISSIONS.OWNER_AREA_VIEW),
      },
    },
    {
      // Session state must never be cached by a shared proxy.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
