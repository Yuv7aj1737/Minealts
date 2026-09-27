"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { ROLE_LABELS } from "@/lib/auth/permissions";
import { routes } from "@/lib/constants";
import { avatarInitials } from "@/lib/display";
import { cn } from "@/lib/cn";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { SessionUserView } from "@/types/auth";

const ROLE_TONES: Record<SessionUserView["role"], BadgeTone> = {
  USER: "neutral",
  SELLER: "brand",
  OWNER: "accent",
};

function Avatar({
  user,
  className,
}: {
  user: SessionUserView;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const name = user.displayName || user.username;

  if (user.avatarUrl && !failed) {
    return (
      // Discord CDN avatar. `next/image` would need the host allow-listed and
      // provides no benefit for a 32px circle.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={`${name}'s Discord avatar`}
        width={32}
        height={32}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("size-8 rounded-full ring-2 ring-brand-500/40", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 place-items-center rounded-full text-sm font-bold",
        "bg-linear-to-br from-brand-500 to-brand-700 text-white",
        "ring-2 ring-brand-500/40",
        className,
      )}
    >
      {avatarInitials(name)}
    </span>
  );
}

/** Signed-in identity cluster: avatar, name, role badge and a dropdown. */
export function UserMenu({
  user,
  isOwner,
}: {
  user: SessionUserView;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const name = user.displayName || user.username;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-2.5 rounded-xl border border-surface-300 bg-surface-100/70 py-1.5 pr-3 pl-1.5",
          "transition-colors hover:border-brand-500/50 hover:bg-surface-200",
        )}
      >
        <Avatar user={user} />
        <span className="hidden text-sm font-semibold text-ink-100 sm:block">
          {name}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={cn(
            "size-4 text-ink-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          <path
            fillRule="evenodd"
            d="M5.22 7.72a.75.75 0 0 1 1.06 0L10 11.44l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.78a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-2xl",
            "border border-surface-300 bg-surface-100 shadow-2xl shadow-black/60",
            "animate-fade-in p-2",
          )}
        >
          <div className="flex items-center gap-3 rounded-xl p-3">
            <Avatar user={user} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-100">{name}</p>
              <p className="truncate text-xs text-ink-400">@{user.username}</p>
            </div>
          </div>

          <div className="px-3 pb-3">
            <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
          </div>

          <div className="border-t border-surface-300/70 pt-2">
            <MenuLink href={routes.dashboard} onNavigate={() => setOpen(false)}>
              Dashboard
            </MenuLink>

            {isOwner ? (
              <MenuLink href={routes.owner} onNavigate={() => setOpen(false)}>
                Owner area
              </MenuLink>
            ) : null}

            {/* Real form POST: no JavaScript, and not vulnerable to a
                cross-site GET logout. */}
            <form action={routes.auth.logout} method="post">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-300 transition-colors hover:bg-surface-200 hover:text-brand-300"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-200 transition-colors hover:bg-surface-200 hover:text-ink-100"
    >
      {children}
    </Link>
  );
}
