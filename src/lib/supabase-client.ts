import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy, single-instance Supabase client used on the *client* (browser).
 *
 * Uses the anon key (safe to ship in the bundle). Reads through this client
 * are governed by Row Level Security policies on the Supabase table; writes
 * happen exclusively through the server's service-role client.
 *
 * Returns null when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY aren't set —
 * callers gracefully degrade (e.g. real-time becomes polling).
 */

let cached: SupabaseClient | null = null;
let checked = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (checked) return cached;
  checked = true;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 2 } },
  });
  return cached;
}

export function isRealtimeConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}
