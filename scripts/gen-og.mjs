/**
 * One-off generator for the social preview image (public/og.png, 1200×630).
 * Run locally with:  node --experimental-vm-modules scripts/gen-og.mjs
 * (requires @resvg/resvg-js; install transiently with `npm i --no-save @resvg/resvg-js`)
 *
 * The output PNG is committed to the repo, so this script doesn't run on Vercel.
 */
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "og.png");

const W = 1200;
const H = 630;

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000000" flood-opacity="0.18"/>
    </filter>
  </defs>

  <!-- workspace -->
  <rect width="${W}" height="${H}" fill="#e6e6e6"/>

  <!-- paper -->
  <rect x="90" y="64" width="1020" height="470" rx="8" fill="#ffffff" filter="url(#shadow)"/>

  <!-- blue title rule -->
  <rect x="140" y="150" width="640" height="4" fill="#2b579a"/>

  <!-- eyebrow -->
  <text x="140" y="135" font-family="Arial, 'Segoe UI', sans-serif" font-size="20"
        letter-spacing="4" fill="#737782">PORTFOLIO · 2026 EDITION</text>

  <!-- name -->
  <text x="138" y="232" font-family="Georgia, 'Times New Roman', serif" font-size="72"
        font-weight="700" fill="#1a1c1c">James Vincent Calunsag</text>

  <!-- role -->
  <text x="140" y="280" font-family="Arial, 'Segoe UI', sans-serif" font-size="26"
        font-weight="600" fill="#2b579a">Computer Engineer · Embedded · Frontend · Design</text>

  <!-- tagline -->
  <text x="140" y="360" font-family="Georgia, serif" font-size="30" font-style="italic" fill="#434750">
    The ability to adapt is what makes a good engineer.
  </text>

  <!-- doc footer line -->
  <rect x="140" y="430" width="930" height="1" fill="#d6d8df"/>
  <text x="140" y="470" font-family="Arial, 'Segoe UI', sans-serif" font-size="22"
        font-weight="700" fill="#2b579a">▤ Portfolio.docx</text>
  <text x="1070" y="470" text-anchor="end" font-family="Arial, 'Segoe UI', sans-serif"
        font-size="20" fill="#737782">Dapitan City, PH</text>

  <!-- status strip -->
  <rect x="0" y="${H - 24}" width="${W}" height="24" fill="#2b579a"/>
  <text x="20" y="${H - 7}" font-family="Arial, 'Segoe UI', sans-serif" font-size="13"
        fill="#ffffff">Page 1 of 6</text>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: { loadSystemFonts: true },
  background: "#e6e6e6",
});
fs.writeFileSync(OUT, resvg.render().asPng());
console.log("Wrote", OUT);
