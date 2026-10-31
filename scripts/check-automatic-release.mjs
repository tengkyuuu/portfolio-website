/** Exercise two successive deployments with a real browser and service worker. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const root = resolve("dist");
const originalId = JSON.parse(await readFile(resolve(root, "release.json"), "utf8")).id;
let generation = "first";
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    res.setHeader("Cache-Control", "no-store");
    if (path.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      res.end("{}"); return;
    }
    let relative = path === "/" ? "index.html" : path.slice(1);
    relative = relative.replace("-second.js", ".js");
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    let body = await readFile(file);
    const ext = extname(file);
    const types = { ".js": "application/javascript", ".json": "application/json", ".html": "text/html", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    if ([".js", ".json", ".html"].includes(ext)) {
      let text = body.toString();
      if (generation === "second") text = text.replaceAll(originalId, "browser-test-second-release");
      if (ext === ".html") {
        text = text.replace("</head>", `<meta name="test-release" content="${generation}"></head>`);
        if (generation === "second") text = text.replace(/(src="\/assets\/[^\"]+)\.js"/, '$1-second.js"');
      }
      body = Buffer.from(text);
    }
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let navigations = 0;
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
  await page.goto(`http://127.0.0.1:${server.address().port}/#top`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(2000);
  assert.equal(navigations, 1, "First installation must not reload the page");
  generation = "second";
  console.log("Second release is available; waiting for automatic detection without interaction.");
  await page.waitForFunction(() => document.querySelector('meta[name="test-release"]')?.content === "second", undefined, { timeout: 75_000 });
  await page.waitForTimeout(4000);
  assert.equal(navigations, 2, "New release must reload exactly once");
  assert.equal(await page.getByText("Update available", { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: first install stays put; a later release loads automatically once, without a button.");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
