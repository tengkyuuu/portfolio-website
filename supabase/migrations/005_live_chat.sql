-- Live chat — visitor conversations with the Office Assistant, plus James's
-- own replies when he takes a session over.
--
-- Design notes:
--   * A session id is a uuid the visitor's browser generates and keeps in
--     localStorage. It is the ONLY credential for reading that transcript,
--     so it must stay unguessable: never log it, never surface it publicly.
--   * The anon key has NO access (RLS on, no policies). Everything goes
--     through /api/chat on the service-role client, so the server decides
--     whether Gemini answers at all and can rate-limit before spending.
--   * mode='human' means James has replied: the AI stops answering that
--     session. Stored as a column rather than derived from message roles so
--     the rule survives message deletion, and handing a session back to the
--     AI stays a one-line change.
--   * No unread flag per message. admin_read_at is a single watermark per
--     session; anything newer is unread. One column, no write amplification
--     on read, and it cannot drift out of sync with the transcript.

create table if not exists chat_sessions (
  id               uuid        primary key,
  mode             text        not null default 'ai'
                                 check (mode in ('ai', 'human')),
  ip_hash          text,
  user_agent       text,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  -- Null means James has never opened this session.
  admin_read_at    timestamptz
);

create table if not exists chat_messages (
  id          bigserial   primary key,
  session_id  uuid        not null references chat_sessions (id) on delete cascade,
  role        text        not null check (role in ('visitor', 'ai', 'human')),
  body        text        not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);

-- Every transcript read is (session_id, created_at asc); the visitor poll
-- adds "created_at > $after" on top of it.
create index if not exists chat_messages_session_created_idx
  on chat_messages (session_id, created_at);

-- The admin session list sorts by most recent activity.
create index if not exists chat_sessions_last_message_idx
  on chat_sessions (last_message_at desc);

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

-- Register with realtime so a later upgrade from polling → broadcast needs
-- no second migration. The anon key can't SELECT, so RLS strips the payload
-- to a bare change event — safe to publish now.
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table chat_messages';
  exception
    when duplicate_object then null;
  end;
end$$;
