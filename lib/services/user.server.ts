import "server-only";

import { prisma } from "@/lib/db";
import type { DiscordUser } from "@/types/discord";

/**
 * Resolves a Discord account to a website account, creating it on first login.
 *
 * Only the minimum identifying data is persisted: snowflake id, username,
 * display name and avatar hash. The Discord access token is used once and
 * then dropped.
 *
 * The role is intentionally *not* part of the update payload. A role is only
 * ever changed by an owner through the admin surface, so a compromised or
 * tampered Discord response can never escalate a member to SELLER or OWNER.
 * `upsert` also leaves an existing role untouched for the same reason.
 */
export async function findOrCreateUserFromDiscord(discordUser: DiscordUser) {
  const data = {
    username: discordUser.username,
    displayName: discordUser.global_name,
    avatar: discordUser.avatar,
  };

  const user = await prisma.user.upsert({
    where: { discordId: discordUser.id },
    create: {
      discordId: discordUser.id,
      // `role` omitted: Prisma applies the schema default of USER.
      ...data,
    },
    update: data,
  });

  return user;
}

/** Looks up a user by Discord snowflake. */
export async function getUserByDiscordId(discordId: string) {
  return prisma.user.findUnique({ where: { discordId } });
}
