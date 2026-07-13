import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearer, verifyToken } from "../_lib/auth";
import {
  deleteInquiry,
  isStoreConfigured,
  updateInquiryStatus,
  type InquiryStatus,
} from "../_lib/inquiries";

/**
 * Single-inquiry endpoint.
 *
 *   PATCH   /api/inquiry/[id]   — Bearer. Body: { status: unread|read|archived }
 *   DELETE  /api/inquiry/[id]   — Bearer. Hard delete.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!isStoreConfigured()) {
    return res.status(503).json({
      error: "Content store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const token = extractBearer(req.headers.authorization);
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idParam = req.query.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ error: "Invalid inquiry id." });
  }

  if (req.method === "PATCH") {
    const body =
      typeof req.body === "string" ? safeJson(req.body) : (req.body ?? {});
    const status = (body as { status?: unknown })?.status;
    if (status !== "unread" && status !== "read" && status !== "archived") {
      return res.status(400).json({
        error: "status must be one of: unread, read, archived.",
      });
    }
    try {
      const row = await updateInquiryStatus(id, status as InquiryStatus);
      if (!row) return res.status(404).json({ error: "Inquiry not found." });
      return res.status(200).json(row);
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : "Server error",
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const removed = await deleteInquiry(id);
      if (!removed) return res.status(404).json({ error: "Inquiry not found." });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : "Server error",
      });
    }
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
