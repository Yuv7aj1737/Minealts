import Link from "next/link";
import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getSellerApplicationState } from "@/lib/seller-applications/service.server";
import { APPLICATION_STATUS_META } from "@/lib/seller-applications/schema";
import { formatDate } from "@/lib/display";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { routes } from "@/lib/constants";
import { SellerApplicationForm } from "./SellerApplicationForm";

export const metadata: Metadata = {
  title: "Apply for Seller",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The applicant-facing seller application page.
 *
 * The guard here only requires SELLER_APPLICATION_CREATE. Whether the *form*
 * renders is decided by `getSellerApplicationState`, which also handles
 * "already pending" and "already a seller" — cases where the member is
 * perfectly allowed on this page but must not see a second form.
 */
export default async function SellerApplicationPage({
  searchParams,
}: PageProps<"/dashboard/seller-application">) {
  // Redirects an anonymous visitor to sign in.
  const user = await requirePermission(PERMISSIONS.SELLER_APPLICATION_CREATE);

  const state = await getSellerApplicationState(user);
  const { application, canApply, blockedReason } = state;

  const params = await searchParams;
  const justSubmitted = params?.submitted === "1";

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-[0.2em] text-brand-400 uppercase">
              Seller
            </span>
            {application ? (
              <Badge tone={APPLICATION_STATUS_META[application.status].tone}>
                {APPLICATION_STATUS_META[application.status].label}
              </Badge>
            ) : null}
          </div>

          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-100">
            Apply to become a seller
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-ink-300">
            Every application is read by an owner. Tell us what you want to sell
            and we will get back to you on Discord.
          </p>
        </div>

        <ButtonLink href={routes.dashboard} variant="outline" size="sm">
          Back to dashboard
        </ButtonLink>
      </div>

      {justSubmitted ? (
        <div
          role="status"
          className="animate-fade-in rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          Application received. An owner will review it shortly.
        </div>
      ) : null}

      {canApply ? (
        <Card>
          <CardHeader>
            <CardTitle>Your application</CardTitle>
            <p className="text-sm text-ink-400">
              Signed in as{" "}
              <span className="text-ink-200">@{user.username}</span>. Your Discord
              details are attached automatically.
            </p>
          </CardHeader>

          <CardContent className="pt-0">
            <SellerApplicationForm
              discordUsername={user.username}
              discordId={user.discordId}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-accent-400/30 bg-accent-400/5">
            <CardHeader>
              <CardTitle className="text-accent-100">Not available</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-accent-100/85">{blockedReason}</p>
            </CardContent>
          </Card>

          {application ? (
            <ApplicationSummary application={application} />
          ) : null}
        </>
      )}

      <p className="text-xs text-ink-500">
        Your role is never changed by this page. Only an owner can approve an
        application, and signing in again will never grant you SELLER.
      </p>
    </div>
  );
}

function ApplicationSummary({
  application,
}: {
  application: NonNullable<
    Awaited<ReturnType<typeof getSellerApplicationState>>["application"]
  >;
}) {
  const meta = APPLICATION_STATUS_META[application.status];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Your application</CardTitle>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        <p className="text-sm text-ink-400">{meta.description}</p>
      </CardHeader>

      <CardContent className="pt-0">
        <dl className="grid gap-px overflow-hidden rounded-xl border border-surface-300/70 bg-surface-300/40 sm:grid-cols-2">
          <SummaryRow label="Submitted" value={formatDate(application.createdAt)} />
          <SummaryRow
            label="Decided"
            value={application.reviewedAt ? formatDate(application.reviewedAt) : "—"}
          />
          <div className="bg-surface-100 px-4 py-3 sm:col-span-2">
            <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
              Why do you want to become a seller?
            </dt>
            <dd className="mt-1 text-sm whitespace-pre-line text-ink-200">
              {application.reason}
            </dd>
          </div>
          <div className="bg-surface-100 px-4 py-3 sm:col-span-2">
            <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
              What will you sell?
            </dt>
            <dd className="mt-1 text-sm whitespace-pre-line text-ink-200">
              {application.whatToSell}
            </dd>
          </div>
          {application.extraInfo ? (
            <div className="bg-surface-100 px-4 py-3 sm:col-span-2">
              <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Additional information
              </dt>
              <dd className="mt-1 text-sm whitespace-pre-line text-ink-200">
                {application.extraInfo}
              </dd>
            </div>
          ) : null}
        </dl>

        {application.status === "REJECTED" ? (
          <p className="mt-4 text-sm text-ink-400">
            Not approved this time. You are welcome to apply again —{" "}
            <Link
              href={routes.dashboardPages.sellerApplication}
              className="text-brand-300 underline-offset-4 hover:underline"
            >
              start a new application
            </Link>{" "}
            whenever you like.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-100 px-4 py-3">
      <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink-200">{value}</dd>
    </div>
  );
}
