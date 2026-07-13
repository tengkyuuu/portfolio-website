import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearer, verifyToken } from "./_lib/auth";
import {
  clientIp,
  createInquiry,
  hashIp,
  isStoreConfigured,
  listInquiries,
  recentInquiryCount,
  type InquiryStatus,
} from "./_lib/inquiries";

/**
 * Inquiries collection endpoint.
 *
 *   POST  /api/inquiries   — public. Submits a new inquiry.
 *   GET   /api/inquiries   — Bearer-auth. Lists inquiries with a filter.
 *
 * Everything else is 405.
 */

const MAX_PER_10_MIN = 5;

/* ------------------------------ validation ------------------------------ */

type ValidationError = { field: string; message: string };

function validateBody(body: unknown): {
  ok: true;
  value: { name: string; email: string; subject: string | null; message: string };
  honeypotTripped: boolean;
} | { ok: false; errors: ValidationError[] } {
  if (!body || typeof body !== "object") {
    return { ok: false, errors: [{ field: "_root", message: "Body must be an object." }] };
  }
  const b = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 1) errors.push({ field: "name", message: "Name is required." });
  if (name.length > 100) errors.push({ field: "name", message: "Name is too long (max 100 characters)." });

  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (email.length < 3) errors.push({ field: "email", message: "Email is required." });
  else if (email.length > 200) errors.push({ field: "email", message: "Email is too long." });
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push({ field: "email", message: "That doesn't look like a valid email." });

  const subjectRaw = typeof b.subject === "string" ? b.subject.trim() : "";
  const subject = subjectRaw.length > 0 ? subjectRaw : null;
  if (subject && subject.length > 200)
    errors.push({ field: "subject", message: "Subject is too long (max 200 characters)." });

  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length < 1) errors.push({ field: "message", message: "Message is required." });
  else if (message.length > 5000)
    errors.push({ field: "message", message: "Message is too long (max 5,000 characters)." });

  // Honeypot: a hidden field named `website`. Any real value = bot.
  const honeypotTripped =
    typeof b.website === "string" && b.website.trim().length > 0;

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { name, email, subject, message },
    honeypotTripped,
  };
}

/* -------------------------------- handler ------------------------------- */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!isStoreConfigured()) {
    return res.status(503).json({
      error: "Content store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  if (req.method === "POST") {
    const body =
      typeof req.body === "string" ? safeJson(req.body) : (req.body ?? {});
    const parsed = validateBody(body);
    if (!parsed.ok) {
      return res.status(400).json({ error: "Validation failed", details: parsed.errors });
    }

    // Silently succeed for honeypot trips — don't give bots feedback to iterate on.
    if (parsed.honeypotTripped) {
      return res.status(202).json({ ok: true });
    }

    const ip = clientIp(req.headers);
    const ipHash = hashIp(ip);

    if (ipHash) {
      try {
        const recent = await recentInquiryCount(ipHash, 10);
        if (recent >= MAX_PER_10_MIN) {
          return res.status(429).json({
            error: "Too many messages from this address. Please try again in a few minutes.",
          });
        }
      } catch {
        // If the rate-limit lookup fails, fall through — a temporary Supabase
        // hiccup shouldn't lock a real visitor out of contacting.
      }
    }

    const uaRaw = req.headers["user-agent"];
    const userAgent = (Array.isArray(uaRaw) ? uaRaw[0] : uaRaw) ?? null;

    try {
      const row = await createInquiry({
        name: parsed.value.name,
        email: parsed.value.email,
        subject: parsed.value.subject,
        message: parsed.value.message,
        ip_hash: ipHash,
        user_agent: userAgent ? userAgent.slice(0, 500) : null,
      });
      return res.status(201).json({ ok: true, id: row.id });
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : "Server error",
      });
    }
  }

  if (req.method === "GET") {
    const token = extractBearer(req.headers.authorization);
    if (!verifyToken(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rawStatus = req.query.status;
    const status = (Array.isArray(rawStatus) ? rawStatus[0] : rawStatus) as
      | InquiryStatus
      | "all"
      | undefined;
    const rawLimit = req.query.limit;
    const limitStr = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;
    const limit = limitStr ? Math.max(1, Math.min(200, Number(limitStr) || 50)) : 50;
    const rawBefore = req.query.before;
    const before = Array.isArray(rawBefore) ? rawBefore[0] : rawBefore;

    try {
      const result = await listInquiries({
        status: status === "all" || status === undefined ? "all" : status,
        limit,
        before,
      });
      return res.status(200).json(result);
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : "Server error",
      });
    }
  }

  res.setHeader("Allow", "POST, GET");
  return res.status(405).json({ error: "Method not allowed" });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
