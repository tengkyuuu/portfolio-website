import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startAutomaticUpdates } from "./auto-update";

describe("automatic release updates", () => {
  let stop: (() => void) | undefined;
  const reload = vi.fn();
  const fetchRelease = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    reload.mockReset();
    fetchRelease.mockReset();
    vi.stubGlobal("fetch", fetchRelease);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    history.replaceState(null, "", "/#gallery");
    document.body.innerHTML = "";
  });
  afterEach(() => { stop?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  const answer = (id: string) => ({ ok: true, json: async () => ({ id }) });
  it("detects a later release on an already open tab and reloads once without a click", async () => {
    fetchRelease.mockResolvedValueOnce(answer("current")).mockResolvedValue(answer("next"));
    stop = startAutomaticUpdates("current", reload);
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fetchRelease).toHaveBeenCalledWith("/release.json", expect.objectContaining({ cache: "no-store" }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("keeps the current page when offline or the manifest is invalid", async () => {
    fetchRelease.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true, json: async () => ({}) });
    stop = startAutomaticUpdates("current", reload);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reload).not.toHaveBeenCalled();
  });
  it.each(["/admin", "/resume"])("does not interrupt drafts in %s", async path => {
    history.replaceState(null, "", path);
    fetchRelease.mockResolvedValue(answer("next"));
    stop = startAutomaticUpdates("current", reload);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reload).not.toHaveBeenCalled();
  });
  it("waits until an unfinished public message is cleared, then updates automatically", async () => {
    const field = document.createElement("textarea");
    document.body.append(field);
    Object.defineProperty(field, "offsetParent", { get: () => document.body });
    field.value = "My unfinished message";
    fetchRelease.mockResolvedValue(answer("next"));
    stop = startAutomaticUpdates("current", reload);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(reload).not.toHaveBeenCalled();
    field.value = "";
    await vi.advanceTimersByTimeAsync(2_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("stops watchers and never reloads after cleanup", async () => {
    fetchRelease.mockResolvedValue(answer("current"));
    stop = startAutomaticUpdates("current", reload);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    fetchRelease.mockResolvedValue(answer("next"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchRelease).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });
});
