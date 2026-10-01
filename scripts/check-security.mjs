import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "vite";
const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const headers = new Map(config.headers.find(h => h.source === "/(.*)").headers.map(h => [h.key, h.value]));
const csp = headers.get("Content-Security-Policy") || "";
for (const rule of ["script-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'"]) {
  if (!csp.split("; ").includes(rule)) throw new Error(`Missing CSP protection: ${rule}`);
}
if (!existsSync("dist/index.html")) throw new Error("Run npm run build first.");
const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
const secretNames = ["ADMIN_PASSWORD_HASH", "VITE_ADMIN_PASSWORD_HASH", "ADMIN_TOKEN_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN", "RESEND_API_KEY"];
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
}
for (const file of files("dist").filter(file => /\.(?:js|json|html|map)$/.test(file))) {
  const body = readFileSync(file, "utf8");
  for (const name of secretNames) {
    if (env[name]?.length >= 16 && body.includes(env[name])) throw new Error(`Server secret ${name} found in ${file}; value suppressed.`);
  }
}
console.log("Deployment header checks passed; configured server secrets were not found in built browser files.");
