import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Focus,
  Highlighter,
  LayoutPanelLeft,
  Link,
  MessageSquare,
  Palette,
  Search,
  Share2,
} from "lucide-react";
import { isAdminAuthed } from "../lib/auth";
import { publishedPosts } from "../lib/blog";
import { getContent, type SiteContent } from "../lib/content";
import { publicDesigns } from "../lib/gallery";
import { useI18n } from "../lib/i18n";
import { switchTheme, THEMES, type Theme } from "../lib/theme";
import { PresenceStack } from "./PresenceStack";

export type TabId =
  | "top"
  | "work"
  | "gallery"
  | "about"
  | "stack"
  | "credentials"
  | "blog"
  | "contact";
export const tabs: { id: TabId; key: string }[] = [
  { id: "top", key: "nav.home" },
  { id: "work", key: "nav.projects" },
  { id: "gallery", key: "nav.gallery" },
  { id: "about", key: "nav.about" },
  { id: "stack", key: "nav.skills" },
  { id: "credentials", key: "nav.credentials" },
  { id: "blog", key: "nav.blog" },
  { id: "contact", key: "nav.contact" },
];

/**
 * The tabs worth showing. Gallery and Blog are written from the admin and
 * ship empty, and an empty chapter on the ribbon reads as unfinished work,
 * so each appears only once it has something in it. A deep link to either
 * still routes there (hashToTab doesn't filter) — the content can arrive
 * from the server a moment after the page does.
 */
export function visibleTabs(content: SiteContent = getContent()) {
  return tabs.filter((tab) => {
    if (tab.id === "blog") return publishedPosts(content.posts).length > 0;
    if (tab.id === "gallery") return publicDesigns(content.designs).length > 0;
    return true;
  });
}

/**
 * "04" — a tab's chapter number as the ribbon currently counts it. Was a
 * literal on each chapter heading, which went stale the moment Gallery or
 * Blog joined the ribbon ahead of it.
 */
export function chapterNumber(id: TabId, content?: SiteContent): string {
  const shown = visibleTabs(content);
  const at = shown.findIndex((tab) => tab.id === id);
  const index = at >= 0 ? at : tabs.findIndex((tab) => tab.id === id);
  return String(index + 1).padStart(2, "0");
}

const RETIRED_TABS: Record<string, TabId> = { process: "about", now: "about" };
export function hashToTab(): TabId {
  const hash = window.location.hash.replace(/^#/, "");
  if (tabs.some((tab) => tab.id === hash)) return hash as TabId;
  if (hash.startsWith("proj-")) return "work";
  if (hash.startsWith("blog/")) return "blog";
  if (hash.startsWith("gallery/")) return "gallery";
  return RETIRED_TABS[hash] ?? "top";
}

type NavProps = {
  theme: Theme;
  onThemeChange: (next: Theme, origin?: { x: number; y: number }) => void;
  active: TabId;
  onChange: (id: TabId) => void;
  outlineOpen?: boolean;
  onToggleOutline?: () => void;
  onFocus?: () => void;
  highlights?: boolean;
  onToggleHighlights?: () => void;
  readingStyle?: "classic" | "modern";
  onReadingStyle?: (style: "classic" | "modern") => void;
};

export function Nav({
  theme,
  onThemeChange,
  active,
  onChange,
  outlineOpen,
  onToggleOutline,
  onFocus,
  highlights,
  onToggleHighlights,
  readingStyle = "classic",
  onReadingStyle,
}: NavProps) {
  const { t } = useI18n();
  const [menu, setMenu] = useState<"file" | "theme" | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const shown = visibleTabs();
  const next =
    shown[(shown.findIndex((tab) => tab.id === active) + 1) % shown.length];

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (
        !(e.target instanceof Element) ||
        !e.target.closest("[data-ribbon-popover]")
      )
        setMenu(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);

  async function shareLink(useNativeShare = true) {
    const url = window.location.href;
    try {
      if (useNativeShare && navigator.share) {
        await navigator.share({
          title: "James Vincent Calunsag — Portfolio.docx",
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("Link copied!");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareStatus("Copy the link from your address bar.");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShareStatus(""), 3500);
  }

  return (
    <nav className="office-chrome no-print" aria-label="Ribbon navigation">
      <div className="office-titlebar">
        <a href="#top" className="word-brand" aria-label="Portfolio home">
          W
        </a>
        <div className="office-filename">
          <span>Portfolio.docx</span>
          <span className="office-file-note">A work in progress, like me.</span>
        </div>
        <button
          className="office-search"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("jvc:open-search"))
          }
          aria-label="Search this document"
        >
          <Search size={15} />
          <span>Find something in my world</span>
          <kbd>Ctrl K</kbd>
        </button>
        <PresenceStack active={active} />
        <a href="#about" className="office-avatar" aria-label="About James">
          JV
        </a>
      </div>

      <div className="office-tabs-row">
        <div className="office-file-wrap" data-ribbon-popover>
          <button
            className={
              "office-file-button " + (menu === "file" ? "is-open" : "")
            }
            aria-expanded={menu === "file"}
            aria-haspopup="menu"
            onClick={() => setMenu(menu === "file" ? null : "file")}
          >
            {t("nav.file")}
          </button>
          {menu === "file" && (
            <div className="office-menu" role="menu">
              <div className="office-menu-heading">Make yourself at home.</div>
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  window.print();
                }}
              >
                <ArrowDownToLine size={16} />
                {t("common.saveAsPdf")}
                <kbd>Ctrl P</kbd>
              </button>
              <button role="menuitem" onClick={() => void shareLink(false)}>
                <Link size={16} />
                Copy document link
              </button>
              {isAdminAuthed() && (
                <>
                  <a role="menuitem" href="/resume">
                    <FileText size={16} />
                    Résumé builder
                  </a>
                  <a role="menuitem" href="/admin">
                    Admin console
                  </a>
                  <a role="menuitem" href="/status">
                    System status
                  </a>
                </>
              )}
            </div>
          )}
        </div>
        <div className="office-tabs">
          {shown.map((tab) => (
            <button
              key={tab.id}
              aria-current={active === tab.id ? "page" : undefined}
              onClick={() => onChange(tab.id)}
              className={active === tab.id ? "is-active" : ""}
            >
              {t(tab.key)}
            </button>
          ))}
        </div>
        <select
          className="office-mobile-tabs"
          aria-label="Switch tab"
          value={active}
          onChange={(e) => onChange(e.target.value as TabId)}
        >
          {shown.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {t(tab.key)}
            </option>
          ))}
        </select>
        <div className="office-tab-actions">
          <button
            onClick={() => onChange("contact")}
            aria-label="Comments — get in touch"
          >
            <MessageSquare size={14} />
            <span>Let’s talk</span>
          </button>
          <button
            className="office-share"
            onClick={() => void shareLink()}
            aria-label="Share"
          >
            <Share2 size={14} />
            <span>Share</span>
            <ChevronDown size={11} />
          </button>
        </div>
      </div>

      <div className="office-ribbon">
        <div className="ribbon-group ribbon-document">
          <div className="ribbon-controls">
            <button
              className="ribbon-tall"
              onClick={() => window.print()}
              aria-label="Save a copy"
            >
              <ArrowDownToLine size={23} />
              <span>Save as PDF</span>
            </button>
            <button
              className="ribbon-tall"
              onClick={() => void shareLink(false)}
            >
              <Link size={22} />
              <span>Copy link</span>
            </button>
          </div>
          <span className="ribbon-group-label">Document</span>
        </div>
        <div className="ribbon-group ribbon-styles">
          <div className="ribbon-controls">
            {(["classic", "modern"] as const).map((style) => (
              <button
                key={style}
                className={
                  "ribbon-style " + (readingStyle === style ? "is-active" : "")
                }
                aria-pressed={readingStyle === style}
                aria-label={
                  style === "classic"
                    ? "Editorial reading style"
                    : "Modern reading style"
                }
                onClick={() => onReadingStyle?.(style)}
              >
                <span className={style === "classic" ? "font-doc" : "font-ui"}>
                  Aa
                </span>
                <small>{style === "classic" ? "Editorial" : "Modern"}</small>
              </button>
            ))}
          </div>
          <span className="ribbon-group-label">Reading style</span>
        </div>
        <div className="ribbon-group">
          <div className="ribbon-controls">
            <button
              className={"ribbon-tall " + (outlineOpen ? "is-selected" : "")}
              aria-label="Toggle navigation pane"
              aria-pressed={outlineOpen}
              onClick={onToggleOutline}
            >
              <LayoutPanelLeft size={22} />
              <span>Navigation</span>
            </button>
            <button
              className="ribbon-tall"
              onClick={onFocus}
              aria-label="Focus mode"
            >
              <Focus size={22} />
              <span>Focus</span>
            </button>
          </div>
          <span className="ribbon-group-label">Your workspace</span>
        </div>
        <div className="ribbon-group">
          <div className="ribbon-controls">
            <button
              className={"ribbon-tall " + (highlights ? "is-selected" : "")}
              aria-pressed={highlights}
              onClick={onToggleHighlights}
            >
              <Highlighter size={22} />
              <span>Highlights</span>
            </button>
            <div className="relative" data-ribbon-popover>
              <button
                className="ribbon-tall"
                aria-label="Office theme"
                aria-expanded={menu === "theme"}
                onClick={() => setMenu(menu === "theme" ? null : "theme")}
              >
                <Palette size={22} />
                <span>
                  Theme <ChevronDown size={10} />
                </span>
              </button>
              {menu === "theme" && (
                <div className="office-menu theme-menu">
                  <div className="office-menu-heading">
                    A different kind of paper.
                  </div>
                  {THEMES.map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={theme === item.id}
                      onClick={(e) => {
                        onThemeChange(item.id, { x: e.clientX, y: e.clientY });
                        setMenu(null);
                      }}
                    >
                      <span
                        className="theme-swatch"
                        style={{ background: item.chip }}
                      />
                      <span>{item.label}</span>
                      {theme === item.id && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <span className="ribbon-group-label">Make it yours</span>
        </div>
        <div className="ribbon-note">
          <span className="ribbon-note-star">✳</span>
          <div>
            A familiar workspace.
            <br />
            <strong>A different kind of portfolio.</strong>
          </div>
        </div>
        <button className="ribbon-next" onClick={() => onChange(next.id)}>
          <span>
            Keep exploring<small>{t(next.key)}</small>
          </span>
          <ArrowRight size={19} />
        </button>
      </div>
      {shareStatus && (
        <div className="office-toast" role="status">
          {shareStatus}
        </div>
      )}
    </nav>
  );
}

export { switchTheme };
