-- Single-row JSON store for the portfolio's editable content.
-- Run this once in your Supabase project (SQL editor).

create table if not exists site_content (
  id text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

-- Optional: keep updated_at fresh on every write.
create or replace function site_content_touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists site_content_touch_trigger on site_content;
create trigger site_content_touch_trigger
  before update on site_content
  for each row
  execute function site_content_touch_updated_at();

-- The Vercel functions use the service role key (which bypasses RLS), so we
-- don't enable RLS here. If you ever expose this table to the anon key,
-- enable RLS and write a SELECT-only policy.
