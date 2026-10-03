import "server-only";

/**
 * Server-side environment access.
 *
 * Importing this module from a Client Component fails the build (`server-only`),
 * which guarantees secret keys never end up in the browser bundle.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const serverEnv = {
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  serpApiKey: () => optional("SERPAPI_KEY"),
  braveSearchApiKey: () => optional("BRAVE_SEARCH_API_KEY"),
  abstractPhoneApiKey: () => optional("ABSTRACT_PHONE_API_KEY"),
  twilioAccountSid: () => optional("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: () => optional("TWILIO_AUTH_TOKEN"),
  tineyeApiKey: () => optional("TINEYE_API_KEY"),
  paystackSecretKey: () => required("PAYSTACK_SECRET_KEY"),
  hashSecret: () => required("LOOKX_HASH_SECRET"),
};
