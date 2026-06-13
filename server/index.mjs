/**
 * Production server: API + built site from one process.
 *
 *   npm run build
 *   npm start          (PORT env overrides the default 3000)
 *
 * In development you don't need this — the API is mounted into Vite's dev
 * server (see vite.config.ts), so `npm run dev` is enough.
 */

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiApp } from "./app.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");

const app = express();
app.use(apiApp);
app.use(express.static(DIST));
// SPA fallback — client-side routes like /admin resolve to index.html
app.use((_req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Portfolio running at http://localhost:${port}`);
});
