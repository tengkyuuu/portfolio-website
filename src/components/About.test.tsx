import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { About } from "./About";
import { hashToTab, tabs } from "./Nav";
import { nowGroups, processStages } from "../lib/data";

/**
 * "How I Work" and "Now" were each their own ribbon tab and now live
 * inside About. The failure mode of a move like this is quiet: the tab
 * disappears, nobody notices the content went with it, and a section of
 * the site is simply gone. These pin both halves — it is off the ribbon
 * AND on the page.
 */

describe("About", () => {
  it("renders the executive summary", () => {
    render(<About page={3} />);
    expect(
      screen.getByRole("heading", { name: /executive summary/i })
    ).toBeInTheDocument();
  });

  it("carries How I Work, with every stage", () => {
    render(<About page={3} />);
    expect(screen.getByRole("heading", { name: "How I Work" })).toBeInTheDocument();
    for (const stage of processStages) {
      expect(
        screen.getByRole("button", { name: new RegExp(stage.title) }),
        `stage "${stage.title}" missing from About`
      ).toBeInTheDocument();
    }
  });

  it("carries Now, with every group", () => {
    render(<About page={3} />);
    expect(screen.getByRole("heading", { name: "Now" })).toBeInTheDocument();
    for (const group of nowGroups) {
      expect(
        screen.getByRole("heading", { name: group.label }),
        `group "${group.label}" missing from About`
      ).toBeInTheDocument();
    }
  });

  it("gives each block a page of its own rather than one long sheet", () => {
    // All three on one sheet would make About several times the length of
    // every other tab's paper, which is what paginating prevents. Three
    // sheets, numbered in sequence from About's own page.
    render(<About page={3} />);
    const numbers = screen
      .getAllByText(/^— \d+ —$/)
      .map((el) => el.textContent?.replace(/\s+/g, " ").trim());
    expect(numbers).toEqual(["— 3 —", "— 4 —", "— 5 —"]);
  });
});

describe("retired tabs", () => {
  it("no longer lists How I Work or Now in the ribbon", () => {
    const ids = tabs.map((t) => t.id);
    expect(ids).not.toContain("process");
    expect(ids).not.toContain("now");
  });

  it("sends an old #process link to the section that absorbed it", () => {
    // A link shared before the move should reach the content, not the
    // homepage, which is where an unknown hash otherwise lands.
    window.location.hash = "#process";
    expect(hashToTab()).toBe("about");
  });

  it("sends an old #now link there too", () => {
    window.location.hash = "#now";
    expect(hashToTab()).toBe("about");
  });

  it("still falls back to the cover page for a hash that means nothing", () => {
    window.location.hash = "#nonsense";
    expect(hashToTab()).toBe("top");
  });

  it("resolves every live tab to itself", () => {
    for (const tab of tabs) {
      window.location.hash = `#${tab.id}`;
      expect(hashToTab()).toBe(tab.id);
    }
  });
});
