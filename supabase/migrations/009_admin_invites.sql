-- Invite-by-email for team admins: the owner enters a name, username and
-- email; the invitee gets a link and sets their own password. Nobody but
-- the invitee ever knows it — the owner never generates or sees it.
--
-- password_hash stays NOT NULL (unchanged): a random, unshared password is
-- set at invite time so the existing constraint holds, and is replaced
-- the moment the invite is redeemed. Only the token's hash is stored,
-- never the token itself — a database read alone can't grant access to
-- a pending invite.

alter table admin_users
  add column if not exists email text,
  add column if not exists invite_token_hash text,
  add column if not exists invite_expires_at timestamptz;

-- A token hash must resolve to exactly one row, and NULLs (redeemed or
-- never-invited accounts) are excluded so they don't collide with each
-- other under the constraint.
create unique index if not exists admin_users_invite_token_hash_idx
  on admin_users (invite_token_hash)
  where invite_token_hash is not null;
