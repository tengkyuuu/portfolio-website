/**
 * One-off generator for the favicon and app icons, scaled down from the
 * portrait in public/no-shades.jpg (2400×2400).
 * Run locally with:  node scripts/gen-favicon.mjs
 *
 * The output PNGs are committed to the repo, so this doesn't run on Vercel.
 * Playwright is already a dependency (scripts/shoot.mjs uses it), so the
 * resampling happens in a canvas inside a real browser rather than pulling
 * in an image library for seven files.
 *
 * Why not just point <link rel="icon"> at the JPG? Because the browser
 * would download 199 KB of 2400×2400 portrait to paint sixteen pixels of
 * tab. These are between 1 and 40 KB.
 *
 * No cropping: the source is already square, so the whole frame scales
 * straight into a square icon. An earlier version cut in tight on the face
 * to buy legibility at 16px, which bought it at the cost of looking like a
 * photo shoved against the glass. The full frame is the portrait as taken.
 *
 * The one exception is the maskable icon — see MASKABLE_INSET.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "..", "public");
const SOURCE = path.join(PUBLIC, "no-shades.jpg");

/**
 * Android crops a maskable icon to a circle and keeps only the middle 80%,
 * so a full-bleed portrait loses the top of the head. This draws the same
 * uncropped frame at 80% over its own backdrop colour, which puts every
 * pixel that matters inside the safe zone and leaves the mask nothing to
 * take. Sampled rather than hardcoded so the padding matches the studio
 * grey behind him instead of announcing itself as a border.
 */
const MASKABLE_INSET = 0.8;

const OUTPUTS = [
  { file: "favicon-16.png", size: 16 },
  { file: "favicon-32.png", size: 32 },
  { file: "favicon-48.png", size: 48 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
];

const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(SOURCE).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const pngs = await page.evaluate(
  async ({ dataUrl, outputs, inset }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    /** Mean colour of the source's outer edge, for the maskable padding. */
    const edgeColor = () => {
      const probe = document.createElement("canvas");
      probe.width = probe.height = 64;
      const pctx = probe.getContext("2d");
      pctx.drawImage(img, 0, 0, 64, 64);
      const { data } = pctx.getImageData(0, 0, 64, 64);
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          if (x > 3 && x < 60 && y > 3 && y < 60) continue; // border ring only
          const i = (y * 64 + x) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
      }
      return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
    };

    const padding = edgeColor();

    return outputs.map(({ file, size, maskable }) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      // Downscaling 2400px to 16px in one step is what makes a photo
      // favicon turn to mush; the browser's high-quality path resamples
      // rather than point-samples.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (maskable) {
        ctx.fillStyle = padding;
        ctx.fillRect(0, 0, size, size);
        const drawn = Math.round(size * inset);
        const offset = Math.round((size - drawn) / 2);
        ctx.drawImage(img, offset, offset, drawn, drawn);
      } else {
        ctx.drawImage(img, 0, 0, size, size);
      }

      return { file, base64: canvas.toDataURL("image/png").split(",")[1] };
    });
  },
  { dataUrl, outputs: OUTPUTS, inset: MASKABLE_INSET }
);

await browser.close();

for (const { file, base64 } of pngs) {
  const out = path.join(PUBLIC, file);
  fs.writeFileSync(out, Buffer.from(base64, "base64"));
  console.log(`[favicon] ${file} — ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
}
