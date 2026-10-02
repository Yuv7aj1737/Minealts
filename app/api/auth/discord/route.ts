import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { createPkcePair } from "@/lib/auth/crypto";
import { buildDiscordAuthorizeUrl } from "@/lib/auth/discord";
import { isDiscordAuthConfigured } from "@/lib/env";
import { safeInternalPathOr } from "@/lib/auth/redirects";
import { routes } from "@/lib/constants";

const STATE_COOKIE = "minealts_oauth_state";
const VERIFIER_COOKIE = "minealts_oauth_verifier";
const NEXT_COOKIE = "minealts_oauth_next";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth/discord",
  maxAge: 60 * 10, // 10 minutes expiry for login transaction cookies
} as const;

export async function GET(request: NextRequest) {
  if (!isDiscordAuthConfigured()) {
    const url = new URL(routes.login, request.nextUrl.origin);
    url.searchParams.set("error", "CONFIG_ERROR");
    return NextResponse.redirect(url);
  }

  const { searchParams } = request.nextUrl;
  const nextPath = safeInternalPathOr(searchParams.get("next"), routes.dashboard);

  // 1. Generate cryptographic state and PKCE verifier/challenge for security
  const state = crypto.randomUUID();
  const pkce = createPkcePair();

  // 2. Build the official Discord authorization URL
  const authorizeUrl = buildDiscordAuthorizeUrl({ state, pkce });

  const response = NextResponse.redirect(authorizeUrl);

  // 3. Set secure cookies so callback can verify them
  response.cookies.set(STATE_COOKIE, state, COOKIE_OPTIONS);
  response.cookies.set(VERIFIER_COOKIE, pkce.codeVerifier, COOKIE_OPTIONS);
  response.cookies.set(NEXT_COOKIE, nextPath, COOKIE_OPTIONS);

  return response;
}
