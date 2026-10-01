// @vitest-environment node
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const policy = JSON.parse(readFileSync("vercel.json", "utf8")).headers
  .find((entry: { source: string }) => entry.source === "/(.*)").headers
  .find((header: { key: string }) => header.key === "Content-Security-Policy").value as string;
const connections = policy.split(";").map(s => s.trim()).find(s => s.startsWith("connect-src "))!.split(/\s+/).slice(1);

function workerIntercepts(url: string): boolean {
  const listeners: Record<string, (event: unknown) => void> = {};
  const context = vm.createContext({
    URL, Response,
    self: { location: { origin: "https://portfolio.example" }, addEventListener: (name: string, fn: (event: unknown) => void) => { listeners[name] = fn; } },
  });
  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);
  // Exercise the worker's real request routing without opening network connections.
  vm.runInContext('cacheFirstTTL = async () => new Response("asset")', context);
  let intercepted = false;
  listeners.fetch({ request: { url, method: "GET", mode: "cors", headers: new Headers() }, respondWith: () => { intercepted = true; } });
  return intercepted;
}

describe("offline assets and deployment CSP", () => {
  it.each([
    "https://fonts.googleapis.com/css2?family=Inter",
    "https://fonts.gstatic.com/s/inter/font.woff2",
    "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
  ])("permits the worker's fetch for %s", url => {
    expect(workerIntercepts(url)).toBe(true);
    expect(connections).toContain(new URL(url).origin);
  });
  it.each(["https://evilgoogleapis.com/file", "https://fonts.googleapis.com.evil.example/file", "http://fonts.googleapis.com/file"])("does not intercept lookalike or insecure origin %s", url => {
    expect(workerIntercepts(url)).toBe(false);
  });
});
