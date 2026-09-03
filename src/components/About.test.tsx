import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { About } from "./About";
import { hashToTab, tabs } from "./Nav";
import { processStages } from "../lib/data";

/**
 * "How I Work" was its own ribbon tab and now lives inside About. The
 * failure mode of a move like this is quiet: the tab disappears, nobody
 * notices the content went with it, and a section of the site is simply
 * gone. These pin both halves — it is off the ribbon AND on the page.
 */

describe("About", () => {
  it("renders the executive summary", () => {
    render(<About />);
    expect(
      screen.getByRole("heading", { name: /executive summary/i })
    ).toBeInTheDocument();
  });

  it("carries How I Work, with every stage", () => {
    render(<About />);
    expect(screen.getByRole("heading", { name: "How I Work" })).toBeInTheDocument();
    for (const stage of processStages) {
      expect(
        screen.getByRole("button", { name: new RegExp(stage.title) }),
        `stage "${stage.title}" missing from About`
      ).toBeInTheDocument();
    }
  });
});

describe("retired tabs", () => {
  it("no longer lists How I Work in the ribbon", () => {
    expect(tabs.map((t) => t.id)).not.toContain("process");
  });

  it("sends an old #process link to the section that absorbed it", () => {
    // A link shared before the move should reach the content, not the
    // homepage, which is where an unknown hash otherwise lands.
    window.location.hash = "#process";
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
