-- Version history + activity log for the admin console.
--
--   content_versions — snapshot of site_content taken just before each
--     publish replaces it (coalesced: max one per 5-minute editing
--     session, pruned to the 20 newest by the API).
--   activity_log — compact "Track Changes" feed: publishes, restores,
--     resets, inquiry status changes.
--
-- RLS is ON with no anon policies on both tables — only the service-role
-- client used by the Vercel Functions can touch them.

create table if not exists content_versions (
  id          uuid        primary key default gen_random_uuid(),
  content     jsonb       not null,
  sections    text[]      not null default '{}',
  byte_size   integer,
  created_at  timestamptz not null default now()
);

create index if not exists content_versions_created_at_idx
  on content_versions (created_at desc);

alter table content_versions enable row level security;

create table if not exists activity_log (
  id          uuid        primary key default gen_random_uuid(),
  action      text        not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx
  on activity_log (created_at desc);

alter table activity_log enable row level security;
