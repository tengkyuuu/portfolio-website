import { afterEach, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TabLoader } from "./TabLoader";

afterEach(() => vi.useRealTimers());

it("removes the loading overlay even when CSS animations are disabled", () => {
  vi.useFakeTimers();
  const { rerender } = render(<TabLoader visible label="Home" />);
  expect(screen.getByText(/Home loading/)).toBeInTheDocument();
  rerender(<TabLoader visible={false} label="Home" />);
  act(() => vi.advanceTimersByTime(360));
  expect(screen.queryByText(/Home loading/)).not.toBeInTheDocument();
});

it("cancels a pending dismissal when loading begins again", () => {
  vi.useFakeTimers();
  const { rerender } = render(<TabLoader visible label="Home" />);
  rerender(<TabLoader visible={false} label="Home" />);
  act(() => vi.advanceTimersByTime(100));
  rerender(<TabLoader visible label="Home" />);
  act(() => vi.advanceTimersByTime(400));
  expect(screen.getByText(/Home loading/)).toBeInTheDocument();
});
