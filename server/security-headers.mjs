import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
/** Use the deployment's exact headers in local production previews too. */
export function securityHeaders(req, res, next) {
  for (const entry of config.headers) {
    if (entry.source === "/(.*)" || (entry.source === "/api/(.*)" && req.url?.startsWith("/api/"))) {
      for (const { key, value } of entry.headers) res.setHeader(key, value);
    }
  }
  next();
}
