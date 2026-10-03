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
export type LookupBilling = "guest" | "free" | "plan" | "credit" | "team";
export type TeamRole = "owner" | "admin" | "member";

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
          plan_expires_at: string | null;
          paystack_customer_code: string | null;
          paystack_subscription_code: string | null;
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
          image_id: string | null;
          team_id: string | null;
          api_key_id: string | null;
          bulk_job_id: string | null;
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
          moderated_by: string | null;
          moderated_at: string | null;
          moderation_note: string | null;
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
          resolved_by: string | null;
          resolved_at: string | null;
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
          product: "starter" | "pro";
          currency: string;
          paid_at: string | null;
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
      dispute_verifications: Table<
        {
          id: string;
          phone_e164: string;
          report_ids: string[];
          reason: string;
          provider: "twilio" | "dev";
          code_hash: string | null;
          attempts: number;
          expires_at: string;
          verified_at: string | null;
          ip_hash: string | null;
          created_at: string;
        },
        "phone_e164" | "report_ids" | "reason" | "provider" | "expires_at"
      >;
      data_requests: Table<
        {
          id: string;
          email: string;
          phone_e164: string | null;
          request_type: "access" | "deletion" | "correction" | "review_reports" | "objection" | "other";
          details: string;
          status: "open" | "in_progress" | "closed";
          admin_note: string | null;
          handled_by: string | null;
          handled_at: string | null;
          ip_hash: string | null;
          created_at: string;
        },
        "email" | "request_type" | "details"
      >;
      teams: Table<
        {
          id: string;
          name: string;
          owner_id: string;
          active: boolean;
          seats: number;
          monthly_allowance: number;
          credits: number;
          created_at: string;
        },
        "name" | "owner_id"
      >;
      team_members: Table<
        { team_id: string; user_id: string; role: TeamRole; created_at: string },
        "team_id" | "user_id"
      >;
      team_invites: Table<
        {
          id: string;
          team_id: string;
          email: string;
          role: "admin" | "member";
          token_hash: string;
          created_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        },
        "team_id" | "email" | "token_hash" | "expires_at"
      >;
      api_keys: Table<
        {
          id: string;
          team_id: string;
          name: string;
          prefix: string;
          key_hash: string;
          created_by: string | null;
          last_used_at: string | null;
          revoked_at: string | null;
          created_at: string;
        },
        "team_id" | "name" | "prefix" | "key_hash"
      >;
      bulk_jobs: Table<
        {
          id: string;
          team_id: string;
          created_by: string | null;
          api_key_id: string | null;
          label: string | null;
          total: number;
          created_at: string;
        },
        "team_id"
      >;
      credit_adjustments: Table<
        {
          id: string;
          user_id: string | null;
          team_id: string | null;
          amount: number;
          applied: number;
          balance: number;
          reason: string;
          admin_id: string | null;
          created_at: string;
        },
        "amount" | "applied" | "balance" | "reason"
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
          p_team_id?: string | null;
        };
        Returns: {
          lookup_id: string | null;
          billing: LookupBilling | null;
          error: "no_profile" | "banned" | "no_credits" | "team_inactive" | null;
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
      bump_dispute_attempt: { Args: { p_id: string }; Returns: number | null };
      fulfill_payment: {
        Args: { p_reference: string; p_amount: number; p_currency: string; p_customer_code: string | null };
        Returns: { ok: boolean; already_applied: boolean; user_id: string | null; product: "starter" | "pro" | null }[];
      };
      record_pro_renewal: {
        Args: { p_reference: string; p_amount: number; p_currency: string; p_customer_code: string };
        Returns: { ok: boolean; already_applied: boolean; user_id: string | null }[];
      };
      my_usage_this_month: {
        Args: Record<string, never>;
        Returns: { free_phone: number; free_image: number; plan_used: number; credit_used: number }[];
      };
      admin_stats: { Args: Record<string, never>; Returns: Json };
      flagged_users: {
        Args: Record<string, never>;
        Returns: { user_id: string; email: string | null; reason: string; metric: number; banned: boolean; created_at: string }[];
      };
      accept_team_invite: {
        Args: { p_token_hash: string; p_user_id: string; p_email: string };
        Returns: { ok: boolean; error: "invalid" | "wrong_email" | "already_in_team" | "no_seats" | null; team_id: string | null }[];
      };
      admin_adjust_credits: {
        Args: { p_admin_id: string; p_user_id: string | null; p_team_id: string | null; p_amount: number; p_reason: string };
        Returns: { ok: boolean; applied: number; balance: number }[];
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
export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type Dispute = Database["public"]["Tables"]["disputes"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type DataRequest = Database["public"]["Tables"]["data_requests"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type ApiKey = Database["public"]["Tables"]["api_keys"]["Row"];
