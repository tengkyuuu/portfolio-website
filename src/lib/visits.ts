import { getSupabaseClient } from "./supabase-client";
import { visitorId } from "./presence";

/**
 * Total unique visits, shown in the footer. One row per browser ever
 * (migrations 010?013) — records this browser's visit, then returns the
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
    const { data, error } = await supabase.rpc("record_visit_and_count", { p_visitor_id: visitorId() });
    if (error || typeof data !== "number" || !Number.isSafeInteger(data) || data < 0) return null;
    return data;
  } catch {
    return null;
  }
}
