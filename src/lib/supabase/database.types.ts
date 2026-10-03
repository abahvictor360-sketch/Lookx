/**
 * Database types for the LookX schema (supabase/migrations).
 *
 * Hand-written to match the migration. Once the Supabase project is linked you
 * can regenerate with:
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "user" | "admin";
export type Plan = "free" | "starter" | "pro" | "business";
export type LookupType = "phone" | "image";
export type RiskLevel = "low" | "caution" | "high";
export type ReportCategory =
  | "scam"
  | "fake_vendor"
  | "spam"
  | "harassment"
  | "impersonation";
export type ReportPlatform =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "jiji"
  | "telegram"
  | "phone_call"
  | "sms"
  | "other";
export type ReportStatus = "pending" | "approved" | "rejected" | "disputed";
export type DisputeStatus = "open" | "upheld" | "rejected";
export type TransactionStatus = "pending" | "success" | "failed";
export type LookupStatus = "processing" | "complete" | "failed";
export type LookupBilling = "guest" | "free" | "plan" | "credit";

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          email: string | null;
          full_name: string | null;
          role: Role;
          plan: Plan;
          credits: number;
          banned: boolean;
          created_at: string;
        },
        "id"
      >;
      phone_numbers: Table<
        {
          id: string;
          e164_number: string;
          country: string | null;
          carrier: string | null;
          line_type: string | null;
          report_count: number;
          last_checked_at: string | null;
        },
        "e164_number"
      >;
      images: Table<
        {
          id: string;
          perceptual_hash: string;
          storage_path: string | null;
          expires_at: string | null;
          report_count: number;
        },
        "perceptual_hash"
      >;
      lookups: Table<
        {
          id: string;
          user_id: string | null;
          type: LookupType;
          query_hash: string;
          normalized_query: string | null;
          question: string | null;
          risk_level: RiskLevel | null;
          summary: string | null;
          raw_results: Json;
          status: LookupStatus;
          billing: LookupBilling;
          ip_hash: string | null;
          saved: boolean;
          created_at: string;
        },
        "type" | "query_hash"
      >;
      reports: Table<
        {
          id: string;
          reporter_id: string;
          target_type: LookupType;
          target_id: string;
          category: ReportCategory;
          platform: ReportPlatform;
          description: string;
          evidence_path: string | null;
          status: ReportStatus;
          created_at: string;
        },
        "reporter_id" | "target_type" | "target_id" | "category" | "platform" | "description"
      >;
      disputes: Table<
        {
          id: string;
          report_id: string;
          claimant_phone: string;
          verified: boolean;
          reason: string;
          status: DisputeStatus;
          created_at: string;
        },
        "report_id" | "claimant_phone" | "reason"
      >;
      transactions: Table<
        {
          id: string;
          user_id: string;
          paystack_reference: string;
          amount: number;
          credits_added: number;
          status: TransactionStatus;
          created_at: string;
        },
        "user_id" | "paystack_reference" | "amount"
      >;
      image_questions: Table<
        {
          id: string;
          label: string;
          guidance: string | null;
          active: boolean;
          sort_order: number;
          created_by: string | null;
          created_at: string;
        },
        "label"
      >;
      site_settings: Table<
        {
          id: number;
          allow_custom_image_questions: boolean;
          updated_at: string;
        }
      >;
      image_uploads: Table<
        {
          id: string;
          image_id: string | null;
          lookup_id: string | null;
          storage_path: string;
          expires_at: string;
          deleted_at: string | null;
          created_at: string;
        },
        "storage_path" | "expires_at"
      >;
      rate_limits: Table<
        {
          id: string;
          identifier: string;
          action: string;
          count: number;
          window_start: string;
        },
        "identifier" | "action" | "window_start"
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      start_lookup: {
        Args: {
          p_user_id: string | null;
          p_type: LookupType;
          p_query_hash: string;
          p_normalized_query: string;
          p_ip_hash: string | null;
          p_raw_results: Json;
        };
        Returns: {
          lookup_id: string | null;
          billing: LookupBilling | null;
          error: "no_profile" | "banned" | "no_credits" | null;
        }[];
      };
      match_or_create_image: {
        Args: {
          p_hash: string;
          p_max_distance: number;
          p_storage_path: string;
          p_expires_at: string;
        };
        Returns: { image_id: string; distance: number; is_new: boolean }[];
      };
      merge_lookup_results: {
        Args: { p_id: string; p_patch: Json };
        Returns: undefined;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      hit_rate_limit: {
        Args: {
          p_identifier: string;
          p_action: string;
          p_window_seconds: number;
          p_max: number;
        };
        Returns: {
          allowed: boolean;
          current_count: number;
          window_start: string;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Lookup = Database["public"]["Tables"]["lookups"]["Row"];
export type ImageQuestion = Database["public"]["Tables"]["image_questions"]["Row"];
