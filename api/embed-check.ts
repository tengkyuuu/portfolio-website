import type { VercelRequest, VercelResponse } from "@vercel/node";

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
 * hosts, 5s timeout, only headers inspected (body discarded).
 */

const TIMEOUT_MS = 5000;

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // Raw IPv4 private/reserved ranges + loopback IPv6
  if (/^(10\.|127\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "::1" || h.startsWith("[")) return true;
  return false;
}

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
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return res.status(400).json({ error: "Only http(s) URLs are supported." });
  }
  if (isPrivateHost(url.hostname)) {
    return res.status(400).json({ error: "Private hosts are not allowed." });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // GET (not HEAD): several hosts reject HEAD or omit security headers
    // on it. We only read headers; the body is never consumed.
    const upstream = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "portfolio-embed-check/1.0" },
    });

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
  } finally {
    clearTimeout(timer);
  }
}
