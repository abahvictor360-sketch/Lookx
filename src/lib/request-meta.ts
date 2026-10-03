import "server-only";

import { cookies, headers } from "next/headers";

export const DEVICE_COOKIE = "lx_did";

/** Best-effort client IP. Vercel sets x-forwarded-for / x-real-ip. */
export async function getClientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/**
 * Stable per-browser device id stored in an httpOnly cookie. Combined with the
 * IP for guest limits: clearing cookies alone or switching networks alone
 * doesn't reset the counter.
 */
export async function getOrCreateDeviceId() {
  const store = await cookies();
  let id = store.get(DEVICE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = crypto.randomUUID();
    store.set(DEVICE_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return id;
}
