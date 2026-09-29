import { getSupabaseClient } from "./supabase-client";
import { visitorId } from "./presence";

/**
 * Total unique visits, shown in the footer. One row per browser ever
 * (migration 010) — records this browser's visit, then returns the
 * running total. Repeat calls from the same browser are a free no-op via
 * the table's primary key.
 *
 * Degrades to null when Realtime isn't configured (VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY unset), same contract as every optional
 * integration here — the caller renders nothing.
 */
export async function recordVisitAndCount(): Promise<number | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    await supabase
      .from("site_visits")
      .upsert({ visitor_id: visitorId() }, { onConflict: "visitor_id", ignoreDuplicates: true });
    const { count, error } = await supabase
      .from("site_visits")
      .select("visitor_id", { count: "exact", head: true });
    if (error) return null;
    return count ?? null;
  } catch {
    return null;
  }
}
