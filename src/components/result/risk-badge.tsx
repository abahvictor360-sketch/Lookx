import type { RiskLevel } from "@/lib/supabase/database.types";

const STYLES: Record<RiskLevel, { label: string; cls: string; icon: React.ReactNode }> = {
  low: {
    label: "Low risk",
    cls: "bg-risk-low-bg text-risk-low ring-risk-low/30",
    icon: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  },
  caution: {
    label: "Caution",
    cls: "bg-risk-caution-bg text-risk-caution ring-risk-caution/30",
    icon: <><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4.5M12 17.2v.1" /></>,
  },
  high: {
    label: "High risk",
    cls: "bg-risk-high-bg text-risk-high ring-risk-high/30",
    icon: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16.2v.1" /></>,
  },
};

/** Colour + icon + text, so risk is never conveyed by colour alone. */
export function RiskBadge({ level, size = "md" }: { level: RiskLevel; size?: "sm" | "md" }) {
  const s = STYLES[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ring-1 ${s.cls} ${
        size === "md" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      <svg viewBox="0 0 24 24" className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {s.icon}
      </svg>
      {s.label}
    </span>
  );
}
