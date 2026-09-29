/**
 * The shape of one language's content translation (Cebuano, Tagalog,
 * Chavacano — everything except English, which is data.ts itself).
 *
 * Deliberately narrow: only prose gets translated. Proper nouns (project
 * titles, org names, cert titles/issuers, tech stack items, contact
 * values) stay in English in every language, the same way a person
 * writing a Cebuano bio wouldn't translate "React" or "GitHub". Anything
 * missing from a translation — a project added after the one-time batch
 * ran, say — falls back to the English string, never a blank.
 *
 * Generated once by scripts/translate-content.mjs, then committed and
 * hand-edited like any other content. Re-run the script (or edit by hand)
 * after a material change to the English copy in data.ts; nothing here
 * updates itself.
 */

export type ProjectTranslation = {
  blurb?: string;
  challenge?: string;
  solution?: string;
  figCaption?: string;
  /** Same order as the English project's `gallery` array. */
  galleryAlts?: string[];
  /** Same order as the English project's `metrics` array — label only. */
  metricLabels?: string[];
};

export type TimelineTranslation = {
  /** Only set when the English `range` is a word ("Freelance", "Internship",
   *  "College") rather than a literal date range ("2022 — 2026"). */
  range?: string;
  title?: string;
  blurb?: string;
};

export type ProcessStageTranslation = {
  title?: string;
  summary?: string;
  detail?: string;
};

export type NowGroupTranslation = {
  label?: string;
  /** Keyed by the English item `name`. */
  items?: Record<string, string>;
};

export type ContentTranslation = {
  hero?: {
    eyebrow?: string;
    role?: string;
    availableText?: string;
    tagline?: string;
    abstract?: string;
  };
  about?: {
    paragraphs?: string;
    highlights?: string[];
    /** Keyed by the English `specs[].label` — the label only, not the value. */
    specLabels?: Record<string, string>;
  };
  contact?: {
    intro?: string;
    /** Keyed by the English `channels[].label` — generic labels only
     *  ("Email", "Location"); brand names ("GitHub", "LinkedIn") are never
     *  translated, so they're never keys here. */
    channelLabels?: Record<string, string>;
  };
  /** Keyed by the English `skillGroups[].label`. */
  skillGroupLabels?: Record<string, string>;
  /** Keyed by project `id`. */
  projects?: Record<string, ProjectTranslation>;
  /** Same order/length as data.ts's `timeline` array. */
  timeline?: TimelineTranslation[];
  /** Keyed by `processStages[].n`. */
  processStages?: Record<string, ProcessStageTranslation>;
  /** Keyed by `nowGroups[].label`. */
  nowGroups?: Record<string, NowGroupTranslation>;
};
