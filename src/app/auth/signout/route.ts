import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST-only sign-out (avoids logout via a cross-site GET link). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
