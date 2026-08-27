import { useEffect, useState } from "react";
import { nowGroups, nowUpdated } from "../lib/data";

/**
 * Now — what has my attention this month, plus a live read on the GitHub
 * account behind the work.
 *
 * Everything below the fold comes from /api/github, which shapes the
 * GitHub API server-side and edge-caches it. The panel degrades quietly:
 * a rate limit or an outage collapses it to one honest line rather than an
 * error state, because a portfolio that shouts about a third-party 403 is
 * worse than one that simply doesn't show a graph.
 *
 * The heatmap is labelled by its source. With GITHUB_TOKEN set it is the
 * real contribution calendar; without one it is derived from the public
 * events feed, which GitHub caps at 90 days — a recent-activity graph, and
 * captioned as exactly that.
 */

type Day = { date: string; count: number };

type Snapshot = {
  ok: true;
  source: "contributions" | "events";
  user: {
    login: string;
    name: string | null;
    bio: string | null;
    htmlUrl: string;
    publicRepos: number;
    followers: number;
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

type Failure = { ok: false; reason: string };
type State = Snapshot | Failure | "loading";

export function Now() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let alive = true;
    fetch("/api/github")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Snapshot | Failure) => {
        if (alive) setState(d);
      })
      .catch(() => {
        if (alive) setState({ ok: false, reason: "unavailable" });
      });
    return () => {
      alive = false;
    };
  }, []);

  const snap = state !== "loading" && state.ok ? state : null;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-4">
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue">
          Now
        </h2>
        <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider">
          Reviewed {nowUpdated}
        </span>
      </div>

      <p className="font-doc italic text-[13px] text-ink-subtle mb-5">
        A standing answer to “what are you working on?” — kept short, and
        dated so you can tell how stale it is. The panel below reads live
        from GitHub.
      </p>

      {/* ── What I'm on ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        {nowGroups.map((group) => (
          <div
            key={group.label}
            className="border border-rule rounded-sm bg-row-alt/60 overflow-hidden break-inside-avoid"
          >
            <header className="flex items-center gap-2 px-3 py-2 border-b border-rule bg-paper/70">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-word-blue"
                style={{ fontSize: 17 }}
              >
                {group.icon}
              </span>
              <h3 className="font-doc text-[15px] font-bold text-ink leading-none">
                {group.label}
              </h3>
              <span className="ml-auto font-ui text-[10px] text-ink-subtle tabular-nums">
                {group.items.length}
              </span>
            </header>
            <ul className="px-3 py-2 space-y-2.5">
              {group.items.map((item) => (
                <li key={item.name}>
                  <div className="font-ui text-[12.5px] font-semibold text-ink">
                    {item.name}
                  </div>
                  <p className="font-doc text-[13px] leading-[1.6] text-ink-muted">
                    {item.note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── GitHub ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-4">
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue">
          GitHub Activity
        </h2>
        {snap && (
          <a
            href={snap.user.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-ui text-[11px] text-ink-subtle hover:text-word-blue transition-colors"
          >
            @{snap.user.login} ↗
          </a>
        )}
      </div>

      {state === "loading" && <Loading />}

      {state !== "loading" && !state.ok && (
        <p className="font-ui text-[12px] italic text-ink-subtle border border-dashed border-rule rounded-sm px-3 py-6 text-center">
          {state.reason === "rate_limited"
            ? "GitHub is rate-limiting this page right now — the graph will be back shortly."
            : "GitHub activity isn't available at the moment."}
        </p>
      )}

      {snap && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-rule border border-rule rounded-sm overflow-hidden mb-4">
            <Tile
              label={snap.source === "contributions" ? "Contributions" : "Events"}
              value={snap.totals.contributions}
              hint={snap.source === "contributions" ? "past 12 months" : "past 90 days"}
            />
            <Tile label="Public repos" value={snap.totals.repos} hint="on the account" />
            <Tile label="Stars" value={snap.totals.stars} hint="across owned repos" />
            <Tile label="Followers" value={snap.totals.followers} hint="on GitHub" />
          </div>

          <Heatmap days={snap.days} source={snap.source} />

          {snap.languages.length > 0 && <Languages languages={snap.languages} />}

          {snap.repos.length > 0 && <Repos repos={snap.repos} />}

          {snap.commits.length > 0 && <Commits commits={snap.commits} />}

          <p className="mt-5 font-ui text-[10px] text-ink-subtle">
            Read live from the GitHub API, cached for 15 minutes · last
            refreshed {formatWhen(snap.fetchedAt)}
          </p>
        </>
      )}
    </section>
  );
}

/* ------------------------------- heatmap -------------------------------- */

/** Five buckets, matching the density ramp GitHub itself uses. */
function level(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio > 0.66) return 4;
  if (ratio > 0.4) return 3;
  if (ratio > 0.15) return 2;
  return 1;
}

const LEVEL_CLASS = [
  "bg-rule",
  "bg-word-blue/25",
  "bg-word-blue/50",
  "bg-word-blue/75",
  "bg-word-blue",
];

function Heatmap({ days, source }: { days: Day[]; source: Snapshot["source"] }) {
  if (days.length === 0) return null;
  const max = days.reduce((n, d) => Math.max(n, d.count), 0);

  // Column-major weeks so the grid reads the way GitHub's does. The first
  // column is padded so every row is a consistent weekday.
  const lead = new Date(days[0].date + "T00:00:00Z").getUTCDay();
  const cells: (Day | null)[] = [...Array(lead).fill(null), ...days];
  const weeks: (Day | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <figure className="mb-5">
      <div className="border border-rule rounded-sm bg-row-alt/50 p-3 overflow-x-auto">
        <div className="flex gap-[3px] min-w-max">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, di) => {
                const day = week[di];
                if (!day) return <span key={di} className="w-[10px] h-[10px]" />;
                return (
                  <span
                    key={di}
                    title={`${day.count} on ${day.date}`}
                    className={
                      "w-[10px] h-[10px] rounded-[2px] " + LEVEL_CLASS[level(day.count, max)]
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 mt-2.5 font-ui text-[10px] text-ink-subtle">
          <span>Less</span>
          {LEVEL_CLASS.map((c, i) => (
            <span key={i} className={"w-[10px] h-[10px] rounded-[2px] " + c} />
          ))}
          <span>More</span>
          <span className="ml-auto tabular-nums">
            {days.length} days · peak {max}
          </span>
        </div>
      </div>
      <figcaption className="mt-2 text-center font-doc italic text-[12px] text-ink-subtle">
        {source === "contributions"
          ? "FIG: GitHub contribution calendar, past 12 months."
          : "FIG: Public-event activity, past 90 days. GitHub caps this feed, so it counts recent public events rather than total contributions."}
      </figcaption>
    </figure>
  );
}

/* ------------------------------ sub-panels ------------------------------ */

function Languages({ languages }: { languages: Snapshot["languages"] }) {
  const shown = languages.slice(0, 6);
  return (
    <div className="mb-5">
      <SubHead>Language mix</SubHead>
      <div className="flex h-2 rounded-full overflow-hidden border border-rule mb-2.5">
        {shown.map((l, i) => (
          <span
            key={l.name}
            title={`${l.name} — ${l.share}%`}
            style={{ width: `${l.share}%`, opacity: 1 - i * 0.13 }}
            className="block bg-word-blue"
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {shown.map((l, i) => (
          <li key={l.name} className="inline-flex items-center gap-1.5 font-ui text-[11px]">
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-[1px] bg-word-blue"
              style={{ opacity: 1 - i * 0.13 }}
            />
            <span className="text-ink">{l.name}</span>
            <span className="text-ink-subtle tabular-nums">{l.share}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 font-ui text-[10px] text-ink-subtle italic">
        Share of public repositories by primary language — not lines written.
      </p>
    </div>
  );
}

function Repos({ repos }: { repos: Snapshot["repos"] }) {
  return (
    <div className="mb-5">
      <SubHead>Repositories</SubHead>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {repos.map((r) => (
          <li key={r.name}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full border border-rule rounded-sm px-3 py-2 hover:border-word-blue hover:bg-word-blue-light transition-colors"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-ui text-[12.5px] font-semibold text-word-blue truncate">
                  {r.name}
                </span>
                {r.stars > 0 && (
                  <span className="ml-auto font-ui text-[10px] text-ink-subtle tabular-nums shrink-0">
                    ★ {r.stars}
                  </span>
                )}
              </div>
              {r.description && (
                <p className="font-doc text-[12.5px] leading-[1.5] text-ink-muted line-clamp-2 mt-0.5">
                  {r.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 font-ui text-[10px] text-ink-subtle">
                {r.language && <span>{r.language}</span>}
                {r.pushedAt && <span>· pushed {formatWhen(r.pushedAt)}</span>}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Commits({ commits }: { commits: Snapshot["commits"] }) {
  return (
    <div>
      <SubHead>Recent commits</SubHead>
      <ul className="border border-rule rounded-sm overflow-hidden">
        {commits.map((c, i) => (
          <li
            key={c.sha + i}
            className="border-b border-rule last:border-0 even:bg-row-alt/60"
          >
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-2 px-3 py-1.5 hover:bg-word-blue-light transition-colors"
            >
              <code className="font-ui text-[10px] text-word-blue tabular-nums shrink-0">
                {c.sha}
              </code>
              <span className="font-ui text-[12px] text-ink truncate">{c.message}</span>
              <span className="ml-auto font-ui text-[10px] text-ink-subtle shrink-0 hidden sm:inline">
                {c.repo.split("/").pop()}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-ink border-l-[3px] border-word-blue pl-2.5 mb-2.5">
      {children}
    </h3>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="bg-paper px-3 py-2.5">
      <div className="font-ui text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
        {label}
      </div>
      <div className="font-ui text-[24px] leading-none font-bold text-word-blue tabular-nums mt-1">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 font-ui text-[10px] text-ink-subtle leading-tight">{hint}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading GitHub activity</span>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-rule border border-rule rounded-sm overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-paper px-3 py-2.5 space-y-2">
            <div className="h-2 w-2/3 bg-ribbon rounded-sm animate-pulse" />
            <div className="h-5 w-10 bg-ribbon rounded-sm animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-[96px] border border-rule rounded-sm bg-ribbon/60 animate-pulse" />
    </div>
  );
}

/** "3 days ago" for anything recent, a plain date beyond a month. */
function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
