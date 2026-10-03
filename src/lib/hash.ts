import "server-only";

import { createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Keyed hash (HMAC-SHA256) for values we must not store in plain text:
 * search queries, IP addresses and device ids. Keyed so the hashes can't be
 * reversed by brute-forcing the small space of phone numbers.
 */
export function hashValue(namespace: string, value: string) {
  return createHmac("sha256", serverEnv.hashSecret())
    .update(`${namespace}:${value}`)
    .digest("hex");
}
