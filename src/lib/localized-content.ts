import { useMemo } from "react";
import { getContent, type SiteContent } from "./content";
import { useI18n, type LanguageId } from "./i18n";
import { processStages as processStagesData, nowGroups as nowGroupsData } from "./data";
import type { ContentTranslation } from "./translations/schema";
import { ceb } from "./translations/ceb";
import { tl } from "./translations/tl";
import { cbk } from "./translations/cbk";

/**
 * Applies a one-time, static translation over the live content (whatever
 * getContent() returns — the shipped defaults, or an admin-published
 * snapshot) so switching the language picker actually changes the paper,
 * not just the chrome around it.
 *
 * Every lookup falls back to English when a translation is missing —
 * a project the admin adds after the batch translation ran, say, or an
 * English edit that hasn't been re-translated yet. That staleness is the
 * accepted tradeoff of "static, not live" (see schema.ts); nothing here
 * ever shows a blank instead of English.
 */

type Translations = Partial<Record<LanguageId, ContentTranslation>>;

const TRANSLATIONS: Translations = { ceb, tl, cbk };

function pick<T>(translated: T | undefined, fallback: T): T {
  return translated !== undefined ? translated : fallback;
}

/** `translations` is injectable (defaults to the real, committed files)
 *  purely so tests can exercise real substitution behaviour without
 *  depending on what's actually been translated yet. */
export function localizeContent(
  content: SiteContent,
  language: LanguageId,
  translations: Translations = TRANSLATIONS
): SiteContent {
  const dict = translations[language];
  if (!dict) return content;

  return {
    ...content,
    hero: {
      ...content.hero,
      eyebrow: pick(dict.hero?.eyebrow, content.hero.eyebrow),
      role: pick(dict.hero?.role, content.hero.role),
      availableText: pick(dict.hero?.availableText, content.hero.availableText),
      tagline: pick(dict.hero?.tagline, content.hero.tagline),
      abstract: pick(dict.hero?.abstract, content.hero.abstract),
    },
    about: {
      ...content.about,
      paragraphs: pick(dict.about?.paragraphs, content.about.paragraphs),
      highlights: pick(dict.about?.highlights, content.about.highlights),
      specs: content.about.specs.map((spec) => ({
        ...spec,
        label: dict.about?.specLabels?.[spec.label] ?? spec.label,
      })),
    },
    contact: {
      ...content.contact,
      intro: pick(dict.contact?.intro, content.contact.intro),
      channels: content.contact.channels.map((c) => ({
        ...c,
        label: dict.contact?.channelLabels?.[c.label] ?? c.label,
      })),
    },
    // skills is deliberately left untranslated here: Skills.tsx looks up
    // each group's icon by its English label (groupIcon[group.label]), so
    // translating it in place would silently break every group's icon.
    // translateSkillGroupLabel() below handles display text separately.
    projects: content.projects.map((p) => {
      const t = dict.projects?.[p.id];
      if (!t) return p;
      return {
        ...p,
        blurb: pick(t.blurb, p.blurb),
        challenge: pick(t.challenge, p.challenge),
        solution: pick(t.solution, p.solution),
        figCaption: pick(t.figCaption, p.figCaption),
        gallery: p.gallery?.map((g, i) => ({ ...g, alt: t.galleryAlts?.[i] ?? g.alt })),
        metrics: p.metrics?.map((m, i) => ({ ...m, label: t.metricLabels?.[i] ?? m.label })),
      };
    }),
    timeline: content.timeline.map((entry, i) => {
      const t = dict.timeline?.[i];
      if (!t) return entry;
      return {
        ...entry,
        range: t.range ?? entry.range,
        title: t.title ?? entry.title,
        blurb: t.blurb ?? entry.blurb,
      };
    }),
  };
}

/** Display-only translation for a skill group's label. Not part of
 *  localizeContent() because Skills.tsx looks its icon up by the English
 *  label — call this for the text you render, and keep using the
 *  original (English) `group.label` for keys, icon lookups, and anything
 *  else that isn't literally the on-screen words. */
export function translateSkillGroupLabel(
  englishLabel: string,
  language: LanguageId,
  translations: Translations = TRANSLATIONS
): string {
  return translations[language]?.skillGroupLabels?.[englishLabel] ?? englishLabel;
}

/** Reactive to language only — matches every content-reading component's
 *  existing `useMemo(() => getContent(), [])`, which is itself mount-once
 *  rather than reactive to content edits; this doesn't change that. */
export function useLocalizedContent(): SiteContent {
  const { language } = useI18n();
  return useMemo(() => localizeContent(getContent(), language), [language]);
}

/** processStages and nowGroups aren't part of SiteContent — fixed data.ts
 *  constants, never admin-editable — so they localize directly against
 *  the data.ts arrays rather than through getContent(). */
export function useLocalizedProcessStages() {
  const { language } = useI18n();
  const dict = TRANSLATIONS[language];
  return useMemo(() => {
    if (!dict?.processStages) return processStagesData;
    return processStagesData.map((stage) => {
      const t = dict.processStages?.[stage.n];
      if (!t) return stage;
      return { ...stage, title: t.title ?? stage.title, summary: t.summary ?? stage.summary, detail: t.detail ?? stage.detail };
    });
  }, [language, dict]);
}

export function useLocalizedNowGroups() {
  const { language } = useI18n();
  const dict = TRANSLATIONS[language];
  return useMemo(() => {
    if (!dict?.nowGroups) return nowGroupsData;
    return nowGroupsData.map((group) => {
      const t = dict.nowGroups?.[group.label];
      if (!t) return group;
      return {
        ...group,
        label: t.label ?? group.label,
        items: group.items.map((item) => ({ ...item, note: t.items?.[item.name] ?? item.note })),
      };
    });
  }, [language, dict]);
}
