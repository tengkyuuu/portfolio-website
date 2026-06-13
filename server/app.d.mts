/** Type surface for vite.config.ts — the app is connect-middleware compatible. */
import type { IncomingMessage, ServerResponse } from "node:http";

export declare const apiApp: (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void
) => void;
