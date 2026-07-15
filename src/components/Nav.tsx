import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { switchTheme, THEMES, type Theme } from "../lib/theme";

export type TabId =
  | "top"
  | "work"
  | "about"
  | "stack"
  | "credentials"
  | "contact";

type TabMeta = { id: TabId; key: string };

export const tabs: TabMeta[] = [
  { id: "top", key: "nav.home" },
  { id: "work", key: "nav.projects" },
  { id: "about", key: "nav.about" },
  { id: "stack", key: "nav.skills" },
  { id: "credentials", key: "nav.credentials" },
  { id: "contact", key: "nav.contact" },
];

type NavProps = {
  theme: Theme;
  onThemeChange: (next: Theme, origin?: { x: number; y: number }) => void;
  active: TabId;
  onChange: (id: TabId) => void;
};

export function Nav({ theme, onThemeChange, active, onChange }: NavProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click / Esc
  useEffect(() => {
    if (!menuOpen && !themeOpen) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuOpen && !menuRef.current?.contains(target)) setMenuOpen(false);
      if (themeOpen && !themeRef.current?.contains(target)) setThemeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setThemeOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, themeOpen]);

  async function shareLink() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Portfolio.docx", url });
        return;
      } catch {
        // user dismissed the share sheet — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  const currentTheme = THEMES.find((th) => th.id === theme) ?? THEMES[0];

  return (
    <nav className="no-print fixed top-0 left-0 right-0 z-50 h-12 bg-paper border-b border-rule flex items-center justify-between px-2 md:px-3 text-sm">
      {/* Left: menu/tool buttons + ribbon tabs */}
      <div className="flex items-center gap-1 min-w-0">
        <div className="relative" ref={menuRef}>
          <button
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className={
              "p-2 rounded text-ink-muted transition-colors " +
              (menuOpen ? "bg-ribbon-hover" : "hover:bg-ribbon-hover")
            }
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          {menuOpen && (
            <div className="word-popover absolute top-full left-0 mt-1 w-56 py-1 font-ui text-[13px] text-ink">
              <MenuItem
                icon="description"
                label="Résumé (PDF)"
                onClick={() => {
                  window.location.href = "/resume";
                }}
              />
              <MenuItem
                icon="print"
                label="Print / Save as PDF"
                shortcut="Ctrl+P"
                onClick={() => {
                  setMenuOpen(false);
                  window.print();
                }}
              />
              <MenuItem
                icon="link"
                label={linkCopied ? "Link copied!" : t("common.share")}
                onClick={() => {
                  void shareLink();
                }}
              />
              <MenuItem
                icon="monitoring"
                label="System info (/status)"
                onClick={() => {
                  window.location.href = "/status";
                }}
              />
              <div className="my-1 h-px bg-rule" />
              <MenuItem
                icon="shield_person"
                label="Admin console"
                onClick={() => {
                  window.location.href = "/admin";
                }}
              />
            </div>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-0.5 border-r border-rule pr-2 mr-1">
          <button
            aria-label="Save a copy"
            title="Save a copy (print to PDF)"
            onClick={() => window.print()}
            className="p-1.5 rounded text-ink-muted hover:bg-ribbon-hover transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              save
            </span>
          </button>
          <button
            aria-label="Undo"
            disabled
            className="p-1.5 rounded text-ink-subtle opacity-60 cursor-not-allowed"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              undo
            </span>
          </button>
          <button
            aria-label="Redo"
            disabled
            className="p-1.5 rounded text-ink-subtle opacity-60 cursor-not-allowed"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              redo
            </span>
          </button>
        </div>

        <div className="hidden md:flex items-end h-full pt-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={
                  "px-3 pb-1.5 pt-1 text-[13px] font-medium transition-colors border-b-2 whitespace-nowrap " +
                  (isActive
                    ? "text-word-blue border-word-blue"
                    : "text-ink-muted border-transparent hover:bg-ribbon-hover hover:text-ink")
                }
              >
                {t(tab.key)}
              </button>
            );
          })}
        </div>

        {/* Mobile: current tab dropdown */}
        <div className="md:hidden">
          <select
            aria-label="Switch tab"
            value={active}
            onChange={(e) => onChange(e.target.value as TabId)}
            className="bg-paper border border-rule rounded text-ink text-[13px] font-medium px-2 py-1 focus:outline-none focus:ring-2 focus:ring-word-blue"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {t(tab.key)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Center: document title (hidden on small screens) */}
      <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-2 pointer-events-none">
        <span
          className="material-symbols-outlined icon-fill text-word-blue"
          style={{ fontSize: 18 }}
        >
          description
        </span>
        <span className="font-semibold text-ink text-[14px] tracking-tight">
          Portfolio.docx
        </span>
        <span className="text-ink-subtle text-[11px]">— Saved to OneDrive</span>
      </div>

      {/* Right: search, comment, share, theme picker, avatar */}
      <div className="flex items-center gap-1">
        <button
          aria-label="Search this document"
          title="Search this document (Ctrl+K)"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("jvc:open-search"))
          }
          className="p-2 rounded text-ink-muted hover:bg-ribbon-hover transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            search
          </span>
        </button>
        <button
          aria-label="Comments — get in touch"
          title="Leave a comment (opens Contact)"
          onClick={() => onChange("contact")}
          className="hidden sm:inline-flex p-2 rounded text-ink-muted hover:bg-ribbon-hover transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            chat_bubble
          </span>
        </button>
        <button
          aria-label="Share"
          title="Share a link to this document"
          onClick={() => void shareLink()}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-rule text-ink-muted hover:bg-ribbon-hover transition-colors text-[12px] font-medium"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {linkCopied ? "check" : "share"}
          </span>
          <span className="hidden md:inline">
            {linkCopied ? "Copied" : t("common.share")}
          </span>
        </button>

        <div className="relative" ref={themeRef}>
          <ThemePicker
            currentTheme={currentTheme.id}
            onChange={onThemeChange}
            open={themeOpen}
            setOpen={setThemeOpen}
          />
        </div>

        <div className="ml-1 w-8 h-8 rounded-full bg-word-blue text-white grid place-items-center text-[11px] font-semibold tracking-wider">
          JV
        </div>
      </div>
    </nav>
  );
}

/* ─── theme picker popover ─── */

function ThemePicker({
  currentTheme,
  onChange,
  open,
  setOpen,
}: {
  currentTheme: Theme;
  onChange: (next: Theme, origin?: { x: number; y: number }) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <button
        aria-label="Office theme"
        aria-expanded={open}
        title={t("theme.title")}
        onClick={() => setOpen(!open)}
        className={
          "p-2 rounded text-ink-muted transition-colors " +
          (open ? "bg-ribbon-hover" : "hover:bg-ribbon-hover")
        }
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          palette
        </span>
      </button>
      {open && (
        <div className="word-popover absolute top-full right-0 mt-1 w-72 py-2 z-50">
          <div className="px-3 pb-1.5 border-b border-rule">
            <div className="font-ui text-[13px] font-semibold text-ink">
              {t("theme.title")}
            </div>
            <div className="font-ui text-[11px] text-ink-subtle">
              {t("theme.hint")}
            </div>
          </div>
          <div className="py-1">
            {THEMES.map((th) => {
              const isActive = th.id === currentTheme;
              return (
                <button
                  key={th.id}
                  onClick={(e) => {
                    setOpen(false);
                    onChange(th.id, { x: e.clientX, y: e.clientY });
                  }}
                  className={
                    "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors " +
                    (isActive
                      ? "bg-word-blue-light"
                      : "hover:bg-ribbon-hover")
                  }
                >
                  <span
                    className="w-6 h-6 rounded-sm border border-rule shrink-0"
                    style={{ background: th.chip }}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-ui text-[13px] font-medium text-ink truncate">
                      {th.label}
                    </div>
                    <div className="font-ui text-[11px] text-ink-subtle truncate">
                      {th.hint}
                    </div>
                  </div>
                  {isActive && (
                    <span
                      className="material-symbols-outlined text-word-blue icon-fill"
                      style={{ fontSize: 18 }}
                    >
                      check_circle
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: string;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-ribbon-hover transition-colors"
    >
      <span
        className="material-symbols-outlined text-ink-muted"
        style={{ fontSize: 16 }}
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-[11px] text-ink-subtle">{shortcut}</span>
      )}
    </button>
  );
}

/** Re-export for convenience: callers that need switchTheme's animation. */
export { switchTheme };
