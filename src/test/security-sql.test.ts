// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role; create table public.site_visits (visitor_id text primary key, first_seen timestamptz default now());");
  await db.exec(readFileSync("supabase/migrations/012_security_limits.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/013_private_visit_counter.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
it("accepts only the configured number of reservations and resets after expiry", async () => {
  const reserve = () => db.query<{ allowed: boolean }>("select public.consume_security_limit('test', 2, 60) as allowed");
  const results = await Promise.all([reserve(), reserve(), reserve()]);
  expect(results.map(r => r.rows[0].allowed)).toEqual([true, true, false]);
  await db.exec("update public.security_rate_limits set expires_at = now() - interval '1 second'");
  expect((await reserve()).rows[0].allowed).toBe(true);
});
it("allows anonymous visitors only the counter function, never records or quotas", async () => {
  const result = await db.query("select has_table_privilege('anon', 'public.site_visits', 'SELECT') as can_read, has_table_privilege('anon', 'public.site_visits', 'INSERT') as can_write, has_function_privilege('anon', 'public.consume_security_limit(text,integer,integer)', 'EXECUTE') as can_reset");
  expect(result.rows[0]).toEqual({ can_read: false, can_write: false, can_reset: false });
  await db.exec("set role anon");
  try {
    const first = await db.query<{ count: number }>("select public.record_visit_and_count('random-visitor-one')::integer as count");
    const repeat = await db.query<{ count: number }>("select public.record_visit_and_count('random-visitor-one')::integer as count");
    expect(first.rows[0].count).toBe(1); expect(repeat.rows[0].count).toBe(1);
    await expect(db.exec("select * from public.site_visits")).rejects.toThrow(/permission denied/);
  } finally { await db.exec("reset role"); }
});
it("bounds IDs and anonymous storage growth", async () => {
  await expect(db.query("select public.record_visit_and_count($1)", ["x".repeat(10000)])).rejects.toThrow(/Invalid visitor/);
  await db.exec("update public.security_rate_limits set hits=1000 where key='visits:global'");
  const result = await db.query<{ count: number }>("select public.record_visit_and_count('random-visitor-two')::integer as count");
  expect(result.rows[0].count).toBe(1);
});
