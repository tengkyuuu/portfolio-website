import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnv } from "vite";

// "local" can't be the mode here — Vite reserves that word (it collides
// with the .env.local naming convention and throws). Any real mode works:
// loadEnv already merges in .env.local on top of it regardless of mode.
const env = { ...loadEnv("development", process.cwd(), ""), ...process.env };
const id = env.SPOTIFY_CLIENT_ID;
const secret = env.SPOTIFY_CLIENT_SECRET;
if (!id || !secret) {
  console.error("Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local first. See docs/spotify-setup.md.");
  process.exit(1);
}
const redirect = "http://127.0.0.1:8888/callback";
const state = randomBytes(32).toString("hex");
const auth = new URL("https://accounts.spotify.com/authorize");
auth.search = new URLSearchParams({ client_id: id, response_type: "code", redirect_uri: redirect, state,
  scope: "user-read-currently-playing user-read-recently-played user-top-read" }).toString();
let processing = false;
const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const url = new URL(req.url, redirect);
  if (req.method !== "GET" || url.pathname !== "/callback") { res.writeHead(404).end("Not found"); return; }
  const received = Buffer.from(url.searchParams.get("state") || "");
  const expected = Buffer.from(state);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) { res.writeHead(400).end("Invalid authorization state. Use the link in your terminal."); return; }
  if (processing) { res.writeHead(409).end("Authorization is already being processed."); return; }
  if (url.searchParams.has("error")) { res.end("Spotify authorization was declined. You can close this tab."); finish(1); return; }
  const code = url.searchParams.get("code");
  if (!code) { res.writeHead(400).end("Missing authorization code."); return; }
  processing = true;
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect }),
    });
    if (!response.ok) throw new Error("Spotify rejected the token exchange. Check your app credentials and redirect URI.");
    const data = await response.json();
    if (typeof data.refresh_token !== "string" || !/^[A-Za-z0-9._~+\/=-]+$/.test(data.refresh_token)) throw new Error("Spotify returned no usable refresh token. Run the helper again.");
    const path = resolve(".env.local");
    const original = await readFile(path, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; });
    const line = `SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`;
    const next = /^SPOTIFY_REFRESH_TOKEN=.*$/m.test(original) ? original.replace(/^SPOTIFY_REFRESH_TOKEN=.*$/m, line) : `${original.trimEnd()}\n${line}\n`;
    await writeFile(path, next, { mode: 0o600 });
    res.end("Spotify connected. The refresh token is saved in .env.local. You can close this tab.");
    console.log("Connected. SPOTIFY_REFRESH_TOKEN saved in .env.local. Add all three Spotify variables to Vercel and redeploy to enable production playback.");
    finish(0);
  } catch (error) {
    res.writeHead(502).end("Connection failed. Check your terminal and run the helper again.");
    console.error(error instanceof Error ? error.message : "Connection failed.");
    finish(1);
  }
});
const timeout = setTimeout(() => { console.error("Authorization timed out after 10 minutes. Run the helper again."); finish(1); }, 600000);
function finish(code) { clearTimeout(timeout); server.close(); process.exitCode = code; }
server.on("error", error => { console.error(`Could not listen on 127.0.0.1:8888: ${error.message}`); finish(1); });
server.listen(8888, "127.0.0.1", () => console.log(`Open this URL to connect Spotify:\n${auth}\n\nRegistered redirect URI must be exactly ${redirect}`));
