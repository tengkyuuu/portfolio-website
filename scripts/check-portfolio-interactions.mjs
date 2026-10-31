import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise shipped defaults, independent of a local/published draft.
  await page.route("**/api/content", (route) => route.fulfill({ json: {} }));
  const go = async (hash) => { await page.goto(`http://127.0.0.1:5173/#${hash}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1800); };
  await go("top");
  const portrait = page.locator(".portrait-object");
  const before = await portrait.evaluate((el) => el.getBoundingClientRect().toJSON());
  await portrait.hover();
  const after = await portrait.evaluate((el) => ({ rect: el.getBoundingClientRect().toJSON(), transform: getComputedStyle(el).transform, shades: getComputedStyle(el.querySelector(".portrait-shades")).opacity }));
  assert.equal(after.transform, "none"); assert.equal(after.shades, "1"); assert.equal(before.x, after.rect.x); assert.equal(before.y, after.rect.y);
  const resume = await page.getByRole("link", { name: /Download résumé/ }).getAttribute("href");
  assert.match(resume, /resume\.pdf\?v=/);
  const download = await page.request.get(`http://127.0.0.1:5173${resume}`);
  assert.equal(download.status(), 200); assert.equal((await download.body()).subarray(0, 4).toString(), "%PDF");

  await go("work");
  assert.equal(await page.locator(".project-contents img").count(), 0);
  assert(await page.locator(".project-contents a").first().evaluate((el) => {
    const group = el.closest(".sheet-flow"), sheet = group.querySelector(".paper-surface");
    return el.getBoundingClientRect().bottom < sheet.getBoundingClientRect().bottom - 64;
  }), "Contents must begin on the first project sheet");
  await page.getByRole("link", { name: "Explore Flux", exact: true }).click();
  assert.equal(new URL(page.url()).hash, "#proj-flux");
  assert.equal(await page.locator("#proj-flux table").count(), 0);
  const launch = page.getByRole("button", { name: "Try the alert logic", exact: true });
  assert.equal(await page.getByRole("dialog").count(), 0);
  await launch.click();
  await page.getByRole("dialog", { name: "SHM alert simulation" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert(await launch.evaluate((el) => el === document.activeElement));

  await page.getByRole("button", { name: "Highlight text", exact: true }).click();
  const select = async () => {
    await page.locator("#proj-flux p").first().evaluate((el) => {
      const range = document.createRange(); range.selectNodeContents(el);
      const selected = window.getSelection(); selected.removeAllRanges(); selected.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await page.waitForTimeout(100);
  };
  await select();
  await page.getByRole("button", { name: "Highlight selection", exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("jvc_text_marks_v1")).marks.length), 1);
  assert.equal(await page.evaluate(() => CSS.highlights.get("visitor-marks").size), 1);
  await page.reload(); await page.waitForTimeout(1900);
  assert.equal(await page.evaluate(() => CSS.highlights.get("visitor-marks").size), 1);
  await page.getByRole("button", { name: "Highlight text", exact: true }).click();
  await select(); await page.getByRole("button", { name: "Remove selected", exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("jvc_text_marks_v1")).marks.length), 0);

  await go("credentials");
  for (const name of [/Google Cloud Gen AI/, /^Python\s*Sololearn/]) {
    const trigger = page.getByRole("button", { name });
    await trigger.click();
    await page.getByRole("dialog").waitFor();
    const images = page.getByRole("dialog").locator("img");
    await images.first().evaluate((img) => img.decode());
    assert(await images.first().evaluate((img) => img.naturalWidth > 0));
    await page.keyboard.press("Escape");
    assert(await trigger.evaluate((el) => el === document.activeElement));
  }
  await go("about");
  assert(await page.getByText(/currently building my own orchestrator software/).count());
  await page.getByRole("button", { name: /Build in small steps/ }).click();
  assert(await page.getByText(/Sonnet implements each task/).isVisible());
  await go("stack");
  await page.getByRole("button", { name: "Sortable matrix", exact: true }).click();
  assert(await page.getByRole("table").isVisible());
  await page.setViewportSize({ width: 320, height: 900 });
  await page.waitForTimeout(300);
  assert.equal(await page.locator("table thead th:visible").count(), 3);
  await go("blog/flux-contrast-tests");
  assert(await page.getByRole("heading", { name: "When a brand colour fails its own text" }).isVisible());
  assert.deepEqual(errors, []);
  console.log("Passed: portrait, ATS download, contents/deep links, Flux, SHM modal, highlight persistence/removal, certificate image/PDF modals, workflow, responsive skills matrix, blog.");
} finally { await browser.close(); }
