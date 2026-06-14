-- Enable real-time updates on site_content so the live site reflects admin
-- saves within seconds, on any browser.
--
-- Three things to do here:
--   1) Turn on Row Level Security (the anon key in the browser is now scoped).
--   2) Add a public-read policy (the live site reads via the anon key).
--   3) Add the table to the Supabase Realtime publication so client
--      subscriptions receive INSERT / UPDATE / DELETE notifications.
--
-- Writes still happen only through the Vercel Functions, which use the
-- service-role key — service role bypasses RLS, so writes are unaffected
-- regardless of the policies below.

alter table site_content enable row level security;

drop policy if exists "site_content_public_read" on site_content;
create policy "site_content_public_read"
  on site_content
  for select
  to anon, authenticated
  using (true);

-- Make sure the table is included in the realtime publication. Safe to run
-- repeatedly: if it's already in the publication, the inner statement raises
-- and we swallow it.
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table site_content';
  exception
    when duplicate_object then null;
  end;
end$$;
