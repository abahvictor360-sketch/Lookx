import "server-only";

import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * For admin pages and actions. Non-admins get a 404 so the admin area isn't
 * advertised. RLS enforces the same rule again at the database.
 */
export async function requireAdmin() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (profile?.role !== "admin") notFound();
  return { user, profile };
}
