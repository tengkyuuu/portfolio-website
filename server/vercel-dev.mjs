/**
 * Run a Vercel Serverless Function locally, inside the Vite dev server.
 *
 * Most of the `api/` handlers have a hand-written mirror in app.mjs,
 * because their production versions talk to Supabase and the local ones
 * talk to a JSON file — different storage, so different code.
 *
 * /api/github has no such split. It reads a public third-party API and
 * shapes the response, and that shaping is the part worth exercising while
 * developing. Mirroring it would mean a second copy of ~150 lines of
 * bucketing and ranking logic that could drift from the real one without
 * a test noticing — the mirror would keep passing while production broke.
 *
 * So instead of copying the handler, run it. Vite's ssrLoadModule compiles
 * the TypeScript on demand and hot-reloads it on edit, which leaves one
 * gap: the handler expects Vercel's req/res, and what arrives here is a
 * raw Node request. The shims below are that adapter, and no more — only
 * the surface the handlers under api/ actually touch.
 */

/** The slice of VercelRequest the handlers read. */
function toVercelRequest(req) {
  const url = new URL(req.url, "http://localhost");
  const query = {};
  for (const [key, value] of url.searchParams) {
    // Vercel collapses a repeated key into an array; matched here so a
    // handler that expects one behaves the same locally.
    const seen = query[key];
    if (seen === undefined) query[key] = value;
    else if (Array.isArray(seen)) seen.push(value);
    else query[key] = [seen, value];
  }
  // Delegate to the real request, overriding only the two fields Vercel
  // shapes differently. defineProperty rather than assignment: express 5
  // exposes `query` as a getter-only accessor on the prototype, and a
  // plain assignment through it throws instead of shadowing it.
  // express.json() has already run by this point and left req.body behind.
  return Object.create(req, {
    query: { value: query, enumerable: true },
    body: { value: req.body, enumerable: true },
  });
}

/**
 * The slice of VercelResponse the handlers call. Chainable, because they
 * are written as `res.status(200).json(...)`.
 */
function toVercelResponse(res) {
  let status = 200;
  const shim = {
    status(code) {
      status = code;
      return shim;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
      return shim;
    },
    json(body) {
      res.statusCode = status;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
      return shim;
    },
    send(body) {
      res.statusCode = status;
      res.end(typeof body === "string" ? body : JSON.stringify(body));
      return shim;
    },
    end(body) {
      res.statusCode = status;
      res.end(body);
      return shim;
    },
  };
  return shim;
}

/**
 * Vite plugin mounting `routes` — a map of pathname to the api/ module that
 * serves it — on the dev server.
 *
 * Dev only. `vite preview` has no module runner to compile TypeScript with,
 * and the deployed build has Vercel itself, so neither needs this.
 */
export function vercelApi(routes) {
  return {
    name: "vercel-api-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url, "http://localhost").pathname;
        const modulePath = routes[pathname];
        if (!modulePath) return next();

        try {
          const mod = await server.ssrLoadModule(modulePath);
          await mod.default(toVercelRequest(req), toVercelResponse(res));
        } catch (err) {
          // A crash here is a bug in the handler, not a missing route —
          // say so loudly in the terminal rather than falling through to
          // Vite's SPA fallback, which would answer the fetch with HTML
          // and surface as an unexplained "unavailable" in the UI.
          server.config.logger.error(`[vercel-api] ${pathname} failed:\n${err?.stack ?? err}`);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, reason: "unavailable" }));
          }
        }
      });
    },
  };
}
