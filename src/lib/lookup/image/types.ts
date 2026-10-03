import type { AiSection, ReportsSection, RiskSection } from "@/lib/lookup/phone/types";

export type Likelihood = "low" | "medium" | "high" | "unknown";

export type ImageInfo = {
  /** Path inside the private `lookup-images` bucket (deleted after 24h). */
  storagePath: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  bytes: number;
  source: "upload" | "url";
  /** Domain the image link pointed at, when looked up by URL. */
  sourceDomain: string | null;
  expiresAt: string;
};

export type ImageMetadata = {
  found: boolean;
  camera: string | null;
  takenAt: string | null;
  software: string | null;
  /**
   * Whether the file carries GPS coordinates. We deliberately never store or
   * show the coordinates: LookX must not help locate people.
   */
  hasGps: boolean;
};

export type ImageMatch = { title: string; url: string; date: string | null };

export type MatchGroup = {
  domain: string;
  /** Social network or dating site, where a photo usually represents a person. */
  isProfileSite: boolean;
  matches: ImageMatch[];
};

export type MatchesSection = {
  status: "ok" | "not_configured" | "error";
  providers: ("google_lens" | "tineye")[];
  total: number;
  groups: MatchGroup[];
  possibleStolen: { flag: boolean; reason: string | null };
};

export type AuthenticitySection = {
  status: "ok" | "not_configured" | "error";
  aiGenerated: { level: Likelihood; note: string };
  edited: { level: Likelihood; note: string };
  stockOrCatalog: { level: Likelihood; note: string };
  /** Watermarks, usernames or handles visible in the image. */
  visibleText: string[];
};

export type ImageAiSection = AiSection & {
  /** Answer to the user's question, when one was asked. */
  answer: string | null;
};

/** Shape of lookups.raw_results for image lookups. Sections appear as they finish. */
export type ImageResults = {
  image: ImageInfo;
  question: { label: string; source: "preset" | "custom" } | null;
  metadata: ImageMetadata;
  matches?: MatchesSection;
  reports?: ReportsSection;
  authenticity?: AuthenticitySection;
  risk?: RiskSection;
  ai?: ImageAiSection;
};
