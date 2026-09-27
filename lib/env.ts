import "server-only";

import { z } from "zod";

/**
 * Server environment contract.
 *
 * Validation is lazy (memoised) rather than top-level so that a missing value
 * produces an actionable error at the point of use instead of crashing every
 * page at import time.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must be a PostgreSQL connection string",
    ),

  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_CLIENT_SECRET: z.string().min(1, "DISCORD_CLIENT_SECRET is required"),

  DISCORD_REDIRECT_URI: z
    .url("DISCORD_REDIRECT_URI must be an absolute URL")
    .refine(
      (value) => value.startsWith("https://") || /^http:\/\/localhost(:\d+)?\//.test(value),
      "DISCORD_REDIRECT_URI must use https (http is only allowed for localhost)",
    ),

  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters (generate one with `npm run auth:secret`)"),

  NEXT_PUBLIC_SITE_URL: z
    .url("NEXT_PUBLIC_SITE_URL must be an absolute URL")
    .refine((value) => !value.endsWith("/"), "NEXT_PUBLIC_SITE_URL must not end with a slash"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/** Thrown when the environment is incomplete or malformed. */
export class EnvironmentError extends Error {
  constructor(readonly issues: string[]) {
    super(
      `Invalid server environment:\n${issues.map((issue) => `  - ${issue}`).join("\n")}\n\n` +
        "Copy .env.example to .env.local and fill in the missing values.",
    );
    this.name = "EnvironmentError";
  }
}

/**
 * Returns the validated server environment, parsing it on first use.
 * @throws {EnvironmentError}
 */
export function env(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "env"}: ${issue.message}`,
    );
    throw new EnvironmentError(issues);
  }

  cached = parsed.data;
  return cached;
}

/**
 * Non-throwing check for the Discord OAuth2 credentials.
 *
 * Used by the login screen so an unconfigured deployment renders an
 * instruction instead of a stack trace. Discord is optional for every other
 * page, so this must never call {@link env}.
 */
export function isDiscordAuthConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_CLIENT_ID?.trim() &&
      process.env.DISCORD_CLIENT_SECRET?.trim() &&
      process.env.DISCORD_REDIRECT_URI?.trim() &&
      process.env.AUTH_SECRET?.length,
  );
}
