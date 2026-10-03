import "server-only";

import dns from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch } from "undici";
import { MAX_IMAGE_BYTES } from "@/lib/lookup/detect";
import { ImageInputError } from "./decode";
import { isPrivateIp } from "./ip";

/**
 * Fetch a user-supplied image URL safely (SSRF protection):
 * - http(s) only, standard ports
 * - every hop's hostname must resolve to public IPs (no localhost, private
 *   ranges, link-local / cloud metadata)
 * - the IP is re-checked at connect time (undici lookup hook), so DNS
 *   rebinding between our check and the request can't reach private hosts
 * - redirects followed manually (max 3) and re-validated
 * - 10MB cap enforced while streaming, 8s timeout
 */

const MAX_REDIRECTS = 3;

/** Connection-time guard: refuse to open sockets to private addresses. */
const publicOnlyAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, "", 4);
        const list = addresses as dns.LookupAddress[];
        const blocked = list.length === 0 || list.some((a) => isPrivateIp(a.address));
        if (blocked) return callback(new Error("Blocked private address"), "", 4);
        callback(null, list[0].address, list[0].family);
      });
    },
  },
});
const TIMEOUT_MS = 8000;

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImageInputError("That image link isn't valid.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ImageInputError("Image links must start with http:// or https://.");
  }
  if (url.username || url.password) throw new ImageInputError("That image link isn't allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new ImageInputError("That image link isn't allowed.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new ImageInputError("We couldn't reach that image link.");
      });
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new ImageInputError("That image link isn't allowed.");
  }
  return url;
}

export async function fetchImageFromUrl(raw: string): Promise<{ buffer: Buffer; domain: string }> {
  let url = await assertPublicUrl(raw);
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(url, {
        dispatcher: publicOnlyAgent,
        redirect: "manual",
        signal,
        headers: { "User-Agent": "LookXBot/1.0 (+https://lookx.app)", Accept: "image/*" },
      });
    } catch {
      throw new ImageInputError("We couldn't download that image.");
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok || !res.body) throw new ImageInputError("We couldn't download that image.");

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES) throw new ImageInputError("Images must be 10MB or smaller.");

    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new ImageInputError("Images must be 10MB or smaller.");
      }
      chunks.push(value);
    }
    return { buffer: Buffer.concat(chunks), domain: url.hostname.replace(/^www\./, "") };
  }
  throw new ImageInputError("That image link redirects too many times.");
}
