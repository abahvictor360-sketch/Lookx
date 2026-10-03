import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Results are private-by-link; account and admin areas aren't for search engines.
      disallow: ["/result/", "/api/", "/admin", "/dashboard", "/history", "/report", "/payment/", "/login"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
