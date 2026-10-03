import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

/** Public, indexable pages only. Results, history and account pages are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/dispute`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/data-request`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
