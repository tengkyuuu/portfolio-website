import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * /api/github
 *   GET public — a small, shaped snapshot of the GitHub profile behind
 *   this portfolio: contribution graph, top repositories, language mix,
 *   and recent commits (which the Now tab reuses as a changelog).
 *
 * Why proxy at all, when the GitHub API is public? Three reasons:
 *   • Rate limits. Unauthenticated GitHub allows 60 requests/hour per IP.
 *     Called from the browser that is per visitor; called from here it is
 *     per function, and the s-maxage below collapses every visitor in a
 *     15-minute window into one upstream refresh.
 *   • Payload. The raw responses are ~400 KB of JSON for what renders as
 *     four numbers and a grid. Shaping server-side keeps that off the wire.
 *   • Optional auth. GITHUB_TOKEN never has to reach the client.
 *
 * The contribution graph has two sources, and the response says which:
 *   • "contributions" — the real calendar, 12 months, via GraphQL. Needs
 *     GITHUB_TOKEN (a classic token with no scopes is enough for public
 *     data).
 *   • "events" — derived from the public events feed when there is no
 *     token. GitHub caps that feed at 90 days and 300 events, so it is a
 *     recent-activity graph, not a contribution count. The UI labels it
 *     honestly rather than passing it off as the real thing.
 *
 * Self-contained, no shared imports: every file under api/ is built as a
 * Serverless Function and the Hobby plan caps a deployment at 12, so this
 * file both stands alone and had to replace one (see .vercelignore).
 */

const API = "https://api.github.com";
const GRAPHQL = "https://api.github.com/graphql";
const EVENT_WINDOW_DAYS = 90;
const TOP_REPOS = 6;
const RECENT_COMMITS = 12;

function login(): string {
  return process.env.GITHUB_USERNAME || "tengkyuuu";
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    // GitHub rejects requests with no User-Agent.
    "user-agent": "portfolio-docx",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

/* ------------------------------ shaping ------------------------------- */

export type Day = { date: string; count: number };

export type Snapshot = {
  ok: true;
  source: "contributions" | "events";
  user: {
    login: string;
    name: string | null;
    bio: string | null;
    avatarUrl: string | null;
    htmlUrl: string;
    publicRepos: number;
    followers: number;
    createdAt: string | null;
  };
  totals: { stars: number; repos: number; followers: number; contributions: number };
  days: Day[];
  languages: { name: string; repos: number; share: number }[];
  repos: {
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    url: string;
    pushedAt: string | null;
    topics: string[];
  }[];
  commits: { repo: string; message: string; sha: string; url: string; at: string }[];
  fetchedAt: string;
};

export type Failure = { ok: false; reason: "rate_limited" | "unavailable" };

/** ISO date (YYYY-MM-DD) in UTC — the unit the heatmap buckets by. */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * A dense, ascending run of days ending today, with zero-filled gaps.
 * The grid needs every day present or the columns misalign.
 */
export function fillDays(counts: Map<string, number>, from: Date, to: Date): Day[] {
  const out: Day[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (cursor.getTime() <= end) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ date: key, count: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/* GitHub's event payloads are loosely typed; only a few fields are read. */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Bucket public events per day. Pushes count their commits, everything else 1. */
export function daysFromEvents(events: any[], now: Date): Day[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (typeof e?.created_at !== "string") continue;
    const key = dayKey(e.created_at);
    const n =
      e.type === "PushEvent"
        ? Number(e.payload?.distinct_size ?? e.payload?.size ?? 1) || 1
        : 1;
    counts.set(key, (counts.get(key) ?? 0) + n);
  }
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (EVENT_WINDOW_DAYS - 1));
  return fillDays(counts, from, now);
}

/** Flatten push events into a newest-first commit list. */
export function commitsFromEvents(events: any[], limit = RECENT_COMMITS) {
  const out: Snapshot["commits"] = [];
  for (const e of events) {
    if (e?.type !== "PushEvent" || !Array.isArray(e.payload?.commits)) continue;
    const repo: string = e.repo?.name ?? "";
    for (const c of [...e.payload.commits].reverse()) {
      if (out.length >= limit) return out;
      const sha: string = typeof c?.sha === "string" ? c.sha : "";
      if (!sha || typeof c?.message !== "string") continue;
      out.push({
        repo,
        // Subject line only — bodies are long in this repo by convention.
        message: c.message.split("\n")[0].slice(0, 160),
        sha: sha.slice(0, 7),
        url: `https://github.com/${repo}/commit/${sha}`,
        at: e.created_at,
      });
    }
  }
  return out;
}

/** Primary-language mix by repository count. Forks and archives excluded. */
export function languageMix(repos: any[]): Snapshot["languages"] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of repos) {
    if (r?.fork || r?.archived) continue;
    const name = typeof r?.language === "string" ? r.language : null;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    total += 1;
  }
  return [...counts.entries()]
    .map(([name, n]) => ({
      name,
      repos: n,
      share: total ? Math.round((n / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name));
}

/** Most-starred first, then most recently pushed. Forks excluded. */
export function topRepos(repos: any[], limit = TOP_REPOS): Snapshot["repos"] {
  return repos
    .filter((r) => r && !r.fork && !r.archived && !r.private)
    .sort(
      (a, b) =>
        (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0) ||
        String(b.pushed_at ?? "").localeCompare(String(a.pushed_at ?? ""))
    )
    .slice(0, limit)
    .map((r) => ({
      name: r.name,
      description: typeof r.description === "string" ? r.description.slice(0, 200) : null,
      language: r.language ?? null,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      url: r.html_url,
      pushedAt: r.pushed_at ?? null,
      topics: Array.isArray(r.topics) ? r.topics.slice(0, 4) : [],
    }));
}

export function starTotal(repos: any[]): number {
  return repos.reduce(
    (n, r) => n + (r && !r.fork ? Number(r.stargazers_count ?? 0) : 0),
    0
  );
}

/** Pull the calendar out of the GraphQL response, or null if it isn't there. */
export function daysFromCalendar(json: any): { days: Day[]; total: number } | null {
  const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
  const weeks = cal?.weeks;
  if (!Array.isArray(weeks)) return null;
  const days: Day[] = [];
  for (const w of weeks) {
    for (const d of w?.contributionDays ?? []) {
      if (typeof d?.date !== "string") continue;
      days.push({ date: d.date, count: Number(d.contributionCount ?? 0) || 0 });
    }
  }
  if (days.length === 0) return null;
  return { days, total: Number(cal.totalContributions ?? 0) || 0 };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------- handler ------------------------------- */

const CALENDAR_QUERY = `query($login:String!){
  user(login:$login){
    contributionsCollection{
      contributionCalendar{
        totalContributions
        weeks{ contributionDays{ date contributionCount } }
      }
    }
  }
}`;

let cache: { at: number; body: Snapshot } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // One upstream refresh serves every visitor in the window.
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");

  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return res.status(200).json(cache.body);

  const user = login();

  try {
    const [profileRes, reposRes, eventsRes] = await Promise.all([
      fetch(`${API}/users/${user}`, { headers: headers() }),
      fetch(`${API}/users/${user}/repos?per_page=100&sort=pushed&type=owner`, {
        headers: headers(),
      }),
      fetch(`${API}/users/${user}/events/public?per_page=100`, { headers: headers() }),
    ]);

    if ([profileRes, reposRes, eventsRes].some((r) => r.status === 403 || r.status === 429)) {
      return res.status(200).json({ ok: false, reason: "rate_limited" } satisfies Failure);
    }
    if (!profileRes.ok) {
      return res.status(200).json({ ok: false, reason: "unavailable" } satisfies Failure);
    }

    const profile = await profileRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];
    const events = eventsRes.ok ? await eventsRes.json() : [];

    // Prefer the real contribution calendar; fall back to public events.
    let source: Snapshot["source"] = "events";
    let days = daysFromEvents(Array.isArray(events) ? events : [], new Date());
    let contributions = days.reduce((n, d) => n + d.count, 0);

    if (process.env.GITHUB_TOKEN) {
      try {
        const gql = await fetch(GRAPHQL, {
          method: "POST",
          headers: { ...headers(), "content-type": "application/json" },
          body: JSON.stringify({ query: CALENDAR_QUERY, variables: { login: user } }),
        });
        if (gql.ok) {
          const parsed = daysFromCalendar(await gql.json());
          if (parsed) {
            source = "contributions";
            days = parsed.days;
            contributions = parsed.total;
          }
        }
      } catch {
        // Keep the events fallback.
      }
    }

    const repoList = Array.isArray(repos) ? repos : [];
    const eventList = Array.isArray(events) ? events : [];

    const body: Snapshot = {
      ok: true,
      source,
      user: {
        login: profile.login,
        name: profile.name ?? null,
        bio: profile.bio ?? null,
        avatarUrl: profile.avatar_url ?? null,
        htmlUrl: profile.html_url ?? `https://github.com/${user}`,
        publicRepos: profile.public_repos ?? 0,
        followers: profile.followers ?? 0,
        createdAt: profile.created_at ?? null,
      },
      totals: {
        stars: starTotal(repoList),
        repos: profile.public_repos ?? repoList.length,
        followers: profile.followers ?? 0,
        contributions,
      },
      days,
      languages: languageMix(repoList),
      repos: topRepos(repoList),
      commits: commitsFromEvents(eventList),
      fetchedAt: new Date().toISOString(),
    };

    cache = { at: now, body };
    return res.status(200).json(body);
  } catch {
    return res.status(200).json({ ok: false, reason: "unavailable" } satisfies Failure);
  }
}
