import "server-only";

import { z } from "zod";

import { env } from "@/lib/env";
import { AppError } from "@/lib/auth/errors";
import type { PkcePair } from "@/lib/auth/crypto";
import {
  DISCORD_SCOPES,
  type DiscordOAuthError,
  type DiscordTokenResponse,
  type DiscordUser,
} from "@/types/discord";

/** Public OAuth2 endpoints. Not secrets. */
const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_API_BASE = "https://discord.com/api/v10";

const userSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  global_name: z.string().nullable().default(null),
  avatar: z.string().nullable().default(null),
  discriminator: z.string().default("0"),
  public_flags: z.number().default(0),
});

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().default(""),
});

/**
 * Builds the URL the browser is redirected to in order to start login.
 *
 * `state` protects against CSRF/login-injection; the PKCE challenge means a
 * stolen authorization code cannot be redeemed without the verifier that
 * only ever existed in the user's httpOnly cookie.
 */
export function buildDiscordAuthorizeUrl(input: {
  state: string;
  pkce: PkcePair;
}): URL {
  const { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI } = env();

  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("client_id", DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", DISCORD_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DISCORD_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.pkce.codeChallenge);
  url.searchParams.set("code_challenge_method", input.pkce.codeChallengeMethod);
  url.searchParams.set("prompt", "consent");

  return url;
}

/**
 * Exchanges an authorization code for an access token.
 *
 * Runs server-to-server, so DISCORD_CLIENT_SECRET never reaches the browser.
 * The access/refresh tokens are intentionally not persisted — the website
 * session is the only credential we keep.
 */
export async function exchangeCodeForToken(input: {
  code: string;
  codeVerifier: string;
}): Promise<DiscordTokenResponse> {
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } = env();

  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: DISCORD_REDIRECT_URI,
    code_verifier: input.codeVerifier,
  });

  let response: Response;
  try {
    response = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch (cause) {
    throw new AppError("OAUTH_EXCHANGE_FAILED", "Could not reach Discord", { cause });
  }

  if (!response.ok) {
    const detail = await readOAuthError(response);
    console.error("[discord] token exchange failed", response.status, detail);

    // `invalid_client` is Discord's single error for a bad client_id, a bad
    // client_secret, or a redirect_uri that is not registered for this
    // application. It is by far the most common setup mistake, so it gets a
    // distinct, actionable message instead of a generic failure.
    if (detail?.error === "invalid_client") {
      throw new AppError(
        "DISCORD_CREDENTIALS_INVALID",
        "Discord rejected the application credentials or redirect URI",
      );
    }

    // A code that is unknown, expired or already redeemed.
    if (detail?.error === "invalid_grant") {
      throw new AppError(
        "INVALID_CODE",
        "The authorization code was invalid, expired or already used",
      );
    }

    throw new AppError(
      "OAUTH_EXCHANGE_FAILED",
      "Discord rejected the authorization code",
    );
  }

  const parsed = tokenSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError("OAUTH_EXCHANGE_FAILED", "Malformed token response from Discord");
  }

  return parsed.data as DiscordTokenResponse;
}

/** Fetches the authenticated Discord account. Uses the `identify` scope only. */
export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  let response: Response;
  try {
    response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch (cause) {
    throw new AppError("USER_FETCH_FAILED", "Could not reach Discord", { cause });
  }

  if (!response.ok) {
    console.error("[discord] /users/@me failed", response.status);
    throw new AppError("USER_FETCH_FAILED", "Could not read your Discord profile");
  }

  const parsed = userSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError("USER_FETCH_FAILED", "Malformed Discord profile response");
  }

  return parsed.data as DiscordUser;
}

/** Builds a Discord CDN avatar URL from a stored avatar hash. */
export function discordAvatarUrl(
  discordId: string,
  avatarHash: string | null,
  size = 128,
): string | null {
  if (!avatarHash) return null;

  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${extension}?size=${size}`;
}

async function readOAuthError(response: Response): Promise<DiscordOAuthError | null> {
  try {
    return (await response.json()) as DiscordOAuthError;
  } catch {
    return null;
  }
}
