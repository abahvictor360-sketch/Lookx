import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ saved: z.boolean() });

/** POST /api/lookup/[id]/save { saved } — owners only (enforced by RLS). */
export async function POST(request: Request, ctx: RouteContext<"/api/lookup/[id]/save">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save results." }, { status: 401 });

  const { data, error } = await supabase
    .from("lookups")
    .update({ saved: parsed.data.saved })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Couldn't save this result." }, { status: 404 });
  return NextResponse.json({ saved: parsed.data.saved });
}
