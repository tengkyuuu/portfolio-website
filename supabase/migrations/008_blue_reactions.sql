-- Preserve Gemini's chosen Blue mood when reopening a conversation.
alter table public.chat_messages
  add column if not exists reaction text
  check (reaction in ('coffee', 'working', 'searching', 'needmoney', 'like', 'cry', 'corporate'));
