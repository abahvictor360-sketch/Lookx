import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { scorePhone } from "@/lib/risk/phone";
import { summarizePhoneLookup } from "@/lib/ai/summarize-phone";
import { enrichNumberDetails } from "./providers";
import { searchWebForNumber } from "./web-search";
import type { NumberDetails, PhoneResults, ReportsSection, WebSection } from "./types";

const WEB_CACHE_HOURS = 24;
const RECENT_DAYS = 14;

type Admin = ReturnType<typeof createAdminClient>;

async function merge(db: Admin, id: string, patch: Partial<PhoneResults>) {
  const { error } = await db.rpc("merge_lookup_results", { p_id: id, p_patch: patch as Json });
  if (error) console.error("[lookup] merge failed", error.message);
}

/** Upsert the phone_numbers row and return its id (used to match reports). */
async function upsertPhoneNumber(db: Admin, details: NumberDetails) {
  const { data, error } = await db
    .from("phone_numbers")
    .upsert(
      {
        e164_number: details.e164,
        country: details.country,
        carrier: details.carrier,
        line_type: details.lineType,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "e164_number" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function getReports(db: Admin, phoneId: string): Promise<ReportsSection> {
  const { data, error } = await db
    .from("reports")
    .select("category, platform, description, created_at")
    .eq("target_type", "phone")
    .eq("target_id", phoneId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const since = Date.now() - RECENT_DAYS * 86_400_000;
  const byCategory: ReportsSection["byCategory"] = {};
  for (const r of data) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;

  return {
    total: data.length,
    byCategory,
    recentCount: data.filter((r) => Date.parse(r.created_at) >= since).length,
    // Reporter identities are never selected, so they can't leak.
    recent: data.slice(0, 3).map((r) => ({
      category: r.category,
      platform: r.platform,
      excerpt: r.description.length > 220 ? `${r.description.slice(0, 217)}…` : r.description,
      created_at: r.created_at,
    })),
  };
}

/** Reuse web results from a lookup of the same number in the last 24h (saves API cost). */
async function cachedWeb(db: Admin, lookupId: string, queryHash: string): Promise<WebSection | null> {
  const since = new Date(Date.now() - WEB_CACHE_HOURS * 3_600_000).toISOString();
  const { data } = await db
    .from("lookups")
    .select("raw_results")
    .eq("query_hash", queryHash)
    .eq("status", "complete")
    .neq("id", lookupId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const web = (data?.raw_results as PhoneResults | undefined)?.web;
  return web?.status === "ok" ? web : null;
}

/**
 * Runs after the POST response is sent. Each section is merged into
 * lookups.raw_results as soon as it is ready, so the results page can render
 * progressively: details -> web + reports -> risk -> AI summary.
 */
export async function runPhonePipeline(lookupId: string, queryHash: string, basic: NumberDetails) {
  const db = createAdminClient();
  try {
    const [number, web, reports] = await Promise.all([
      enrichNumberDetails(basic).then(async (n) => {
        if (n !== basic) await merge(db, lookupId, { number: n });
        return n;
      }),
      cachedWeb(db, lookupId, queryHash)
        .then((c) => c ?? searchWebForNumber(basic))
        .then(async (w) => {
          await merge(db, lookupId, { web: w });
          return w;
        }),
      upsertPhoneNumber(db, basic)
        .then((id) => getReports(db, id))
        .then(async (r) => {
          await merge(db, lookupId, { reports: r });
          return r;
        }),
    ]);

    const risk = scorePhone({ lineType: number.lineType, reports, web });
    await merge(db, lookupId, { risk });

    const ai = await summarizePhoneLookup({ number, reports, web, risk });
    await merge(db, lookupId, { ai });

    await db
      .from("lookups")
      .update({ status: "complete", risk_level: risk.level, summary: ai.summary })
      .eq("id", lookupId);
  } catch (error) {
    console.error("[lookup] phone pipeline failed", error);
    await db.from("lookups").update({ status: "failed" }).eq("id", lookupId);
  }
}
