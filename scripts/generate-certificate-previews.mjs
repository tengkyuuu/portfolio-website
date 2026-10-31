/** Requires Poppler's pdftoppm on PATH. Run after adding local PDF certificates. */
import { execFileSync } from "node:child_process";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("public/credentials");
const output = resolve(root, "previews");
await mkdir(output, { recursive: true });
const manifest = {};
for (const file of await readdir(root)) {
  if (!file.toLowerCase().endsWith(".pdf")) continue;
  const stem = file.slice(0, -4);
  execFileSync("pdftoppm", ["-jpeg", "-r", "110", "-jpegopt", "quality=88", resolve(root, file), resolve(output, stem)]);
  manifest[`/credentials/${file}`] = (await readdir(output))
    .filter((name) => name.startsWith(`${stem}-`) && name.endsWith(".jpg"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => `/credentials/previews/${name}`);
}
await writeFile(resolve("src/lib/certificate-previews.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`[certificates] generated previews for ${Object.keys(manifest).length} PDFs`);
