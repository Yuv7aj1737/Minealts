import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { env } from "@/lib/env";

/** URL-safe base64 without padding. */
export function base64UrlEncode(input: Buffer): string {
  return input.toString("base64url");
}

/** Cryptographically strong random token, URL-safe. */
export function generateToken(byteLength = 32): string {
  return base64UrlEncode(randomBytes(byteLength));
}

/** One-way digest used to store session tokens at rest. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time string comparison. Returns false on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Signed-cookie payload: `<base64url(json)>.<base64url(hmac-sha256)>`. */
export type SignedPayload = { value: string; expiresAt: number };

/**
 * Signs a short-lived value with AUTH_SECRET so it can live in a cookie
 * without server-side storage while still being tamper-evident.
 */
export function signPayload(value: string, ttlSeconds: number): string {
  const { AUTH_SECRET } = env();
  const payload: SignedPayload = {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = base64UrlEncode(
    createHmac("sha256", AUTH_SECRET).update(encoded).digest(),
  );
  return `${encoded}.${signature}`;
}

/**
 * Verifies and un-signs a payload produced by {@link signPayload}.
 * Returns null when the signature does not match, the payload is malformed,
 * or it has expired.
 */
export function verifyPayload(token: string | undefined): SignedPayload | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: Buffer;
  try {
    expected = createHmac("sha256", env().AUTH_SECRET)
      .update(encoded)
      .digest();
  } catch {
    return null;
  }

  const provided = Buffer.from(signature, "base64url");
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SignedPayload;

    if (typeof payload.value !== "string") return null;
    if (typeof payload.expiresAt !== "number") return null;
    if (payload.expiresAt <= Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

/** PKCE pair for the OAuth2 authorization-code flow (RFC 7636, S256). */
export type PkcePair = {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
};

export function createPkcePair(): PkcePair {
  const codeVerifier = generateToken(32);
  const codeChallenge = base64UrlEncode(
    createHash("sha256").update(codeVerifier).digest(),
  );
  return { codeVerifier, codeChallenge, codeChallengeMethod: "S256" };
}
