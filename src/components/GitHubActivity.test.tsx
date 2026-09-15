import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  GitHubActivity,
  GitHubDetail,
  gitHubSnapshot,
  hasGitHubDetail,
  useGitHubSnapshot,
  type GitHubState,
} from "./GitHubActivity";

const SNAPSHOT = {
  ok: true as const,
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

describe("GitHubActivity", () => {
  it("shows the totals and links out to the account", () => {
    render(<GitHubActivity state={SNAPSHOT} />);
    expect(screen.getByText("Public repos")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@tengkyuuu/ })).toHaveAttribute(
      "href",
      SNAPSHOT.user.htmlUrl
    );
  });

  it("captions the heatmap honestly when it came from public events", () => {
    render(<GitHubActivity state={SNAPSHOT} />);
    expect(screen.getByText(/Public-event activity/)).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
  });

  it("captions it as a contribution calendar when a token was used", () => {
    render(<GitHubActivity state={{ ...SNAPSHOT, source: "contributions" }} />);
    expect(screen.getByText(/contribution calendar/)).toBeInTheDocument();
    expect(screen.getByText("Contributions")).toBeInTheDocument();
  });

  it("explains a rate limit instead of showing an error", () => {
    render(<GitHubActivity state={{ ok: false, reason: "rate_limited" }} />);
    expect(screen.getByText(/rate-limiting/)).toBeInTheDocument();
  });

  it("stays quiet when the endpoint fails outright", () => {
    render(<GitHubActivity state={{ ok: false, reason: "unavailable" }} />);
    expect(screen.getByText(/isn't available/)).toBeInTheDocument();
    // The heading has to survive the failure — an unexplained empty panel
    // reads as a broken page.
    expect(
      screen.getByRole("heading", { name: "GitHub Activity" })
    ).toBeInTheDocument();
  });

  it("survives a snapshot with empty collections", () => {
    render(
      <GitHubActivity
        state={{ ...SNAPSHOT, languages: [], repos: [], commits: [], days: [] }}
      />
    );
    expect(screen.getByText("Public repos")).toBeInTheDocument();
  });
});

describe("GitHubDetail", () => {
  it("lists repositories and recent commits", () => {
    render(<GitHubDetail snapshot={SNAPSHOT} />);
    // The repo name shows on the card and again on the commit row, so
    // assert by destination rather than by accessible name.
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(SNAPSHOT.repos[0].url);
    expect(hrefs).toContain(SNAPSHOT.commits[0].url);
    expect(screen.getByText(SNAPSHOT.repos[0].description)).toBeInTheDocument();
  });

  it("marks itself as a continuation, the way a spilled page does", () => {
    render(<GitHubDetail snapshot={SNAPSHOT} />);
    expect(
      screen.getByRole("heading", { name: "GitHub Activity (cont.)" })
    ).toBeInTheDocument();
  });
});

describe("hasGitHubDetail", () => {
  it("earns a continuation page only when there is something to put on it", () => {
    expect(hasGitHubDetail(SNAPSHOT)).toBe(true);
    expect(hasGitHubDetail({ ...SNAPSHOT, repos: [], commits: [] })).toBe(false);
    expect(hasGitHubDetail("loading")).toBe(false);
    expect(hasGitHubDetail({ ok: false, reason: "unavailable" })).toBe(false);
  });
});

describe("useGitHubSnapshot", () => {
  function Probe() {
    const state = useGitHubSnapshot();
    const snap = gitHubSnapshot(state);
    return <span>{state === "loading" ? "loading" : snap ? snap.user.login : "none"}</span>;
  }

  it("reads the snapshot once and hands it to whoever asks", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SNAPSHOT)));
    vi.stubGlobal("fetch", fetchMock);
    render(<Probe />);
    expect(await screen.findByText("tengkyuuu")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a dead endpoint as unavailable rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 }))
    );
    render(<Probe />);
    expect(await screen.findByText("none")).toBeInTheDocument();
  });
});

/**
 * These pin the accessible reading of the panel, which is the half that
 * breaks silently. The graph, the star counts and the language bar all
 * render correctly while announcing nothing useful, so a regression here
 * is invisible on screen and only shows up to someone using a reader.
 */
describe("GitHubActivity accessibility", () => {
  it("summarises the heatmap in one label instead of 365 bare cells", () => {
    render(<GitHubActivity state={SNAPSHOT} />);
    // 6 contributions over the 3 days in the fixture, busiest day 4.
    const graph = screen.getByRole("img", { name: /Public event calendar/ });
    expect(graph).toHaveAccessibleName(/6 across 3 days/);
    expect(graph).toHaveAccessibleName(/Busiest day: 4/);
  });

  it("names the calendar for what it is when a token produced it", () => {
    render(<GitHubActivity state={{ ...SNAPSHOT, source: "contributions" }} />);
    expect(
      screen.getByRole("img", { name: /Contribution calendar/ })
    ).toBeInTheDocument();
  });

  it("spells out the date range rather than leaving a reader to parse digits", () => {
    render(<GitHubActivity state={SNAPSHOT} />);
    // Asserted as the absence of the ISO form rather than a formatted
    // string: the label goes through toLocaleDateString with the runtime
    // locale, so "August 25, 2026" and "25 August 2026" are both correct
    // and which one appears is not this component's business. What must
    // never come back is "2026-08-25", which a reader says as three
    // unrelated numbers.
    const name = screen.getByRole("img").getAttribute("aria-label") ?? "";
    expect(name).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(name).toMatch(/2026/);
  });

  it("says 'stars' rather than announcing the glyph as 'black star'", () => {
    render(<GitHubDetail snapshot={SNAPSHOT} />);
    expect(screen.getByRole("link", { name: /4 stars/ })).toBeInTheDocument();
  });

  it("hides the language bar, which repeats the list directly under it", () => {
    render(<GitHubActivity state={SNAPSHOT} />);
    const segment = screen.getByTitle("TypeScript 60%");
    expect(segment.parentElement).toHaveAttribute("aria-hidden", "true");
    // The visible list is the accessible copy, and there is only one of it.
    expect(screen.getAllByText("TypeScript")).toHaveLength(1);
  });
});

/** Type-level guard: the panel accepts every shape the hook can produce. */
const STATES: GitHubState[] = ["loading", { ok: false, reason: "x" }, SNAPSHOT];
void STATES;
