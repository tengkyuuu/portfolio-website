import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  const paragraph = "Long-form content must stay readable and complete across every sheet. ".repeat(120);
  const code = Array.from({ length: 40 }, (_, n) => `const example${n} = "A long line that should wrap without losing its content.";`).join("\n");
  await page.route("**/api/content", (route) => route.fulfill({ json: {
    posts: [{ id: "layout-check", slug: "layout-check", title: "Long content check", date: "2026-10-31", excerpt: "Pagination fixture", body: `${paragraph}\n\n\`\`\`js\n${code}\n\`\`\``, tags: [], draft: false }],
  } }));
  await page.goto("http://127.0.0.1:5173/#blog/layout-check");
  await page.waitForTimeout(2100);
  assert.equal(await page.locator(".blog-prose p").textContent(), paragraph.trim());
  assert.equal(await page.locator(".blog-prose pre code").textContent(), code);
  const collisions = await page.locator(".sheet-flow").evaluate((group) => {
    const top = group.getBoundingClientRect().top;
    const height = group.querySelector(".paper-surface").offsetHeight;
    const walker = document.createTreeWalker(group.querySelector(".blog-prose"), NodeFilter.SHOW_TEXT);
    const bad = [];
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) {
        if (!rect.height || !rect.width) continue;
        const y = (rect.top - top) % (height + 28);
        if (y < 20 || y + rect.height > height - 51) { bad.push(walker.currentNode.textContent.slice(0, 30)); break; }
      }
    }
    return bad;
  });
  assert.deepEqual(collisions, []);
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".blog-prose p").textContent(), paragraph.trim());
  assert.equal(await page.locator(".paper-surface:visible").count(), 0);
  console.log("Passed: long paragraphs and code retain every character, paginate without footer collisions, and remain available in print.");
} finally { await browser.close(); }
