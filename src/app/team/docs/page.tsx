import type { Metadata } from "next";
import Link from "next/link";
import { publicEnv } from "@/lib/public-env";
import { requireTeam, MAX_BULK } from "@/lib/teams/server";
import { API_RATE_PER_MINUTE } from "@/lib/api/auth";

export const metadata: Metadata = { title: "API docs", robots: { index: false } };

function Code({ children }: { children: string }) {
  return <pre className="mt-2 overflow-x-auto rounded-xl bg-forest-900 p-4 text-xs leading-relaxed text-white/90"><code>{children}</code></pre>;
}

export default async function ApiDocsPage() {
  const { team } = await requireTeam();
  const base = `${publicEnv.siteUrl.replace(/\/$/, "")}/api/v1`;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/team" className="text-sm font-semibold text-brand underline">← {team.name}</Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">LookX API</h1>
      <p className="mt-2 text-ink-muted">
        Check phone numbers from your own systems. Requests are billed to your team like lookups in the app. Create
        keys on the <Link href="/team" className="font-semibold text-brand underline">team page</Link>, and never put
        them in browser or mobile app code.
      </p>

      <h2 className="mt-8 text-xl font-bold">Authentication</h2>
      <p className="mt-2 text-sm text-ink-muted">Send your key in the <code>Authorization</code> header. Each key can make {API_RATE_PER_MINUTE} requests a minute.</p>
      <Code>{`Authorization: Bearer lx_live_...`}</Code>

      <h2 className="mt-8 text-xl font-bold">Look up a number</h2>
      <p className="mt-2 text-sm text-ink-muted">
        <code>POST /lookups/phone</code>. Waits for the full result (usually under 10 seconds). Pass <code>&quot;wait&quot;: false</code> to
        return immediately with status <code>processing</code>, then poll <code>GET /lookups/{"{id}"}</code>. A <code>202</code> means it&apos;s still processing.
      </p>
      <Code>{`curl -X POST ${base}/lookups/phone \\
  -H "Authorization: Bearer $LOOKX_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "08031234567"}'`}</Code>
      <Code>{`{
  "id": "6f1c…",
  "type": "phone",
  "status": "complete",
  "result_url": "https://…/result/6f1c…",
  "number": { "e164": "+2348031234567", "formatted": "+234 803 123 4567",
              "country": "NG", "network": "MTN", "network_source": "prefix", "line_type": "mobile" },
  "risk": { "level": "caution", "score": 35, "headline": "1 community report describing fake vendor",
            "reasons": ["1 community report describing fake vendor"], "disclaimer": "Risk indicator, not a verdict." },
  "summary": "This number appears in 1 LookX community report…",
  "reports": { "total": 1, "disputed": 0, "by_category": { "fake_vendor": 1 }, "recent_14_days": 1 },
  "web_mentions": { "status": "ok", "results": [ { "title": "…", "url": "…", "domain": "…", "date": null, "scam_keywords": false } ] }
}`}</Code>

      <h2 className="mt-8 text-xl font-bold">Bulk lookups</h2>
      <p className="mt-2 text-sm text-ink-muted">
        <code>POST /bulk</code> with up to {MAX_BULK} unique numbers. Returns a job id at once; poll <code>GET /bulk/{"{id}"}</code> until
        <code> status</code> is <code>complete</code>. If the team runs out of lookups, remaining numbers are listed in <code>rejected</code>.
      </p>
      <Code>{`curl -X POST ${base}/bulk \\
  -H "Authorization: Bearer $LOOKX_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"label": "New riders", "phones": ["08031234567", "+2348051112222"]}'

curl ${base}/bulk/JOB_ID -H "Authorization: Bearer $LOOKX_API_KEY"`}</Code>

      <h2 className="mt-8 text-xl font-bold">Errors</h2>
      <p className="mt-2 text-sm text-ink-muted">Errors look like <code>{`{"error": {"code": "…", "message": "…"}}`}</code>.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        <li><code>400 invalid_request</code> / <code>invalid_phone</code>: bad input</li>
        <li><code>401 unauthorized</code>: missing, invalid or revoked key</li>
        <li><code>402 no_credits</code>: the team&apos;s allowance and credits are used up</li>
        <li><code>403 team_inactive</code>: the business account is inactive</li>
        <li><code>429 rate_limited</code>: slow down</li>
      </ul>

      <h2 className="mt-8 text-xl font-bold">Acceptable use</h2>
      <p className="mt-2 text-sm text-ink-muted">
        The API is for verifying customers, agents, riders and vendors. It must not be used to track or locate
        people. Results are a risk indicator, not a verdict. See the <Link href="/legal/terms" className="text-brand underline">terms</Link>.
      </p>
    </div>
  );
}
