/**
 * Development seed.
 *
 * Creates one OWNER so the `/owner` area can be exercised locally, plus a
 * plain USER for comparison.
 *
 * IMPORTANT: a role is only ever assigned here or by an OWNER through the
 * admin surface. The Discord login flow never sets a role, which is why the
 * seeded owner will not be the owner of *your* real login unless you set
 * SEED_OWNER_DISCORD_ID to your own Discord user id before signing in.
 *
 * Run with:  npm run db:seed
 */

import { PrismaClient } from "@prisma/client";

// `.env.local` is not loaded by Prisma when the seed is executed directly.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: fall back to whatever is already in the environment.
}

const prisma = new PrismaClient();

/**
 * A snowflake nobody can log in as, used when SEED_OWNER_DISCORD_ID is unset.
 * Tracked as a constant so the closing hint can tell "your owner is real" from
 * "your owner is still the placeholder".
 */
const PLACEHOLDER_OWNER_DISCORD_ID = "100000000000000001";

/** Discord snowflakes are decimal strings — use your own to become owner. */
const OWNER_DISCORD_ID = process.env.SEED_OWNER_DISCORD_ID ?? PLACEHOLDER_OWNER_DISCORD_ID;
const OWNER_USERNAME = process.env.SEED_OWNER_USERNAME ?? "owner";
const MEMBER_DISCORD_ID = "100000000000000002";

async function main() {
  console.log("Seeding MineAlts...");

  const owner = await prisma.user.upsert({
    where: { discordId: OWNER_DISCORD_ID },
    create: {
      discordId: OWNER_DISCORD_ID,
      username: OWNER_USERNAME,
      displayName: "MineAlts Owner",
      role: "OWNER",
    },
    // Idempotent: re-seeding keeps the account an owner.
    update: { role: "OWNER" },
  });

  const member = await prisma.user.upsert({
    where: { discordId: MEMBER_DISCORD_ID },
    create: {
      discordId: MEMBER_DISCORD_ID,
      username: "member",
      displayName: "Demo Member",
      role: "USER",
    },
    update: {},
  });

  console.log(`  OWNER  ${owner.username} (${owner.discordId})`);
  console.log(`  USER   ${member.username} (${member.discordId})`);

  // Only nag when the owner is still the placeholder. Printing the instruction
  // unconditionally made it look like owner access was not working even after
  // SEED_OWNER_DISCORD_ID had been set and applied.
  if (OWNER_DISCORD_ID === PLACEHOLDER_OWNER_DISCORD_ID) {
    console.log("");
    console.log("This owner cannot be logged into — the id is a placeholder.");
    console.log("To use your own Discord login as the owner, set");
    console.log("SEED_OWNER_DISCORD_ID in .env.local to your own Discord user id,");
    console.log("re-run `npm run db:seed`, then sign in.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
