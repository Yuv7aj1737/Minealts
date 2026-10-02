import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { safeEqual, verifyPayload } from "@/lib/auth/crypto";
import { exchangeCodeForToken, fetchDiscordUser } from "@/lib/auth/discord";
import { isAppError } from "@/lib/auth/errors";
import { createSession } from "@/lib/auth/session";
import { isDiscordAuthConfigured } from "@/lib/env";
import { safeInternalPathOr } from "@/lib/auth/redirects";
import { DEFAULT_POST_LOGIN_REDIRECT, routes } from "@/lib/constants";

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

  if (searchParams.get("error")) {
    return loginErrorRedirect(request, "OAUTH_PROVIDER_ERROR");
  }

  const code = searchParams.get("code");
  if (!code) {
    return loginErrorRedirect(request, "INVALID_CODE");
  }

  const statePayload = verifyPayload(request.cookies.get(STATE_COOKIE)?.value);
  const returnedState = searchParams.get("state");
  if (!statePayload || !returnedState || !safeEqual(statePayload.value, returnedState)) {
    return loginErrorRedirect(request, "INVALID_STATE");
  }

  const verifierPayload = verifyPayload(request.cookies.get(VERIFIER_COOKIE)?.value);
  if (!verifierPayload) {
    return loginErrorRedirect(request, "INVALID_STATE");
  }

  const nextPath = safeInternalPathOr(
    verifyPayload(request.cookies.get(NEXT_COOKIE)?.value)?.value,
    DEFAULT_POST_LOGIN_REDIRECT,
  );

  try {
    // 3. Authorization code -> access token
    const token = await exchangeCodeForToken({
      code,
      codeVerifier: verifierPayload.value,
    });

    // 4. Identify the Discord account
    const discordUser = await fetchDiscordUser(token.access_token);

    // 5. Build user object directly from Discord profile (No Database required!)
    const authUser = {
      id: discordUser.id,
      username: discordUser.username,
      displayName: discordUser.global_name || discordUser.username,
      discordId: discordUser.id,
      avatar: discordUser.avatar,
      role: "USER" as const,
      createdAt: new Date(),
    };

    // 6. Mint a website session with the user data
    await createSession(authUser.id, authUser);

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
