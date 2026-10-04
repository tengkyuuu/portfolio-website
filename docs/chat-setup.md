# Blue chat provider setup

Blue supports Gemini and Groq in both the local Express API and the Vercel
function. With `CHAT_PROVIDER` unset, existing deployments continue using Gemini.
Provider selection is explicit: a missing key or an upstream error does not
automatically send conversations to another provider.

## Switch to Groq

Create a key at [Groq Console](https://console.groq.com/keys), then set these
server-only variables in `.env.local` for development:

```dotenv
CHAT_PROVIDER=groq
GROQ_API_KEY=<your Groq key>
GROQ_MODEL=openai/gpt-oss-20b
```

Set the same variables in Vercel's project environment settings and redeploy
to activate the switch on the hosted site. Restart the local dev server after
editing `.env.local`. Never prefix provider keys with `VITE_`.

`GROQ_MODEL` is optional. The default GPT-OSS 20B uses low reasoning effort and
strict JSON output for Blue's reply and reaction. If overriding the model,
choose one supporting Groq's strict structured outputs. Confirm available
models and your account's limits in the console before switching.

Groq's published free-plan GPT-OSS 20B limits at review time were 30 requests
per minute, 1,000 requests per day, 8,000 tokens per minute, and 200,000 tokens
per day. Input, history, and output consume token capacity, so the daily request
allowance does not guarantee that many portfolio conversations. Blue also
enforces its existing production limits of 15 messages per IP per 10 minutes
and 300 globally per day. Free quotas and model availability can change.

Sources: [models](https://console.groq.com/docs/models),
[limits](https://console.groq.com/docs/rate-limits),
[structured outputs](https://console.groq.com/docs/structured-outputs).

## Gemini and rollback

Set `CHAT_PROVIDER=gemini` (or remove it) and keep `GEMINI_API_KEY` configured.
`GEMINI_MODEL` retains its existing default. The content translation script
continues to use Gemini independently of Blue's provider setting.

Production also needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`ADMIN_TOKEN_SECRET` with the existing chat and security migrations applied.
The local API stores conversations in memory. Grounding, reaction parsing,
conversation history, and human takeover work with either chat provider.

Check `/api/chat` for `{"configured":true}`, ask a portfolio question, and
check its reply and reaction. During human takeover, Blue does not call a model.
Upstream failures return the existing temporary-unavailability message.
