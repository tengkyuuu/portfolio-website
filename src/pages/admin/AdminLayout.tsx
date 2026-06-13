import { useEffect, useMemo, useState } from "react";
import { SYNC_EVENT, type SyncStatus } from "../../lib/content";
import { clearAdminAuth } from "../../lib/auth";
import { Button } from "./ui";

export type SectionId =
  | "hero"
  | "about"
  | "skills"
  | "projects"
  | "credentials"
  | "contact"
  | "tools";

export const SECTIONS: { id: SectionId; label: string; icon: string; tab: string }[] = [
  { id: "hero", label: "Home", icon: "home", tab: "Home tab" },
  { id: "about", label: "About", icon: "person", tab: "About tab" },
  { id: "skills", label: "Skills", icon: "build", tab: "Skills tab" },
  { id: "projects", label: "Projects", icon: "folder", tab: "Projects tab" },
  { id: "credentials", label: "Credentials", icon: "school", tab: "Credentials tab" },
  { id: "contact", label: "Contact", icon: "mail", tab: "Contact tab" },
  { id: "tools", label: "Tools", icon: "settings", tab: "Backup, import, danger zone" },
];

function hashToSection(): SectionId {
  const h = window.location.hash.replace(/^#/, "");
  return (SECTIONS.find((s) => s.id === h)?.id ?? "hero") as SectionId;
}

type Props = {
  active: SectionId;
  onChange: (s: SectionId) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

export function AdminLayout({ active, onChange, onLogout, children }: Props) {
  const [sync, setSync] = useState<SyncStatus | "idle">("idle");

  // Track real publish status: "saving" while the debounced push is pending,
  // then "saved" (server), "local" (no server / offline), or "error".
  useEffect(() => {
    let t: number | undefined;
    const onSync = (e: Event) => {
      const status = (e as CustomEvent<SyncStatus>).detail;
      setSync(status);
      if (t) window.clearTimeout(t);
      if (status === "saved") {
        t = window.setTimeout(() => setSync("idle"), 1800);
      }
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      if (t) window.clearTimeout(t);
    };
  }, []);

  // Sync active section ⇄ URL hash
  useEffect(() => {
    if (window.location.hash.replace(/^#/, "") !== active) {
      window.history.replaceState(null, "", `#${active}`);
    }
  }, [active]);

  useEffect(() => {
    const onHash = () => onChange(hashToSection());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [onChange]);

  const activeMeta = useMemo(
    () => SECTIONS.find((s) => s.id === active) ?? SECTIONS[0],
    [active]
  );

  function handleLogout() {
    clearAdminAuth();
    onLogout();
  }

  return (
    <div className="min-h-svh bg-workspace text-ink">
      {/* Top bar — Word-style ribbon, lean version */}
      <header className="sticky top-0 z-30 h-12 bg-paper border-b border-rule flex items-center justify-between px-3 md:px-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="material-symbols-outlined icon-fill text-word-blue"
            style={{ fontSize: 20 }}
          >
            description
          </span>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-ui text-[14px] font-semibold text-ink">
              Portfolio.docx
            </span>
            <span className="font-ui text-[12px] text-ink-subtle hidden sm:inline">
              · Admin Console
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SavedPill sync={sync} />
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-ui font-medium text-ink-muted hover:text-ink px-2.5 py-1 rounded-sm hover:bg-ribbon-hover transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              open_in_new
            </span>
            View live
          </a>
          <Button variant="ghost" icon="logout" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:block w-60 shrink-0 border-r border-rule bg-paper min-h-[calc(100svh-3rem)]">
          <nav className="p-3 flex flex-col gap-0.5 sticky top-12">
            {SECTIONS.map((s, i) => (
              <SidebarItem
                key={s.id}
                item={s}
                active={active === s.id}
                onClick={() => onChange(s.id)}
                topDivider={s.id === "tools" && i > 0}
              />
            ))}
          </nav>
        </aside>

        {/* Mobile section picker */}
        <div className="md:hidden fixed bottom-3 left-3 right-3 z-20 bg-paper border border-rule rounded-sm shadow-lg p-2 flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className={
                "shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-sm font-ui text-[12px] font-medium transition-colors " +
                (active === s.id
                  ? "bg-word-blue text-white"
                  : "text-ink-muted hover:bg-ribbon-hover")
              }
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {s.icon}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Main */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-10 pb-24 md:pb-10 max-w-4xl">
          <div className="mb-6">
            <p className="font-ui text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
              Editing
            </p>
            <h1 className="font-doc text-[28px] md:text-[32px] font-bold text-word-blue tracking-tight leading-tight">
              {activeMeta.label}
            </h1>
            <p className="font-ui text-[12px] text-ink-subtle mt-0.5">
              {activeMeta.tab} · changes save automatically
            </p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function SavedPill({ sync }: { sync: SyncStatus | "idle" }) {
  const view = {
    idle: { icon: "cloud_done", label: "Up to date", tone: "text-ink-subtle bg-transparent" },
    saving: { icon: "sync", label: "Publishing…", tone: "text-ink-muted bg-ribbon" },
    saved: { icon: "check_circle", label: "Published", tone: "text-word-blue bg-word-blue-light" },
    local: {
      icon: "cloud_off",
      label: "Saved locally only",
      tone: "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50",
    },
    error: {
      icon: "error",
      label: "Publish failed",
      tone: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/50",
    },
  }[sync];

  return (
    <span
      className={
        "hidden sm:inline-flex items-center gap-1 font-ui text-[11px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-sm transition-colors " +
        view.tone
      }
      title={
        sync === "local"
          ? "No server connection — edits persist in this browser only."
          : sync === "error"
            ? "The server rejected the update. Try signing out and back in."
            : undefined
      }
    >
      <span
        className={
          "material-symbols-outlined " +
          (sync === "saved" ? "icon-fill " : "") +
          (sync === "saving" ? "animate-spin" : "")
        }
        style={{ fontSize: 14 }}
      >
        {view.icon}
      </span>
      {view.label}
    </span>
  );
}

function SidebarItem({
  item,
  active,
  onClick,
  topDivider,
}: {
  item: (typeof SECTIONS)[number];
  active: boolean;
  onClick: () => void;
  topDivider?: boolean;
}) {
  return (
    <>
      {topDivider && (
        <div className="my-2 mx-2 h-px bg-rule" aria-hidden="true" />
      )}
      <button
        onClick={onClick}
        className={
          "flex items-center gap-2.5 px-3 py-2 rounded-sm font-ui text-[13px] text-left transition-colors " +
          (active
            ? "bg-word-blue-light text-word-blue font-semibold"
            : "text-ink-muted hover:bg-ribbon-hover hover:text-ink")
        }
      >
        <span
          className={
            "material-symbols-outlined " + (active ? "icon-fill" : "")
          }
          style={{ fontSize: 18 }}
        >
          {item.icon}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
      </button>
    </>
  );
}

export { hashToSection };
