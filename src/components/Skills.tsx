import { useEffect, useMemo, useRef, useState } from "react";
import { getContent } from "../lib/content";
import { useI18n } from "../lib/i18n";
import {
  getSkillMeta,
  LEVEL_LABEL,
  skillLogoUrl,
  type SkillLevel,
} from "../lib/skill-catalog";
import {
  buildSkillModel,
  CADENCE_MAX,
  LEVEL_ORDER,
  matchesQuery,
  sortRows,
  type SkillRow,
  type SortKey,
} from "../lib/skill-stats";
import { SkillDetailPanel } from "./SkillDetailPanel";

/**
 * Core Competencies — the skill deck rendered as an instrument panel.
 *
 *   Telemetry strip   four counters derived from real data (disciplines,
 *                     skills, daily drivers, projects reached), each with
 *                     a share bar and a count-up on mount.
 *   Controls          live text filter, cadence filter, and a view switch
 *                     between the discipline grid and the sortable matrix.
 *   Readout           one line that tracks whatever row you're pointing at,
 *                     falling back to the filtered result count.
 *
 * "Cadence" is not a self-assessed score — it is the `level` field from
 * `skill-catalog.ts` drawn as a 0–3 signal (daily 3, weekly 2, explored 1).
 * "Shipped" counts the projects whose tags or stack actually name the skill.
 *
 * Clicking any row still opens the existing SkillDetailPanel.
 */

/** Material Symbol per competency group; falls back to a generic chip icon. */
const groupIcon: Record<string, string> = {
  Embedded: "memory",
  Frontend: "code",
  Design: "palette",
  "Tools & Backend": "terminal",
  "AI & Data": "smart_toy",
};

type LevelFilter = SkillLevel | "all";

export function Skills() {
  const { t } = useI18n();
  const { skills, projects } = useMemo(() => getContent(), []);
  const model = useMemo(
    () => buildSkillModel(skills, projects),
    [skills, projects]
  );
  const { stats } = model;

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [view, setView] = useState<"grid" | "matrix">("grid");
  const [sort, setSort] = useState<SortKey>("cadence");
  const [focus, setFocus] = useState<SkillRow | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const reduced = usePrefersReducedMotion();

  const passes = useMemo(() => {
    const set = new Set<string>();
    for (const row of model.rows) {
      if (level !== "all" && row.level !== level) continue;
      if (!matchesQuery(row, query)) continue;
      set.add(row.name);
    }
    return set;
  }, [model.rows, level, query]);

  const visible = useMemo(
    () => model.rows.filter((r) => passes.has(r.name)),
    [model.rows, passes]
  );

  const filtering = query.trim().length > 0 || level !== "all";

  /* `/` jumps to the filter; Esc closes the panel, then clears the filter. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        Boolean(el?.isContentEditable);

      if (e.key === "/" && !typing && !selected) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === "Escape") {
        if (selected) setSelected(null);
        else if (el === searchRef.current) {
          setQuery("");
          searchRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-4">
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue">
          {t("section.coreCompetencies")}
        </h2>
        <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider tabular-nums">
          {stats.disciplines} disciplines · {stats.skills} skills
        </span>
      </div>

      <p className="font-doc italic text-[13px] text-ink-subtle mb-3">
        Filter, sort, and point at any row for its readout — cadence is how
        often I actually reach for it, and “shipped” counts the projects on
        this site that name it. Click through for the detail card.
      </p>

      {/* ── Telemetry strip ─────────────────────────────────────────── */}
      <div className="overflow-hidden border border-rule rounded-sm mb-3">
        {/* gap-px over a rule-coloured bed draws the hairlines between tiles. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-rule">
          <StatTile
            label="Disciplines"
            value={stats.disciplines}
            hint="competency groups"
            share={1}
            reduced={reduced}
          />
          <StatTile
            label="Skills"
            value={stats.skills}
            hint={`${stats.documented} with detail cards`}
            share={stats.skills ? stats.documented / stats.skills : 0}
            reduced={reduced}
          />
          <StatTile
            label="Daily drivers"
            value={stats.byLevel.daily}
            hint={`of ${stats.skills} — reached for most days`}
            share={stats.skills ? stats.byLevel.daily / stats.skills : 0}
            reduced={reduced}
          />
          <StatTile
            label="Projects reached"
            value={stats.shippedIn}
            hint={`of ${projects.length} name one of these`}
            share={projects.length ? stats.shippedIn / projects.length : 0}
            reduced={reduced}
          />
        </div>
      </div>

      {/* ── Controls ────────────────────────────────────────────────── */}
      <div className="no-print flex flex-wrap items-center gap-2 mb-2">
        <div className="relative flex-1 min-w-[190px]">
          <label htmlFor="skill-filter" className="sr-only">
            Filter skills
          </label>
          <span
            aria-hidden="true"
            className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
            style={{ fontSize: 15 }}
          >
            search
          </span>
          <input
            id="skill-filter"
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by skill or discipline…"
            autoComplete="off"
            spellCheck={false}
            className="w-full font-ui text-[12px] text-ink bg-paper border border-rule rounded-sm pl-7 pr-8 py-[7px] outline-none focus:border-word-blue focus:ring-1 focus:ring-word-blue/30 placeholder:text-ink-subtle transition-colors"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Clear filter"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 grid w-5 h-5 place-items-center rounded-sm text-ink-subtle hover:bg-ribbon-hover hover:text-ink transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                close
              </span>
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="absolute right-2 top-1/2 -translate-y-1/2 font-ui text-[10px] leading-none text-ink-subtle border border-rule rounded-[3px] px-1 py-[3px] bg-ribbon"
            >
              /
            </kbd>
          )}
        </div>

        <div
          role="group"
          aria-label="Filter by cadence"
          className="inline-flex border border-rule rounded-sm overflow-hidden bg-paper"
        >
          <FilterButton
            active={level === "all"}
            onClick={() => setLevel("all")}
            count={stats.skills}
          >
            All
          </FilterButton>
          {LEVEL_ORDER.map((lv) => (
            <FilterButton
              key={lv}
              active={level === lv}
              onClick={() => setLevel(level === lv ? "all" : lv)}
              count={stats.byLevel[lv]}
            >
              {LEVEL_LABEL[lv]}
            </FilterButton>
          ))}
        </div>

        <div
          role="group"
          aria-label="View"
          className="inline-flex border border-rule rounded-sm overflow-hidden bg-paper"
        >
          <ViewButton
            active={view === "grid"}
            onClick={() => setView("grid")}
            icon="grid_view"
            label="Discipline grid"
          />
          <ViewButton
            active={view === "matrix"}
            onClick={() => setView("matrix")}
            icon="table_rows"
            label="Sortable matrix"
          />
        </div>
      </div>

      {/* ── Live readout ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border border-rule rounded-sm bg-ribbon px-2.5 py-1.5 mb-4 flex items-center gap-2 min-h-[30px]">
        <span
          aria-hidden="true"
          className={
            "shrink-0 w-1.5 h-1.5 rounded-full bg-word-blue " +
            (focus ? "" : "opacity-50")
          }
        />
        {focus ? (
          <span
            key={focus.name}
            className="readout-in flex flex-wrap items-center gap-x-2 gap-y-0.5 font-ui text-[11px] text-ink-muted min-w-0"
          >
            <b className="text-ink font-semibold">{focus.name}</b>
            <Sep />
            <span className="uppercase tracking-wider text-[10px]">
              {focus.group}
            </span>
            <Sep />
            <span className="tabular-nums">
              cadence{" "}
              <b className="text-word-blue">
                {focus.cadence || "—"}/{CADENCE_MAX}
              </b>
              {focus.level ? ` · ${LEVEL_LABEL[focus.level]}` : ""}
            </span>
            <Sep />
            <span className="tabular-nums">
              shipped in <b className="text-word-blue">{focus.projects.length}</b>{" "}
              {focus.projects.length === 1 ? "project" : "projects"}
            </span>
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-ui text-[11px] text-ink-muted min-w-0">
            <span aria-live="polite" className="tabular-nums">
              <b className="text-ink font-semibold">{visible.length}</b> of{" "}
              {stats.skills} shown
            </span>
            <Sep />
            <span className="hidden sm:inline-flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-ink-subtle">
              <SegMeter value={3} reduced /> daily
              <SegMeter value={2} reduced /> weekly
              <SegMeter value={1} reduced /> explored
            </span>
            <span className="sm:hidden italic">
              Point at a skill for its readout
            </span>
          </span>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="border border-dashed border-rule rounded-sm py-10 text-center">
          <span
            className="material-symbols-outlined text-ink-subtle"
            style={{ fontSize: 28 }}
          >
            search_off
          </span>
          <p className="mt-1 font-ui text-[12px] text-ink-subtle">
            No skill matches{" "}
            {query ? <b className="text-ink">“{query}”</b> : "this filter"}
            {level !== "all" ? ` at ${LEVEL_LABEL[level]} cadence` : ""}.
          </p>
          <button
            onClick={() => {
              setQuery("");
              setLevel("all");
            }}
            className="mt-3 font-ui text-[11px] font-semibold uppercase tracking-wider text-word-blue border border-rule rounded-sm px-3 py-1 hover:bg-word-blue-light transition-colors"
          >
            Reset filters
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {model.groups.map((group) => {
            const rows = group.rows.filter((r) => passes.has(r.name));
            if (rows.length === 0) return null;
            const avg = group.density * CADENCE_MAX;
            return (
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
                    {groupIcon[group.label] ?? "category"}
                  </span>
                  <h3 className="font-doc text-[15px] font-bold text-ink leading-none">
                    {group.label}
                  </h3>
                  <span className="ml-auto font-ui text-[10px] text-ink-subtle tabular-nums">
                    {filtering
                      ? `${rows.length}/${group.rows.length}`
                      : group.rows.length}
                  </span>
                </header>

                <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                  <span className="font-ui text-[9px] uppercase tracking-[0.16em] text-ink-subtle shrink-0">
                    Avg cadence
                  </span>
                  <BarMeter value={group.density} reduced={reduced} />
                  <span className="font-ui text-[10px] font-semibold text-word-blue tabular-nums shrink-0">
                    {avg.toFixed(1)}/{CADENCE_MAX}
                  </span>
                </div>

                <ul className="px-1.5 pb-2">
                  {rows.map((row, i) => (
                    <SkillRowButton
                      key={row.name}
                      row={row}
                      index={i}
                      reduced={reduced}
                      onOpen={() => setSelected(row.name)}
                      onEnter={() => setFocus(row)}
                      onLeave={() => setFocus(null)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <SkillMatrix
          rows={sortRows(visible, sort)}
          sort={sort}
          onSort={setSort}
          reduced={reduced}
          onOpen={setSelected}
          onEnter={setFocus}
          onLeave={() => setFocus(null)}
        />
      )}

      {selected && (
        <SkillDetailPanel
          name={selected}
          related={
            model.rows.find((r) => r.name === selected)?.projects ?? []
          }
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

/* ── Matrix view ─────────────────────────────────────────────────────── */

function SkillMatrix({
  rows,
  sort,
  onSort,
  reduced,
  onOpen,
  onEnter,
  onLeave,
}: {
  rows: SkillRow[];
  sort: SortKey;
  onSort: (k: SortKey) => void;
  reduced: boolean;
  onOpen: (name: string) => void;
  onEnter: (row: SkillRow) => void;
  onLeave: () => void;
}) {
  return (
    <div className="border border-rule rounded-sm overflow-hidden">
      <table className="w-full border-collapse font-ui text-[12px]">
        <thead>
          <tr className="bg-ribbon border-b-2 border-word-blue">
            <SortableTh
              label="Skill"
              k="name"
              sort={sort}
              onSort={onSort}
              className="text-left"
            />
            <SortableTh
              label="Discipline"
              k="discipline"
              sort={sort}
              onSort={onSort}
              className="text-left hidden sm:table-cell"
            />
            <SortableTh
              label="Cadence"
              k="cadence"
              sort={sort}
              onSort={onSort}
              className="text-right"
            />
            <SortableTh
              label="Shipped"
              k="projects"
              sort={sort}
              onSort={onSort}
              className="text-right"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.name}
              onMouseEnter={() => onEnter(row)}
              onMouseLeave={onLeave}
              className="border-b border-rule last:border-0 even:bg-row-alt/60 hover:bg-word-blue-light transition-colors cursor-pointer"
              onClick={() => onOpen(row.name)}
            >
              <td className="py-1.5 px-2.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(row.name);
                  }}
                  onFocus={() => onEnter(row)}
                  onBlur={onLeave}
                  aria-label={`Open ${row.name}`}
                  className="inline-flex items-center gap-2 text-left font-medium text-ink hover:text-word-blue focus:outline-none focus-visible:underline underline-offset-2"
                >
                  <SkillLogo row={row} size={15} />
                  <span className="truncate">{row.name}</span>
                </button>
              </td>
              <td className="py-1.5 px-2.5 text-ink-subtle hidden sm:table-cell">
                {row.group}
              </td>
              <td className="py-1.5 px-2.5">
                <span className="flex items-center justify-end gap-2">
                  <span className="tabular-nums text-[11px] text-ink-muted">
                    {row.level ? LEVEL_LABEL[row.level] : "—"}
                  </span>
                  <SegMeter
                    value={row.cadence}
                    reduced={reduced}
                    delay={reduced ? 0 : Math.min(i, 14) * 20}
                  />
                </span>
              </td>
              <td className="py-1.5 px-2.5 text-right tabular-nums font-semibold text-word-blue">
                {row.projects.length || (
                  <span className="text-ink-subtle font-normal">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableTh({
  label,
  k,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort === k;
  return (
    <th
      scope="col"
      aria-sort={active ? "descending" : "none"}
      className={"py-1.5 px-2.5 font-bold " + className}
    >
      <button
        onClick={() => onSort(k)}
        className={
          "inline-flex items-center gap-0.5 uppercase text-[10px] tracking-[0.12em] transition-colors " +
          (active ? "text-word-blue" : "text-ink-subtle hover:text-ink")
        }
      >
        {label}
        <span
          aria-hidden="true"
          className={
            "material-symbols-outlined transition-opacity " +
            (active ? "opacity-100" : "opacity-0")
          }
          style={{ fontSize: 13 }}
        >
          arrow_downward
        </span>
      </button>
    </th>
  );
}

/* ── Grid row ────────────────────────────────────────────────────────── */

function SkillRowButton({
  row,
  index,
  reduced,
  onOpen,
  onEnter,
  onLeave,
}: {
  row: SkillRow;
  index: number;
  reduced: boolean;
  onOpen: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  // The visible content reads as "ESP321x3/3" to a screen reader, so the
  // button gets an explicit name saying what it opens and what it shows.
  const cadenceText = row.level
    ? LEVEL_LABEL[row.level].toLowerCase()
    : "cadence not recorded";
  const projectText =
    row.projects.length === 1 ? "1 project" : `${row.projects.length} projects`;

  return (
    <li
      className={reduced ? undefined : "skill-row-in"}
      style={reduced ? undefined : { animationDelay: `${Math.min(index, 10) * 28}ms` }}
    >
      <button
        onClick={onOpen}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        title={`Open ${row.name}`}
        aria-label={`Open ${row.name} — ${cadenceText}, ${projectText}`}
        className="skill-scan group relative w-full flex items-center gap-2 px-1.5 py-[5px] rounded-sm text-left hover:bg-word-blue-light focus:outline-none focus-visible:bg-word-blue-light focus-visible:ring-1 focus-visible:ring-word-blue transition-colors"
      >
        <SkillLogo row={row} size={15} />
        <span
          className={
            "font-ui text-[12px] font-medium truncate " +
            (row.documented ? "text-ink" : "text-ink-muted")
          }
        >
          {row.name}
        </span>
        {/* Word TOC dot leader — drawn inline rather than via .toc-leader so it
            centres in this row instead of hanging at the baseline. */}
        <span
          aria-hidden="true"
          className="flex-1 h-0 border-b border-dotted border-ink-subtle opacity-30 group-hover:opacity-60 transition-opacity"
        />
        {row.projects.length > 0 && (
          <span className="font-ui text-[10px] tabular-nums text-ink-subtle group-hover:text-ink-muted shrink-0">
            {row.projects.length}×
          </span>
        )}
        <span className="font-ui text-[10px] font-semibold tabular-nums text-word-blue w-[26px] text-right shrink-0">
          {row.cadence ? `${row.cadence}/${CADENCE_MAX}` : "—"}
        </span>
        <SegMeter
          value={row.cadence}
          reduced={reduced}
          delay={reduced ? 0 : Math.min(index, 10) * 28}
        />
      </button>
    </li>
  );
}

function SkillLogo({ row, size }: { row: SkillRow; size: number }) {
  const [ok, setOk] = useState(true);
  const meta = getSkillMeta(row.name);
  const logo = row.logo ?? meta?.logo;

  if (logo && ok) {
    return (
      <img
        src={skillLogoUrl(logo)}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setOk(false)}
        className="object-contain shrink-0 transition-transform group-hover:scale-110"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="material-symbols-outlined text-ink-subtle group-hover:text-word-blue transition-colors shrink-0"
      style={{ fontSize: size - 1, width: size }}
    >
      chip_extraction
    </span>
  );
}

/* ── Digital readouts ────────────────────────────────────────────────── */

function StatTile({
  label,
  value,
  hint,
  share,
  reduced,
}: {
  label: string;
  value: number;
  hint: string;
  share: number;
  reduced: boolean;
}) {
  const n = useCountUp(value, !reduced);
  return (
    <div className="relative overflow-hidden bg-paper px-3 py-2.5">
      <div className="absolute inset-0 telemetry-grid" aria-hidden="true" />
      <div className="relative">
        <div className="font-ui text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          {label}
        </div>
        <div className="font-ui text-[26px] leading-none font-bold text-word-blue tabular-nums mt-1">
          {String(n).padStart(2, "0")}
        </div>
        <div className="mt-1.5">
          <BarMeter value={share} reduced={reduced} />
        </div>
        <div className="mt-1 font-ui text-[10px] text-ink-subtle leading-tight">
          {hint}
        </div>
      </div>
    </div>
  );
}

/** Proportional hairline bar, 0–1. */
function BarMeter({ value, reduced }: { value: number; reduced: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className="block w-full h-[3px] bg-rule rounded-full overflow-hidden">
      <span
        className={"block h-full bg-word-blue rounded-full " + (reduced ? "" : "meter-fill")}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

/** Rising signal bars — the level rendered as 0–3 segments. */
function SegMeter({
  value,
  reduced,
  delay = 0,
}: {
  value: number;
  reduced?: boolean;
  delay?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-end gap-[2px] shrink-0"
      style={{ height: 11 }}
    >
      {Array.from({ length: CADENCE_MAX }, (_, i) => (
        <span
          key={i}
          className={
            "w-[3px] rounded-[1px] " +
            (i < value ? "bg-word-blue" : "bg-rule-strong opacity-50") +
            (reduced ? "" : " seg-in")
          }
          style={{
            height: 5 + i * 3,
            animationDelay: reduced ? undefined : `${delay + i * 70}ms`,
          }}
        />
      ))}
    </span>
  );
}

/* ── Small controls ──────────────────────────────────────────────────── */

function FilterButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1 font-ui text-[10px] font-semibold uppercase tracking-wider px-2 py-[7px] border-r border-rule last:border-r-0 transition-colors " +
        (active
          ? "bg-word-blue text-paper"
          : "text-ink-muted hover:bg-ribbon-hover hover:text-ink")
      }
    >
      {children}
      <span
        className={
          "tabular-nums font-normal " +
          (active ? "text-paper/70" : "text-ink-subtle")
        }
      >
        {count}
      </span>
    </button>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={
        "grid w-8 h-[31px] place-items-center border-r border-rule last:border-r-0 transition-colors " +
        (active
          ? "bg-word-blue text-paper"
          : "text-ink-muted hover:bg-ribbon-hover hover:text-ink")
      }
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
        {icon}
      </span>
    </button>
  );
}

function Sep() {
  return (
    <span aria-hidden="true" className="text-rule-strong">
      ·
    </span>
  );
}

/* ── Hooks ───────────────────────────────────────────────────────────── */

function useCountUp(target: number, enabled: boolean): number {
  const [n, setN] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 850;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);

  return n;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
