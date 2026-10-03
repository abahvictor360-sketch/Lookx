import { NextResponse } from "next/server";
import { apiError, authenticateApi } from "@/lib/api/auth";
import { serializePhoneLookup } from "@/lib/api/serialize";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/v1/lookups/{id}: a lookup made by the same team. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/lookups/[id]">) {
  const auth = await authenticateApi(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(404, "not_found", "Lookup not found.");

  const { data } = await createAdminClient()
    .from("lookups")
    .select("id, status, risk_level, created_at, raw_results, team_id, type")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.team_id !== auth.teamId || data.type !== "phone") return apiError(404, "not_found", "Lookup not found.");
  return NextResponse.json(serializePhoneLookup(data));
}
