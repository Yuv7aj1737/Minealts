import { cn } from "@/lib/cn";
import { avatarInitials } from "@/lib/display";

/**
 * Seller avatar with a local, deterministic fallback.
 *
 * The fallback is a letter on a colour picked by hashing the username, so the
 * same seller always gets the same swatch without any request.
 *
 * The obvious alternative — a Minecraft skin head from a public avatar service —
 * was rejected on purpose. It would hand every seller's username to a third
 * party on every page view, and it would break (or start returning someone
 * else's face) the day that service changes. An initial is honest and free.
 */

const PALETTE = [
  "from-brand-500 to-brand-700",
  "from-emerald-500 to-emerald-700",
  "from-sky-500 to-sky-700",
  "from-accent-400 to-accent-600",
  "from-violet-500 to-violet-700",
  "from-rose-500 to-rose-700",
] as const;

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-20 text-2xl",
} as const;

export type SellerAvatarProps = {
  /** Used for the initial and to pick the colour. Never rendered raw. */
  username: string;
  displayName?: string | null;
  /** Discord CDN URL from the server, or null. */
  avatarUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
};

/** Stable string hash. Small, fast, and good enough to pick one of six colours. */
function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index++) {
    result = (result * 31 + value.charCodeAt(index)) % 0xffffffff;
  }
  return result;
}

export function SellerAvatar({
  username,
  displayName,
  avatarUrl,
  size = "md",
  className,
}: SellerAvatarProps) {
  const classes = cn(
    "grid shrink-0 place-items-center overflow-hidden rounded-xl ring-2 ring-brand-500/25",
    SIZES[size],
    className,
  );

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        // Decorative: the seller's name is always rendered as text next to it.
        alt=""
        width={64}
        height={64}
        loading="lazy"
        className={classes}
      />
    );
  }

  return (
    <span
      // The initial alone carries no information the name does not already
      // provide, so it is hidden from assistive tech.
      aria-hidden="true"
      className={cn(classes, "font-display font-bold text-white", PALETTE[hash(username) % PALETTE.length])}
    >
      {avatarInitials(displayName || username)}
    </span>
  );
}
