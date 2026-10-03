/**
 * Public (browser-safe) environment variables. Next.js inlines NEXT_PUBLIC_*
 * values at build time, so they must be referenced literally.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  paystackPublicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "",
  /** Where business enquiries and privacy requests are sent. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
};

/** True when Supabase is configured; lets the UI degrade gracefully in dev. */
export const isSupabaseConfigured = Boolean(
  publicEnv.supabaseUrl && publicEnv.supabaseAnonKey,
);
