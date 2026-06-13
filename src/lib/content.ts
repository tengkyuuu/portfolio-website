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
  type Project,
  type ProjectImage,
  type SkillGroup,
  type Cert,
  type Metric,
  type TimelineEntry,
} from "./data";

export type { Project, ProjectImage, SkillGroup, Cert, Metric, TimelineEntry };

const STORAGE_KEY = "jvc_content_v1";
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
  /** Multi-paragraph body. Split on blank lines. Inline markdown allowed. */
  paragraphs: string;
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
};

export type SiteContent = {
  hero: HeroContent;
  about: AboutContent;
  skills: SkillGroup[];
  projects: Project[];
  certs: Cert[];
  timeline: TimelineEntry[];
  contact: ContactContent;
};

export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    eyebrow: "Portfolio · 2026 Edition",
    name: "James Vincent Calunsag",
    role: "Computer Engineer · Embedded · Frontend · Design",
    email: "jamescalunsag13@gmail.com",
    website: "localhost:3000",
    location: "Dapitan City, PH",
    available: true,
    availableText: "Available for work",
    tagline:
      "The ability to <em>adapt</em> is what makes a good <em>engineer</em>.",
    abstract:
      "This document is a working portfolio: a record of selected projects, credentials, and ways to get in touch. It is laid out the way I think — like a Word document: structured, hierarchical, deliberate about typography.\n\nUse the ribbon above to navigate. Each tab is its own page.",
    showContents: true,
  },
  about: {
    paragraphs:
      "I'm a **Computer Engineer** specializing in embedded systems, with deep proficiency in frontend engineering and graphic design. I work at the seam where hardware and software meet — from programming microcontrollers and laying out PCBs to crafting pixel-perfect interfaces and visual identities.\n\nMy engineering background gives me a useful edge: I understand systems from the silicon up. Whether it's optimizing firmware for an ESP32, building responsive web apps, or designing brand assets that read clearly, I bring systems-level thinking to the work.\n\nI believe great technology should feel invisible — *powerful under the hood, calm on the surface.*",
    specs: [
      { label: "Role", value: "Computer Engineer" },
      { label: "Focus", value: "Embedded · Frontend · Design" },
      { label: "Currently", value: "BS CpE, JRMSU Dapitan" },
      { label: "Location", value: "Dapitan City, PH" },
      { label: "Tooling", value: "ESP32 · React · Figma" },
      { label: "Open to", value: "Freelance · Internships" },
    ],
  },
  skills: defaultSkills,
  projects: defaultProjects,
  certs: defaultCerts,
  timeline: defaultTimeline,
  contact: {
    intro:
      "Open to freelance, internships, and collaborations across embedded, frontend, and design. The fastest way to reach me is [email](mailto:jamesvincent.calunsag@example.com) — I read everything.",
    channels: [
      {
        label: "Email",
        value: "jamescalunsag13@gmail.com",
        href: "mailto:jamescalunsag13@gmail.com",
        icon: "mail",
      },
      { label: "GitHub", value: "github.com/jvc", href: "https://github.com/tengkyuuu", icon: "code" },
      {
        label: "LinkedIn",
        value: "linkedin.com/in/jvc",
        href: "https://www.linkedin.com/in/james-vincent-calunsag-7616bb353?utm_source=share_via&utm_content=profile&utm_medium=member_android",
        icon: "link",
      },
      { label: "Location", value: "Dapitan City, PH", href: "#", icon: "location_on" },
    ],
  },
};

function shallowMerge<T extends object>(defaults: T, override?: Partial<T>): T {
  if (!override) return defaults;
  return { ...defaults, ...override } as T;
}

/** Fill any missing sections of a partial payload with the defaults. */
function normalizeContent(stored: Partial<SiteContent>): SiteContent {
  return {
    hero: shallowMerge(DEFAULT_CONTENT.hero, stored.hero),
    about: {
      ...DEFAULT_CONTENT.about,
      ...stored.about,
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
  };
}

/** In-memory copy — survives a full localStorage (quota exceeded) and is the
 *  read source when the cached JSON can't be written. */
let memoryContent: SiteContent | null = null;

export function getContent(): SiteContent {
  if (typeof localStorage === "undefined") {
    return memoryContent ?? DEFAULT_CONTENT;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryContent ?? DEFAULT_CONTENT;
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

/** Debounced publish to the server. No-op (reported as "local") when the
 *  admin isn't server-authenticated, e.g. static deploys. */
function schedulePush(content: SiteContent) {
  const token = getAdminToken();
  if (!token) {
    emitSync("local");
    return;
  }
  emitSync("saving");
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    void pushContent(content, token).then((result) => {
      emitSync(result === "ok" ? "saved" : result === "offline" ? "local" : "error");
    });
  }, PUSH_DEBOUNCE_MS);
}

/** Write content to the local cache without publishing (used for content
 *  that just arrived FROM the server — pushing it back would be a loop). */
function applyContent(content: SiteContent): void {
  memoryContent = content;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
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
  applyContent(next);
  return true;
}

export function saveContent(content: SiteContent): void {
  applyContent(content);
  schedulePush(content);
}

export function saveSection<K extends keyof SiteContent>(
  section: K,
  value: SiteContent[K]
): SiteContent {
  const current = getContent();
  const next = { ...current, [section]: value };
  saveContent(next);
  return next;
}

export function resetSection<K extends keyof SiteContent>(
  section: K
): SiteContent[K] {
  const current = getContent();
  saveContent({ ...current, [section]: DEFAULT_CONTENT[section] });
  return DEFAULT_CONTENT[section];
}

export function resetAll(): void {
  localStorage.removeItem(STORAGE_KEY);
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
