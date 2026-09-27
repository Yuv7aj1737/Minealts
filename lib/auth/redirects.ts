/**
 * Post-login / post-logout redirect safety.
 *
 * A `next` query parameter is attacker-controllable, so it is only honoured
 * when it is a same-origin, absolute *path*. This blocks open-redirects such
 * as `?next=https://evil.example`.
 */

const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#[\]]*$/;

/** Returns a safe in-app path, or null when the input must be rejected. */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!SAFE_PATH.test(value)) return null;
  // Reject control characters and backslash tricks such as "/\evil.example".
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return null;
  return value;
}

/** Same as {@link safeInternalPath} but always returns a usable fallback. */
export function safeInternalPathOr(
  value: string | null | undefined,
  fallback: string,
): string {
  return safeInternalPath(value) ?? fallback;
}
