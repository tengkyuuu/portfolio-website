# Portfolio.docx — working conventions

A React + TypeScript portfolio built to look and behave like a Microsoft
Word document. Read this before changing anything; most of it is written
down because getting it wrong has already cost a day.

## Hard constraints

**Twelve Serverless Functions, no more.** Every `.ts` file under `api/` is
built as one, and the Hobby plan caps a deployment at twelve. Going over
does **not** fail the build — the build completes, the log reads clean, CI
stays green, and the deployment is rejected afterwards at "Deploying
outputs…" while production silently keeps serving the previous version.
Test files are kept out of the count by `.vercelignore`; `api/limits.test.ts`
fails the suite if a thirteenth handler appears. To add an endpoint, remove
or merge one first.

**`src/lib/data.ts` is the source of truth for content.** A snapshot
published from `/admin` lives in Supabase and *replaces* the defaults
wholesale — `normalizeContent` does `stored.projects ?? DEFAULT_CONTENT.projects`,
not a merge. A project added to `data.ts` while a published row exists is
invisible on the live site. Either publish through the admin, or reset the
row so the repo wins.

**Never inline a base64 image.** Admin uploads arrive as data URLs. They
belong in `public/projects/` as files — 100 KB of base64 in `data.ts` ships
in every visitor's JS bundle, and `data.test.ts` fails if one lands there.

**Secrets stay server-side.** `VITE_`-prefixed env vars are compiled into
the client bundle. API keys and tokens must only be read inside `api/`.

## Content and data

- Projects are numbered `01`, `02`, … in array order, and `ref`, `page`
  and the `FIG N.1:` caption must agree with that index. `data.test.ts`
  enforces all of it.
- Every local image path must resolve to a real file in `public/`.
- Every gallery image needs real alt text describing what is visibly on
  screen, not what the project is for.
- Do not invent metrics, dates, client names, or URLs. Absent beats
  fabricated. Project entries come from `docs/project-intake-prompt.md`,
  which requires an `uncertain` array — verify those before publishing.
- Skill "cadence" is the `level` field in `skill-catalog.ts` rendered as a
  0–3 signal. It is not a self-assessed score, and nothing should present
  it as one.

## Code

- TypeScript strict. `npx tsc -b` must pass — note it covers `src` only,
  not `api/`, so handlers are typechecked by their tests and by Vercel.
- Tailwind v4 with CSS-first tokens in `src/index.css`. Use the semantic
  tokens (`text-ink`, `bg-paper`, `border-rule`, `text-word-blue`); never
  hardcode a hex value in a component.
- Active states use `bg-word-blue text-paper`, not `text-white` —
  `--color-word-blue` is light in dark mode and white on it fails contrast.
- Every animation needs a `prefers-reduced-motion` escape.
- Interactive controls that are chrome rather than content get `no-print`.
- Accessible names come from element content, so an icon-plus-number
  button announces as gibberish. Give it an explicit `aria-label`.
- Material Symbol ligatures put their literal name into `textContent`.
  They are `aria-hidden`, but read-aloud uses `innerText` — keep that in
  mind when adding icons to a page that gets read.

## Tests

- `npm test` runs Vitest. New behaviour needs coverage; a bug that reached
  production needs a regression test in the same commit as its fix.
- Prefer testing derived logic and data integrity over rendering details.
  The valuable tests here are the ones that catch silent failures.
- Component tests query by accessible name. If that is hard to write, the
  component's accessibility is the thing to fix.

## Commits

- Subject in the imperative, no Conventional Commits prefix.
- The body explains **why**: the problem, the mechanism behind it, and why
  this fix over the alternatives. The diff already shows what changed.
- If a change was caused by an incident, say what the incident was.
- One logical change per commit. Branch off `main`, merge back, no
  `.planning`-style noise in the history.

## Deployment

- Push to `main` deploys via Vercel. `.github/workflows/tests.yml` gates it
  and publishes results to `/api/tests`; `lighthouse.yml` publishes scores
  to `/api/lighthouse`. Both surface on `/status`.
- After a push, verify the deploy actually promoted — check
  `/metrics.json`, which reports the commit the live build came from.
  A green CI run is not evidence that production changed.
- Optional integrations degrade to nothing rather than erroring:
  `/api/chat`, `/api/spotify` and `/api/github` all report an unconfigured
  state and their UI renders nothing. Keep that contract for anything new.
