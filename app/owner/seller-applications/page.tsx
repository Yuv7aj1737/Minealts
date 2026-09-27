import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listSellerApplicationsForOwner } from "@/lib/seller-applications/service.server";
import {
  APPLICATION_STATUS_META,
  REVIEW_PAGE_ERRORS,
  type ReviewPageError,
} from "@/lib/seller-applications/schema";
import { formatDate } from "@/lib/display";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { routes } from "@/lib/constants";
import { ReviewButtons } from "./ReviewButtons";

export const metadata: Metadata = {
  title: "Seller Applications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * OWNER-only review queue.
 *
 * Three independent layers protect this page:
 *   1. `/owner/layout.tsx` calls `requireOwner()` before any child renders, so
 *      every page under `/owner` is guarded by construction.
 *   2. This page re-checks `SELLER_APPLICATION_REVIEW` in case it is ever
 *      mounted outside that layout.
 *   3. The Server Action re-checks again, because the action is a public POST
 *      endpoint that a crafted request can reach without rendering this page.
 */
export default async function SellerApplicationsPage({
  searchParams,
}: PageProps<"/owner/seller-applications">) {
  const user = await requirePermission(PERMISSIONS.SELLER_APPLICATION_REVIEW);

  const { applications, counts } = await listSellerApplicationsForOwner();

  const params = await searchParams;
  const errorKey =
    typeof params?.error === "string" && params.error in REVIEW_PAGE_ERRORS
      ? (params.error as ReviewPageError)
      : null;
  const justAccepted = params?.accepted === "1";
  const justRejected = params?.rejected === "1";

  const pending = applications.filter((application) => application.status === "PENDING");
  const decided = applications.filter((application) => application.status !== "PENDING");

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-[0.2em] text-accent-400 uppercase">
              Owner
            </span>
            <Badge tone="accent">{counts.pending} pending</Badge>
          </div>

          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-100">
            Seller applications
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-ink-300">
            Read every answer, then accept or reject. Accepting promotes the
            applicant from USER to SELLER immediately. You cannot review your own
            applications, because owners never submit them.
          </p>
        </div>

        <ButtonLink href={routes.owner} variant="outline" size="sm">
          Back to owner area
        </ButtonLink>
      </div>

      {errorKey ? <Notice tone="error">{REVIEW_PAGE_ERRORS[errorKey]}</Notice> : null}

      {justAccepted ? (
        <Notice tone="success">
          Application accepted. The applicant is now a seller.
        </Notice>
      ) : null}

      {justRejected ? (
        <Notice tone="neutral">
          Application rejected. The applicant stays a member and may apply again.
        </Notice>
      ) : null}

      {/* ------------------------------------------------------------ Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={counts.total} />
        <Stat label="Pending" value={counts.pending} tone="warning" />
        <Stat label="Accepted" value={counts.accepted} tone="success" />
        <Stat label="Rejected" value={counts.rejected} />
      </div>

      {/* ------------------------------------------------------------ Pending */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-ink-100">
          Awaiting review
          {pending.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-ink-400">
              {pending.length} new
            </span>
          ) : null}
        </h2>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-ink-400">
                Nothing waiting. New applications appear here as soon as a member
                submits one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pending.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                reviewerUsername={user.username}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ History */}
      {decided.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-ink-100">
            Decided
          </h2>

          <div className="space-y-3">
            {decided.map((application) => (
              <Card key={application.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-ink-100">
                      @{application.discordUsername}
                    </p>
                    <p className="mt-0.5 font-mono text-xs break-all text-ink-500">
                      {application.discordId}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={APPLICATION_STATUS_META[application.status].tone}
                    >
                      {APPLICATION_STATUS_META[application.status].label}
                    </Badge>
                    <span className="text-xs text-ink-500">
                      {application.reviewedAt
                        ? `${formatDate(application.reviewedAt)} · by @${application.reviewerUsername ?? "unknown"}`
                        : "—"}
                    </span>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-ink-400">
                  {application.whatToSell}
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ApplicationCard({
  application,
  reviewerUsername,
}: {
  application: Awaited<
    ReturnType<typeof listSellerApplicationsForOwner>
  >["applications"][number];
  reviewerUsername: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">
              @{application.discordUsername}
            </CardTitle>
            <p className="mt-0.5 font-mono text-xs break-all text-ink-500">
              {application.discordId}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={APPLICATION_STATUS_META[application.status].tone}>
              {APPLICATION_STATUS_META[application.status].label}
            </Badge>
            <span className="text-xs text-ink-500">
              Applied {formatDate(application.createdAt)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        <dl className="grid gap-px overflow-hidden rounded-xl border border-surface-300/70 bg-surface-300/40">
          <AnswerRow label="Why do you want to become a seller?" value={application.reason} />
          <AnswerRow label="What will you sell?" value={application.whatToSell} />
          {application.extraInfo ? (
            <AnswerRow label="Additional information" value={application.extraInfo} />
          ) : null}
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          <Badge
            tone={
              application.applicantRole === "OWNER"
                ? "accent"
                : application.applicantRole === "SELLER"
                  ? "brand"
                  : "neutral"
            }
          >
            Currently {application.applicantRole}
          </Badge>
          <span className="text-xs text-ink-500">
            Reviewing as @{reviewerUsername}
          </span>
        </div>

        <ReviewButtons
          applicationId={application.id}
          applicantUsername={application.discordUsername}
        />
      </CardContent>
    </Card>
  );
}

function AnswerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-100 px-4 py-3">
      <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm whitespace-pre-line text-ink-200">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneClass = {
    neutral: "text-ink-100",
    warning: "text-accent-300",
    success: "text-emerald-300",
  }[tone];

  return (
    <Card className="p-5">
      <p className="text-xs font-semibold tracking-[0.15em] text-ink-500 uppercase">
        {label}
      </p>
      <p className={`mt-1 font-display text-3xl font-bold ${toneClass}`}>{value}</p>
    </Card>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "success" | "neutral";
  children: React.ReactNode;
}) {
  const toneClass = {
    error: "border-brand-500/40 bg-brand-500/10 text-brand-200",
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    neutral: "border-surface-300/70 bg-surface-200/50 text-ink-200",
  }[tone];

  return (
    <div
      role="status"
      className={`animate-fade-in rounded-xl border px-4 py-3 text-sm ${toneClass}`}
    >
      {children}
    </div>
  );
}
