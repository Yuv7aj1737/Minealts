/**
 * Discriminated list of the site's own errors.
 *
 * Route handlers and server actions map these onto HTTP status codes so that
 * internals never leak to the client.
 */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "INVALID_CODE"
  | "OAUTH_EXCHANGE_FAILED"
  | "OAUTH_PROVIDER_ERROR"
  | "USER_FETCH_FAILED"
  | "INVALID_REDIRECT"
  | "CONFIG_ERROR"
  | "DISCORD_CREDENTIALS_INVALID";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_STATE: 400,
  INVALID_CODE: 400,
  OAUTH_EXCHANGE_FAILED: 502,
  OAUTH_PROVIDER_ERROR: 502,
  USER_FETCH_FAILED: 502,
  INVALID_REDIRECT: 400,
  CONFIG_ERROR: 500,
  DISCORD_CREDENTIALS_INVALID: 502,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;

  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Turns any thrown value into a log-safe message.
 * The raw cause is logged server-side only, never returned to the browser.
 */
export function toSafeMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

/**
 * User-facing copy for each failure code, keyed by the `error` query parameter
 * on `/login`. Keeping the strings here means the callback route can hand back
 * a code without leaking provider detail into the URL.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "You need to sign in to view that page.",
  FORBIDDEN: "You do not have permission to view that page.",
  INVALID_STATE:
    "Your Discord login expired or was tampered with. Please try again.",
  INVALID_CODE: "Discord did not return a valid authorization code. Please try again.",
  OAUTH_EXCHANGE_FAILED:
    "We could not complete the handshake with Discord. Please try again in a moment.",
  OAUTH_PROVIDER_ERROR:
    "Discord did not complete the sign-in. If you declined, that is fine — try again when you are ready.",
  USER_FETCH_FAILED: "We could not read your Discord profile. Please try again.",
  INVALID_REDIRECT: "That destination is not valid, so we sent you home instead.",
  CONFIG_ERROR:
    "Discord sign-in is not configured on this deployment. An administrator needs to set the Discord environment variables.",
  DISCORD_CREDENTIALS_INVALID:
    "Discord rejected this application's credentials. Check that DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET are correct (copy the revealed secret, not the masked one) and that DISCORD_REDIRECT_URI is registered on the Discord OAuth2 page character for character.",
};

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? "Something went wrong while signing in. Please try again.";
}
