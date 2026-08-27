import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The Hobby plan caps a deployment at 12 Serverless Functions, and going
 * over does not fail the build — it fails afterwards, at "Deploying
 * outputs...", so the log reads clean and CI stays green while production
 * silently keeps serving the last good deploy. That cost a day once
 * (commit 123d442). It should never cost another.
 */

const MAX_FUNCTIONS = 12;
const apiDir = resolve(process.cwd(), "api");

/** Files Vercel will actually build as functions. */
function functionFiles(): string[] {
  return readdirSync(apiDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
}

describe("serverless function budget", () => {
  it(`stays within the ${MAX_FUNCTIONS}-function Hobby cap`, () => {
    const files = functionFiles();
    expect(
      files.length,
      `api/ has ${files.length} handlers: ${files.join(", ")}. ` +
        `Remove or merge one before adding another.`
    ).toBeLessThanOrEqual(MAX_FUNCTIONS);
  });

  it("keeps test files out of the count via .vercelignore", () => {
    const path = resolve(process.cwd(), ".vercelignore");
    expect(existsSync(path), ".vercelignore is missing").toBe(true);
    expect(readFileSync(path, "utf8")).toContain("api/**/*.test.ts");
  });

  it("has no stray non-handler source under api/", () => {
    // A helper module here would burn a function slot doing nothing.
    for (const f of functionFiles()) {
      const src = readFileSync(resolve(apiDir, f), "utf8");
      expect(src, `${f} has no default export — it is not a handler`).toMatch(
        /export default (async )?function|export default handler/
      );
    }
  });
});
