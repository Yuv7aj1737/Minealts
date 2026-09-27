import Link from "next/link";

import { DiscordIcon } from "@/components/auth/DiscordIcon";
import { buttonStyles } from "@/components/ui/Button";
import { routes } from "@/lib/constants";
import { cn } from "@/lib/cn";

/**
 * "Continue with Discord".
 *
 * This is a plain link to our own `/api/auth/discord` route, which performs
 * the redirect to Discord's consent screen. The user authenticates on
 * discord.com — we never see or ask for their Discord password.
 */
export function DiscordButton({
  next,
  size = "lg",
  className,
  label = "Continue with Discord",
}: {
  /** Internal path to return to after login. */
  next?: string;
  size?: "md" | "lg";
  className?: string;
  label?: string;
}) {
  const href = next
    ? `${routes.auth.discordStart}?next=${encodeURIComponent(next)}`
    : routes.auth.discordStart;

  return (
    <Link
      href={href}
      className={cn(buttonStyles({ variant: "discord", size }), "w-full sm:w-auto", className)}
      // No referrer: keeps the post-login path out of Discord's logs.
      referrerPolicy="no-referrer"
    >
      <DiscordIcon className="size-5" />
      {label}
    </Link>
  );
}
