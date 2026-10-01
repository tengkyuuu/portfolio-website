-- Apply BEFORE deploying the security update. Service-role callers only.
-- Atomic counters survive cold starts and concurrent Vercel instances.
create table if not exists public.security_rate_limits (
  key text primary key check (length(key) <= 200),
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
create index if not exists security_rate_limits_expiry on public.security_rate_limits (expires_at);
alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from anon, authenticated;

create or replace function public.consume_security_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare accepted integer;
begin
  if p_key is null or length(p_key) < 1 or length(p_key) > 200
     or p_limit is null or p_limit < 1 or p_limit > 10000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid limit';
  end if;
  -- Bounded retention: old IP hashes disappear after their window expires.
  delete from public.security_rate_limits where expires_at < now();
  insert into public.security_rate_limits as limits (key, hits, expires_at)
    values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set hits = limits.hits + 1
    where limits.hits < p_limit
  returning hits into accepted;
  return accepted is not null;
end;
$$;
revoke all on function public.consume_security_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_security_limit(text, integer, integer) to service_role;
