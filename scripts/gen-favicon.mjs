/**
 * One-off generator for the favicon and app icons, cut from the portrait
 * in public/no-shades.jpg (2400×2400).
 * Run locally with:  node scripts/gen-favicon.mjs
 *
 * The output PNGs are committed to the repo, so this doesn't run on Vercel.
 * Playwright is already a dependency (scripts/shoot.mjs uses it), so the
 * cropping happens in a canvas inside a real browser rather than pulling in
 * an image library for six files.
 *
 * Why not just point <link rel="icon"> at the JPG? Because the browser
 * would download 199 KB of 2400×2400 portrait to paint sixteen pixels of
 * tab. These are between 1 and 40 KB.
 *
 * Two crops, because the icon is read at two very different sizes:
 *
 *   HEAD  — the browser tab, at 16–48 px. Everything below the collar is
 *           a smudge at that size, so the crop is tight enough that the
 *           face fills the frame and is still recognisable as a person.
 *   BUST  — the home screen and install prompt, at 180–512 px. There is
 *           room for shoulders here, and the extra margin is what keeps
 *           the face inside the safe zone when Android masks the icon to
 *           a circle (it keeps the middle 80% and discards the rest).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "..", "public");
const SOURCE = path.join(PUBLIC, "no-shades.jpg");

/** Source-pixel crop windows, measured off the 2400×2400 original. */
const HEAD = { x: 531, y: 87, size: 1350 };
const BUST = { x: 200, y: 0, size: 2000 };

const OUTPUTS = [
  { file: "favicon-16.png", size: 16, crop: HEAD },
  { file: "favicon-32.png", size: 32, crop: HEAD },
  { file: "favicon-48.png", size: 48, crop: HEAD },
  { file: "apple-touch-icon.png", size: 180, crop: BUST },
  { file: "icon-192.png", size: 192, crop: BUST },
  { file: "icon-512.png", size: 512, crop: BUST },
];

const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(SOURCE).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const pngs = await page.evaluate(
  async ({ dataUrl, outputs }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    return outputs.map(({ file, size, crop }) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      // Downscaling 1500px to 16px in one step is what makes a photo
      // favicon turn to mush; the browser's high-quality path resamples
      // rather than point-samples.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
      return { file, base64: canvas.toDataURL("image/png").split(",")[1] };
    });
  },
  { dataUrl, outputs: OUTPUTS }
);

await browser.close();

for (const { file, base64 } of pngs) {
  const out = path.join(PUBLIC, file);
  fs.writeFileSync(out, Buffer.from(base64, "base64"));
  console.log(`[favicon] ${file} — ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
}
