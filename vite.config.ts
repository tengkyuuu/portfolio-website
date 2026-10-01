import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { securityHeaders } from "./server/security-headers.mjs";
import { apiApp } from "./server/app.mjs";
import { vercelApi } from "./server/vercel-dev.mjs";

/** Mount the content API into the dev server so `npm run dev` serves
 *  /api/* on the same port — no separate backend process needed. */
function contentApi(): Plugin {
  return {
    name: "content-api",
    configureServer(server) {
      apiApp.locals.invitationHandler = async (req: unknown, res: unknown, actor: unknown) => {
        const module = await server.ssrLoadModule("/api/inquiries.ts");
        return module.handleInvitations(req, res, actor);
      };
      server.middlewares.use(apiApp);
    },
    configurePreviewServer(server) {
      server.middlewares.use(securityHeaders);
      server.middlewares.use(apiApp);
    },
  };
}

export default defineConfig({
  // Defuse legacy hosting settings too; VITE_* values otherwise become public.
  define: { "import.meta.env.VITE_ADMIN_PASSWORD_HASH": "undefined" },
  plugins: [
    react(),
    tailwindcss(),
    contentApi(),
    // After contentApi, so a route with a local mirror keeps it; only what
    // app.mjs falls through on reaches the real handler. /api/github has no
    // mirror — its logic is identical in dev and production, so dev runs
    // the same file Vercel deploys rather than a copy of it.
    vercelApi({ "/api/embed-check": "/api/embed-check.ts", "/api/github": "/api/github.ts", "/api/spotify": "/api/spotify.ts" }),
  ],
});
