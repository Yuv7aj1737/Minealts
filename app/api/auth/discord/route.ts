import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { createPkcePair, generateToken, signPayload } from "@/lib/auth/crypto";
import { buildDiscordAuthorizeUrl } from "@/lib/auth/discord";
import { isDiscordAuthConfigured } from "@/lib/env";
import { safeInternalPathOr } from "@/lib/auth/redirects";
import { DEFAULT_POST_LOGIN_REDIRECT, routes } from "@/lib/constants";

/**
 * Step 1 of the Discord login flow: redirect the browser to Discord.
 *
 * Nothing about the user is collected here. The CSRF `state` value and the
 * PKCE `code_verifier` are placed in short-lived, signed, httpOnly cookies so
 * the callback can prove the authorization response belongs to *this* browser
 * session. No secret is embedded in either cookie.
 */

const STATE_COOKIE = "minealts_oauth_state";
const VERIFIER_COOKIE = "minealts_oauth_verifier";
const NEXT_COOKIE = "minealts_oauth_next";

/** 10 minutes: long enough for a slow consent screen, short enough to be useless if stolen. */
const TRANSACTION_TTL_SECONDS = 600;

/** All transaction cookies are scoped to the OAuth routes only. */
const transactionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth/discord",
  maxAge: TRANSACTION_TTL_SECONDS,
} as const;

export function GET(request: NextRequest) {
  if (!isDiscordAuthConfigured()) {
    return NextResponse.redirect(
      new URL(`${routes.login}?error=CONFIG_ERROR`, request.nextUrl.origin),
    );
  }

  const state = generateToken(24);
  const pkce = createPkcePair();
  const nextPath = safeInternalPathOr(
    request.nextUrl.searchParams.get("next"),
    DEFAULT_POST_LOGIN_REDIRECT,
  );

  const response = NextResponse.redirect(
    buildDiscordAuthorizeUrl({ state, pkce }).toString(),
  );

  // The verifier and the "next" destination are signed with AUTH_SECRET, so a
  // user cannot forge them even though the cookies are readable by the client
  // that owns them.
  response.cookies.set(STATE_COOKIE, signPayload(state, TRANSACTION_TTL_SECONDS), transactionCookieOptions);
  response.cookies.set(
    VERIFIER_COOKIE,
    signPayload(pkce.codeVerifier, TRANSACTION_TTL_SECONDS),
    transactionCookieOptions,
  );
  response.cookies.set(
    NEXT_COOKIE,
    signPayload(nextPath, TRANSACTION_TTL_SECONDS),
    transactionCookieOptions,
  );

  return response;
}
