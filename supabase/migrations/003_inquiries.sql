-- Inquiries inbox — visitor-submitted messages surfaced in the admin console.
--
-- Design notes:
--   * The anon key has NO direct access to this table (no policies). All
--     inserts go through /api/inquiries, so the server can rate-limit,
--     validate, and salt-hash the IP before write.
--   * Reads/updates/deletes stay behind the service-role client used by the
--     Vercel Functions.
--   * We enable this table in the supabase_realtime publication so a future
--     upgrade from client polling → server broadcast doesn't need a second
--     migration. Right now the anon key can't SELECT, so RLS strips
--     realtime payloads to a bare change event — safe.

create table if not exists inquiries (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null check (char_length(name) between 1 and 100),
  email        text        not null check (char_length(email) between 3 and 200),
  subject      text                  check (subject is null or char_length(subject) <= 200),
  message      text        not null check (char_length(message) between 1 and 5000),
  status       text        not null default 'unread'
                            check (status in ('unread', 'read', 'archived')),
  ip_hash      text,
  user_agent   text,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  archived_at  timestamptz
);

-- Inbox list is sorted by (status, created_at desc) — supports the default
-- "unread first, newest first" view and filter-by-status without a scan.
create index if not exists inquiries_status_created_at_idx
  on inquiries (status, created_at desc);

-- Rate limit check queries by (ip_hash, created_at desc). Small, cheap index.
create index if not exists inquiries_ip_hash_created_at_idx
  on inquiries (ip_hash, created_at desc)
  where ip_hash is not null;

-- Row Level Security ON with NO policies for anon/authenticated = zero
-- access via those roles. Service role bypasses RLS and does all real work.
alter table inquiries enable row level security;

-- Register with realtime publication (safe to run repeatedly).
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table inquiries';
  exception
    when duplicate_object then null;
  end;
end$$;
