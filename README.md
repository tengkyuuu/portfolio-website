# Portfolio v2 — JVC

A portfolio themed as a **Microsoft Word document**: bond-paper layout on a
workspace, ribbon-style nav, blue status bar, and one paper sheet per section.
Built with React, TypeScript, and Tailwind v4.

## Run locally

```bash
cd v2
npm install
npm run dev
```

Open http://localhost:5173. The dev server also mounts a small content API (see
[Admin](#admin) below) on the same port.

## Build

```bash
npm run build      # tsc -b && vite build  →  dist/
npm run preview    # serve the production build locally
```

## Editing content

There are two ways to change what the site shows:

1. **Defaults in code** — [`src/lib/data.ts`](src/lib/data.ts) and
   [`src/lib/content.ts`](src/lib/content.ts) hold the projects, skills, certs,
   bio, and contact info. Edit these and redeploy; this is what every visitor
   sees on a static deploy.
2. **Admin panel** — visit `/admin`. On the deployed (static) site, edits are
   saved in **your browser only** (great for drafting + the Tools → Copy/Download
   JSON backup), but they aren't published to other visitors. To make an edit
   public, paste the exported JSON into `data.ts`/`content.ts` and redeploy, or
   run the local dev server which has a writable file-backed API.

### Project images

Put screenshots in [`public/projects/`](public/projects/) and reference them by
path (e.g. `/projects/physiopano-app.png`) in a project's `gallery`. Two or more
images render as a carousel with arrows. You can also upload them in `/admin`.

## Admin

The admin is gated by a SHA-256 hash of your password — the plaintext never
ships, only the hash. Set it via env var:

```
VITE_ADMIN_PASSWORD_HASH=<sha-256 hex of your password>
```

Generate the hash at `/admin` (the setup screen has a built-in generator) or with
`node -e "console.log(require('crypto').createHash('sha256').update('PW').digest('hex'))"`.
See [`.env.example`](.env.example). Locally this goes in `.env.local`.

## Deploy to Vercel

This is configured as a **static SPA** ([`vercel.json`](vercel.json)): Vercel runs
`npm run build` and serves `dist/`, with a rewrite so client routes like `/admin`
resolve to `index.html`.

1. Push this folder to a GitHub repo.
2. In the Vercel dashboard: **Add New → Project → Import** the repo.
   - Framework preset: **Vite** (auto-detected).
   - Build command / output: already set by `vercel.json` (`npm run build` → `dist`).
3. Add an Environment Variable: **`VITE_ADMIN_PASSWORD_HASH`** = your hash
   (Production + Preview). Without it, `/admin` shows the setup screen.
4. **Deploy.** Every push to the default branch redeploys automatically.

The Express server under `server/` powers the writable API for **local dev only**
and is not used by the static deploy.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config in `src/index.css` via `@theme`)
- **Material Symbols** + **Source Serif 4 / Inter** from Google Fonts
- **Express** (local dev content API only)
