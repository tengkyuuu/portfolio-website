import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTabReady } from "./tab-ready";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("tab readiness", () => {
  it("reveals the document when asset requests never settle", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "Image",
      class {
        set src(_value: string) {}
      },
    );
    const { result, unmount } = renderHook(() => useTabReady("top"));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1499));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
    unmount();
  });

  it("clears the fallback when the tab is unmounted", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "Image",
      class {
        set src(_value: string) {}
      },
    );
    const { unmount } = renderHook(() => useTabReady("top"));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
