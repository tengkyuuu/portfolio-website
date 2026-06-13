import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { apiApp } from "./server/app.mjs";

/** Mount the content API into the dev server so `npm run dev` serves
 *  /api/* on the same port — no separate backend process needed. */
function contentApi(): Plugin {
  return {
    name: "content-api",
    configureServer(server) {
      server.middlewares.use(apiApp);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiApp);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentApi()],
});
