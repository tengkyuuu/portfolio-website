import { useEffect, useRef, useState } from "react";

export type TabId =
  | "top"
  | "work"
  | "about"
  | "stack"
  | "credentials"
  | "contact";

export const tabs: { id: TabId; label: string }[] = [
  { id: "top", label: "Home" },
  { id: "work", label: "Projects" },
  { id: "about", label: "About" },
  { id: "stack", label: "Skills" },
  { id: "credentials", label: "Credentials" },
  { id: "contact", label: "Contact" },
];

type NavProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  active: TabId;
  onChange: (id: TabId) => void;
};

export function Nav({ theme, onToggleTheme, active, onChange }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the File menu on outside click / Esc
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
            <div className="absolute top-full left-0 mt-1 w-56 bg-paper border border-rule rounded-sm shadow-lg py-1 font-ui text-[13px] text-ink">
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
                label={linkCopied ? "Link copied!" : "Copy link"}
                onClick={() => {
                  void shareLink();
                }}
              />
              <MenuItem
                icon={theme === "dark" ? "light_mode" : "dark_mode"}
                label={theme === "dark" ? "Light mode" : "Dark mode"}
                onClick={() => {
                  setMenuOpen(false);
                  onToggleTheme();
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
          {tabs.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={
                  "px-3 pb-1.5 pt-1 text-[13px] font-medium transition-colors border-b-2 whitespace-nowrap " +
                  (isActive
                    ? "text-word-blue border-word-blue"
                    : "text-ink-muted border-transparent hover:bg-ribbon-hover hover:text-ink")
                }
              >
                {t.label}
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
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
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

      {/* Right: theme toggle + avatar */}
      <div className="flex items-center gap-1">
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
            {linkCopied ? "Copied" : "Share"}
          </span>
        </button>
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded text-ink-muted hover:bg-ribbon-hover transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>
        <div className="ml-1 w-8 h-8 rounded-full bg-word-blue text-white grid place-items-center text-[11px] font-semibold tracking-wider">
          JV
        </div>
      </div>
    </nav>
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
