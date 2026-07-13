import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Data-access helpers for the inquiries inbox. Uses the same service-role
 * Supabase client pattern as _lib/store.ts, but scoped to `inquiries` so
 * the content flow and the inbox flow don't share query shapes.
 */

export type InquiryStatus = "unread" | "read" | "archived";

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: InquiryStatus;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
};

export type InquiryInsert = {
  name: string;
  email: string;
  subject: string | null;
  message: string;
  ip_hash: string | null;
  user_agent: string | null;
};

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env not set. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export function isStoreConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Salt-hash the visitor's IP with a server-only secret so identical IPs
 * still cluster (rate limit works) but the raw address never lands in
 * the database. Falls back to a random hash if no secret is configured,
 * which effectively disables clustering — a safer default than logging IP.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.ADMIN_TOKEN_SECRET ?? "";
  if (!salt) return null;
  return crypto
    .createHmac("sha256", salt)
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Extract the visitor IP from Vercel-style forwarding headers. Returns
 * null on local dev / when the header is absent — we don't try to guess.
 */
export function clientIp(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const raw =
    (headers["x-forwarded-for"] as string | undefined) ??
    (headers["x-real-ip"] as string | undefined);
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first || null;
}

/** Insert a new inquiry. Returns the created row. */
export async function createInquiry(insert: InquiryInsert): Promise<Inquiry> {
  const { data, error } = await client()
    .from("inquiries")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw error;
  return data as Inquiry;
}

/** How many inquiries have this ip_hash submitted in the last window (min)? */
export async function recentInquiryCount(
  ipHash: string,
  windowMinutes: number
): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await client()
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

export type ListInquiriesFilter = {
  status?: InquiryStatus | "all";
  limit?: number;
  before?: string; // ISO created_at cursor
};

export async function listInquiries(
  filter: ListInquiriesFilter = {}
): Promise<{ items: Inquiry[]; unreadCount: number }> {
  const status = filter.status ?? "all";
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);

  let q = client().from("inquiries").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status !== "all") q = q.eq("status", status);
  if (filter.before) q = q.lt("created_at", filter.before);

  const { data, error } = await q;
  if (error) throw error;

  // Cheap parallel unread count for the sidebar badge.
  const { count, error: countErr } = await client()
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread");
  if (countErr) throw countErr;

  return {
    items: (data ?? []) as Inquiry[],
    unreadCount: count ?? 0,
  };
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus
): Promise<Inquiry | null> {
  const patch: Record<string, unknown> = { status };
  if (status === "read") patch.read_at = new Date().toISOString();
  if (status === "archived") patch.archived_at = new Date().toISOString();
  if (status === "unread") patch.read_at = null;

  const { data, error } = await client()
    .from("inquiries")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as Inquiry | null) ?? null;
}

export async function deleteInquiry(id: string): Promise<boolean> {
  const { error, count } = await client()
    .from("inquiries")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}
