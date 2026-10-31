import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];
await page.route("**/api/content", (route) => route.fulfill({ json: {} }));
page.on("pageerror", (error) => console.error(error.message));
for (const width of [1440, 390, 320]) {
  await page.setViewportSize({ width, height: 950 });
  for (const route of ["top", "work", "about", "stack", "credentials", "blog", "blog/flux-contrast-tests", "gallery", "contact"]) {
    await page.goto(`http://127.0.0.1:5173/#${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1900);
    await page.locator(".sheet-flow-content").first().waitFor();
    const report = await page.evaluate(() => {
      const bad = [];
      for (const group of document.querySelectorAll(".sheet-flow")) {
        const page = group.querySelector(".paper-surface");
        const height = page.offsetHeight, gap = 28, inset = group.offsetWidth < 600 ? 23 : 37, bottom = group.offsetWidth < 600 ? 54 : 64;
        const origin = group.getBoundingClientRect().top;
        const walk = document.createTreeWalker(group.querySelector(".sheet-flow-content"), NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
          const node = walk.currentNode;
          if (!node.textContent.trim() || node.parentElement.closest(".sr-only, .no-print, [aria-hidden=true], .material-symbols-outlined, dialog")) continue;
          if (node.parentElement.closest("details:not([open])") && !node.parentElement.closest("summary")) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (!rect.width || !rect.height) continue;
            const y = rect.top - origin, local = y % (height + gap);
            if (local < inset - 3 || local + rect.height > height - bottom + 3) {
              bad.push({ text: node.textContent.slice(0, 60), y: Math.round(y), local: Math.round(local), tag: node.parentElement.tagName }); break;
            }
          }
        }
      }
      return { sheets: document.querySelectorAll(".paper-surface").length, sizes: [...new Set([...document.querySelectorAll(".paper-surface")].map((el) => `${el.offsetWidth}x${el.offsetHeight}`))], bad: bad.length, samples: bad.slice(0, 5) };
    });
    console.log(JSON.stringify({ width, route, ...report }));
    if (report.bad || report.sizes.length !== 1) failures.push({ width, route, ...report });
  }
}
await browser.close();
assert.deepEqual(failures, [], "Every visible line must stay inside equal-sized sheets");
