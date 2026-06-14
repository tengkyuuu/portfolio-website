import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearer, verifyToken } from "./_lib/auth";
import {
  clearContent,
  getContent,
  isStoreConfigured,
  setContent,
} from "./_lib/store";

/** Same minimal shape check the client's importContent does. */
function isContentShaped(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return Boolean(
    b.hero &&
      b.about &&
      Array.isArray(b.skills) &&
      Array.isArray(b.projects)
  );
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!isStoreConfigured()) {
    return res.status(503).json({
      error:
        "Content store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  if (req.method === "GET") {
    try {
      const content = await getContent();
      if (!content) return res.status(404).json({ error: "No content" });
      return res.status(200).json(content);
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : "Server error",
      });
    }
  }

  // PUT / DELETE require auth
  if (req.method === "PUT" || req.method === "DELETE") {
    const token = extractBearer(req.headers.authorization);
    if (!verifyToken(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      if (req.method === "PUT") {
        const body =
          typeof req.body === "string" ? safeJson(req.body) : req.body;
        if (!isContentShaped(body)) {
          return res
            .status(400)
            .json({ error: "Body must include hero, about, skills, projects." });
        }
        await setContent(body);
        return res.status(200).json({ ok: true });
      }
      await clearContent();
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : "Server error",
      });
    }
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Note: Vercel's @vercel/node runtime has a ~4.5 MB request body cap on Hobby
// plans. The client base64-encodes uploaded screenshots into the JSON, so very
// image-heavy content can exceed this. If you hit a 413 on PUT, either keep
// screenshots in public/ and reference by path, or upgrade the plan.
