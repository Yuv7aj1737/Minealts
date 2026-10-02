import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoMark } from "@/components/ui/Logo";
import { getCurrentUser } from "@/lib/auth/session";
import { safeInternalPathOr } from "@/lib/auth/redirects";
import { DEFAULT_POST_LOGIN_REDIRECT, routes } from "@/lib/constants";
import { SupabaseDiscordButton } from "@/components/auth/SupabaseDiscordButton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to MineAlts with your Discord account via Supabase.",
};

const HIGHLIGHTS = [
  {
    title: "No new password",
    description: "Discord authenticates you securely through Supabase.",
  },
  {
    title: "Minimum access",
    description: "We request only standard profile scope — secure and fast.",
  },
  {
    title: "Revocable sessions",
    description: "Sign out from this device at any time and the session dies instantly.",
  },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // Already signed in: skip the form.
  const user = await getCurrentUser();
  const nextPath = safeInternalPathOr(
    typeof params?.next === "string" ? params.next : null,
    DEFAULT_POST_LOGIN_REDIRECT,
  );

  if (user) {
    redirect(nextPath);
  }

  const errorParam = typeof params?.error === "string" ? params.error : null;
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute top-0 left-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-brand-700/20 blur-[120px]" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-8">
        {/* ------------------------------------------------------ Pitch column */}
        <div className="order-2 lg:order-1">
          <span className="text-xs font-bold tracking-[0.2em] text-brand-400 uppercase">
            Sign in
          </span>

          <h1 className="animate-fade-up mt-4 font-display text-3xl font-bold tracking-tight text-balance text-ink-100 sm:text-4xl">
            One click and you are in
          </h1>

          <p className="mt-4 max-w-md text-pretty leading-relaxed text-ink-300">
            MineAlts uses Supabase & Discord OAuth2. You approve the connection on Discord&apos;s own
            site — your credentials never touch this website.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map((item, index) => (
              <li
                key={item.title}
                className="animate-fade-up flex gap-4"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-brand-500/30 bg-brand-500/10 text-xs font-bold text-brand-300"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-100">{item.title}</p>
                  <p className="mt-0.5 text-sm text-ink-400">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* --------------------------------------------------------- Form card */}
        <div className="order-1 lg:order-2">
          <div className="card-sheen animate-fade-up mx-auto w-full max-w-md rounded-3xl border border-surface-300/70 bg-surface-100/85 p-8 shadow-2xl shadow-black/60 backdrop-blur-sm sm:p-10">
            <div className="flex flex-col items-center text-center">
              <LogoMark className="size-14" />

              <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-ink-100">
                Continue to MineAlts
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-ink-400">
                You will be redirected to Discord to approve the connection.
              </p>
            </div>

            {errorParam ? (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm text-brand-200"
              >
                Authentication error occurred. Please try again.
              </div>
            ) : null}

            {!hasSupabaseConfig ? (
              <div
                role="status"
                className="mt-6 rounded-xl border border-accent-400/40 bg-accent-400/10 px-4 py-4 text-sm text-accent-100"
              >
                <p className="font-semibold">Supabase is not configured.</p>
                <p className="mt-1.5 text-accent-100/80">
                  Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                  <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
                  <code className="font-mono text-xs">.env.local</code>.
                </p>
              </div>
            ) : null}

            <div className="mt-8">
              {hasSupabaseConfig ? (
                <SupabaseDiscordButton nextPath={nextPath} />
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-flex h-13 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-surface-200 text-sm font-semibold text-ink-500"
                >
                  Continue with Discord
                </span>
              )}
            </div>

            <p className="mt-6 text-center text-xs leading-relaxed text-ink-500">
              By continuing you agree to let MineAlts sign you in securely via Supabase and Discord.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
