# Portfolio.docx — Roadmap

Next-phase feature backlog. Group by area, then pick from Tier 1 (biggest
visible payoff, smallest scope) first.

Legend: **T1** = ship next · **T2** = worth it, more scope · **T3** = polish
or nice-to-have · **T4** = big infra, only if the portfolio grows.

## Shipped

- ✅ Inquiry form + admin inbox (+ polling notifications, unread badge, toast)
- ✅ Skill logos + interactive tech stack (detail side pane)
- ✅ Interactive résumé builder (Modern + ATS templates, role focus, ?style/?role links)
- ✅ PWA (manifest, service worker, install + update chips)
- ✅ /status performance dashboard (bundle metrics, deploy info, live Web Vitals)
- ✅ Version history + restore (admin → History, coalesced snapshots, keep-20)
- ✅ Activity log (admin → History, "Track Changes" feed, server-written)
- ✅ Full-text search (Ctrl+K "Tell Me" palette on the live site)
- ✅ Interactive projects (Web Layout live-demo tab with device frames, Media video tab)
- ✅ Email reply templates (inbox → Reply → Compose modal, Gmail/mailto/copy)
- ✅ Contact scheduling (admin-configurable Cal.com/Calendly embed on Contact)
- ✅ Chatbot — Blue, the Office Assistant 📎 (grounded in site content, needs GEMINI_API_KEY on Vercel)
- ✅ How I Work tab (agent-in-the-loop workflow, each stage linked to a real repo artifact)
- ✅ Now tab (what I am learning/building + live GitHub panel via /api/github)
- ✅ Vitest suite + /status Test Suite card (needs ADMIN_TOKEN_SECRET repo secret)
- ✅ Spotify "Now Playing" in the status bar (needs SPOTIFY_* on Vercel)
- ✅ Lighthouse CI (GitHub Action → /api/lighthouse → /status card, needs ADMIN_TOKEN_SECRET repo secret)

---

## Site — visible to visitors

### Interactive Tech Stack **[T1]**
Clicking a technology in the Skills tab opens a side panel with:

- Related projects (auto-linked from `projects[].stack`)
- Code snippets — short, real, taken from the actual repos
- Why you chose it (one paragraph per tech)
- Experience level (e.g. Daily · Weekly · Explored)

**How**: extend the `SkillGroup` type with per-item metadata:
```ts
type Skill = { name: string; level: 'daily' | 'weekly' | 'explored';
               why?: string; snippet?: { language: string; code: string }; };
```
Snippets rendered via Shiki or Prism client-side. The related-projects
lookup is a filter over the existing `projects` array. Panel opens as
a right drawer over the paper — reuse `word-popover` styling.

### Skill logos in Skills tab **[T1]** *(deferred from an earlier turn)*
Each competency item shows its official mark next to the label.

**How**: use [Devicon](https://devicon.dev) or [Simple Icons](https://simpleicons.org)
via CDN — no bundle cost. Map skill name → icon slug in a small table
in `data.ts`; components fall back to the material `chip` icon we already
render when a mapping is missing. Sub-40 line change.

### Interactive Résumé Builder **[T2]**
Instead of a single `/resume` page:

- Multiple templates (Word-doc style + a stricter ATS-friendly one)
- Role-specific résumés — Frontend, Full Stack, IT Support
- Automatic skill selection based on the target role
- One-click PDF export (keeps existing print-to-PDF but with a proper
  filename and layout finalization step)

**How**: `/resume?role=frontend&template=ats`. Query string drives:
- Which template component renders (`ResumePage.tsx` becomes a template
  registry — `Modern`, `ATS`, `Compact`)
- A role → skill-subset mapping (`resume-roles.ts` — declares which of
  the six skill groups + which projects surface per role)
- Template stylesheet variant (ATS = single-column, system fonts, no
  colored dividers, no gradient figures)

### Contact scheduling **[T2]**
Let visitors book a call instead of only sending a form message.

**How**: embed a Cal.com or SavvyCal booking widget in the Contact tab as
a new "Book a meeting" section. Two integration options:

- Iframe embed (5-min setup, no backend)
- Cal.com API + our `/api/inquiries` — so bookings land in the same admin
  inbox as inquiries

Prefer option 2 once the inquiry inbox exists (see below).

### Contact / Inquiry form **[T1]** *(deferred from an earlier turn)*
Public form; submissions land in the admin console.

**How**:
- New Supabase table `inquiries(id, name, email, subject, message,
  status enum('unread','read','archived'), created_at)`
- `POST /api/inquiries` — public, rate-limited by IP hash
- `GET /api/inquiries` + `PATCH /api/inquiries/:id` — bearer-token auth
- New admin section "Inbox" in `AdminLayout.SECTIONS` with unread badge
- Contact form on the site + a success toast on submission

### Real-time inbox notifications **[T2]**
When an inquiry lands, the admin sees it without refreshing.

**How**: the existing Supabase Realtime subscription pattern from
`src/lib/realtime.ts` — subscribe to `postgres_changes` on `inquiries`.
Show a Word-style comment popover in the admin top bar when the tab is
open; use the Notifications API + `notification` sound when it isn't
(gated by permission prompt).

### Performance dashboard **[T2]**
A `/status` route (or a sub-page under About) showing the site's own
engineering metrics:

- Lighthouse scores (Performance / A11y / SEO / Best Practices)
- Core Web Vitals (LCP / INP / CLS)
- Bundle size + gzip
- Build time
- Deployed commit SHA + build date

**How**: gather at build time via a small script (`scripts/collect-metrics.mjs`)
run in `postbuild`. Writes to `public/metrics.json`. The page reads that
file and renders a Word "System Info" style panel — key/value grid,
color-coded rows (green / amber / red thresholds). Vercel's build env
gives us the commit SHA (`process.env.VERCEL_GIT_COMMIT_SHA`).

Lighthouse numbers need a separate CI step (e.g. `treosh/lighthouse-ci-action`
on push to main) that commits the JSON back — or a Vercel deploy hook that
pings a Lighthouse worker. Second phase.

### PWA support **[T3]**
Installable on mobile, works offline for the last-viewed content.

**How**: add a service worker (Workbox or hand-rolled), a
`public/manifest.webmanifest`, and PNG app icons at 192 / 512 / maskable.
Cache strategy:

- Shell (JS + CSS + fonts) → cache-first
- `/api/content` → stale-while-revalidate
- Images → cache-first with 30-day expiry

Realtime still works when online; when offline, show the last cached
content plus a subtle "Offline — last synced X" chip in the status bar.

### LinkedIn integration **[T1]**
Concretely: a LinkedIn card on the Home tab, and a link in the Contact
channels (already possible today, but honest-and-obvious would be to
adopt the LinkedIn "Follow" widget or an OG-style card).

**How**:
- Cheapest: just add a channel row with the correct icon + a good CTA.
  Already supported by the admin — user action, no code.
- More work: server-side fetch of LinkedIn OG data to render a preview
  card. Requires the URL to be public. Not worth doing before Contact
  form ships.

### Chatbot **[T3]**
"Chat with the portfolio" — visitor asks natural-language questions
about your work, gets an answer sourced from the actual content.

**How**: content is already JSON (Supabase `site_content`). Options:

- Simplest (~1 day): a small Vercel function that takes the visitor's
  question + the content JSON as context, calls Claude Haiku, returns
  streamed tokens. UI: bottom-right chat pill; opens a small
  Word-comment-style panel.
- More work: embed each project as a vector in Supabase pgvector, do
  RAG. Only worth it once content is >30 KB and Haiku with full context
  becomes slow/expensive.

Rate-limit per IP hash — cheap defense against abuse. Never ship without
that.

---

## Admin — you-only tools

### Activity log **[T2]**
Every content change writes a row: who (single-admin for now, extensible
later), what section, timestamp, and a compact diff.

**How**: intercept `saveContent` in `src/lib/content.ts` and PUT to
`/api/activity` alongside the content push. Supabase `activity_log`
table: `(id, section, diff jsonb, created_at)`. Admin surfaces it as a
Word-style "Track Changes" panel — chronological, filterable by section.

### Version history + restore **[T2]**
Every save creates a snapshot; admin can browse and restore any point.

**How**: on each `PUT /api/content`, insert a row into
`content_versions(id, content jsonb, created_at)` before doing the
upsert on `site_content`. Admin adds a Tools → History card showing
timestamped versions with a "Restore" button; clicking calls `PUT
/api/content` with that snapshot's JSON.

Cost: base64 image data URLs balloon the version table fast. Two
tactics: (a) prune versions older than 30 days via a scheduled function,
(b) store images by pointer (Supabase Storage) instead of inline
data URLs — see below.

### Role-based admin accounts **[T4]**
Only worth building if you actually collaborate. Current single-shared-
password model is fine for one editor.

**How when needed**: replace the HMAC-token flow in `api/_lib/auth.ts`
with Supabase Auth. Roles table with `admin` / `editor` / `viewer`.
Every server-side write checks role against the section being edited.
This is the biggest infra bump on the list — don't do it until there's
a second editor.

### Full-text search **[T3]**
Across projects, credentials, skills, contact — a `Ctrl+F`-style palette
that jumps to the matching section on the live site.

**How**: on the admin side we already have all the content. Build a small
Fuse.js index client-side on mount; render a command palette (Cmd+K)
that jumps to the matching tab and scrolls to the match. Zero server
work.

### Automatic image optimization **[T2]**
Upload one PNG → get WebP + AVIF at multiple widths, plus a
`srcset`-ready `<picture>` payload.

**How**: two paths depending on where images end up:

- **Static** (`public/`): a `scripts/optimize-images.mjs` runs on
  `prebuild` with `sharp`, generates `.webp` + `.avif` at 480/960/1600px
  next to each source image. Data lives in a manifest file the
  components read.
- **Uploaded via admin** (currently base64 in JSON): move to Supabase
  Storage — admin uploads the original, a Supabase Edge Function
  generates the variants on the server, the admin gets back a set of
  URLs. Removes the localStorage size cliff too.

Prefer path 2 once bandwidth or storage starts hurting.

### Auto-generated email templates **[T3]**
When someone submits the contact form or requests your résumé, the
admin console shows a pre-filled reply template ready to send.

**How**: template stored in Supabase per template kind
(`inquiry_reply`, `resume_delivery`), with `{{name}}` / `{{message_excerpt}}`
placeholders. Admin panel "Compose reply" button opens a modal with the
merged text; a "Copy to clipboard" button + "Open in Gmail" link. No
SMTP setup needed for v1.

For v2, wire an actual send via Resend or a Vercel Function calling
Google's OAuth-authorized Gmail API. Only worth it if you find yourself
copy/pasting a lot.

---

## Priority slice for the next phase

If we do this in one sprint, ship in this order:

1. **Inquiry form + inbox** — visible utility, small scope, uses infra
   we already have. Unlocks Contact scheduling later.
2. **Skill logos + interactive tech stack** — biggest visible change on
   the site for a day of work.
3. **Interactive résumé builder** — 2-3 days but very portfolio-relevant.
4. **Real-time inbox notifications** — piggybacks on the Realtime layer
   already wired for content.
5. **PWA + performance dashboard** — proof-of-craft, one afternoon each.

Everything below that (activity log, version history, roles, chatbot,
scheduling, email templates) is worth it but should wait until you
actually feel the pain of not having it.
