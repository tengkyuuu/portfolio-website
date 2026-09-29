/**
 * Single source of truth for editable site content.
 *
 * Read path: localStorage cache (seeded from the server on page load via
 * `syncFromServer`), falling back to the hardcoded defaults from `./data`.
 *
 * Write path (admin): every save lands in localStorage immediately, then a
 * debounced push publishes it to the server (PUT /api/content) when an admin
 * token is present. Without a reachable server, edits stay local-only.
 */

import { deleteRemoteContent, fetchRemoteContent, pushContent } from "./api";
import { getAdminToken } from "./auth";
import {
  projects as defaultProjects,
  skillGroups as defaultSkills,
  certs as defaultCerts,
  timeline as defaultTimeline,
  defaultHero,
  defaultAbout,
  defaultContact,
  type Project,
  type ProjectImage,
  type SkillGroup,
  type Cert,
  type Metric,
  type TimelineEntry,
} from "./data";

export type { Project, ProjectImage, SkillGroup, Cert, Metric, TimelineEntry };

const STORAGE_KEY = "jvc_content_v1";
/** Sidecar describing what the cached payload was derived from. */
const META_KEY = "jvc_content_meta_v1";
export const CONTENT_EVENT = "jvc:content-change";

export type HeroContent = {
  eyebrow: string;
  name: string;
  role: string;
  email: string;
  website: string;
  location: string;
  available: boolean;
  availableText: string;
  /** Italic pull-quote. Inline HTML allowed (e.g. <em>silicon</em>). */
  tagline: string;
  /** Multi-paragraph body. Split on blank lines. Inline HTML allowed. */
  abstract: string;
  /** Toggle the auto-generated Table of Contents on the Home paper. */
  showContents: boolean;
};

export type AboutContent = {
  /** Short lead body. Split on blank lines. Inline markdown allowed. */
  paragraphs: string;
  /** Scannable one-line highlights shown as a bulleted strip. */
  highlights?: string[];
  specs: { label: string; value: string }[];
};

export type ContactChannel = {
  label: string;
  value: string;
  href: string;
  icon: string;
};

export type ContactContent = {
  /** Intro paragraph. Inline markdown allowed. */
  intro: string;
  channels: ContactChannel[];
  /** Scheduling link (Cal.com / Calendly). When set, the Contact tab
   *  shows a "Book a meeting" section with an inline embed. */
  bookingUrl?: string;
};

/** A blog post, written and published from the admin. */
export type BlogPost = {
  /** Stable identity. Never shown, and survives a slug edit. */
  id: string;
  /** URL segment — the post lives at #blog/<slug>. */
  slug: string;
  title: string;
  /** ISO date, yyyy-mm-dd. Posts sort newest first on it. */
  date: string;
  /** One or two sentences for the index, search, and link previews. */
  excerpt: string;
  /** Markdown subset — see lib/markdown.tsx for exactly what renders. */
  body: string;
  tags: string[];
  cover?: string;
  /** What is visibly in the cover image. */
  coverAlt?: string;
  /** Hidden from the Blog tab and search. Not private: a draft still
   *  travels in the published content JSON, like everything else. */
  draft: boolean;
};

/** One piece in the graphic-design gallery. */
export type Design = {
  /** Stable identity, also the #gallery/<id> deep link. */
  id: string;
  title: string;
  /** Storage URL, /public path, or (without storage) a data URL. */
  image: string;
  /** What is visibly in the image — not what it was for. */
  alt: string;
  /** A sentence or two: the brief, the idea, the outcome. */
  caption?: string;
  /** Poster, Logo, Social, Packaging… — drives the filter chips. */
  category?: string;
  tools?: string[];
  year?: string;
  /** Behance, Dribbble, or the live piece. */
  link?: string;
  /** Parked: kept in the admin, off the site. */
  hidden?: boolean;
};

export type SiteContent = {
  activity: ActivityContent;
  hero: HeroContent;
  about: AboutContent;
  skills: SkillGroup[];
  projects: Project[];
  certs: Cert[];
  timeline: TimelineEntry[];
  contact: ContactContent;
  posts: BlogPost[];
  designs: Design[];
};

export type ActivityContent = {
  status: string;
  note: string;
  meme: string;
  memeAlt: string;
  updatedAt: string;
};

/**
 * Posts and designs ship empty. Both are written from the admin; nothing
 * here should invent a post or a piece of work to fill the space. A tab
 * with nothing in it stays off the ribbon (see visibleTabs in Nav.tsx).
 */
export const DEFAULT_CONTENT: SiteContent = {
  activity: { status: "", note: "", meme: "coffee", memeAlt: "", updatedAt: "" },
  hero: defaultHero,
  about: defaultAbout,
  skills: defaultSkills,
  projects: defaultProjects,
  certs: defaultCerts,
  timeline: defaultTimeline,
  contact: defaultContact,
  posts: [],
  designs: [],
};

function shallowMerge<T extends object>(defaults: T, override?: Partial<T>): T {
  if (!override) return defaults;
  return { ...defaults, ...override } as T;
}

/** Fill any missing sections of a partial payload with the defaults. */
function normalizeContent(stored: Partial<SiteContent>): SiteContent {
  return {
    activity: shallowMerge(DEFAULT_CONTENT.activity, stored.activity),
    hero: shallowMerge(DEFAULT_CONTENT.hero, stored.hero),
    about: {
      ...DEFAULT_CONTENT.about,
      ...stored.about,
      highlights: stored.about?.highlights ?? DEFAULT_CONTENT.about.highlights,
      specs: stored.about?.specs ?? DEFAULT_CONTENT.about.specs,
    },
    skills: stored.skills ?? DEFAULT_CONTENT.skills,
    projects: stored.projects ?? DEFAULT_CONTENT.projects,
    certs: stored.certs ?? DEFAULT_CONTENT.certs,
    timeline: stored.timeline ?? DEFAULT_CONTENT.timeline,
    contact: {
      ...DEFAULT_CONTENT.contact,
      ...stored.contact,
      channels: stored.contact?.channels ?? DEFAULT_CONTENT.contact.channels,
    },
    // A snapshot published before these existed simply has none.
    posts: Array.isArray(stored.posts) ? stored.posts : DEFAULT_CONTENT.posts,
    designs: Array.isArray(stored.designs) ? stored.designs : DEFAULT_CONTENT.designs,
  };
}

/** In-memory copy — survives a full localStorage (quota exceeded) and is the
 *  read source when the cached JSON can't be written. */
let memoryContent: SiteContent | null = null;

/* ---------------------- stale-cache invalidation ---------------------- */

/**
 * The browser copy is a cache, not a source of truth. On a static deploy
 * `data.ts` is what's published (see README), so a deploy that ships new
 * defaults must not stay invisible to anyone whose browser is holding an
 * older snapshot — that is how a project can be live in the bundle and
 * still missing from the page.
 *
 * Every write records a fingerprint of the defaults it was taken against.
 * A payload survives only while that fingerprint still matches: once a
 * deploy ships different defaults, the deploy wins and the cache is
 * ignored. Nothing is lost when the server is healthy — syncFromServer
 * re-applies the published content and re-stamps the record on the next
 * load — but when the server is unreachable we fall back to what shipped
 * instead of serving an indefinitely old snapshot.
 *
 * A payload with no record predates this rule, so it counts as stale.
 */

/** `src` is informational only — provenance for anyone reading the
 *  key in devtools. Staleness is decided by `fp` alone. */
type CacheMeta = { fp: string; src: "server" | "local" };

/** Cheap, stable 32-bit string hash. Collisions don't matter here. */
function fingerprint(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36) + "." + s.length.toString(36);
}

let defaultsFp: string | null = null;
/** Lazy: DEFAULT_CONTENT is initialized above, but only at module load. */
function defaultsFingerprint(): string {
  if (defaultsFp === null) defaultsFp = fingerprint(DEFAULT_CONTENT);
  return defaultsFp;
}

function readMeta(): CacheMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheMeta>;
    if (typeof parsed?.fp !== "string") return null;
    return { fp: parsed.fp, src: parsed.src === "server" ? "server" : "local" };
  } catch {
    return null;
  }
}

function writeMeta(src: CacheMeta["src"]): void {
  try {
    const meta: CacheMeta = { fp: defaultsFingerprint(), src };
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Quota exceeded — the payload write failed too.
  }
}

/** False when the cached payload is masking newer shipped defaults. */
function cacheIsUsable(): boolean {
  const meta = readMeta();
  return meta !== null && meta.fp === defaultsFingerprint();
}

export function getContent(): SiteContent {
  if (typeof localStorage === "undefined") {
    return memoryContent ?? DEFAULT_CONTENT;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryContent ?? DEFAULT_CONTENT;
    if (!cacheIsUsable()) return memoryContent ?? DEFAULT_CONTENT;
    return normalizeContent(JSON.parse(raw) as Partial<SiteContent>);
  } catch {
    return memoryContent ?? DEFAULT_CONTENT;
  }
}

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONTENT_EVENT));
  }
}

/* ------------------------------ server sync ------------------------------ */

export const SYNC_EVENT = "jvc:sync-status";
export type SyncStatus = "saving" | "saved" | "local" | "error";

function emitSync(status: SyncStatus) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: status }));
  }
}

const PUSH_DEBOUNCE_MS = 800;
let pushTimer: number | undefined;
/** Sections edited since the last push, or "all" for a whole-document
 *  write (import, reset). */
let pending: Set<keyof SiteContent> | "all" = new Set();

/**
 * Debounced publish to the server. No-op (reported as "local") when the
 * admin isn't server-authenticated, e.g. static deploys.
 *
 * An ordinary edit publishes only the sections it touched, and the server
 * merges them into what's there. Pushing the whole document let two
 * admins erase each other — one editing the blog, the other a project,
 * each re-publishing the other's section as it was when they opened it.
 */
function schedulePush(content: SiteContent, sections: (keyof SiteContent)[] | "all") {
  const token = getAdminToken();
  if (!token) {
    emitSync("local");
    return;
  }
  if (sections === "all" || pending === "all") pending = "all";
  else sections.forEach((s) => (pending as Set<keyof SiteContent>).add(s));
  emitSync("saving");
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    const scope = pending === "all" ? undefined : [...pending];
    pending = new Set();
    void pushContent(content, token, scope).then((result) => {
      emitSync(result === "ok" ? "saved" : result === "offline" ? "local" : "error");
    });
  }, PUSH_DEBOUNCE_MS);
}

/** Write content to the local cache without publishing (used for content
 *  that just arrived FROM the server — pushing it back would be a loop). */
function applyContent(content: SiteContent, src: CacheMeta["src"]): void {
  memoryContent = content;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
    writeMeta(src);
  } catch {
    // Quota exceeded — memoryContent still serves this session.
  }
  emitChange();
}

/**
 * Pull published content from the server and apply it locally.
 * Returns true if fresh content was applied. Call once on page load.
 */
export async function syncFromServer(): Promise<boolean> {
  const remote = await fetchRemoteContent();
  if (!remote) return false;
  const next = normalizeContent(remote);
  if (JSON.stringify(next) === JSON.stringify(getContent())) return false;
  applyContent(next, "server");
  return true;
}

/** Replace the whole document — import and restore. */
export function saveContent(content: SiteContent): void {
  applyContent(content, "local");
  schedulePush(content, "all");
}

export function saveSection<K extends keyof SiteContent>(
  section: K,
  value: SiteContent[K]
): SiteContent {
  const current = getContent();
  const next = { ...current, [section]: value };
  applyContent(next, "local");
  schedulePush(next, [section]);
  return next;
}

export function resetSection<K extends keyof SiteContent>(
  section: K
): SiteContent[K] {
  saveSection(section, DEFAULT_CONTENT[section]);
  return DEFAULT_CONTENT[section];
}

export function resetAll(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(META_KEY);
  memoryContent = null;
  const token = getAdminToken();
  if (token) {
    emitSync("saving");
    void deleteRemoteContent(token).then((result) => {
      emitSync(result === "ok" ? "saved" : result === "offline" ? "local" : "error");
    });
  } else {
    emitSync("local");
  }
  emitChange();
}

export function exportContent(): string {
  return JSON.stringify(getContent(), null, 2);
}

export type ImportResult = { ok: true } | { ok: false; error: string };

export function importContent(json: string): ImportResult {
  try {
    const parsed = JSON.parse(json) as Partial<SiteContent>;
    if (
      !parsed ||
      !parsed.hero ||
      !parsed.about ||
      !Array.isArray(parsed.skills) ||
      !Array.isArray(parsed.projects)
    ) {
      return { ok: false, error: "JSON is missing required sections (hero, about, skills, projects)." };
    }
    saveContent(normalizeContent(parsed));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON." };
  }
}
