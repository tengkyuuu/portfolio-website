import { useEffect, useState } from "react";

/**
 * GitHub Activity — a live read on the account behind the work.
 *
 * This used to sit under the Now tab, below the fold. It reads better on
 * the cover page: it is evidence for the claims the rest of the document
 * makes, and it is the only part of it that is true at the moment you load
 * it rather than at the moment it was written.
 *
 * It comes in two halves because six repository cards and twelve commit
 * rows do not fit on a page with the graph. Totals, heatmap and language
 * mix on one sheet; the lists on a "(cont.)" sheet after it. Both read one
 * shared fetch, so a sheet cannot show a different snapshot to its
 * continuation.
 *
 * Everything here comes from /api/github, which shapes the GitHub API
 * server-side and edge-caches it. The panel degrades quietly: a rate limit
 * or an outage collapses it to one honest line rather than an error state,
 * because a portfolio that shouts about a third-party 403 is worse than
 * one that simply doesn't show a graph.
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
export type GitHubState = Snapshot | Failure | "loading";

/** Fetches the snapshot once. Lifted out of the panel because the panel
 *  spans two sheets and both halves have to read the same fetch — two
 *  components each calling /api/github would double the request and let
 *  the pages disagree with each other. */
export function useGitHubSnapshot(): GitHubState {
  const [state, setState] = useState<GitHubState>("loading");

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

  return state;
}

/** The snapshot, if there is one — otherwise null. */
export function gitHubSnapshot(state: GitHubState): Snapshot | null {
  return state !== "loading" && state.ok ? state : null;
}

/** First sheet: who, how much, and the shape of the year. */
export function GitHubActivity({ state }: { state: GitHubState }) {
  const snap = gitHubSnapshot(state);

  return (
    <section>
      <PanelHead snap={snap}>GitHub Activity</PanelHead>

      <p className="font-doc italic text-[13px] text-ink-subtle mb-5">
        The rest of this document was written. This page is read from the
        account it describes, so it is the one part that can disagree with
        me.
      </p>

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
        </>
      )}
    </section>
  );
}

/** Second sheet: the lists, which are what actually overflow a page.
 *  Only rendered when there is something to put on it — an empty
 *  continuation sheet is worse than no continuation sheet. */
export function GitHubDetail({ snapshot }: { snapshot: Snapshot }) {
  return (
    <section>
      <PanelHead snap={snapshot}>GitHub Activity (cont.)</PanelHead>

      {snapshot.repos.length > 0 && <Repos repos={snapshot.repos} />}

      {snapshot.commits.length > 0 && <Commits commits={snapshot.commits} />}

      <p className="mt-5 font-ui text-[10px] text-ink-subtle">
        Read live from the GitHub API, cached for 15 minutes · last
        refreshed {formatWhen(snapshot.fetchedAt)}
      </p>
    </section>
  );
}

/** True when there is enough for the continuation sheet to be worth a page. */
export function hasGitHubDetail(state: GitHubState): boolean {
  const snap = gitHubSnapshot(state);
  return Boolean(snap && (snap.repos.length > 0 || snap.commits.length > 0));
}

function PanelHead({
  snap,
  children,
}: {
  snap: Snapshot | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-4">
      <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue">
        {children}
      </h2>
      {snap && (
        <a
          href={snap.user.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-ui text-[11px] text-ink-subtle hover:text-word-blue transition-colors"
        >
          @{snap.user.login} <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens on github.com)</span>
        </a>
      )}
    </div>
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

  // One sentence carrying what the grid conveys visually. The cells cannot
  // do this themselves: a `title` is not reachable by keyboard, and screen
  // readers treat it inconsistently, so 365 title-only spans are either
  // silence or 365 interruptions depending on the reader. Summarising here
  // and hiding the cells gives one useful announcement instead.
  const total = days.reduce((n, d) => n + d.count, 0);
  const summary =
    `${source === "contributions" ? "Contribution" : "Public event"} calendar: ` +
    `${total.toLocaleString()} across ${days.length} days, ` +
    `from ${longDate(days[0].date)} to ${longDate(days[days.length - 1].date)}. ` +
    `Busiest day: ${max.toLocaleString()}.`;

  return (
    <figure className="mb-5">
      {/* Focusable so the grid can be scrolled without a mouse — it is
          wider than the page on narrow viewports. */}
      <div
        tabIndex={0}
        className="border border-rule rounded-sm bg-row-alt/50 p-3 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-word-blue"
      >
        <div className="flex gap-[3px] min-w-max" role="img" aria-label={summary}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, di) => {
                const day = week[di];
                if (!day) return <span key={di} className="w-[10px] h-[10px]" />;
                return (
                  <span
                    key={di}
                    aria-hidden="true"
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
            <span
              key={i}
              aria-hidden="true"
              className={"w-[10px] h-[10px] rounded-[2px] " + c}
            />
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
      {/* Decorative: the list directly below states every name and share
          as real text, so announcing the bar too would read the same six
          languages twice. */}
      <div
        aria-hidden="true"
        className="flex h-2 rounded-full overflow-hidden border border-rule mb-2.5"
      >
        {shown.map((l, i) => (
          <span
            key={l.name}
            title={`${l.name} ${l.share}%`}
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
                    {/* The glyph alone announces as "black star", so the
                        count reads as gibberish without a real word. Both
                        halves are whole phrases rather than a shared
                        number: the accessible-name algorithm trims each
                        element's text before joining, so a bare "4" beside
                        a " stars" fragment concatenates to "4stars". */}
                    <span aria-hidden="true">★ {r.stars}</span>
                    <span className="sr-only">
                      {r.stars} star{r.stars === 1 ? "" : "s"}
                    </span>
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

/** "4 September 2026" — spelled out, because this only ever goes into a
 *  spoken label where "2026-09-04" is read as three separate numbers. */
function longDate(day: string): string {
  const at = new Date(day + "T00:00:00Z");
  if (Number.isNaN(at.getTime())) return day;
  return at.toLocaleDateString(undefined, {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
