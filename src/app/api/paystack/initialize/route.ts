import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/lib/env";
import { publicEnv } from "@/lib/public-env";
import { PRODUCTS } from "@/lib/plans";
import { initializeTransaction } from "@/lib/payments/paystack";

const Body = z.object({ product: z.enum(["starter", "pro"]) });

/**
 * POST /api/paystack/initialize { product }
 * Prices are decided here, never by the browser. Creates a pending
 * transaction, initializes it with Paystack and returns the access code for
 * the inline checkout popup.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Sign in to buy credits." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });
  if (!(await hitRateLimit(`user:${user.id}`, "checkout", 3600, 20))) {
    return NextResponse.json({ error: "Too many checkout attempts. Please try again later." }, { status: 429 });
  }

  const product = PRODUCTS[parsed.data.product];
  const reference = `lx_${parsed.data.product}_${crypto.randomUUID().replace(/-/g, "")}`;
  const db = createAdminClient();
  const { error } = await db.from("transactions").insert({
    user_id: user.id,
    paystack_reference: reference,
    amount: product.amountKobo,
    credits_added: product.credits,
    product: parsed.data.product,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });

  try {
    const proPlan = parsed.data.product === "pro" ? serverEnv.paystackProPlanCode() : undefined;
    const init = await initializeTransaction({
      email: user.email,
      amountKobo: product.amountKobo,
      reference,
      callbackUrl: `${publicEnv.siteUrl}/payment/callback`,
      plan: proPlan,
      metadata: { user_id: user.id, product: parsed.data.product },
    });
    return NextResponse.json({ access_code: init.access_code, reference, authorization_url: init.authorization_url });
  } catch (e) {
    console.error("[paystack] initialize failed", (e as Error).message);
    await db.from("transactions").update({ status: "failed" }).eq("paystack_reference", reference);
    return NextResponse.json({ error: "Payments are unavailable right now. Please try again later." }, { status: 502 });
  }
}
