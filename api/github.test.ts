import { describe, expect, it } from "vitest";
import {
  commitsFromSearch,
  dayKey,
  daysFromCalendar,
  daysFromEvents,
  fillDays,
  languageMix,
  starTotal,
  topRepos,
} from "./github";

/**
 * Everything here shapes third-party JSON we do not control. GitHub can
 * omit fields, change counts, or return an error body with a 200, and a
 * shaping bug is silent — the panel renders empty rather than throwing.
 */

const push = (date: string, repo: string, commits: { sha: string; message: string }[]) => ({
  type: "PushEvent",
  created_at: date,
  repo: { name: repo },
  payload: { distinct_size: commits.length, size: commits.length, commits },
});

describe("dayKey", () => {
  it("reduces an ISO timestamp to its UTC date", () => {
    expect(dayKey("2026-08-27T23:59:59Z")).toBe("2026-08-27");
  });
});

describe("fillDays", () => {
  it("returns a dense ascending run with gaps zero-filled", () => {
    const counts = new Map([["2026-08-03", 4]]);
    const days = fillDays(counts, new Date("2026-08-01T00:00:00Z"), new Date("2026-08-05T00:00:00Z"));
    expect(days.map((d) => d.date)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
    expect(days.map((d) => d.count)).toEqual([0, 0, 4, 0, 0]);
  });

  it("handles a single-day range", () => {
    const days = fillDays(new Map(), new Date("2026-08-01T00:00:00Z"), new Date("2026-08-01T00:00:00Z"));
    expect(days).toEqual([{ date: "2026-08-01", count: 0 }]);
  });

  it("crosses a month boundary", () => {
    const days = fillDays(new Map(), new Date("2026-07-30T00:00:00Z"), new Date("2026-08-02T00:00:00Z"));
    expect(days.map((d) => d.date)).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });
});

describe("daysFromEvents", () => {
  const now = new Date("2026-08-27T12:00:00Z");

  it("counts a push as its number of distinct commits", () => {
    const days = daysFromEvents(
      [push("2026-08-27T10:00:00Z", "a/b", [{ sha: "1", message: "x" }, { sha: "2", message: "y" }])],
      now
    );
    expect(days.at(-1)).toEqual({ date: "2026-08-27", count: 2 });
  });

  it("counts a non-push event as one", () => {
    const days = daysFromEvents([{ type: "WatchEvent", created_at: "2026-08-27T10:00:00Z" }], now);
    expect(days.at(-1)?.count).toBe(1);
  });

  it("sums several events landing on the same day", () => {
    const days = daysFromEvents(
      [
        push("2026-08-27T09:00:00Z", "a/b", [{ sha: "1", message: "x" }]),
        { type: "IssuesEvent", created_at: "2026-08-27T11:00:00Z" },
      ],
      now
    );
    expect(days.at(-1)?.count).toBe(2);
  });

  it("returns a full 90-day window ending today", () => {
    const days = daysFromEvents([], now);
    expect(days).toHaveLength(90);
    expect(days.at(-1)?.date).toBe("2026-08-27");
    expect(days.every((d) => d.count === 0)).toBe(true);
  });

  it("ignores entries with no timestamp", () => {
    expect(() => daysFromEvents([{ type: "PushEvent" }, null, 7], now)).not.toThrow();
  });
});

describe("commitsFromSearch", () => {
  const item = (sha, message, repo = "tengkyuuu/portfolio-website") => ({
    sha,
    commit: { message, committer: { date: "2026-08-27T10:00:00Z" } },
    html_url: `https://github.com/${repo}/commit/${sha}`,
    repository: { full_name: repo },
  });

  it("keeps only the subject line of each message", () => {
    const out = commitsFromSearch({
        items: [item("aaaaaaa1111", "Add the thing\n\nA long body that must not appear")],
    });
    expect(out[0].message).toBe("Add the thing");
  });

  it("shortens the sha and carries repo, url and date", () => {
    const out = commitsFromSearch({ items: [item("aaaaaaa1111", "Subject")] });
    expect(out[0]).toEqual({
      repo: "tengkyuuu/portfolio-website",
      message: "Subject",
      sha: "aaaaaaa",
      url: "https://github.com/tengkyuuu/portfolio-website/commit/aaaaaaa1111",
      at: "2026-08-27T10:00:00Z",
    });
  });

  it("respects the limit", () => {
    const items = Array.from({ length: 30 }, (_, i) => item(`sha${i}0000000`, `m${i}`));
    expect(commitsFromSearch({ items }, 5)).toHaveLength(5);
  });

  it("drops entries missing a sha or message", () => {
    const out = commitsFromSearch({
      items: [{ sha: "", commit: { message: "no sha" } }, item("ok1234567", "kept")],
    });
    expect(out.map((c) => c.message)).toEqual(["kept"]);
  });

  it("returns nothing for a rate-limit or error body", () => {
    expect(commitsFromSearch({ message: "API rate limit exceeded" })).toEqual([]);
    expect(commitsFromSearch({})).toEqual([]);
    expect(commitsFromSearch(null)).toEqual([]);
  });

  it("falls back to a constructed url when html_url is absent", () => {
    const raw = item("bbbbbbb2222", "Subject");
    delete raw.html_url;
    expect(commitsFromSearch({ items: [raw] })[0].url).toBe(
      "https://github.com/tengkyuuu/portfolio-website/commit/bbbbbbb2222"
    );
  });
});

describe("languageMix", () => {
  it("counts repos per primary language and shares them to 100", () => {
    const mix = languageMix([
      { language: "TypeScript" },
      { language: "TypeScript" },
      { language: "C++" },
    ]);
    expect(mix[0]).toEqual({ name: "TypeScript", repos: 2, share: 66.7 });
    expect(mix[1]).toEqual({ name: "C++", repos: 1, share: 33.3 });
  });

  it("excludes forks, archives, and repos with no language", () => {
    const mix = languageMix([
      { language: "Go", fork: true },
      { language: "Rust", archived: true },
      { language: null },
      { language: "Dart" },
    ]);
    expect(mix).toEqual([{ name: "Dart", repos: 1, share: 100 }]);
  });

  it("returns nothing for an empty list rather than dividing by zero", () => {
    expect(languageMix([])).toEqual([]);
  });
});

describe("topRepos", () => {
  const repos = [
    { name: "old", stargazers_count: 0, pushed_at: "2024-01-01", html_url: "u", forks_count: 0 },
    { name: "starred", stargazers_count: 9, pushed_at: "2023-01-01", html_url: "u", forks_count: 0 },
    { name: "fresh", stargazers_count: 0, pushed_at: "2026-08-01", html_url: "u", forks_count: 0 },
  ];

  it("ranks by stars, then by most recent push", () => {
    expect(topRepos(repos).map((r) => r.name)).toEqual(["starred", "fresh", "old"]);
  });

  it("excludes forks, archives and private repos", () => {
    const out = topRepos([
      ...repos,
      { name: "forked", fork: true, html_url: "u" },
      { name: "archived", archived: true, html_url: "u" },
      { name: "secret", private: true, html_url: "u" },
    ]);
    expect(out.map((r) => r.name)).not.toContain("forked");
    expect(out.map((r) => r.name)).not.toContain("archived");
    expect(out.map((r) => r.name)).not.toContain("secret");
  });

  it("caps the list", () => {
    expect(topRepos(repos, 2)).toHaveLength(2);
  });

  it("survives missing optional fields", () => {
    const [r] = topRepos([{ name: "bare", html_url: "u" }]);
    expect(r).toMatchObject({ name: "bare", stars: 0, forks: 0, language: null, topics: [] });
  });
});

describe("starTotal", () => {
  it("sums stars across owned repos only", () => {
    expect(starTotal([{ stargazers_count: 3 }, { stargazers_count: 4, fork: true }])).toBe(3);
  });

  it("is zero for an empty list", () => {
    expect(starTotal([])).toBe(0);
  });
});

describe("daysFromCalendar", () => {
  it("flattens the GraphQL weeks into days", () => {
    const parsed = daysFromCalendar({
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: 5,
              weeks: [
                { contributionDays: [{ date: "2026-08-01", contributionCount: 2 }] },
                { contributionDays: [{ date: "2026-08-02", contributionCount: 3 }] },
              ],
            },
          },
        },
      },
    });
    expect(parsed).toEqual({
      total: 5,
      days: [
        { date: "2026-08-01", count: 2 },
        { date: "2026-08-02", count: 3 },
      ],
    });
  });

  it("returns null for an error response so the caller keeps the fallback", () => {
    expect(daysFromCalendar({ errors: [{ message: "Bad credentials" }] })).toBeNull();
    expect(daysFromCalendar({})).toBeNull();
    expect(daysFromCalendar({ data: { user: null } })).toBeNull();
  });

  it("returns null for an empty calendar", () => {
    expect(
      daysFromCalendar({
        data: { user: { contributionsCollection: { contributionCalendar: { weeks: [] } } } },
      })
    ).toBeNull();
  });
});
