-- Unique-visitor counter shown in the footer. Written directly from the
-- browser with the anon key, the same way src/lib/presence.ts's "who's
-- viewing" dogs avoid a Serverless Function: the Hobby plan's twelve are
-- already spoken for (see CLAUDE.md), and an insert-only counter has
-- nothing worth putting a server in front of.
--
-- "Unique" means one row per browser — the same random id in localStorage
-- that presence.ts already generates as visitorId(), reused here rather
-- than minting a second identity. Clearing storage or switching browsers
-- recounts; that is the known, accepted tradeoff every client-side hit
-- counter like this has always had, not a claim of analytics-grade
-- accuracy.
--
-- visitor_id is `text`, not `uuid`: visitorId()'s fallback path (browsers
-- without crypto.randomUUID) doesn't produce valid UUID syntax, and a
-- typed column would reject that insert outright.
create table if not exists site_visits (
  visitor_id text primary key,
  first_seen timestamptz not null default now()
);

alter table site_visits enable row level security;

-- Nothing in a row is worth protecting (a random id and a timestamp), so
-- a permissive insert is fine; the primary key makes a repeat visit from
-- the same browser a free no-op via ON CONFLICT DO NOTHING.
create policy "anon can record a visit"
  on site_visits for insert
  to anon
  with check (true);

-- The client only ever asks for a count with head:true (no row bodies
-- leave Postgres) — the same idiom api/health.ts already uses for its
-- table probes — so a permissive select never actually exposes a row.
create policy "anon can read for a count"
  on site_visits for select
  to anon
  using (true);
