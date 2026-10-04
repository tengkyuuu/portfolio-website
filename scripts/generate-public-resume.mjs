/** Generate the public, read-only PDF from the portfolio's shipped content. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const content = JSON.parse(await readFile(resolve(root, "dist/content-defaults.json"), "utf8"));
const htmlEscape = (value = "") => String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const plain = (value = "") => String(value).replace(/<[^>]*>/g, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
const selected = ["stormfresh-erp", "flux", "shm"].map((id) => content.projects.find((p) => p.id === id)).filter(Boolean);
const skills = content.skills.filter((s) => ["Embedded", "Frontend", "Design", "Tools & Backend"].includes(s.label));
const links = content.contact.channels.filter((c) => c.href?.startsWith("https://") && ["GitHub", "LinkedIn"].includes(c.label));
const selectedExperience = content.timeline.filter((t) => t.title === "SaaS Frontend Developer & Designer" || t.title === "BS Computer Engineering");
const resume = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${htmlEscape(content.hero.name)} — Résumé</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; color: #182238; background: white; font-family: Arial, Helvetica, sans-serif; }
.page { width: 210mm; min-height: 297mm; padding: 16mm 18mm 13mm; }
h1 { font-size: 24pt; line-height: 1.08; letter-spacing: -.025em; margin: 0 0 3mm; color: #183b70; }
.role { font-size: 11pt; line-height: 1.3; margin: 0 0 5mm; font-weight: 600; }
.contact { display: flex; flex-wrap: wrap; gap: 2mm 5mm; font-size: 8.4pt; line-height: 1.35; padding-bottom: 6mm; border-bottom: 1pt solid #b8c5d5; }
a { color: #183b70; text-decoration: none; }
section { margin-top: 6.1mm; break-inside: avoid; }
h2 { color: #183b70; font-size: 9.3pt; text-transform: uppercase; letter-spacing: .075em; margin: 0 0 2mm; border-bottom: .5pt solid #c6d1dd; padding-bottom: 1.5mm; }
p { font-size: 9pt; line-height: 1.4; margin: 0; }
.skills { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 7mm; }
.skills p { font-size: 8.4pt; }
.entry { margin-bottom: 3.1mm; break-inside: avoid; }
.entry:last-child { margin-bottom: 0; }
.entry-head { display: flex; justify-content: space-between; gap: 3mm; align-items: baseline; }
.entry strong { font-size: 9.3pt; }
.entry small { font-size: 8pt; color: #526176; white-space: nowrap; }
.entry p { margin-top: 1mm; font-size: 8.55pt; }
.subline { color: #526176; }
.footer { margin-top: 6mm; border-top: .5pt solid #c6d1dd; padding-top: 2mm; color: #526176; font-size: 8pt; }
</style><main class="page">
<header><h1>${htmlEscape(content.hero.name)}</h1><p class="role">${htmlEscape(content.hero.role)}</p>
<div class="contact"><a href="mailto:${htmlEscape(content.hero.email)}">${htmlEscape(content.hero.email)}</a><span>${htmlEscape(content.hero.location)}</span><a href="${htmlEscape(content.hero.website)}">${htmlEscape(content.hero.website.replace(/^https?:\/\//, ""))}</a>${links.map((l) => `<a href="${htmlEscape(l.href)}">${htmlEscape(l.value)}</a>`).join("")}</div></header>
<section><h2>Profile</h2><p>${htmlEscape(plain(content.about.paragraphs))}</p></section>
<section><h2>Skills</h2><div class="skills">${skills.map((s) => `<p><strong>${htmlEscape(s.label)}:</strong> ${htmlEscape(s.items.slice(0, 6).join(", "))}</p>`).join("")}</div></section>
<section><h2>Selected work</h2>${selected.map((p) => `<div class="entry"><div class="entry-head"><strong>${htmlEscape(p.title)}</strong><small>${htmlEscape(p.year ?? "")}</small></div><p>${htmlEscape(plain(p.contribution || p.blurb))} ${htmlEscape(plain(p.id === "shm" ? "See the sensor-node dashboard and case study on the portfolio." : p.result || ""))}</p></div>`).join("")}</section>
<section><h2>Experience & education</h2>${selectedExperience.map((t) => `<div class="entry"><div class="entry-head"><strong>${htmlEscape(t.title)}</strong><small>${htmlEscape(t.range)}</small></div><p class="subline">${htmlEscape(t.org)}</p><p>${htmlEscape(plain(t.blurb))}</p></div>`).join("")}</section>
<section><h2>Selected recognition</h2><p>${htmlEscape(content.certs.filter((c) => c.title.includes("Champion") || c.title.includes("Google Cloud")).map((c) => `${c.title} — ${c.issuer}`).join("  ·  "))}</p></section>
<p class="footer">More project details, screenshots, and live demos: ${htmlEscape(content.hero.website)}</p>
</main></html>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(resume);
  if (process.env.RESUME_PREVIEW) {
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.screenshot({ path: resolve(root, ".screenshots/resume-preview.png"), fullPage: true });
  }
  const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  const target = resolve(root, "public/james-vincent-calunsag-resume.pdf");
  await writeFile(target, pdf);
  console.log(`[resume] wrote ${target} (${pdf.length} bytes)`);
} finally {
  await browser.close();
}
