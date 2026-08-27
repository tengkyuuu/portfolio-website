import { useEffect, useMemo, useRef, useState } from "react";
import { getContent } from "../lib/content";
import type { TabId } from "./Nav";

/**
 * Word "Tell Me / Microsoft Search" palette (Alt+Q in real Word; here
 * Ctrl+K / Cmd+K, plus the magnifier button in the ribbon).
 *
 * Fully client-side: the index is built from getContent() when the
 * palette opens — content already lives in the browser, so search is
 * instant and needs no API, no dependency, no network.
 *
 * Index coverage: hero (name/role/tagline/abstract), about paragraphs +
 * highlights + specs, every skill, every project (title/blurb/challenge/
 * solution/tags/stack), every certification, every timeline entry, and
 * contact channels.
 *
 * Ranking: query is tokenized; every token must match somewhere (AND).
 * Title prefix > title substring > keywords > body. Matches highlighted
 * with <mark>. Selecting a result flips to the right tab via the same
 * #hash mechanism the ribbon uses, then polls for the anchor (projects
 * land mid-page) before scrolling.
 */

export const OPEN_SEARCH_EVENT = "jvc:open-search";

type Entry = {
  id: string;
  tab: TabId;
  tabLabel: string;
  title: string;
  body: string;
  keywords: string;
  anchor?: string;
};

const TAB_LABEL: Record<TabId, string> = {
  top: "Home",
  work: "Projects",
  about: "About",
  stack: "Skills",
  process: "How I Work",
  now: "Now",
  credentials: "Credentials",
  contact: "Contact",
};

function stripInline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function buildIndex(): Entry[] {
  const c = getContent();
  const entries: Entry[] = [];

  entries.push({
    id: "hero",
    tab: "top",
    tabLabel: TAB_LABEL.top,
    title: c.hero.name,
    body: stripInline(`${c.hero.tagline} ${c.hero.abstract}`),
    keywords: `${c.hero.role} ${c.hero.email} ${c.hero.location}`,
  });

  entries.push({
    id: "about",
    tab: "about",
    tabLabel: TAB_LABEL.about,
    title: "Executive Summary",
    body: stripInline(
      `${c.about.paragraphs} ${(c.about.highlights ?? []).join(" ")}`
    ),
    keywords: c.about.specs.map((s) => `${s.label} ${s.value}`).join(" "),
  });

  for (const group of c.skills) {
    for (const item of group.items) {
      entries.push({
        id: `skill-${group.label}-${item}`,
        tab: "stack",
        tabLabel: TAB_LABEL.stack,
        title: item,
        body: `${group.label} — one of the core competencies.`,
        keywords: `skill ${group.label}`,
      });
    }
  }

  for (const p of c.projects) {
    entries.push({
      id: `project-${p.id}`,
      tab: "work",
      tabLabel: TAB_LABEL.work,
      title: p.title,
      body: stripInline(`${p.blurb} ${p.challenge ?? ""} ${p.solution ?? ""}`),
      keywords: [...(p.tags ?? []), ...(p.stack ?? []), p.kind, p.year ?? ""].join(" "),
      anchor: `proj-${p.id}`,
    });
  }

  for (const cert of c.certs) {
    entries.push({
      id: `cert-${cert.title}-${cert.issuer}`,
      tab: "credentials",
      tabLabel: TAB_LABEL.credentials,
      title: cert.title,
      body: `${cert.issuer}${cert.date ? ` · ${cert.date}` : ""}`,
      keywords: "certificate certification award",
    });
  }

  for (const t of c.timeline) {
    entries.push({
      id: `timeline-${t.title}`,
      tab: "credentials",
      tabLabel: TAB_LABEL.credentials,
      title: t.title,
      body: stripInline(`${t.org} ${t.blurb}`),
      keywords: `education experience ${t.range}`,
    });
  }

  for (const ch of c.contact.channels) {
    entries.push({
      id: `contact-${ch.label}`,
      tab: "contact",
      tabLabel: TAB_LABEL.contact,
      title: ch.label,
      body: ch.value,
      keywords: "contact reach email social",
    });
  }

  return entries;
}

type Scored = { entry: Entry; score: number };

function search(index: Entry[], query: string): Scored[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const out: Scored[] = [];
  for (const entry of index) {
    const title = entry.title.toLowerCase();
    const keywords = entry.keywords.toLowerCase();
    const body = entry.body.toLowerCase();
    let score = 0;
    let allMatch = true;
    for (const tok of tokens) {
      if (title.startsWith(tok)) score += 4;
      else if (title.includes(tok)) score += 3;
      else if (keywords.includes(tok)) score += 2;
      else if (body.includes(tok)) score += 1;
      else {
        allMatch = false;
        break;
      }
    }
    if (allMatch) out.push({ entry, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}

/** Wrap query-token matches in <mark>. */
function highlight(text: string, tokens: string[]): React.ReactNode {
  if (tokens.length === 0) return text;
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "ig");
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark
        key={i}
        className="bg-word-blue-light text-word-blue rounded-[2px] px-px"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/** After a tab switch the target section mounts asynchronously (loader,
 *  skeleton). Poll for the anchor before scrolling — give up quietly. */
function scrollToAnchor(anchor: string) {
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (++tries < 14) setTimeout(tick, 250);
  };
  setTimeout(tick, 300);
}

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState<Entry[]>([]);

  // Open triggers: Ctrl/Cmd+K anywhere, or the ribbon button's event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpenEvent);
    };
  }, []);

  // Build the index fresh each time the palette opens (content may have
  // synced from the server since last time). Focus + reset state.
  useEffect(() => {
    if (!open) return;
    setIndex(buildIndex());
    setQuery("");
    setCursor(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const tokens = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );
  const results = useMemo(() => search(index, query), [index, query]);

  // Keep the cursor inside the result list as it shrinks.
  useEffect(() => {
    if (cursor >= results.length) setCursor(Math.max(0, results.length - 1));
  }, [results.length, cursor]);

  function select(entry: Entry) {
    setOpen(false);
    window.location.hash = entry.tab;
    if (entry.anchor) scrollToAnchor(entry.anchor);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault();
      select(results[cursor].entry);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search this document"
      className="no-print fixed inset-0 z-[90] flex items-start justify-center pt-[14vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/30 dark:bg-black/60" aria-hidden="true" />

      <div
        className="word-popover relative w-full max-w-[560px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row — Word "Tell me what you want to do" */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-rule">
          <span
            className="material-symbols-outlined text-word-blue"
            style={{ fontSize: 20 }}
          >
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={
              results[cursor] ? `search-opt-${results[cursor].entry.id}` : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search this document…"
            spellCheck={false}
            className="flex-1 bg-transparent font-ui text-[15px] text-ink placeholder:text-ink-subtle outline-none"
          />
          <kbd className="font-ui text-[10px] text-ink-subtle border border-rule rounded-sm px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div id="search-results" role="listbox" className="max-h-[46vh] overflow-y-auto">
          {query.trim() === "" ? (
            <Hint text="Type to search projects, skills, credentials, and more." />
          ) : results.length === 0 ? (
            <Hint text={`No results for “${query}”. Try a different term.`} />
          ) : (
            results.map(({ entry }, i) => (
              <button
                key={entry.id}
                id={`search-opt-${entry.id}`}
                role="option"
                aria-selected={i === cursor}
                onClick={() => select(entry)}
                onMouseEnter={() => setCursor(i)}
                className={
                  "w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors " +
                  (i === cursor ? "bg-word-blue-light" : "hover:bg-ribbon-hover")
                }
              >
                <span
                  className="material-symbols-outlined text-ink-muted shrink-0 mt-0.5"
                  style={{ fontSize: 16 }}
                >
                  {entry.tab === "work"
                    ? "folder"
                    : entry.tab === "stack"
                      ? "build"
                      : entry.tab === "credentials"
                        ? "school"
                        : entry.tab === "contact"
                          ? "mail"
                          : entry.tab === "about"
                            ? "person"
                            : "home"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-ui text-[13px] font-semibold text-ink truncate">
                    {highlight(entry.title, tokens)}
                  </span>
                  <span className="block font-ui text-[11px] text-ink-muted truncate">
                    {highlight(entry.body.slice(0, 110), tokens)}
                  </span>
                </span>
                <span className="shrink-0 font-ui text-[10px] uppercase tracking-wider text-ink-subtle border border-rule rounded-sm px-1.5 py-0.5 mt-0.5">
                  {entry.tabLabel}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer strip */}
        <div className="flex items-center gap-3 px-4 py-1.5 border-t border-rule bg-ribbon font-ui text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
              unfold_more
            </span>
            Navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
              keyboard_return
            </span>
            Open
          </span>
          <span className="ml-auto">Tell me · Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <p className="px-4 py-6 text-center font-ui text-[12px] text-ink-subtle italic">
      {text}
    </p>
  );
}
