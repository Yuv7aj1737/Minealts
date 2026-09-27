import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-bold text-brand-500/30">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink-100">
        Page not found
      </h1>
      <p className="mt-3 text-pretty text-ink-300">
        That page does not exist or has moved.
      </p>
      <ButtonLink href={routes.home} className="mt-8">
        Back to home
      </ButtonLink>
    </div>
  );
}
