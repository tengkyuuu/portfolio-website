# Project Intake Prompt

A copy-paste prompt for gathering everything the **Admin → Projects** editor needs, without typing it by hand.

## How to use it

1. Open the *other* project's repo in Claude Code (or any AI with repo access).
2. Paste the prompt in [the block below](#the-prompt) verbatim.
3. It replies with one JSON object.
4. Paste that JSON back into *this* repo's chat and say "add this to Projects."
5. Screenshots stay manual: save the PNG/WebP files into [public/projects/](../public/projects/) using the filenames the JSON suggests.

The JSON mirrors the `Project` type in [src/lib/data.ts:14](../src/lib/data.ts#L14), which is what [ProjectsEditor.tsx](../src/pages/admin/ProjectsEditor.tsx) writes.

Fields deliberately **left out** of the prompt because they depend on position in the portfolio list, not on the project itself: `id`, `index`, `ref`, `page`. Those get assigned here.

---

## The prompt

````text
You are documenting THIS repository for an entry on my portfolio site. Read the
codebase first — README, package manifests, source, config, routes, schema,
tests, CI, and git history — then answer entirely from what you actually found.

Output ONE fenced ```json block and nothing else before or after it. Match this
shape exactly:

{
  "title": "",
  "kind": "embedded | web | mobile | desktop | design",
  "year": "",
  "blurb": "",
  "tags": [],
  "stack": [],
  "challenge": "",
  "solution": "",
  "metrics": [ { "label": "", "pre": "", "post": "", "delta": "" } ],
  "figCaption": "",
  "gallerySuggestions": [ { "filename": "", "whatToCapture": "", "alt": "" } ],
  "demoUrl": "",
  "videoUrl": "",
  "links": [ { "label": "", "href": "" } ],
  "uncertain": []
}

FIELD RULES

title
  The project's real display name. Proper case, no filler like "app" unless the
  name genuinely includes it.

kind
  Exactly one of: embedded, web, mobile, desktop, design. Pick by what the thing
  actually runs on — firmware/PCB is embedded, browser app is web, Flutter/RN is
  mobile, Electron/native is desktop, non-code work is design.

year
  Four digits, as a string. Use the most recent substantive commit year (check
  `git log -1 --format=%cd`), not today's date.

blurb
  ONE sentence, 20–40 words. What it is, who it's for, and the one thing that
  makes it interesting. Present tense, no "This project is…". Written for a
  hiring manager skimming, not for a developer reading docs.

tags
  3–4 short technology names, the headline ones only. These render as small
  pills, so keep each under ~14 characters. e.g. ["React", "TypeScript",
  "Firebase"]

stack
  6–8 entries, the fuller technical picture. Include framework, language,
  notable libraries, database, auth, hosting. Name specific libraries where they
  matter, e.g. "BLE (flutter_blue_plus)" rather than just "Bluetooth". No
  version numbers.

challenge
  ONE paragraph, 50–80 words. The problem that existed BEFORE this project — the
  constraint, the friction, the thing that was hard. Concrete and situational,
  not abstract. Do not describe the solution here. Do not start with "The
  challenge was".

solution
  ONE paragraph, 50–80 words. What was built and what changed because of it.
  Name the actual architectural decisions that mattered — why offline-first, why
  that data model, why that protocol. End on the outcome. Do not repeat the
  stack list verbatim.

metrics
  ONLY if the repo contains real evidence: benchmarks, Lighthouse scores,
  bundle-size reports, load-test output, test-coverage numbers, before/after
  notes in commits or docs. Each entry needs a short label, a pre value, a post
  value, and a delta like "+85%" or "−1.2s". If there is no such evidence,
  return an empty array. NEVER estimate, guess, or invent a number here.

figCaption
  One line describing the primary screenshot, in the form:
  "FIG N.1: {short description of what the screenshot shows}."
  Leave the literal "N" in place — the number gets assigned on the portfolio
  side. Describe the actual UI, not the project in general.

gallerySuggestions
  2–4 screenshots worth taking, most representative first. For each:
    filename       kebab-case, no extension, prefixed with the repo name.
                   e.g. "poias-dashboard"
    whatToCapture  precise instruction — which route/screen, which state, which
                   data visible, light or dark mode. Written so I can reproduce
                   it without re-reading the code.
    alt            real alt text for the finished screenshot, 15–30 words,
                   describing what is visibly on screen (layout, key elements,
                   colours) — not the project's purpose. This is used for
                   accessibility, so be literal.

demoUrl
  Live deployed URL if one is verifiable in the repo — README badge, deploy
  config, vercel.json, CNAME, CI workflow, package.json homepage. Empty string
  if you cannot verify one. Do not guess a URL from the project name.

videoUrl
  YouTube link or committed demo video path, if one exists in the repo. Empty
  string otherwise.

links
  Repo URL from the git remote, plus any docs site, case study, app-store
  listing, or design file referenced in the repo. Label each in 1–2 words
  ("Repo", "Docs", "Case study", "Figma"). Empty array if nothing verifiable.

uncertain
  Every field above where you had to infer rather than confirm, one short line
  each, naming the field and what you were unsure about. Be honest here — an
  empty array means you verified everything. This is the most useful field in
  the whole object, so do not leave it empty just to look confident.

HARD RULES
- Never invent metrics, URLs, dates, or client names. Absent > fabricated.
- Prefer what the code does over what the README claims it does. If they
  disagree, note it in "uncertain".
- Use straight quotes and plain ASCII, except for "—" (em dash) and "×" where
  natural. No markdown formatting inside any string value.
- Omit no keys. Use "" for unknown strings and [] for unknown arrays.
- Do not add commentary, preamble, or a summary after the JSON block.
````

---

## Style notes (why the prompt asks for what it does)

- **Blurb vs. challenge/solution** — the site shows `blurb` only when `challenge` and `solution` are both empty, so the blurb has to stand alone.
- **`tags` vs. `stack`** — tags are pills inside the figure (short, 3–4); stack is the chip row under the write-up (fuller, 6–8).
- **`metrics`** renders a Pre / Post / Δ table. An empty array simply hides it, which is better than a table of invented numbers.
- **`demoUrl`** adds a "Web Layout" tab that iframes the live site in device frames. Sites that send `X-Frame-Options: DENY` fall back gracefully, but a wrong URL is worse than none.
- **`videoUrl`** adds a "Media" tab.
- **`alt` text** is real accessibility text, not SEO filler — hence the "describe what is visible" instruction.
