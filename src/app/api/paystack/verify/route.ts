import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfillReference } from "@/lib/payments/fulfill";

/**
 * GET /api/paystack/verify?reference=...
 * Called after the popup reports success (or on the redirect callback page),
 * so the user sees their credits straight away. The webhook applies the same
 * payment independently; fulfill_payment makes it apply only once.
 */
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference") ?? "";
  if (!/^lx_(starter|pro)_[0-9a-f]{32}$/.test(reference)) {
    return NextResponse.json({ error: "Invalid reference." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const { data: tx } = await createAdminClient()
    .from("transactions")
    .select("user_id, status")
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (!tx || tx.user_id !== user.id) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (tx.status === "success") return NextResponse.json({ status: "success" });

  try {
    const result = await fulfillReference(reference);
    const ok = result.status === "applied" || result.status === "already_applied";
    return NextResponse.json({ status: ok ? "success" : result.status });
  } catch (e) {
    console.error("[paystack] verify failed", (e as Error).message);
    return NextResponse.json({ status: "pending" });
  }
}
