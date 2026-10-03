import { NextResponse } from "next/server";
import { getPublicLookup } from "@/lib/lookup/public";

/** GET /api/lookup/[id]: polled by the results page while sections stream in. */
export async function GET(_request: Request, ctx: RouteContext<"/api/lookup/[id]">) {
  const { id } = await ctx.params;
  const lookup = await getPublicLookup(id);
  if (!lookup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lookup, { headers: { "Cache-Control": "no-store" } });
}
