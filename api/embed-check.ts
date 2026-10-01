import type { VercelRequest, VercelResponse } from "@vercel/node";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";

export function publicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === "unicast"; }
  catch { return false; }
}

/** Validate every DNS answer, then connect only to that pinned address.
 * The original hostname is retained for TLS certificate/SNI validation. */
export async function probeHeaders(url: URL): Promise<{ status: number; headers: Headers }> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const signal = AbortSignal.timeout(5000);
  const addresses = await Promise.race([
    lookup(hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true })),
  ]);
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
    throw new Error("Blocked address");
  }
  const chosen = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "HEAD", agent: false, signal,
      // An explicit family prevents automatic selection/re-resolution.
      family: chosen.family,
      lookup: (_hostname, _options, callback) => callback(null, chosen.address, chosen.family),
      headers: { "user-agent": "portfolio-embed-check/2.0" },
    }, (response) => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(response.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      resolve({ status: response.statusCode ?? 502, headers });
      response.destroy();
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * GET /api/embed-check?url=<https://…>
 *
 * Browsers give the parent page no way to detect an iframe blocked by
 * X-Frame-Options / CSP frame-ancestors — the frame just renders a sad
 * blank page. So the server probes the target's headers and tells the
 * client up front whether embedding will work, letting the Web Layout
 * tab fall back gracefully.
 *
 * Public + read-only. SSRF hardening: https only, no localhost/private
 * DNS answers checked and pinned, no redirects, HEAD only, 5s timeout.
 */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = req.query.url;
  const urlStr = Array.isArray(raw) ? raw[0] : raw;
  if (!urlStr) return res.status(400).json({ error: "Missing ?url=" });

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return res.status(400).json({ error: "Invalid URL." });
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || urlStr.length > 2048) {
    return res.status(400).json({ error: "Use an HTTPS URL on the standard port, without credentials." });
  }
  try {
    // Node's https client never follows redirects. A redirect is inconclusive:
    // the browser can try it, but the server must not fetch the Location URL.
    const upstream = await probeHeaders(url);
    if (upstream.status >= 300 && upstream.status < 400) {
      return res.status(200).json({ ok: false, embeddable: true, reason: "redirect", status: upstream.status });
    }
    const xfo = (upstream.headers.get("x-frame-options") ?? "").toLowerCase();
    const csp = (upstream.headers.get("content-security-policy") ?? "").toLowerCase();

    let embeddable = true;
    let reason: string | null = null;

    if (xfo.includes("deny")) {
      embeddable = false;
      reason = "X-Frame-Options: DENY";
    } else if (xfo.includes("sameorigin")) {
      embeddable = false;
      reason = "X-Frame-Options: SAMEORIGIN";
    }

    const fa = csp.match(/frame-ancestors\s+([^;]+)/);
    if (fa) {
      const sources = fa[1].trim();
      // 'none' or a list that can't include us (we can't know our exact
      // origin here cheaply, so anything other than * counts as blocked
      // unless it explicitly names https: — conservative but honest).
      if (sources === "'none'") {
        embeddable = false;
        reason = "CSP frame-ancestors 'none'";
      } else if (!sources.includes("*") && !sources.includes("https:")) {
        embeddable = false;
        reason = `CSP frame-ancestors ${sources}`;
      }
    }

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      ok: true,
      embeddable,
      reason,
      status: upstream.status,
    });
  } catch (e) {
    // Unreachable / timed out — let the client try the iframe anyway.
    return res.status(200).json({
      ok: false,
      embeddable: true,
      reason: e instanceof Error && e.name === "AbortError" ? "timeout" : "unreachable",
      status: null,
    });
  }
}
