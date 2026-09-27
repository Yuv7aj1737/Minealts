"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/ui/Logo";
import { DiscordButton } from "@/components/auth/DiscordButton";
import { UserMenu } from "@/components/auth/UserMenu";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { SessionUserView } from "@/types/auth";

export type NavLink = {
  href: string;
  label: string;
};

/**
 * Responsive header shell.
 *
 * A server component (`SiteHeader`) reads the session and passes plain data
 * down to this client component — no token ever crosses the boundary.
 */
export function SiteNav({
  links,
  user,
  isOwner,
}: {
  links: readonly NavLink[];
  user: SessionUserView | null;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-surface-300/60 bg-surface-0/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((link) => {
            // `#hash` links point at sections of the current page, so they are
            // never "current". Home is current only on `/` exactly, and every
            // other link is current on its own prefix — otherwise the
            // marketplace link would light up on `/marketplace?q=...` never and
            // `/listing/[id]` would highlight nothing at all.
            const isHashLink = link.href.includes("#");
            const active = isHashLink
              ? false
              : link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-ink-100" : "text-ink-300 hover:text-ink-100",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden md:block">
                <UserMenu user={user} isOwner={isOwner} />
              </div>
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label="Toggle navigation menu"
                className="grid size-10 place-items-center rounded-lg border border-surface-300 text-ink-200 transition-colors hover:bg-surface-200 md:hidden"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="size-5"
                  aria-hidden="true"
                >
                  {open ? (
                    <>
                      <path d="M6 6l12 12" />
                      <path d="M18 6L6 18" />
                    </>
                  ) : (
                    <>
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </>
                  )}
                </svg>
              </button>
            </>
          ) : (
            <div className="hidden md:block">
              <Link href="/login" className={buttonStyles({ variant: "primary", size: "sm" })}>
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div
          id="mobile-menu"
          className="animate-fade-in border-t border-surface-300/60 bg-surface-50/95 backdrop-blur-xl md:hidden"
        >
          <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4" aria-label="Mobile">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:bg-surface-200 hover:text-ink-100"
              >
                {link.label}
              </Link>
            ))}

            {user ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-surface-300/60 px-3 pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-100">
                      {user.displayName || user.username}
                    </p>
                    <p className="truncate text-xs text-ink-400">@{user.username}</p>
                  </div>
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 rounded-full ring-2 ring-brand-500/40"
                    />
                  ) : null}
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className={buttonStyles({ variant: "primary", size: "md" })}
                  >
                    Dashboard
                  </Link>
                  {isOwner ? (
                    <Link
                      href="/owner"
                      onClick={() => setOpen(false)}
                      className={buttonStyles({ variant: "accent", size: "md" })}
                    >
                      Owner area
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mt-3">
                <DiscordButton size="md" next="/dashboard" />
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
