import "server-only";

import { randomInt, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { hashValue } from "@/lib/hash";

/**
 * Phone OTP for the dispute flow.
 *
 * Production: Twilio Verify (sends the SMS, generates and checks the code).
 * Development only: a local 6-digit code printed to the server log, with just
 * its HMAC stored. The dev provider is never used when NODE_ENV=production.
 */

export class OtpUnavailableError extends Error {}

export type OtpProvider = "twilio" | "dev";

function twilioConfig() {
  const sid = serverEnv.twilioAccountSid();
  const token = serverEnv.twilioAuthToken();
  const service = serverEnv.twilioVerifyServiceSid();
  return sid && token && service ? { sid, token, service } : null;
}

export function activeOtpProvider(): OtpProvider {
  if (twilioConfig()) return "twilio";
  if (process.env.NODE_ENV !== "production") return "dev";
  throw new OtpUnavailableError("Phone verification is not configured");
}

async function twilio(path: string, body: Record<string, string>) {
  const cfg = twilioConfig()!;
  const res = await fetch(`https://verify.twilio.com/v2/Services/${cfg.service}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
  return { ok: res.ok, status: data.status, message: data.message };
}

/** Send a code. Returns the HMAC to store for the dev provider (null for Twilio). */
export async function sendOtp(provider: OtpProvider, phone: string): Promise<{ codeHash: string | null }> {
  if (provider === "twilio") {
    const r = await twilio("Verifications", { To: phone, Channel: "sms" });
    if (!r.ok) throw new Error(`Twilio Verify send failed: ${r.message ?? "unknown"}`);
    return { codeHash: null };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  console.info(`[otp:dev] Code for ${phone}: ${code} (development only)`);
  return { codeHash: hashValue("otp", `${phone}:${code}`) };
}

export async function checkOtp(
  provider: OtpProvider,
  phone: string,
  code: string,
  codeHash: string | null,
): Promise<boolean> {
  if (!/^\d{4,8}$/.test(code)) return false;
  if (provider === "twilio") {
    const r = await twilio("VerificationCheck", { To: phone, Code: code });
    return r.ok && r.status === "approved";
  }
  if (!codeHash) return false;
  const given = Buffer.from(hashValue("otp", `${phone}:${code}`));
  const expected = Buffer.from(codeHash);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
