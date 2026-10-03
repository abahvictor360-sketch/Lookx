import type { ReportCategory, ReportPlatform } from "@/lib/supabase/database.types";

/** Labels shared by the report form, results pages and moderation queue. */
export const REPORT_CATEGORIES: { value: ReportCategory; label: string; hint: string }[] = [
  { value: "scam", label: "Scam", hint: "Took money or tried to, e.g. advance payment, fake investment" },
  { value: "fake_vendor", label: "Fake vendor", hint: "Sold something that never arrived or wasn't as described" },
  { value: "impersonation", label: "Impersonation", hint: "Pretended to be someone else, a company, bank or official" },
  { value: "spam", label: "Spam", hint: "Unwanted promotional calls or messages" },
  { value: "harassment", label: "Harassment", hint: "Threats, abuse or repeated unwanted contact" },
];

export const REPORT_PLATFORMS: { value: ReportPlatform; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "jiji", label: "Jiji" },
  { value: "telegram", label: "Telegram" },
  { value: "phone_call", label: "Phone call" },
  { value: "sms", label: "SMS" },
  { value: "other", label: "Other" },
];

export const MAX_DESCRIPTION = 500;
export const MIN_DESCRIPTION = 20;
/** Evidence screenshots are downscaled in the browser; this is the server cap. */
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

/**
 * Reports from accounts that aren't yet trusted are held for moderation.
 * Trusted = account at least TRUST_MIN_ACCOUNT_DAYS old, at least one approved
 * report, and no rejected reports in the last TRUST_REJECTION_WINDOW_DAYS.
 */
export const TRUST_MIN_ACCOUNT_DAYS = 7;
export const TRUST_REJECTION_WINDOW_DAYS = 90;
