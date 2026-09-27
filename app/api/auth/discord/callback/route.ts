import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { safeEqual, verifyPayload } from "@/lib/auth/crypto";
import { exchangeCodeForToken, fetchDiscordUser } from "@/lib/auth/discord";
import { isAppError } from "@/lib/auth/errors";
import { createSession } from "@/lib/auth/session";
import { findOrCreateUserFromDiscord } from "@/lib/services/user.server";
import { isDiscordAuthConfigured } from "@/lib/env";
import { safeInternalPathOr } from "@/lib/auth/redirects";
import { DEFAULT_POST_LOGIN_REDIRECT, routes } from "@/lib/constants";

/**
 * Step 2 of the Discord login flow: Discord redirects the browser back here.
 *
 * Order of operations, all server-side:
 *   1. clear the transaction cookies immediately (single use),
 *   2. verify `state` against the signed cookie            -> CSRF defence,
 *   3. recover the PKCE `code_verifier` from its cookie,
 *   4. exchange the code for an access token (client secret stays here),
 *   5. read the Discord profile,
 *   6. find-or-create the website account,
 *   7. mint a website session and set the session cookie,
 *   8. redirect to the (validated) destination.
 *
 * We never ask for, receive, or store a Discord password.
 */

const STATE_COOKIE = "minealts_oauth_state";
const VERIFIER_COOKIE = "minealts_oauth_verifier";
const NEXT_COOKIE = "minealts_oauth_next";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth/discord",
} as const;

function withClearedTransactionCookies(response: NextResponse): NextResponse {
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, NEXT_COOKIE]) {
    response.cookies.set(name, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  }
  return response;
}

function loginErrorRedirect(request: NextRequest, code: string): NextResponse {
  const url = new URL(routes.login, request.nextUrl.origin);
  url.searchParams.set("error", code);
  return withClearedTransactionCookies(NextResponse.redirect(url));
}

export async function GET(request: NextRequest) {
  if (!isDiscordAuthConfigured()) {
    return loginErrorRedirect(request, "CONFIG_ERROR");
  }

  const { searchParams } = request.nextUrl;

  // The user declined, or Discord reported a problem.
  if (searchParams.get("error")) {
    return loginErrorRedirect(request, "OAUTH_PROVIDER_ERROR");
  }

  const code = searchParams.get("code");
  if (!code) {
    return loginErrorRedirect(request, "INVALID_CODE");
  }

  // 1. CSRF: the state we sent must come back signed, intact and identical.
  const statePayload = verifyPayload(request.cookies.get(STATE_COOKIE)?.value);
  const returnedState = searchParams.get("state");
  if (!statePayload || !returnedState || !safeEqual(statePayload.value, returnedState)) {
    return loginErrorRedirect(request, "INVALID_STATE");
  }

  // 2. PKCE verifier from the signed cookie.
  const verifierPayload = verifyPayload(request.cookies.get(VERIFIER_COOKIE)?.value);
  if (!verifierPayload) {
    return loginErrorRedirect(request, "INVALID_STATE");
  }

  const nextPath = safeInternalPathOr(
    verifyPayload(request.cookies.get(NEXT_COOKIE)?.value)?.value,
    DEFAULT_POST_LOGIN_REDIRECT,
  );

  try {
    // 3. Authorization code -> access token, entirely on the server.
    const token = await exchangeCodeForToken({
      code,
      codeVerifier: verifierPayload.value,
    });

    // 4. Identify the Discord account.
    const discordUser = await fetchDiscordUser(token.access_token);

    // 5. Find or create the website account. Role is never taken from Discord.
    const user = await findOrCreateUserFromDiscord(discordUser);

    // 6. Mint a website session.
    await createSession(user.id);

    const destination = new URL(nextPath, request.nextUrl.origin);
    return withClearedTransactionCookies(NextResponse.redirect(destination));
  } catch (error) {
    const code = isAppError(error) ? error.code : "OAUTH_EXCHANGE_FAILED";
    if (!isAppError(error)) {
      console.error("[auth] unexpected error during discord callback", error);
    } else {
      console.error("[auth] discord callback failed:", error.code, error.message);
    }
    return loginErrorRedirect(request, code);
  }
}
