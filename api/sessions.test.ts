import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every authed handler carries its own copy of the admin-session helpers,
 * because Vercel's tracer has failed to bundle a shared api/_lib in
 * production (see the header note in api/content.ts). Duplication is the
 * price of that, and drift is the risk: a copy left on the old
 * signature-only check would keep honouring a removed admin's token, and
 * nothing would look wrong until it mattered.
 *
 * So the copies are held to byte-for-byte identity, and every handler that
 * reads a bearer token must carry one.
 */

const apiDir = resolve(process.cwd(), "api");
const START = "/* ---- admin session:";
const END = "/* ---- end admin session ---- */";

function handlers(): { file: string; src: string }[] {
  return readdirSync(apiDir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((file) => ({
      file,
      src: readFileSync(resolve(apiDir, file), "utf8").replace(/\r\n/g, "\n"),
    }));
}

function block(src: string): string | null {
  const a = src.indexOf(START);
  const b = src.indexOf(END);
  return a >= 0 && b > a ? src.slice(a, b + END.length) : null;
}

describe("admin session helpers", () => {
  it("are present in every handler that reads a bearer token", () => {
    // Inbound only: github.ts sends an authorization header to GitHub,
    // which is not the same thing as accepting one.
    const readsBearer = handlers().filter(({ src }) => /req\.headers\.authorization/.test(src));
    // tests.ts and lighthouse.ts accept the raw CI secret, not an admin
    // session — their own check is intentional and different.
    const expected = readsBearer.filter(({ file }) => !["tests.ts", "lighthouse.ts"].includes(file));
    expect(expected.map((h) => h.file).sort()).toEqual(
      ["activity.ts", "chat.ts", "content.ts", "health.ts", "inquiries.ts", "login.ts", "versions.ts"].sort()
    );
    for (const { file, src } of expected) {
      expect(block(src), `${file} is missing the admin session block`).not.toBeNull();
    }
  });

  it("are identical everywhere they appear", () => {
    const copies = handlers()
      .map(({ file, src }) => ({ file, block: block(src) }))
      .filter((c): c is { file: string; block: string } => c.block !== null);
    expect(copies.length).toBeGreaterThanOrEqual(6);
    const [first, ...rest] = copies;
    for (const c of rest) {
      expect(c.block, `${c.file} has drifted from ${first.file}`).toBe(first.block);
    }
  });

  it("no longer leave a signature-only check behind", () => {
    for (const { file, src } of handlers()) {
      expect(src, `${file} still defines verifyToken`).not.toMatch(/function verifyToken\(/);
    }
  });
});
