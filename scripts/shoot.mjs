#!/usr/bin/env node
/**
 * Screenshot the running site.
 *
 * Every UI change before this one was verified by reading the DOM in
 * jsdom, which will happily tell you an element exists while it renders
 * white-on-white, overflows its column, or sits behind the ribbon. This
 * takes the picture instead.
 *
 *   npm run dev                       # in one terminal
 *   node scripts/shoot.mjs            # in another
 *
 * Options:
 *   --url <origin>     default http://localhost:5173
 *   --out <dir>        default .screenshots  (gitignored)
 *   --only <a,b>       subset of shot names
 *   --theme <id>       one theme instead of every theme in THEMES
 *
 * Shots are named <shot>.<theme>.<viewport>.png so a diff of two runs
 * lines up pairwise.
 */

import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const ORIGIN = args.url ?? "http://localhost:5173";
const OUT = path.resolve(args.out ?? ".screenshots");
// "colorful" is the default Word-blue look; "black" is where the
// white-on-pale-blue contrast bug lived, so both get shot by default.
const THEMES = args.theme ? [args.theme] : ["colorful", "black"];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

/**
 * `at` runs after navigation, before the shot — for opening the disclosure
 * or menu whose closed state the page would otherwise be stuck in.
 */
const SHOTS = [
  { name: "home", hash: "#top" },
  { name: "credentials", hash: "#credentials" },
  {
    name: "credentials-open",
    hash: "#credentials",
    at: async (page) => {
      const toggle = page.getByRole("button", { name: /Course Certificates/i });
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      await page.waitForTimeout(500); // card transition is 460ms
    },
  },
  {
    name: "file-menu",
    hash: "#top",
    at: async (page) => {
      await page.getByRole("button", { name: /^(File|Archivo)$/ }).click();
      await page.waitForTimeout(150);
    },
  },
  { name: "projects", hash: "#work" },
  { name: "about", hash: "#about" },
  { name: "contact", hash: "#contact" },
];

const wanted = args.only ? new Set(args.only.split(",")) : null;
const shots = SHOTS.filter((s) => !wanted || wanted.has(s.name));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const failures = [];
let taken = 0;

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      // The theme is read from localStorage before React mounts, so it has
      // to be seeded on the origin rather than toggled after load.
      storageState: {
        cookies: [],
        origins: [
          {
            origin: ORIGIN,
            localStorage: [{ name: "jvc_theme_v2", value: theme }],
          },
        ],
      },
    });
    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") failures.push(`[${theme}/${vp.name}] console: ${m.text()}`);
    });
    page.on("pageerror", (e) => failures.push(`[${theme}/${vp.name}] pageerror: ${e.message}`));

    for (const shot of shots) {
      try {
        // Not networkidle: Vite's HMR socket in dev never goes quiet, so
        // the first navigation in every context would sit there until it
        // timed out. Wait for the document instead, then for the things
        // that actually move the layout.
        await page.goto(ORIGIN + "/" + shot.hash, { waitUntil: "load" });
        await page.waitForSelector("#paper-doc", { timeout: 15_000 });
        // Fonts settle late; an unsettled shot mismeasures every line.
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        if (shot.at) await shot.at(page);
        const file = path.join(OUT, `${shot.name}.${theme}.${vp.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        taken++;
        console.log("  " + path.relative(process.cwd(), file));
      } catch (err) {
        failures.push(`[${theme}/${vp.name}] ${shot.name}: ${err.message.split("\n")[0]}`);
      }
    }
    await ctx.close();
  }
}

await browser.close();

console.log(`\n${taken} shot(s) -> ${path.relative(process.cwd(), OUT)}`);
if (failures.length) {
  console.log("\nproblems:");
  for (const f of failures) console.log("  " + f);
  process.exitCode = 1;
}
