/**
 * One-off generator for src/lib/translations/{ceb,tl,cbk}.ts.
 *
 * Run locally with:  node scripts/translate-content.mjs [lang...]
 *   node scripts/translate-content.mjs           — all three languages
 *   node scripts/translate-content.mjs ceb        — just Cebuano
 *
 * Reads the English defaults straight out of data.ts (same esbuild-bundle-
 * then-import trick as emit-content-defaults.mjs, since this is a plain
 * .mjs script and data.ts is TypeScript), builds the translatable subset
 * described by src/lib/translations/schema.ts, and asks Gemini to
 * translate it once per language. The output is committed to the repo —
 * this does not run in CI or on Vercel, and nothing calls Gemini again
 * until this script is re-run by hand after a material content edit.
 *
 * Only prose goes in the request: tags, stack, hrefs, dates, org names,
 * and cert titles/issuers never leave data.ts, so there's nothing for the
 * model to mistranslate there in the first place.
 */
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";

const root = process.cwd();
const env = { ...loadEnv("development", root, ""), ...process.env };
const API_KEY = env.GEMINI_API_KEY;
// Deliberately not GEMINI_MODEL (api/chat.ts's "Blue" model) — this is a
// one-off local batch job, independent of whatever the live chat feature
// is pinned to, and gemini-3.8-flash was 503ing (overloaded) when this
// script was written.
const MODEL = env.TRANSLATE_MODEL || "gemini-flash-latest";

if (!API_KEY) {
  console.error("[translate] GEMINI_API_KEY is not set (checked .env.local and process.env).");
  process.exit(1);
}

const LANGUAGES = {
  ceb: {
    name: "Cebuano (Sinugbuanong Binisayâ)",
    note:
      "Natural Bisaya as an educated Filipino tech professional would actually write it — code-switch English for technical/professional vocabulary the way real Cebuano speech does (\"Computer Engineer\", \"firmware\", \"dashboard\", framework and tool names) rather than forcing an artificial full translation of every technical concept.",
  },
  tl: {
    name: "Tagalog (Filipino)",
    note:
      "Natural Filipino as an educated Manila-tech-scene professional would write it — code-switch English technical/professional vocabulary rather than forcing a translation of every technical concept.",
  },
  cbk: {
    name: "Zamboangueño Chavacano",
    note:
      "The Zamboanga City variety specifically, not Caviteño or another Chavacano variety — Spanish-derived vocabulary and grammar with the code-switching a Zamboangueño tech professional would actually use for technical/professional terms.",
  },
};

const only = process.argv.slice(2).filter((a) => a in LANGUAGES);
const targets = only.length ? only : Object.keys(LANGUAGES);

/* ---------------- load data.ts's exports (see emit-content-defaults.mjs) ---------------- */

const tmp = await mkdtemp(join(tmpdir(), "translate-content-"));
const bundle = join(tmp, "data.mjs");
let d;
try {
  await build({
    entryPoints: [resolve(root, "src/lib/data.ts")],
    outfile: bundle,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  d = await import(pathToFileURL(bundle).href);
} finally {
  await rm(tmp, { recursive: true, force: true });
}

/* ---------------- build the translatable extract ---------------- */

/** Words, not literal date ranges — those the timeline entries are strewn with. */
const WORD_RANGES = new Set(["Freelance", "Internship", "College"]);

function buildExtract() {
  const projects = {};
  for (const p of d.projects) {
    const entry = {};
    if (p.blurb) entry.blurb = p.blurb;
    if (p.challenge) entry.challenge = p.challenge;
    if (p.solution) entry.solution = p.solution;
    if (p.figCaption) entry.figCaption = p.figCaption;
    if (p.gallery?.length) entry.galleryAlts = p.gallery.map((g) => g.alt ?? "");
    if (p.metrics?.length) entry.metricLabels = p.metrics.map((m) => m.label);
    projects[p.id] = entry;
  }

  const timeline = d.timeline.map((t) => {
    const entry = { title: t.title, blurb: t.blurb };
    if (WORD_RANGES.has(t.range)) entry.range = t.range;
    return entry;
  });

  const processStages = {};
  for (const s of d.processStages) {
    processStages[s.n] = { title: s.title, summary: s.summary, detail: s.detail };
  }

  const nowGroups = {};
  for (const g of d.nowGroups) {
    nowGroups[g.label] = {
      label: g.label,
      items: Object.fromEntries(g.items.map((i) => [i.name, i.note])),
    };
  }

  return {
    hero: {
      eyebrow: d.defaultHero.eyebrow,
      role: d.defaultHero.role,
      availableText: d.defaultHero.availableText,
      tagline: d.defaultHero.tagline,
      abstract: d.defaultHero.abstract,
    },
    about: {
      paragraphs: d.defaultAbout.paragraphs,
      highlights: d.defaultAbout.highlights,
      specLabels: Object.fromEntries(d.defaultAbout.specs.map((s) => [s.label, s.label])),
    },
    contact: {
      intro: d.defaultContact.intro,
      channelLabels: Object.fromEntries(
        d.defaultContact.channels
          .filter((c) => c.label === "Email" || c.label === "Location")
          .map((c) => [c.label, c.label])
      ),
    },
    skillGroupLabels: Object.fromEntries(d.skillGroups.map((g) => [g.label, g.label])),
    projects,
    timeline,
    processStages,
    nowGroups,
  };
}

/* ---------------- ask Gemini to translate the extract ---------------- */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translate(langId, extract) {
  const lang = LANGUAGES[langId];
  const prompt = `Translate every string VALUE in this JSON into ${lang.name}. ${lang.note}

Rules:
- Preserve the exact JSON structure and every key — translate values only.
- Preserve markdown formatting (**bold**, *italic*, [text](url) links) and inline HTML tags (<em>...</em>) exactly, translating only the text inside them.
- Preserve blank-line paragraph breaks (\\n\\n) exactly where they appear.
- Never translate proper nouns, brand/product names, or code identifiers if any slip through (there shouldn't be any in this input).
- Return ONLY the translated JSON, same shape, no commentary.

JSON:
${JSON.stringify(extract, null, 2)}`;

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const wait = 2 ** attempt * 1000;
      console.log(`[translate] ${langId}: retrying in ${wait}ms (attempt ${attempt + 1}/4)…`);
      await sleep(wait);
    }
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            // No maxOutputTokens: setting it at all (any value) 429s on
            // this key's quota — "exceeded your current quota" — while
            // omitting it and taking the model's own default ceiling
            // works fine. Found by bisecting the generationConfig live.
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      if (!res.ok) {
        const body = await res.text();
        // 429/503 are transient (rate limit / model overloaded) — worth a
        // retry. Anything else (400/401/etc.) won't fix itself.
        if (res.status === 429 || res.status === 503) {
          lastErr = new Error(`Gemini ${res.status} for ${langId}: ${body}`);
          continue;
        }
        throw new Error(`Gemini ${res.status} for ${langId}: ${body}`);
      }
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`${langId}: response wasn't valid JSON:\n${text.slice(0, 500)}`);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function tsLiteral(value) {
  return JSON.stringify(value, null, 2);
}

async function main() {
  const extract = buildExtract();
  for (const langId of targets) {
    console.log(`[translate] ${langId} (${LANGUAGES[langId].name})…`);
    const translated = await translate(langId, extract);
    const out = resolve(root, `src/lib/translations/${langId}.ts`);
    const body = `import type { ContentTranslation } from "./schema";

/**
 * ${LANGUAGES[langId].name} — one-time AI translation of data.ts's
 * English defaults, generated by scripts/translate-content.mjs.
 * Static, not live: re-run the script (or edit by hand) after a
 * material change to the English copy this was translated from.
 */
export const ${langId}: ContentTranslation = ${tsLiteral(translated)};
`;
    await writeFile(out, body);
    console.log(`[translate] wrote ${out}`);
  }
}

await main();
