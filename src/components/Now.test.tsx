import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Now } from "./Now";
import { nowGroups } from "../lib/data";

/**
 * Now is the static half of what used to be the Now tab — the live GitHub
 * panel that sat under it moved to the cover page and is covered by
 * GitHubActivity.test.tsx. Nothing here should touch the network.
 */

describe("Now", () => {
  it("renders every group and its items", () => {
    render(<Now />);
    for (const g of nowGroups) {
      expect(screen.getByRole("heading", { name: g.label })).toBeInTheDocument();
      for (const item of g.items) {
        expect(screen.getByText(item.name)).toBeInTheDocument();
      }
    }
  });

  it("shows when the page was last reviewed", () => {
    render(<Now />);
    expect(screen.getByText(/Reviewed /)).toBeInTheDocument();
  });

  it("renders without asking the network for anything", () => {
    // A stale date is the only failure mode this section should have; a
    // fetch here would give it a second one for no benefit.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<Now />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
