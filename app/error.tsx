"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side details are logged by the route that threw; the browser only
    // gets a digest so nothing sensitive reaches the client console.
    console.error("[app] unhandled error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <span className="text-xs font-bold tracking-[0.2em] text-brand-400 uppercase">
        Error
      </span>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink-100">
        Something broke
      </h1>
      <p className="mt-3 text-pretty text-ink-300">
        An unexpected error occurred while rendering this page. Try again, and if it
        keeps happening check the server logs.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-ink-500">digest: {error.digest}</p>
      ) : null}
      <Button onClick={reset} className="mt-8">
        Try again
      </Button>
    </div>
  );
}
