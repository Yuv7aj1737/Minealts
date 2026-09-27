import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";
import { routes } from "@/lib/constants";

/**
 * Signs the current device out.
 *
 * POST only. The session cookie is `sameSite=lax`, so a cross-site top-level
 * GET navigation would carry it; restricting the route to POST means a stray
 * `<img>` or link on another site cannot end someone's session. The header
 * renders a real `<form method="post">`, which needs no JavaScript.
 *
 * Responds 303 so the browser re-issues the request as GET.
 */
export async function POST(request: NextRequest) {
  await destroySession();

  const destination = new URL(routes.home, request.nextUrl.origin);
  return NextResponse.redirect(destination, { status: 303 });
}
