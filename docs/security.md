# Security hardening and rollout

These changes reduce verified risks; they cannot guarantee immunity from attacks.
The live `engrjamescalunsag.vercel.app` site already uses HTTPS. Vercel includes
[automatic certificates and platform protections](https://vercel.com/docs/security)
and [DDoS mitigation on every plan](https://vercel.com/docs/vercel-firewall/ddos-mitigation).
Buying a domain or upgrading hosting is not required for these code changes.

## Before deploying

1. In the existing Supabase project's SQL editor, run migrations **012_security_limits.sql**
   and **013_private_visit_counter.sql**, in that order, after migrations 001?011.
   These are additive protections; they do not remove portfolio content or visitor records.
   Login, chatbot, contact submissions and sending visitor invitations return **503** if the
   shared limiter is unavailable. Apply migration 012 before deploying the code.
   Migration 013 removes direct public access to visitor records; the older counter UI
   may temporarily disappear until this build is deployed.
2. Rotate the owner password if `VITE_ADMIN_PASSWORD_HASH` was ever set. Earlier builds
   could expose that hash publicly, making offline password guessing possible. Use a long,
   unique password from a password manager. Set its digest as **ADMIN_PASSWORD_HASH** in
   Vercel and remove **VITE_ADMIN_PASSWORD_HASH**. Current builds suppress that legacy
   client variable even when it is still present in hosting settings. The API accepts the
   legacy server value temporarily so renaming does not silently invalidate the password.
3. Set **ADMIN_TOKEN_SECRET** to at least 32 cryptographically random bytes, server-side.
   Rotating it signs everyone out; update the matching GitHub Actions secret used for
   publishing test and Lighthouse results. Keep Supabase service-role, Gemini, Spotify,
   and Resend credentials server-side with no `VITE_` prefix.
4. Deploy, then confirm `/metrics.json` reports the expected commit. Verify that `/`
   responds with Content-Security-Policy, X-Content-Type-Options, X-Frame-Options and HSTS;
   `/api/login` and private API responses must have `Cache-Control: no-store`.
5. Sign in, preview an invitation, publish a small content edit, check public content,
   and send one normal chatbot/contact request. A 503 mentioning request protection
   means migration 012, the service-role key, or database availability needs attention.

The migrations and Vercel account settings have **not** been applied by this workspace update.

## What changed

- Server-only password verification; an unavailable API cannot grant a local admin session.
- Atomic invite redemption checks the original token, expiry and disabled state in the
  UPDATE itself. Concurrent requests cannot both acquire access.
- Database-backed request reservations across server instances. Checks happen before
  password verification, chat storage, Gemini calls, contact writes or Resend sends.
  Errors fail closed. Failed upstream requests count too, preventing free retries from
  bypassing the quota. These are fixed-duration windows starting at the first request:

  | Operation | Limit |
  | --- | --- |
  | Login | 10 attempts/IP/15 minutes; 500 total/15 minutes |
  | Invite validation/redemption | 20/IP/15 minutes |
  | Own password change | 10/admin/15 minutes |
  | Chat, including human takeover | 15/IP/10 minutes; 300 total/24 hours |
  | Contact form | 5/IP/10 minutes; 200 total/24 hours |
  | Visitor invitation sending | 10 batches/admin/hour; 30 total/24 hours; at most 10 recipients/batch |
  | New visitor counter rows | 1,000/24 hours |

  Keys are HMAC hashes; raw IP addresses are not stored in the limiter. Expired rows are
  removed on the next reservation. These controls limit application work, not requests
  reaching Vercel or Supabase. Distributed traffic can still exhaust shared quotas.
- The preview probe accepts HTTPS on port 443, rejects credentials, checks every resolved
  IP, connects only to a checked address, requests headers only, and never follows
  redirects. Redirects/failed probes leave the existing browser preview fallback available.
- Chatbot fallback content uses the configured site URL, never an incoming Host header.
- CSP blocks third-party scripts, inline executable scripts, embedded objects and framing
  this site. Inline styles remain allowed because React, animation and email preview
  styles use them. HTTPS frames/images remain permitted for portfolio demos and artwork.
- Private responses bypass browser/CDN/service-worker caches. Health diagnostics require
  an active admin token; public readiness exposes only configuration booleans.
- Visitor counter callers receive only a total. Database table access is revoked from
  anonymous/authenticated browser roles, and the function bounds ID size and write growth.
- Updated vulnerable dependencies. Scoped overrides patch dependencies pinned by Vercel's
  build tooling. Recheck/remove those overrides when upstream packages adopt the fixes.

## Account settings and ongoing work

Enable MFA on Vercel, Supabase, GitHub and the email account that controls them.
Keep preview deployments protected. Use Vercel's Firewall/Attack Challenge Mode if abusive
traffic appears, and set Gemini/Resend usage limits and provider billing alerts as available.
These account controls cannot be enabled from this repository.

Run `npm run build`, `npm test`, and `npm run security:check` before release. The security
workflow repeats the audit on changes and weekly. An empty npm audit is a check of known
package advisories, not a penetration test or proof of complete security.

The JSON-backed `server/app.mjs` is a local development backend. Public production uses
Vercel's `api/*.ts` handlers and the database limits above. Do not expose a Vite dev server
to the internet. The public content JSON and public media bucket are for publishable data;
blog drafts currently hide from navigation but are still included in that JSON. Do not
store credentials, private documents or confidential drafts there. Admin bearer tokens
remain tab-scoped in sessionStorage, so preventing script injection remains important.
