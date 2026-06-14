import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TABLE = "site_content";
const ROW_ID = "default";

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

/** Returns the stored content blob, or null if none. */
export async function getContent(): Promise<unknown | null> {
  const { data, error } = await client()
    .from(TABLE)
    .select("content")
    .eq("id", ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return (data as { content: unknown } | null)?.content ?? null;
}

export async function setContent(content: unknown): Promise<void> {
  const { error } = await client().from(TABLE).upsert({
    id: ROW_ID,
    content,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function clearContent(): Promise<void> {
  const { error } = await client().from(TABLE).delete().eq("id", ROW_ID);
  if (error) throw error;
}

export async function hasContent(): Promise<boolean> {
  try {
    const { count, error } = await client()
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("id", ROW_ID);
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}
