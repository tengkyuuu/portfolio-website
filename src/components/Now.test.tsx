import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Now } from "./Now";
import { nowGroups } from "../lib/data";

const SNAPSHOT = {
  ok: true,
  source: "events" as const,
  user: {
    login: "tengkyuuu",
    name: "James",
    bio: null,
    htmlUrl: "https://github.com/tengkyuuu",
    publicRepos: 14,
    followers: 3,
  },
  totals: { stars: 7, repos: 14, followers: 3, contributions: 42 },
  days: [
    { date: "2026-08-25", count: 0 },
    { date: "2026-08-26", count: 4 },
    { date: "2026-08-27", count: 2 },
  ],
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
  commits: [
    {
      repo: "tengkyuuu/portfolio-website",
      message: "Add a Vitest suite",
      sha: "fa53462",
      url: "https://github.com/tengkyuuu/portfolio-website/commit/fa53462",
      at: new Date().toISOString(),
    },
  ],
  fetchedAt: new Date().toISOString(),
};

function mockApi(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 }))
  );
}

describe("Now", () => {
  it("renders the static Now groups without waiting on GitHub", () => {
    mockApi(SNAPSHOT);
    render(<Now />);
    for (const g of nowGroups) {
      expect(screen.getByRole("heading", { name: g.label })).toBeInTheDocument();
      for (const item of g.items) {
        expect(screen.getByText(item.name)).toBeInTheDocument();
      }
    }
  });

  it("shows when the page was last reviewed", () => {
    mockApi(SNAPSHOT);
    render(<Now />);
    expect(screen.getByText(/Reviewed /)).toBeInTheDocument();
  });

  it("renders the GitHub panel once the snapshot arrives", async () => {
    mockApi(SNAPSHOT);
    render(<Now />);
    expect(await screen.findByText("Public repos")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@tengkyuuu/ })).toHaveAttribute(
      "href",
      SNAPSHOT.user.htmlUrl
    );
  });

  it("captions the heatmap honestly when it came from public events", async () => {
    mockApi(SNAPSHOT);
    render(<Now />);
    expect(await screen.findByText(/Public-event activity/)).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
  });

  it("captions it as a contribution calendar when a token was used", async () => {
    mockApi({ ...SNAPSHOT, source: "contributions" });
    render(<Now />);
    expect(await screen.findByText(/contribution calendar/)).toBeInTheDocument();
    expect(screen.getByText("Contributions")).toBeInTheDocument();
  });

  it("lists repositories and recent commits", async () => {
    mockApi(SNAPSHOT);
    render(<Now />);
    // The repo name shows on the card and again on the commit row, so
    // assert by destination rather than by accessible name.
    await screen.findByText("Repositories");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(SNAPSHOT.repos[0].url);
    expect(hrefs).toContain(SNAPSHOT.commits[0].url);
    expect(screen.getByText(SNAPSHOT.repos[0].description)).toBeInTheDocument();
  });

  it("explains a rate limit instead of showing an error", async () => {
    mockApi({ ok: false, reason: "rate_limited" });
    render(<Now />);
    expect(await screen.findByText(/rate-limiting/)).toBeInTheDocument();
  });

  it("stays quiet when the endpoint fails outright", async () => {
    mockApi({ error: "boom" }, false);
    render(<Now />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(await screen.findByText(/isn't available/)).toBeInTheDocument();
    // The static half of the page must still be there.
    expect(screen.getByRole("heading", { name: nowGroups[0].label })).toBeInTheDocument();
  });

  it("survives a snapshot with empty collections", async () => {
    mockApi({ ...SNAPSHOT, languages: [], repos: [], commits: [], days: [] });
    render(<Now />);
    expect(await screen.findByText("Public repos")).toBeInTheDocument();
  });
});
