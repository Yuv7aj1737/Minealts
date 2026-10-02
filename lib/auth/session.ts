import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { AuthSession, AuthUser } from "@/types/auth";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component
          }
        },
      },
    }
  );
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    return {
      id: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || "User",
      avatarUrl: user.user_metadata?.avatar_url || "",
    } as unknown as AuthUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session || !session.user) return null;

    const user: AuthUser = {
      id: session.user.id,
      name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || "User",
      avatarUrl: session.user.user_metadata?.avatar_url || "",
    } as unknown as AuthUser;

    return {
      user,
      accessToken: session.access_token,
      expiresAt: new Date((session.expires_at || Math.floor(Date.now() / 1000) + 3600) * 1000),
    } as unknown as AuthSession;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore signout errors
  }
}
