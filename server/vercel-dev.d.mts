/** Type surface for vite.config.ts. */
import type { Plugin } from "vite";

/**
 * Mount Vercel Serverless Functions on the Vite dev server.
 *
 * @param routes pathname → the api/ module serving it, e.g.
 *               `{ "/api/github": "/api/github.ts" }`.
 */
export declare function vercelApi(routes: Record<string, string>): Plugin;
