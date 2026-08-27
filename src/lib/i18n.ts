import { useSyncExternalStore } from "react";

/**
 * Lightweight i18n for the UI chrome.
 *
 * Translates static labels (nav tabs, status bar, section titles, common
 * buttons) — NOT the user's own content, which stays in whatever language
 * they authored. Modelled loosely on Word's "Set Proofing Language" flow:
 * a dropdown in the status bar, current choice persisted per user.
 */

export type LanguageId = "en" | "ceb" | "tl" | "cbk";

export type LanguageMeta = {
  id: LanguageId;
  /** Native name — what the picker shows */
  label: string;
  /** English name — used in tooltips and status-bar chip */
  english: string;
  /** IETF tag; drops into <html lang="…"> */
  htmlLang: string;
  /** Word-ish label for the status bar */
  statusLabel: string;
};

export const LANGUAGES: LanguageMeta[] = [
  { id: "en", label: "English", english: "English", htmlLang: "en", statusLabel: "English (US)" },
  { id: "ceb", label: "Sinugbuanong Binisayâ", english: "Cebuano", htmlLang: "ceb", statusLabel: "Cebuano" },
  { id: "tl", label: "Tagalog", english: "Tagalog", htmlLang: "tl", statusLabel: "Tagalog" },
  { id: "cbk", label: "Chavacano", english: "Chavacano", htmlLang: "cbk", statusLabel: "Chavacano" },
];

/**
 * Translation dictionary. Keys are stable identifiers; values are the
 * translated string. Missing translations fall back to English silently.
 * Filipino translations are best-effort — edit them any time.
 */
type Dict = Record<string, string>;

const en: Dict = {
  // Nav tabs
  "nav.home": "Home",
  "nav.projects": "Projects",
  "nav.about": "About",
  "nav.skills": "Skills",
  "nav.process": "How I Work",
  "nav.now": "Now",
  "nav.credentials": "Credentials",
  "nav.contact": "Contact",

  // Section titles
  "section.executiveSummary": "Executive Summary",
  "section.coreCompetencies": "Core Competencies",
  "section.selectedProjects": "Selected Projects",
  "section.educationExperience": "Education & Experience",
  "section.certificationsAwards": "Certifications & Awards",
  "section.getInTouch": "Get in Touch",
  "section.contents": "Contents",

  // Common
  "common.availableForWork": "Available for work",
  "common.backToPortfolio": "Back to portfolio",
  "common.downloadPdf": "Download PDF",
  "common.signIn": "Sign in",
  "common.signOut": "Sign out",
  "common.share": "Share",
  "common.viewLive": "View live",

  // Status bar
  "status.page": "Page",
  "status.of": "of",
  "status.words": "words",
  "status.readAloud": "Read aloud",
  "status.focus": "Focus",
  "status.printLayout": "Print Layout",
  "status.language": "Language",
  "status.accessibility": "Accessibility: Good",

  // Theme picker
  "theme.title": "Office Theme",
  "theme.hint": "Change the look of Word",
};

const ceb: Dict = {
  "nav.home": "Panimalay",
  "nav.projects": "Mga Proyekto",
  "nav.about": "Bahin",
  "nav.skills": "Kahibalo",
  "nav.process": "Paagi sa Pagtrabaho",
  "nav.now": "Karon",
  "nav.credentials": "Katibayan",
  "nav.contact": "Kontak",

  "section.executiveSummary": "Ehekutibong Summary",
  "section.coreCompetencies": "Pangunang Kahanas",
  "section.selectedProjects": "Napiling Proyekto",
  "section.educationExperience": "Edukasyon ug Kasinatian",
  "section.certificationsAwards": "Sertipiko ug Pasidungog",
  "section.getInTouch": "Pakigsulti Kanako",
  "section.contents": "Sulod",

  "common.availableForWork": "Bukás sa trabaho",
  "common.backToPortfolio": "Balik sa portfolio",
  "common.downloadPdf": "I-download ang PDF",
  "common.signIn": "Mag-login",
  "common.signOut": "Mag-logout",
  "common.share": "Ipaambit",
  "common.viewLive": "Tan-awa",

  "status.page": "Panid",
  "status.of": "sa",
  "status.words": "mga pulong",
  "status.readAloud": "Basaha",
  "status.focus": "Focus",
  "status.printLayout": "Print Layout",
  "status.language": "Sinultihan",
  "status.accessibility": "Accessibility: Maayo",

  "theme.title": "Tema sa Office",
  "theme.hint": "Ilis-a ang panagway sa Word",
};

const tl: Dict = {
  "nav.home": "Tahanan",
  "nav.projects": "Mga Proyekto",
  "nav.about": "Tungkol",
  "nav.skills": "Kakayahan",
  "nav.process": "Paraan ng Pagtatrabaho",
  "nav.now": "Ngayon",
  "nav.credentials": "Katibayan",
  "nav.contact": "Kontak",

  "section.executiveSummary": "Buod",
  "section.coreCompetencies": "Pangunahing Kasanayan",
  "section.selectedProjects": "Piling Proyekto",
  "section.educationExperience": "Edukasyon at Karanasan",
  "section.certificationsAwards": "Sertipiko at Parangal",
  "section.getInTouch": "Makipag-ugnayan",
  "section.contents": "Nilalaman",

  "common.availableForWork": "Bukás sa trabaho",
  "common.backToPortfolio": "Bumalik sa portfolio",
  "common.downloadPdf": "I-download ang PDF",
  "common.signIn": "Mag-sign in",
  "common.signOut": "Mag-sign out",
  "common.share": "Ibahagi",
  "common.viewLive": "Tingnan",

  "status.page": "Pahina",
  "status.of": "ng",
  "status.words": "mga salita",
  "status.readAloud": "Basahin",
  "status.focus": "Focus",
  "status.printLayout": "Print Layout",
  "status.language": "Wika",
  "status.accessibility": "Accessibility: Mabuti",

  "theme.title": "Tema ng Office",
  "theme.hint": "Baguhin ang hitsura ng Word",
};

const cbk: Dict = {
  "nav.home": "Casa",
  "nav.projects": "Mga Proyecto",
  "nav.about": "Acerca",
  "nav.skills": "Habilidad",
  "nav.process": "Manera de Trabaja",
  "nav.now": "Ahora",
  "nav.credentials": "Credencial",
  "nav.contact": "Contacto",

  "section.executiveSummary": "Resumen Ejecutivo",
  "section.coreCompetencies": "Habilidad Principal",
  "section.selectedProjects": "Proyecto Escogido",
  "section.educationExperience": "Educación y Experiencia",
  "section.certificationsAwards": "Certificado y Premio",
  "section.getInTouch": "Contactá comigo",
  "section.contents": "Contenido",

  "common.availableForWork": "Abierto para trabajo",
  "common.backToPortfolio": "Volvé na portfolio",
  "common.downloadPdf": "Descargá el PDF",
  "common.signIn": "Entrá",
  "common.signOut": "Salí",
  "common.share": "Compartí",
  "common.viewLive": "Mirá",

  "status.page": "Página",
  "status.of": "de",
  "status.words": "palabra",
  "status.readAloud": "Leé",
  "status.focus": "Focus",
  "status.printLayout": "Print Layout",
  "status.language": "Lengua",
  "status.accessibility": "Accessibility: Bueno",

  "theme.title": "Tema del Office",
  "theme.hint": "Cambiá el aspecto de Word",
};

const DICTS: Record<LanguageId, Dict> = { en, ceb, tl, cbk };

/* ------------------------------ store ------------------------------ */

const STORAGE_KEY = "jvc_language_v1";
const CHANGE_EVENT = "jvc:language-change";

let current: LanguageId = readInitial();

function readInitial(): LanguageId {
  if (typeof localStorage === "undefined") return "en";
  const raw = localStorage.getItem(STORAGE_KEY) as LanguageId | null;
  if (raw && LANGUAGES.some((l) => l.id === raw)) return raw;
  return "en";
}

export function getLanguage(): LanguageId {
  return current;
}

export function setLanguage(id: LanguageId): void {
  if (!LANGUAGES.some((l) => l.id === id)) return;
  current = id;
  localStorage.setItem(STORAGE_KEY, id);
  const meta = LANGUAGES.find((l) => l.id === id)!;
  document.documentElement.setAttribute("lang", meta.htmlLang);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Translate a key; falls back to English then to the key itself. */
export function t(key: string, lang: LanguageId = current): string {
  return DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
}

/* ------------------------------ hook ------------------------------- */

function subscribe(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/**
 * React hook. Returns { t, language, setLanguage } and re-renders whenever
 * the language changes. Uses useSyncExternalStore so it plays well with
 * Strict Mode and concurrent rendering.
 */
export function useI18n(): {
  t: (key: string) => string;
  language: LanguageId;
  setLanguage: (id: LanguageId) => void;
} {
  const language = useSyncExternalStore(
    subscribe,
    () => current,
    () => "en" as LanguageId
  );
  return {
    language,
    t: (k: string) => t(k, language),
    setLanguage,
  };
}

/** Initialise <html lang="…"> on startup. Call once from main.tsx. */
export function initLanguage(): void {
  if (typeof document === "undefined") return;
  const meta = LANGUAGES.find((l) => l.id === current)!;
  document.documentElement.setAttribute("lang", meta.htmlLang);
}
