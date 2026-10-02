import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { createPkcePair, signPayload } from "@/lib/auth/crypto";
import { buildDiscordAuthorizeUrl } from "@/lib/auth/discord";
import { isDiscordAuthConfigured } from "@/lib/env";
import { safeInternalPathOr } from "@/lib/auth/redirects";
import { routes } from "@/lib/constants";

const STATE_COOKIE = "minealts_oauth_state";
const VERIFIER_COOKIE = "minealts_oauth_verifier";
const NEXT_COOKIE = "minealts_oauth_next";

// 10 minutes in seconds for cookie TTL
const COOKIE_TTL = 60 * 10;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth/discord",
  maxAge: COOKIE_TTL,
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

  // 3. Set signed cookies with proper TTL (expiry in seconds)
  response.cookies.set(STATE_COOKIE, signPayload(state, COOKIE_TTL), COOKIE_OPTIONS);
  response.cookies.set(VERIFIER_COOKIE, signPayload(pkce.codeVerifier, COOKIE_TTL), COOKIE_OPTIONS);
  response.cookies.set(NEXT_COOKIE, signPayload(nextPath, COOKIE_TTL), COOKIE_OPTIONS);

  return response;
}
