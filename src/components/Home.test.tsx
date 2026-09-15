import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Home } from "./Home";
import { getContent } from "../lib/content";

/**
 * The GitHub panel moved here from the bottom of the Now tab. The failure
 * mode of a move like this is quiet — the old tab goes, the panel goes
 * with it, and nothing complains — so pin that it landed.
 */

const SNAPSHOT = {
  ok: true,
  source: "events",
  user: {
    login: "tengkyuuu",
    name: "James",
    bio: null,
    htmlUrl: "https://github.com/tengkyuuu",
    publicRepos: 14,
    followers: 3,
  },
  totals: { stars: 7, repos: 14, followers: 3, contributions: 42 },
  days: [{ date: "2026-08-26", count: 4 }],
  languages: [{ name: "TypeScript", repos: 6, share: 60 }],
  repos: [
    {
      name: "portfolio-website",
      description: "A portfolio built as a Word document.",
      language: "TypeScript",
      stars: 4,
      forks: 0,
      url: "https://github.com/tengkyuuu/portfolio-website",
      pushedAt: new Date().toISOString(),
      topics: [],
    },
  ],
  commits: [],
  fetchedAt: new Date().toISOString(),
};

function mockApi(body: unknown = { ok: false, reason: "unavailable" }) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body))));
}

function pageNumbers(): (string | undefined)[] {
  return screen
    .getAllByText(/^— \d+ —$/)
    .map((el) => el.textContent?.replace(/\s+/g, " ").trim());
}

describe("Home", () => {
  it("leads with the cover page", () => {
    mockApi();
    render(<Home page={1} />);
    expect(
      screen.getByRole("heading", { level: 1, name: new RegExp(getContent().hero.name) })
    ).toBeInTheDocument();
  });

  it("carries the live GitHub panel", () => {
    mockApi();
    render(<Home page={1} />);
    expect(
      screen.getByRole("heading", { name: "GitHub Activity" })
    ).toBeInTheDocument();
  });

  it("gives the panel a page of its own rather than one long sheet", () => {
    // On one sheet the cover page would run well past the length of every
    // other tab's paper, which is the thing paginating prevents.
    mockApi();
    render(<Home page={1} />);
    expect(pageNumbers()).toEqual(["— 1 —", "— 2 —"]);
  });

  it("spills the repository and commit lists onto a continuation sheet", async () => {
    mockApi(SNAPSHOT);
    render(<Home page={1} />);
    expect(
      await screen.findByRole("heading", { name: "GitHub Activity (cont.)" })
    ).toBeInTheDocument();
    expect(pageNumbers()).toEqual(["— 1 —", "— 2 —", "— 3 —"]);
  });

  it("does not add an empty continuation sheet when GitHub is down", () => {
    // A blank page numbered 3 is a worse answer than a two-page document.
    mockApi();
    render(<Home page={1} />);
    expect(
      screen.queryByRole("heading", { name: /cont\./ })
    ).not.toBeInTheDocument();
  });
});
