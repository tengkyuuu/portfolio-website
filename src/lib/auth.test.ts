import { afterEach, expect, it, vi } from "vitest";
import { getExpectedHash, login } from "./auth";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); sessionStorage.clear(); });
it("never exposes the legacy browser password hash", () => {
  vi.stubEnv("VITE_ADMIN_PASSWORD_HASH", "old-public-hash");
  expect(getExpectedHash()).toBeUndefined();
});
it("cannot grant an offline admin session when verification is unavailable", async () => {
  vi.stubEnv("VITE_ADMIN_PASSWORD_HASH", "old-public-hash");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  expect((await login("a-password")).ok).toBe(false);
  expect(sessionStorage.getItem("jvc_admin_auth_v1")).toBeNull();
});
