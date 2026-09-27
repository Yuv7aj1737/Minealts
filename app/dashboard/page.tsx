import Link from "next/link";

import { requireUser } from "@/lib/auth/guards";
import { discordAvatarUrl } from "@/lib/auth/discord";
import { avatarInitials, formatDate } from "@/lib/display";
import { getSession } from "@/lib/auth/session";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { can, PERMISSIONS, ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { routes } from "@/lib/constants";
import { getSellerApplicationState } from "@/lib/seller-applications/service.server";
import { APPLICATION_STATUS_META } from "@/lib/seller-applications/schema";
import { cn } from "@/lib/cn";
import type { SessionUserView } from "@/types/auth";

export const dynamic = "force-dynamic";

const ROLE_TONES: Record<SessionUserView["role"], BadgeTone> = {
  USER: "neutral",
  SELLER: "brand",
  OWNER: "accent",
};

/** Notices surfaced via `?error=`, e.g. after a role guard redirects here. */
const DASHBOARD_NOTICES: Record<string, string> = {
  forbidden: "That area is restricted to a different role.",
  seller_only:
    "The seller dashboard is for approved sellers. Apply to become one and an owner will review it.",
  account_suspended:
    "Your seller account is suspended. The details are below — your listings are hidden and you cannot sell until an owner reinstates you.",
};

const UPCOMING: {
  title: string;
  description: string;
  permission: Permission;
  /** Set once the feature is built and reachable. */
  href?: string;
  /**
   * Set when the href points into the SELLER-only area.
   *
   * The permission map is not enough on its own: OWNER holds
   * LISTING_MANAGE_OWN too, so a permission-only check renders an "Unlocked"
   * card linking an owner to `/seller/dashboard` — which then bounces them to
   * `?error=seller_only`. Reachability has to match the route's actual guard.
   */
  sellerOnly?: boolean;
}[] = [
  {
    title: "Seller applications",
    description: "Apply to become a seller. Owners review every application.",
    permission: PERMISSIONS.SELLER_APPLICATION_CREATE,
    href: routes.dashboardPages.sellerApplication,
  },
  {
    title: "My listings",
    description: "Create and manage Minecraft account and server listings.",
    permission: PERMISSIONS.LISTING_MANAGE_OWN,
    href: routes.seller.dashboard,
    sellerOnly: true,
  },
  {
    title: "My orders",
    description: "Track purchases and delivery status.",
    permission: PERMISSIONS.ORDER_VIEW_OWN,
  },
  {
    title: "My wallet",
    description: "Pending and available balances, plus your payout ledger.",
    permission: PERMISSIONS.WALLET_VIEW_OWN,
  },
];

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  // The layout already guarded this, but re-checking is cheap and keeps the
  // page safe if it is ever mounted outside that layout.
  const user = await requireUser();
  const session = await getSession();

  const params = await searchParams;
  const notice =
    typeof params?.error === "string" ? DASHBOARD_NOTICES[params.error] : undefined;

  // Drives the seller-application call to action below. Only members who can
  // actually apply get the button; a SELLER or OWNER sees their state instead.
  const applicationState = can(user.role, PERMISSIONS.SELLER_APPLICATION_CREATE)
    ? await getSellerApplicationState(user)
    : null;

  const avatarUrl = discordAvatarUrl(user.discordId, user.avatar, 160);
  const name = user.displayName || user.username;

  // A suspended seller is still a SELLER, so the role checks below would happily
  // render a "Seller dashboard" button — and `/seller` would immediately redirect
  // them back here with the suspension notice. Gating on the flag keeps every
  // link on this page pointing somewhere the user can actually land.
  const sellerAreaOpen = user.role === "SELLER" && !user.suspendedAt;

  return (
    <div className="space-y-8">
      {notice ? (
        <div
          role="alert"
          className="animate-fade-in rounded-xl border border-accent-400/40 bg-accent-400/10 px-4 py-3 text-sm text-accent-100"
        >
          {notice}
        </div>
      ) : null}

      {/*
        Rendered from the session rather than from `?error=`, so the reason is
        there on every visit. A seller who bookmarks /dashboard would otherwise
        see the reason once, on the redirect, and then never again.
      */}
      {user.suspendedAt ? <SuspensionCard reason={user.suspendedReason} since={user.suspendedAt} /> : null}

      {/* ------------------------------------------------------------- Header */}
      <Card className="overflow-hidden">
        <div className="relative flex flex-col items-start gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-brand-700/25 to-transparent"
          />

          <div className="relative">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                width={80}
                height={80}
                className="size-20 rounded-2xl ring-4 ring-brand-500/30"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-20 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 font-display text-3xl font-bold text-white ring-4 ring-brand-500/30"
              >
                {avatarInitials(name)}
              </span>
            )}
          </div>

          <div className="relative min-w-0 flex-1">
            <p className="text-xs font-bold tracking-[0.2em] text-brand-400 uppercase">
              Dashboard
            </p>
            <h1 className="mt-2 truncate font-display text-2xl font-bold tracking-tight text-ink-100 sm:text-3xl">
              Welcome back, {name}
            </h1>
            <p className="mt-1 text-sm text-ink-400">
              Signed in with Discord as{" "}
              <span className="text-ink-300">@{user.username}</span>
            </p>
          </div>

          <div className="relative flex flex-wrap items-center gap-2">
            <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
            {user.suspendedAt ? <Badge tone="accent">Suspended</Badge> : null}
            {sellerAreaOpen ? (
              <ButtonLink href={routes.seller.dashboard} variant="primary" size="sm">
                Seller dashboard
              </ButtonLink>
            ) : null}
            {can(user.role, PERMISSIONS.OWNER_AREA_VIEW) ? (
              <ButtonLink href={routes.owner} variant="accent" size="sm">
                Owner area
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------- Seller dashboard CTA */}
      {sellerAreaOpen ? (
        <Card className="border-brand-500/30 bg-linear-to-b from-brand-900/25 to-transparent">
          <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-ink-100">
                Your seller dashboard
              </h2>
              <p className="mt-1 text-sm text-pretty text-ink-400">
                Sales, listings and balances. This area is only visible to approved
                sellers.
              </p>
            </div>

            <ButtonLink href={routes.seller.dashboard} variant="primary" size="md">
              Open seller dashboard
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      {/* ------------------------------------------------ Seller application CTA */}
      {can(user.role, PERMISSIONS.SELLER_APPLICATION_REVIEW) ? (
        <SellerApplicationCta
          variant="owner"
          reviewHref={routes.ownerPages.sellerApplications}
        />
      ) : applicationState ? (
        <SellerApplicationCta
          variant="applicant"
          canApply={applicationState.canApply}
          status={applicationState.application?.status ?? null}
          applyHref={routes.dashboardPages.sellerApplication}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ------------------------------------------------------ Account card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Discord account</CardTitle>
            <p className="text-sm text-ink-400">
              The minimum set of data we store to show your profile.
            </p>
          </CardHeader>

          <CardContent className="pt-0">
            <dl className="grid gap-px overflow-hidden rounded-xl border border-surface-300/70 bg-surface-300/40 sm:grid-cols-2">
              <Row label="Discord ID" value={user.discordId} mono />
              <Row label="Username" value={`@${user.username}`} />
              <Row label="Display name" value={user.displayName ?? "—"} />
              <Row label="Member since" value={formatDate(user.createdAt)} />
              <Row label="Role" value={ROLE_LABELS[user.role]} />
              <Row label="Session expires" value={formatDate(session?.expiresAt)} />
            </dl>

            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              We never store your Discord password, access token or email address. Your
              role can only be changed by an owner — signing in again cannot grant
              yourself SELLER or OWNER.
            </p>
          </CardContent>
        </Card>

        {/* --------------------------------------------------- Capabilities card */}
        <Card>
          <CardHeader>
            <CardTitle>Your permissions</CardTitle>
            <p className="text-sm text-ink-400">Derived from your role.</p>
          </CardHeader>

          <CardContent className="pt-0">
            <ul className="space-y-2.5">
              {[
                { label: "View your dashboard", granted: true },
                { label: "Apply to be a seller", granted: true },
                {
                  label: "Manage your listings",
                  granted: can(user.role, PERMISSIONS.LISTING_MANAGE_OWN),
                },
                {
                  label: "Review seller applications",
                  granted: can(user.role, PERMISSIONS.SELLER_APPLICATION_REVIEW),
                },
                {
                  label: "Manage all orders and wallets",
                  granted: can(user.role, PERMISSIONS.WALLET_MANAGE_ALL),
                },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className={
                      item.granted
                        ? "grid size-5 shrink-0 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/12 text-[10px] font-bold text-emerald-300"
                        : "grid size-5 shrink-0 place-items-center rounded-full border border-surface-300 bg-surface-200 text-[10px] font-bold text-ink-500"
                    }
                  >
                    {item.granted ? "✓" : "–"}
                  </span>
                  <span className={item.granted ? "text-ink-200" : "text-ink-500"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------------- Roadmap grid */}
      <section>
        <h2 className="font-display text-lg font-semibold text-ink-100">
          Coming to your dashboard
        </h2>
        <p className="mt-1 text-sm text-ink-400">
          The data model and permission checks for these are already in place.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {UPCOMING.map((item) => {
            const available = can(user.role, item.permission);
            // Reachability must agree with the destination's guard, not just
            // with the permission map — see the `sellerOnly` note above.
            const reachable =
              available &&
              Boolean(item.href) &&
              !(item.sellerOnly && !sellerAreaOpen);

            const body = (
              <Card interactive={reachable} className="h-full p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-base font-semibold text-ink-100">
                    {item.title}
                  </h3>
                  <Badge tone={reachable ? "brand" : "neutral"}>
                    {reachable ? "Unlocked" : available ? "Soon" : "Locked"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-ink-400">{item.description}</p>
              </Card>
            );

            if (!item.href) return <div key={item.title}>{body}</div>;

            return (
              <Link
                key={item.title}
                href={reachable ? item.href : routes.dashboard}
                aria-disabled={!reachable}
                className={cn(
                  "block rounded-2xl",
                  !reachable && "pointer-events-none opacity-60",
                )}
              >
                {body}
              </Link>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-ink-500">
        Looking for the owner tools?{" "}
        <Link href={routes.owner} className="text-brand-300 underline-offset-4 hover:underline">
          Owner area
        </Link>{" "}
        is restricted to OWNER accounts.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="bg-surface-100 px-4 py-3">
      <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "mt-1 font-mono text-sm break-all text-ink-200"
            : "mt-1 text-sm text-ink-200"
        }
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

/**
 * The reason an owner suspended this seller.
 *
 * The reason is free text written by an owner, so it is rendered as a plain
 * string: React escapes it, and a `dangerouslySetInnerHTML` here would turn an
 * owner account into a stored-XSS vector against every suspended seller.
 */
function SuspensionCard({
  reason,
  since,
}: {
  reason: string | null;
  since: Date;
}) {
  return (
    <Card className="border-accent-400/35 bg-linear-to-b from-accent-500/10 to-transparent">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Why your account is suspended</CardTitle>
          <Badge tone="accent">Suspended {formatDate(since)}</Badge>
        </div>
        <p className="text-sm text-ink-400">
          An owner paused your seller account on {formatDate(since)}. Your listings are
          hidden from the marketplace, you cannot buy or sell, and your balances are
          untouched.
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <blockquote className="rounded-xl border-l-2 border-accent-400/60 bg-surface-100 px-4 py-3 text-sm whitespace-pre-wrap text-ink-200">
          {reason ?? "No reason was recorded. Ask an owner for the details before listing again."}
        </blockquote>

        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Nothing here is lost while you are suspended, and fixing the problem is enough —
          ask the owner to reinstate you and your listings come back on their own. Do not
          send anyone your Discord password or a 2FA code; this site will never ask for
          either.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Phase 2 call to action.
 *
 * One component, two audiences: an applicant sees their application state with
 * the apply button, an owner gets a shortcut to the review queue. Both are
 * gated on the same capability the server action re-checks, so hiding a button
 * here is presentation only — the action and page guards are the real boundary.
 */
function SellerApplicationCta({
  variant,
  canApply,
  status,
  applyHref,
  reviewHref,
}: {
  variant: "applicant" | "owner";
  canApply?: boolean;
  status?: "PENDING" | "ACCEPTED" | "REJECTED" | null;
  applyHref?: string;
  reviewHref?: string;
}) {
  if (variant === "owner") {
    return (
      <Card className="border-accent-400/30 bg-accent-400/5">
        <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-accent-100">
              Seller applications
            </h2>
            <p className="mt-1 text-sm text-accent-100/80">
              Review, accept or reject applications from members.
            </p>
          </div>

          <ButtonLink href={reviewHref!} variant="accent" size="md">
            Open review queue
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const rejected = status === "REJECTED";

  return (
    <Card
      className={cn(
        "border-brand-500/30 bg-linear-to-b from-brand-900/25 to-transparent",
      )}
    >
      <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-ink-100">
              {rejected
                ? "Apply again"
                : status === "PENDING"
                  ? "Application under review"
                  : "Become a seller"}
            </h2>
            {status ? (
              <Badge tone={APPLICATION_STATUS_META[status].tone}>
                {APPLICATION_STATUS_META[status].label}
              </Badge>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-pretty text-ink-400">
            {rejected
              ? "Your last application was not approved. You are welcome to send a new one."
              : status === "PENDING"
                ? "An owner is reading your answers. You will be told the outcome here."
                : "Tell us what you plan to sell. An owner reviews every application personally."}
          </p>
        </div>

        <ButtonLink
          href={applyHref!}
          variant={canApply ? "accent" : "outline"}
          size="md"
        >
          {rejected
            ? "Start new application"
            : status === "PENDING"
              ? "View application"
              : "Apply for Seller"}
        </ButtonLink>
      </div>
    </Card>
  );
}
