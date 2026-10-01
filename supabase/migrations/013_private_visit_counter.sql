-- Migration 010's SELECT policy allowed downloading every visitor ID,
-- even though the UI asked only for a count. Expose just an aggregate RPC.
revoke all on public.site_visits from anon, authenticated;
drop policy if exists "anon can record a visit" on public.site_visits;
drop policy if exists "anon can read for a count" on public.site_visits;

create or replace function public.record_visit_and_count(p_visitor_id text)
returns bigint
language plpgsql security definer set search_path = ''
as $$
begin
  if p_visitor_id is null or p_visitor_id !~ '^[a-zA-Z0-9-]{12,64}$' then
    raise exception 'Invalid visitor ID';
  end if;
  if not exists (select 1 from public.site_visits where visitor_id = p_visitor_id) then
    -- Cap anonymous storage growth. The count remains an approximate metric.
    if public.consume_security_limit('visits:global', 1000, 86400) then
      insert into public.site_visits (visitor_id) values (p_visitor_id) on conflict do nothing;
    end if;
  end if;
  return (select count(*) from public.site_visits);
end;
$$;
revoke all on function public.record_visit_and_count(text) from public;
grant execute on function public.record_visit_and_count(text) to anon, authenticated, service_role;
