// @vitest-environment node
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fakeReq, fakeRes } from "../src/test/fake-supabase";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
import handler, { publicAddress, probeHeaders } from "./embed-check";
beforeEach(() => { mocks.lookup.mockReset(); mocks.request.mockReset(); });
afterEach(() => vi.restoreAllMocks());
describe("preview network boundaries", () => {
  it.each(["127.0.0.1", "10.2.3.4", "172.16.1.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2001:db8::1"])("blocks private/reserved address %s", address => {
    expect(publicAddress(address)).toBe(false);
  });
  it("refuses a mixed public/private DNS answer before opening a socket", async () => {
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    await expect(probeHeaders(new URL("https://rebinding.example"))).rejects.toThrow("Blocked address");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("pins the checked IP and does not follow a redirect to metadata", async () => {
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    const response = { statusCode: 302, headers: { location: "http://169.254.169.254/latest/meta-data" }, destroy: vi.fn() };
    mocks.request.mockImplementation((_url, options, callback) => {
      const resolved = vi.fn();
      options.lookup("rebinding.example", {}, resolved);
      expect(resolved).toHaveBeenCalledWith(null, "8.8.8.8", 4);
      expect(options.agent).toBe(false);
      const req = new EventEmitter();
      return Object.assign(req, { end: () => callback(response) });
    });
    const res = fakeRes();
    await handler(fakeReq({ method: "GET", query: { url: "https://rebinding.example" } }) as unknown as VercelRequest, res as unknown as VercelResponse);
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({ ok: false, reason: "redirect" });
    expect(response.destroy).toHaveBeenCalled();
  });
  it.each(["http://example.com", "https://user:pass@example.com", "https://example.com:8443"])("rejects unsafe URL %s", async url => {
    const res = fakeRes();
    await handler(fakeReq({ method: "GET", query: { url } }) as unknown as VercelRequest, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(400);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
});
