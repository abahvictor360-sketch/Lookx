import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Acts as the signed-in user (anon key + session cookie), so RLS applies.
 * Create a new client per request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: the proxy refreshes the session cookie.
          }
        },
      },
    },
  );
}

/** Returns the verified current user and their profile, or nulls for guests. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}
