"use client";

import { createBrowserClient } from "@supabase/ssr";
import { DiscordIcon } from "@/components/auth/DiscordIcon";

export function SupabaseDiscordButton({ nextPath }: { nextPath: string }) {
  const handleLogin = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}${nextPath}`,
      },
    });
  };

  return (
    <button
      onClick={handleLogin}
      className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] text-sm font-semibold text-white transition-colors hover:bg-[#4752C4]"
    >
      <DiscordIcon className="size-5" />
      Continue with Discord
    </button>
  );
}
