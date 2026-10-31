// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterAll, expect, it } from "vitest";

// Test the dependencies Vercel actually resolves, including security overrides.
const require = createRequire(import.meta.url);
const { Project } = require("ts-morph");
const { getConfig } = require("@vercel/static-config");
const { nodeFileTrace } = require("@vercel/nft");
const root = mkdtempSync(join(tmpdir(), "portfolio-build-tools-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

it("parses serverless config and discovers TypeScript files with patched build dependencies", () => {
  const file = join(root, "handler.ts");
  writeFileSync(file, 'export const config = { maxDuration: 30 }; export default function handler() {}');
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sources = project.addSourceFilesAtPaths(join(root, "*.ts").replaceAll("\\", "/"));
  expect(sources).toHaveLength(1);
  expect(sources[0].getExportedDeclarations().has("config")).toBe(true);
  expect(getConfig(project, file)).toEqual({ maxDuration: 30 });
});

it("traces a dynamic require through the patched glob dependency", async () => {
  mkdirSync(join(root, "fixtures"));
  writeFileSync(join(root, "fixtures", "a.js"), 'module.exports = "a";');
  writeFileSync(join(root, "fixtures", "b.js"), 'module.exports = "b";');
  const entry = join(root, "entry.js");
  writeFileSync(entry, 'module.exports = require("./fixtures/" + process.env.ENTRY + ".js");');
  const trace = await nodeFileTrace([entry], { base: root, processCwd: root });
  const files = [...trace.fileList].map((file: string) => file.replaceAll("\\", "/"));
  expect(files).toEqual(expect.arrayContaining(["entry.js", "fixtures/a.js", "fixtures/b.js"]));
});
