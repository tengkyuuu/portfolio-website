-- Migration 010 enabled RLS and added insert/select policies for `anon`
-- on site_visits, but missed the table-level grant Postgres still
-- requires before those policies mean anything — a role needs the base
-- GRANT before RLS is even consulted. Without it, PostgREST can't see
-- the table for the anon role at all, and every request 404s: exactly
-- what shipped, caught live on production right after the counter went
-- out (every other table in this project routes writes through the
-- service-role client, so this is the first time this was needed here).
grant insert, select on table site_visits to anon;
