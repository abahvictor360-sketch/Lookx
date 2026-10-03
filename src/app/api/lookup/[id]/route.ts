import { NextResponse } from "next/server";
import { getPublicLookup } from "@/lib/lookup/public";
import { hashValue } from "@/lib/hash";
import { hitRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";

/** GET /api/lookup/[id]: polled by the results page while sections stream in. */
export async function GET(_request: Request, ctx: RouteContext<"/api/lookup/[id]">) {
  const { id } = await ctx.params;
  // Generous: the results page polls once a second while sections load.
  if (!(await hitRateLimit(hashValue("ip", await getClientIp()), "result_poll", 60, 240))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const lookup = await getPublicLookup(id);
  if (!lookup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lookup, { headers: { "Cache-Control": "no-store" } });
}
