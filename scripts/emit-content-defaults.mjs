/**
 * Writes dist/content-defaults.json — the content compiled into the site
 * bundle, as plain JSON.
 *
 * Why a build artefact and not an import: /api/chat needs the shipped
 * defaults to ground the assistant when no snapshot is published, but
 * every file under api/ is a self-contained Serverless Function. Importing
 * ../src/lib/data from one breaks it at module load — Vercel's dependency
 * tracer does not follow it, and the function 500s before the handler runs
 * (see the header note in api/content.ts, and commit 8dd569f which proved
 * it again). Fetching same-origin JSON has no import graph to get wrong.
 *
 * Runs in postbuild, after vite has emitted dist/.
 */

import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outFile = resolve(root, "dist/content-defaults.json");

if (!existsSync(resolve(root, "dist"))) {
  console.log("[content-defaults] no dist/ — skipping");
  process.exit(0);
}

const tmp = await mkdtemp(join(tmpdir(), "content-defaults-"));
const bundle = join(tmp, "data.mjs");

try {
  // data.ts is pure data; its only import is type-only and erased here.
  await build({
    entryPoints: [resolve(root, "src/lib/data.ts")],
    outfile: bundle,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });

  const d = await import(pathToFileURL(bundle).href);

  const content = {
    hero: d.defaultHero,
    about: d.defaultAbout,
    skills: d.skillGroups,
    projects: d.projects,
    certs: d.certs,
    timeline: d.timeline,
    contact: d.defaultContact,
  };

  for (const [key, value] of Object.entries(content)) {
    if (value === undefined) throw new Error(`data.ts exports no default for "${key}"`);
  }

  await writeFile(outFile, JSON.stringify(content));
  const bytes = (await readFile(outFile)).length;
  console.log(
    `[content-defaults] wrote ${outFile} — ${content.projects.length} projects, ${Math.round(bytes / 1024)} KB`
  );
} finally {
  await rm(tmp, { recursive: true, force: true });
}
