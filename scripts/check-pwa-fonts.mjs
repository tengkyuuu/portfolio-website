// Run against a production preview or the deployed site, with the real worker enabled.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.argv[2] || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // initPwa reloads once on first activation; let that finish before
  // initiating the two repeat visits we want to verify.
  await page.waitForFunction(() => performance.getEntriesByType("navigation")[0]?.type === "reload");
  await page.waitForLoadState("load");
  for (let visit = 1; visit <= 2; visit++) {
    // First activation can trigger the app's own controllerchange reload
    // at the same time. Wait for that navigation if it supersedes ours.
    await page.reload({ waitUntil: "load" }).catch(error => {
      if (!error.message.includes("ERR_ABORTED")) throw error;
    });
    await page.waitForLoadState("load");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.fonts].some(font => font.family.replaceAll('"', "") === "Material Symbols Outlined" && font.status === "loaded"));
    const state = await page.evaluate(() => ({
      controlled: !!navigator.serviceWorker.controller,
      loaded: [...document.fonts].filter(font => font.status === "loaded").map(font => font.family.replaceAll('"', "")),
      iconFonts: [...document.querySelectorAll(".material-symbols-outlined")].map(el => getComputedStyle(el).fontFamily),
    }));
    assert.equal(state.controlled, true);
    for (const family of ["Inter", "Source Serif 4", "Material Symbols Outlined"]) assert.ok(state.loaded.includes(family), `${family} missing on visit ${visit}`);
    assert.ok(state.iconFonts.every(font => font.includes("Material Symbols Outlined")), "An icon is falling back to text");
    console.log(`Visit ${visit}: worker active; all three fonts and icon styles loaded.`);
  }
} finally { await browser.close(); }
