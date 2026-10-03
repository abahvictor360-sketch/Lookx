"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

/**
 * Cookieless Vercel Analytics. Result links are private capability URLs, so
 * their ids are stripped before anything is sent; query strings are dropped.
 */
export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        url.search = "";
        url.pathname = url.pathname.replace(/^\/result\/[^/]+/, "/result/[id]");
        return { ...event, url: url.toString() };
      }}
    />
  );
}
