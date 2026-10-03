"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "./database.types";

/** Supabase client for Client Components. Uses the public anon key + RLS. */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  );
}
