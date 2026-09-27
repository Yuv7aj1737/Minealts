import Link from "next/link";

import { DiscordButton } from "@/components/auth/DiscordButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section, SectionHeading } from "@/components/layout/Container";
import { marketplaceFeatures, roadmapFeatures, routes } from "@/lib/constants";

const ICONS = [
  "M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z", // bolt
  "M12 2 4 6v6c0 5 3.4 9.7 8 10 4.6-.3 8-5 8-10V6l-8-4Z", // shield
  "M3 7h18v11H3V7Zm2 2v7h14V9H5Z", // card
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z", // globe
] as const;

export default function HomePage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute top-1/4 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand-700/20 blur-[120px] animate-pulse-glow" />
        </div>

        <Container className="py-20 sm:py-28 lg:py-32">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <Badge tone="brand" className="animate-fade-in">
              Launching soon
            </Badge>

            <h1
              className="animate-fade-up mt-6 font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance text-ink-100 sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "80ms" }}
            >
              Minecraft trading,
              <br />
              <span className="from-brand-300 via-brand-500 to-accent-400 bg-linear-to-r bg-clip-text text-transparent">
                without the risk
              </span>
            </h1>

            <p
              className="animate-fade-up mt-6 max-w-2xl text-base leading-relaxed text-pretty text-ink-300 sm:text-lg"
              style={{ animationDelay: "160ms" }}
            >
              A marketplace for alt accounts, server slots and boosts — with verified
              sellers, tracked delivery and payouts that release only when the sale is
              done.
            </p>

            <div
              className="animate-fade-up mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
              style={{ animationDelay: "240ms" }}
            >
              <DiscordButton next="/dashboard" className="w-full sm:w-auto" />
              <ButtonLink href={routes.marketplace} variant="primary" size="lg" className="w-full sm:w-auto">
                Browse the marketplace
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="outline" size="lg" className="w-full sm:w-auto">
                How it works
              </ButtonLink>
            </div>

            <p
              className="animate-fade-up mt-4 text-xs text-ink-500"
              style={{ animationDelay: "320ms" }}
            >
              Sign in with Discord. We never ask for your Discord password.
            </p>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------- How it works */}
      <Section id="how-it-works" className="scroll-mt-24">
        <Container>
          <SectionHeading
            eyebrow="Why MineAlts"
            title="Built for people who got scammed"
            description="Every part of the flow is designed so that neither side has to take the other on faith."
          />

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {marketplaceFeatures.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>
        </Container>
      </Section>

      {/* ------------------------------------------------------------ Roadmap */}
      <Section id="roadmap" className="scroll-mt-24">
        <Container>
          <div className="card-sheen overflow-hidden rounded-3xl border border-surface-300/70 bg-surface-100/60 p-8 sm:p-12">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <SectionHeading
                align="left"
                eyebrow="Roadmap"
                title="What is live, and what is next"
                description="Accounts, sellers, the marketplace and the owner panel are built. Checkout, delivery and payouts are what remains."
                className="mx-0"
              />

              <ul className="grid gap-3 sm:grid-cols-2">
                {roadmapFeatures.map(({ item, shipped }) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-xl border border-surface-300/70 bg-surface-200/50 px-4 py-3 text-sm text-ink-200"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        shipped
                          ? "grid size-5 shrink-0 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold text-emerald-300"
                          : "grid size-5 shrink-0 place-items-center rounded-full border border-accent-400/40 bg-accent-400/10 text-[10px] font-bold text-accent-300"
                      }
                    >
                      {shipped ? "✓" : "○"}
                    </span>
                    <span className={shipped ? "" : "text-ink-300"}>{item}</span>
                    <span className="sr-only">{shipped ? "(live)" : "(not yet)"}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10 flex flex-col items-start gap-3 border-t border-surface-300/70 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-400">
                Want early access? Create your account now and your role follows you
                through the launch.
              </p>
              <DiscordButton size="md" next="/dashboard" />
            </div>
          </div>
        </Container>
      </Section>

      {/* --------------------------------------------------------------- CTA */}
      <Section className="pt-0">
        <Container>
          <div className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-linear-to-b from-brand-900/40 to-surface-100 px-6 py-14 text-center sm:px-12">
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance text-ink-100 sm:text-4xl">
              Your account takes one click
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-ink-300">
              No forms, no passwords, no waiting for approval. Your Discord profile
              becomes your marketplace profile.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <DiscordButton next="/dashboard" />
              <ButtonLink href="/login" variant="outline" size="lg">
                Go to login
              </ButtonLink>
            </div>
            <p className="mt-6 text-xs text-ink-500">
              Already have an account?{" "}
              <Link href="/login" className="text-brand-300 underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}

function FeatureCard({
  title,
  description,
  index,
}: {
  title: string;
  description: string;
  index: number;
}) {
  return (
    <article
      className="card-sheen animate-fade-up group rounded-2xl border border-surface-300/70 bg-surface-100/80 p-6 shadow-xl shadow-black/40 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-brand-500/50"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="grid size-11 place-items-center rounded-xl border border-brand-500/25 bg-brand-500/10 text-brand-300 transition-colors duration-200 group-hover:border-accent-400/40 group-hover:text-accent-300">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="size-5.5"
        >
          <path d={ICONS[index % ICONS.length]} />
        </svg>
      </div>

      <h3 className="mt-5 font-display text-lg font-semibold text-ink-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">{description}</p>
    </article>
  );
}
