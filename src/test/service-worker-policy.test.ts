// @vitest-environment node
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const policy = JSON.parse(readFileSync("vercel.json", "utf8")).headers
  .find((entry: { source: string }) => entry.source === "/(.*)").headers
  .find((header: { key: string }) => header.key === "Content-Security-Policy").value as string;
const connections = policy.split(";").map(s => s.trim()).find(s => s.startsWith("connect-src "))!.split(/\s+/).slice(1);

function workerStrategy(url: string): string | undefined {
  const listeners: Record<string, (event: unknown) => void> = {};
  const context = vm.createContext({
    URL, Response,
    self: { location: { origin: "https://portfolio.example" }, addEventListener: (name: string, fn: (event: unknown) => void) => { listeners[name] = fn; } },
  });
  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);
  // Exercise the worker's real request routing without opening network connections.
  vm.runInContext('cacheFirstTTL = async () => new Response("asset")', context);
  vm.runInContext('networkFirstAPI = async () => new Response("network")', context);
  // Capture which strategy handles the request without needing a CacheStorage.
  let strategy: string | undefined;
  context.cacheFirstTTL = () => { strategy = "cache"; return Promise.resolve(new Response()); };
  context.networkFirstAPI = () => { strategy = "network"; return Promise.resolve(new Response()); };
  listeners.fetch({ request: { url, method: "GET", mode: "cors", headers: new Headers() }, respondWith: () => {} });
  return strategy;
}

describe("offline assets and deployment CSP", () => {
  it.each([
    "https://fonts.googleapis.com/css2?family=Inter",
    "https://fonts.gstatic.com/s/inter/font.woff2",
    "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
  ])("permits the worker's fetch for %s", url => {
    expect(workerStrategy(url)).toBe("cache");
    expect(connections).toContain(new URL(url).origin);
  });
  it.each(["https://evilgoogleapis.com/file", "https://fonts.googleapis.com.evil.example/file", "http://fonts.googleapis.com/file"])("does not intercept lookalike or insecure origin %s", url => {
    expect(workerStrategy(url)).toBeUndefined();
  });
  it.each(["/release.json", "/metrics.json", "/sw.js"])("never caches release metadata %s", path => {
    expect(workerStrategy(`https://portfolio.example${path}`)).toBeUndefined();
  });
  it.each(["/og.png", "/james-vincent-calunsag-resume.pdf", "/content-defaults.json"])("fetches current stable-name files %s", path => {
    expect(workerStrategy(`https://portfolio.example${path}`)).toBe("network");
  });
  it("keeps immutable bundles cache-first", () => {
    expect(workerStrategy("https://portfolio.example/assets/index-abc123.js")).toBe("cache");
  });
});
