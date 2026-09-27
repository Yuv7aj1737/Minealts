import { SiteNav, type NavLink } from "@/components/layout/SiteNav";
import { discordAvatarUrl } from "@/lib/auth/discord";
import { getCurrentUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import type { SessionUserView } from "@/types/auth";

const links: readonly NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#roadmap", label: "Roadmap" },
];

/**
 * Session-aware header.
 *
 * Runs on the server: the cookie is read here and only non-sensitive fields
 * are handed to the client component. This also makes every page dynamic,
 * which is what a signed-in marketplace requires anyway.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  const sessionUser: SessionUserView | null = user
    ? {
        username: user.username,
        displayName: user.displayName,
        avatarUrl: discordAvatarUrl(user.discordId, user.avatar),
        role: user.role,
      }
    : null;

  return (
    <SiteNav
      links={links}
      user={sessionUser}
      isOwner={user ? can(user.role, PERMISSIONS.OWNER_AREA_VIEW) : false}
    />
  );
}
