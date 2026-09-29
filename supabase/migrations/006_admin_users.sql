-- Team admins — people the owner invites to edit the portfolio.
--
-- Design notes:
--   * The owner is NOT a row here. The owner signs in with the password in
--     ADMIN_PASSWORD_HASH, so nothing in this table can lock the owner out,
--     and only the owner can add, disable, reset or remove the rows below.
--   * password_hash is scrypt, formatted scrypt$N$r$p$salt$hash with the
--     cost parameters stored alongside so they can be raised later
--     without invalidating existing accounts.
--   * password_changed_at is compared against each token's issue time on
--     every authed request (see authorize() in api/*.ts): a reset signs
--     that admin out of every session issued before it.
--   * RLS on with NO policies: the anon key can't read this table at all.
--     Every read and write goes through /api/login on the service role.

create table if not exists admin_users (
  id                   uuid        primary key default gen_random_uuid(),
  username             text        not null unique
                                     check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
                                            and username <> 'owner'),
  display_name         text        not null
                                     check (char_length(display_name) between 1 and 60),
  password_hash        text        not null,
  disabled             boolean     not null default false,
  created_by           text,
  created_at           timestamptz not null default now(),
  last_login_at        timestamptz,
  password_changed_at  timestamptz
);

alter table admin_users enable row level security;
