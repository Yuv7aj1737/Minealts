import path from "node:path";

import { defineConfig } from "prisma/config";

/**
 * Prisma configuration.
 *
 * Replaces the deprecated `package.json#prisma` block. `prisma.config.ts` does
 * not read `.env` files automatically, so we load `.env.local` explicitly
 * using Node's built-in loader (Node >= 20.12).
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local present (e.g. CI). Fall back to the ambient environment.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
