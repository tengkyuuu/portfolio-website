import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Code2,
  FolderGit2,
  GitCommitHorizontal,
  Github,
  Star,
  Users,
} from "lucide-react";
import "./github-activity.css";

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
  totals: {
    stars: number;
    repos: number;
    followers: number;
    contributions: number;
  };
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
  commits: {
    repo: string;
    message: string;
    sha: string;
    url: string;
    at: string;
  }[];
  fetchedAt: string;
};
type Failure = { ok: false; reason: string };
export type GitHubState = Snapshot | Failure | "loading";

/** Both activity sheets share this fetch and its source-labelled snapshot. */
export function useGitHubSnapshot(): GitHubState {
  const [state, setState] = useState<GitHubState>("loading");
  useEffect(() => {
    let alive = true;
    fetch("/api/github")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error(String(response.status))),
      )
      .then((snapshot: Snapshot | Failure) => {
        if (alive) setState(snapshot);
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
export function gitHubSnapshot(state: GitHubState): Snapshot | null {
  return state !== "loading" && state.ok ? state : null;
}
export function hasGitHubDetail(state: GitHubState): boolean {
  const snapshot = gitHubSnapshot(state);
  return Boolean(
    snapshot && (snapshot.repos.length || snapshot.commits.length),
  );
}

/** The range is based on calendar dates, never a count of received records. */
export function activityWindow(days: Day[], range: number): Day[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return [];
  const cutoff =
    new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`).getTime() -
    (range - 1) * 86400000;
  return sorted.filter(
    (day) => new Date(`${day.date}T00:00:00Z`).getTime() >= cutoff,
  );
}

export function GitHubActivity({ state }: { state: GitHubState }) {
  const snapshot = gitHubSnapshot(state);
  return (
    <section className="github-panel">
      <PanelHead snapshot={snapshot}>GitHub Activity</PanelHead>
      <div className="gh-introduction">
        <h3>
          Small commits.
          <br />
          <em>Steady progress.</em>
        </h3>
        <p>
          A look at what’s happening behind the scenes.
          <br />
          Real activity, straight from my GitHub.
        </p>
      </div>
      {state === "loading" && <Loading />}
      {state !== "loading" && !state.ok && (
        <div className="gh-unavailable">
          <Github size={27} />
          <p>
            {state.reason === "rate_limited"
              ? "GitHub is rate-limiting this page right now — the graph will be back shortly."
              : "GitHub activity isn't available at the moment."}
          </p>
        </div>
      )}
      {snapshot && (
        <>
          <div className="gh-stat-strip">
            <div className="gh-stat-featured">
              <GitCommitHorizontal size={23} />
              <strong>{snapshot.totals.contributions.toLocaleString()}</strong>
              <div>
                <span>
                  {snapshot.source === "events" ? "Events" : "Contributions"}
                </span>
                <small>
                  {snapshot.source === "events"
                    ? "in the available public feed"
                    : "over the past year"}
                </small>
              </div>
            </div>
            <Stat
              icon={<FolderGit2 size={17} />}
              label="Public repos"
              value={snapshot.totals.repos}
            />
            <Stat
              icon={<Star size={17} />}
              label="Stars"
              value={snapshot.totals.stars}
            />
            <Stat
              icon={<Users size={17} />}
              label="Followers"
              value={snapshot.totals.followers}
            />
          </div>
          <div className="gh-insights">
            <Heatmap days={snapshot.days} source={snapshot.source} />
            {snapshot.languages.length > 0 && (
              <Languages languages={snapshot.languages} />
            )}
          </div>
          <div className="gh-source-note">
            <span className="gh-snapshot-dot" />
            GitHub snapshot <span>·</span> Updated{" "}
            {formatWhen(snapshot.fetchedAt)}
            <span className="gh-cache-note">
              Refreshes on load · cached for 15 minutes
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function PanelHead({
  snapshot,
  children,
}: {
  snapshot: Snapshot | null;
  children: React.ReactNode;
}) {
  return (
    <div className="gh-panel-heading">
      <div>
        <Github size={17} />
        <h2>{children}</h2>
      </div>
      {snapshot && (
        <a
          href={snapshot.user.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          @{snapshot.user.login}
          <ArrowUpRight size={13} />
          <span className="sr-only"> (opens on github.com)</span>
        </a>
      )}
    </div>
  );
}

function Heatmap({
  days,
  source,
}: {
  days: Day[];
  source: Snapshot["source"];
}) {
  const [range, setRange] = useState(90);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const shown = useMemo(() => activityWindow(days, range), [days, range]);
  if (!shown.length)
    return (
      <div className="gh-calendar-empty">
        <CalendarDays size={24} />
        <p>No activity reported for this period.</p>
      </div>
    );
  const max = Math.max(...shown.map((day) => day.count));
  const total = shown.reduce((sum, day) => sum + day.count, 0);
  const activeDays = shown.filter((day) => day.count > 0).length;
  const first = new Date(shown[0].date + "T00:00:00Z").getUTCDay();
  const cells: (Day | null)[] = [...Array(first).fill(null), ...shown];
  const weeks: (Day | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7)
    weeks.push(cells.slice(index, index + 7));
  const selected =
    shown.find((day) => day.date === selectedDate) ?? shown[shown.length - 1];
  const noun = source === "events" ? "events" : "contributions";
  const summary = `${source === "events" ? "Public event" : "Contribution"} calendar: ${total.toLocaleString()} across ${shown.length} days, from ${longDate(shown[0].date)} to ${longDate(shown[shown.length - 1].date)}. Busiest day: ${max.toLocaleString()}.`;
  const changeRange = (next: number) => {
    setRange(next);
    setSelectedDate(null);
  };
  return (
    <figure className="gh-calendar-panel">
      <div className="gh-card-heading">
        <h3>Activity calendar</h3>
        <div className="gh-range" aria-label="Activity date range">
          {[30, 90, ...(source === "contributions" ? [365] : [])].map(
            (count) => (
              <button
                key={count}
                onClick={() => changeRange(count)}
                aria-pressed={range === count}
              >
                {count === 365 ? "Year" : `${count} days`}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="gh-calendar-summary">
        <strong>
          {total.toLocaleString()} {noun}
        </strong>
        <span>
          across {activeDays} active {activeDays === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="sr-only" role="img" aria-label={summary} />
      <div
        className="gh-calendar-scroll"
        tabIndex={0}
        aria-label="Scrollable activity calendar"
      >
        <div
          className={
            "gh-calendar-grid " + (weeks.length > 20 ? "gh-calendar-year" : "")
          }
          style={{
            gridTemplateColumns: `25px repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="gh-weekday-labels" aria-hidden="true">
            <span />
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
          </div>
          {weeks.map((week, weekIndex) => (
            <div className="gh-calendar-week" key={weekIndex}>
              {Array.from({ length: 7 }, (_, dayIndex) => {
                const day = week[dayIndex];
                if (!day) return <span key={dayIndex} />;
                const index = shown.indexOf(day);
                return (
                  <button
                    key={day.date}
                    type="button"
                    className={`gh-day gh-level-${level(day.count, max)} ${selected.date === day.date ? "is-selected" : ""}`}
                    tabIndex={selected.date === day.date ? 0 : -1}
                    aria-label={`${longDate(day.date)}: ${day.count} ${noun}`}
                    aria-pressed={selected.date === day.date}
                    title={`${longDate(day.date)} · ${day.count} ${noun}`}
                    onClick={() => setSelectedDate(day.date)}
                    onFocus={() => setSelectedDate(day.date)}
                    onMouseEnter={() => setSelectedDate(day.date)}
                    onKeyDown={(event) => {
                      const offset =
                        event.key === "ArrowRight"
                          ? 7
                          : event.key === "ArrowLeft"
                            ? -7
                            : event.key === "ArrowDown"
                              ? 1
                              : event.key === "ArrowUp"
                                ? -1
                                : 0;
                      if (
                        !offset &&
                        event.key !== "Home" &&
                        event.key !== "End"
                      )
                        return;
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? shown.length - 1
                            : Math.max(
                                0,
                                Math.min(shown.length - 1, index + offset),
                              );
                      const calendar =
                        event.currentTarget.closest(".gh-calendar-grid");
                      calendar
                        ?.querySelector<HTMLButtonElement>(
                          `[data-date="${shown[next].date}"]`,
                        )
                        ?.focus();
                    }}
                    data-date={day.date}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="gh-calendar-axis">
        <span>{shortDate(shown[0].date)}</span>
        <div aria-label="Activity intensity">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((value) => (
            <i key={value} className={`gh-level-${value}`} />
          ))}
          <span>More</span>
        </div>
        <span>{shortDate(shown[shown.length - 1].date)}</span>
      </div>
      <div className="gh-day-readout" aria-live="polite" aria-atomic="true">
        <CalendarDays size={14} />
        <span>{longDate(selected.date)}</span>
        <strong>
          {selected.count} {noun}
        </strong>
      </div>
      <figcaption>
        {source === "events"
          ? "Public-event activity from GitHub’s capped feed; this is not a complete contribution history."
          : "GitHub contribution calendar for the selected date range."}
      </figcaption>
    </figure>
  );
}
function level(count: number, max: number) {
  return count <= 0
    ? 0
    : max <= 1
      ? 4
      : count / max > 0.66
        ? 4
        : count / max > 0.4
          ? 3
          : count / max > 0.15
            ? 2
            : 1;
}

function Languages({ languages }: { languages: Snapshot["languages"] }) {
  const shown = languages.slice(0, 6);
  return (
    <aside className="gh-languages">
      <div className="gh-card-heading">
        <h3>Language mix</h3>
        <Code2 size={16} />
      </div>
      <p>The tools behind the repositories.</p>
      <div className="gh-language-spectrum" aria-hidden="true">
        {shown.map((language, index) => (
          <span
            key={language.name}
            title={`${language.name} ${language.share}%`}
            className={`gh-language-${index}`}
            style={{ width: `${language.share}%` }}
          />
        ))}
      </div>
      <ul>
        {shown.map((language, index) => (
          <li key={language.name}>
            <div>
              <i className={`gh-language-${index}`} />
              <strong>{language.name}</strong>
              <span>{language.share}%</span>
            </div>
            <div className="gh-language-track" aria-hidden="true">
              <span
                className={`gh-language-${index}`}
                style={{ width: `${language.share}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <small>
        Share of public repositories by primary language, not lines of code.
      </small>
    </aside>
  );
}
function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="gh-small-stat">
      {icon}
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}

export function GitHubDetail({ snapshot }: { snapshot: Snapshot }) {
  return (
    <section className="github-panel">
      <PanelHead snapshot={snapshot}>GitHub Activity (cont.)</PanelHead>
      <div className="gh-detail-heading">
        <h3>
          Open files. <em>Ongoing work.</em>
        </h3>
        <p>Explore the repositories and the latest changes.</p>
      </div>
      {snapshot.repos.length > 0 && (
        <div className="gh-repositories">
          <h3 className="gh-subheading">
            <FolderGit2 size={16} /> Repositories{" "}
            <span>{snapshot.repos.length} recently updated</span>
          </h3>
          <ul>
            {snapshot.repos.map((repo) => (
              <li key={repo.name}>
                <a href={repo.url} target="_blank" rel="noopener noreferrer">
                  <div className="gh-repo-title">
                    <FolderGit2 size={17} />
                    <strong>{repo.name}</strong>
                    <ArrowUpRight size={15} />
                  </div>
                  {repo.description && <p>{repo.description}</p>}
                  <div className="gh-repo-meta">
                    <span>{repo.language || "Repository"}</span>
                    {repo.stars > 0 && (
                      <span>
                        <Star size={11} />
                        {repo.stars} stars
                      </span>
                    )}
                    {repo.pushedAt && <span>{formatWhen(repo.pushedAt)}</span>}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {snapshot.commits.length > 0 && (
        <div className="gh-commits">
          <h3 className="gh-subheading">
            <GitCommitHorizontal size={16} /> Recent commits
          </h3>
          <ul>
            {snapshot.commits.map((commit, index) => (
              <li key={commit.sha + index}>
                <a href={commit.url} target="_blank" rel="noopener noreferrer">
                  <span className="gh-commit-dot" />
                  <div>
                    <strong>{commit.message}</strong>
                    <span>
                      {commit.repo.split("/").pop()} <span>·</span>{" "}
                      {formatWhen(commit.at)}
                    </span>
                  </div>
                  <code>{commit.sha}</code>
                  <ArrowUpRight size={13} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="gh-source-note">
        Read from the GitHub API · Updated {formatWhen(snapshot.fetchedAt)}
      </p>
    </section>
  );
}
function Loading() {
  return (
    <div className="gh-loading" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading GitHub activity</span>
      <div />
      <div />
      <div />
    </div>
  );
}
function longDate(day: string) {
  const at = new Date(day + "T00:00:00Z");
  return Number.isNaN(at.getTime())
    ? day
    : at.toLocaleDateString(undefined, {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}
function shortDate(day: string) {
  return new Date(day + "T00:00:00Z").toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}
function formatWhen(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days < 31
    ? `${days} day${days === 1 ? "" : "s"} ago`
    : new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}
