/**
 * Only allow same-site relative paths as post-login redirects, to prevent
 * open-redirect attacks (e.g. ?next=https://evil.example or //evil.example).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
