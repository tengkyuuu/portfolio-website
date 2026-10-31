/** Confirm promotion on the real custom domain, not just a successful build. */
import assert from "node:assert/strict";
const origin = process.env.SITE_URL || "https://www.jamescalunsag.online";
const expected = process.env.GITHUB_SHA || process.argv[2];
if (!expected || !/^[a-f0-9]{40}$/.test(expected)) throw new Error("Provide the full Git commit SHA to verify.");
const deadline = Date.now() + Number(process.env.DEPLOY_TIMEOUT_MS || 900_000);
let last = "No deployment response";
while (Date.now() < deadline) {
  try {
    const response = await fetch(`${origin}/metrics.json?verify=${Date.now()}`, {
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`metrics HTTP ${response.status}`);
    const metrics = await response.json();
    if (metrics.commit?.sha !== expected) throw new Error(`Live commit is ${metrics.commit?.sha || "unknown"}`);
    const release = await fetch(`${origin}/release.json?verify=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    assert(release.ok, `release HTTP ${release.status}`);
    assert.equal(typeof (await release.json()).id, "string");
    const page = await fetch(origin, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    assert(page.ok, `home HTTP ${page.status}`);
    const html = await page.text();
    const script = html.match(/<script[^>]+src="([^\"]+\.js)"/)?.[1];
    assert(script, "No application bundle in the live page");
    const bundle = await fetch(new URL(script, origin), { signal: AbortSignal.timeout(15_000) });
    assert(bundle.ok && /javascript/.test(bundle.headers.get("content-type") || ""), "Live application bundle is unavailable");
    console.log(`Production verified: ${expected} at ${origin}`);
    process.exit(0);
  } catch (error) {
    last = error.message;
    console.log(`Waiting for production: ${last}`);
    await new Promise(resolve => setTimeout(resolve, 15_000));
  }
}
throw new Error(`Production did not serve ${expected} within the deadline. ${last}`);
