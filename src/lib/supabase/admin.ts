import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";
import { serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client. BYPASSES RLS.
 * Only use inside server routes after you have authorised the request yourself.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
