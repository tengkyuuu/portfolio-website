import { useEffect, useMemo, useState } from "react";
import { CONTENT_EVENT, syncFromServer } from "./lib/content";
import { useI18n } from "./lib/i18n";
import { startContentSync } from "./lib/realtime";
import {
  applyTheme,
  getStoredTheme,
  switchTheme,
  watchSystemTheme,
  type Theme,
} from "./lib/theme";
import { Assistant } from "./components/Assistant";
import { hashToTab, Nav, tabs, type TabId } from "./components/Nav";
import { PwaChips } from "./components/PwaChips";
import { RequireAuth } from "./components/RequireAuth";
import { SearchPalette } from "./components/SearchPalette";
import { Home } from "./components/Home";
import { About } from "./components/About";
import { Skills } from "./components/Skills";
import { PaperSheet } from "./components/PaperSheet";
import { Projects } from "./components/Projects";
import { Certifications } from "./components/Certifications";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";
import { DocumentOutline } from "./components/DocumentOutline";
import { TabLoader } from "./components/TabLoader";
import { TabSkeleton } from "./components/TabSkeleton";
import { useDelayedLoading, useTabReady } from "./lib/tab-ready";
import { AdminPage } from "./pages/AdminPage";
import { ResumePage } from "./pages/ResumePage";
import { StatusPage } from "./pages/StatusPage";

/**
 * Word-style theme picker (5 options: Colorful / Dark Gray / Black / White /
 * System). The setter's second argument is the click origin — passing it
 * triggers a circular reveal via the View Transitions API.
 */
function useTheme(): [
  Theme,
  (next: Theme, origin?: { x: number; y: number }) => void,
] {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  // Apply on mount + whenever theme changes without an origin (e.g. programmatic).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Keep "system" in sync with OS-level light/dark flips.
  useEffect(() => watchSystemTheme(() => theme), [theme]);

  const setTheme = (next: Theme, origin?: { x: number; y: number }) => {
    switchTheme(next, origin);
    setThemeState(next);
  };

  return [theme, setTheme];
}

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

function useZoom(): [number, (z: number) => void] {
  const [zoom, setZoomRaw] = useState(() => {
    const saved = Number(localStorage.getItem("jvc_zoom"));
    return saved >= ZOOM_MIN && saved <= ZOOM_MAX ? saved : 100;
  });

  const setZoom = (z: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z)));
    setZoomRaw(clamped);
    localStorage.setItem("jvc_zoom", String(clamped));
  };

  // Ctrl + scroll zooms the document, like Word (also catches trackpad pinch)
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoomRaw((z) => {
        const next = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, z - Math.sign(e.deltaY) * ZOOM_STEP),
        );
        localStorage.setItem("jvc_zoom", String(next));
        return next;
      });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  return [zoom, setZoom];
}

function PortfolioDoc() {
  const [theme, setTheme] = useTheme();
  const [zoom, setZoom] = useZoom();
  const [focusMode, setFocusMode] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(
    () => window.innerWidth >= 1100,
  );
  const [highlights, setHighlights] = useState(true);
  const [readingStyle, setReadingStyle] = useState<"classic" | "modern">(
    "classic",
  );
  const [active, setActive] = useState<TabId>(() =>
    typeof window !== "undefined" ? hashToTab() : "top",
  );

  // Components read content once on mount, so bump a version (part of the
  // paper's key) to remount it whenever content changes — server content
  // arriving on load, admin edits in another tab, etc.
  const [contentVersion, setContentVersion] = useState(0);
  useEffect(() => {
    void syncFromServer();
    const bump = () => setContentVersion((v) => v + 1);
    window.addEventListener(CONTENT_EVENT, bump);
    window.addEventListener("storage", bump);
    // Real-time sync: Supabase Realtime + visibility refetch + polling.
    // Any admin save on any device propagates to this tab in seconds.
    const stopSync = startContentSync();
    return () => {
      window.removeEventListener(CONTENT_EVENT, bump);
      window.removeEventListener("storage", bump);
      stopSync();
    };
  }, []);

  // Esc leaves focus mode
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const navigate = (tab: TabId) => {
    if (window.location.hash !== `#${tab}`) window.location.hash = tab;
    setActive(tab);
    if (window.innerWidth < 1100) setOutlineOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // Respond to hash navigation (e.g. user pastes a link)
  useEffect(() => {
    const onHash = () => {
      setActive(hashToTab());
      if (window.innerWidth < 1100) setOutlineOpen(false);
      if (!window.location.hash.startsWith("#proj-"))
        window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const totalPages = tabs.length;
  const currentPage = useMemo(
    () => tabs.findIndex((t) => t.id === active) + 1,
    [active],
  );
  const { t } = useI18n();
  const activeMeta = useMemo(
    () => tabs.find((tab) => tab.id === active),
    [active],
  );
  const activeLabel = activeMeta ? t(activeMeta.key) : "Document";

  // Real loading state for the active tab (fonts + images).
  // The loader only flashes if loading lasts longer than the threshold.
  const ready = useTabReady(active);
  const showLoader = useDelayedLoading(!ready);

  // A project deep link must survive loading and content synchronization.
  useEffect(() => {
    if (
      !ready ||
      active !== "work" ||
      !window.location.hash.startsWith("#proj-")
    )
      return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(window.location.hash.slice(1))
        ?.scrollIntoView({ block: "start" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [ready, active, contentVersion]);

  return (
    <div
      className={
        "portfolio-workspace min-h-screen bg-workspace text-ink " +
        (outlineOpen && !focusMode ? "has-outline " : "") +
        (focusMode ? "is-focused " : "") +
        (highlights ? "show-highlights" : "")
      }
      data-reading-style={readingStyle}
    >
      <a
        href="#document-main"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("document-main")?.focus();
        }}
      >
        Skip to document
      </a>
      {!focusMode && (
        <Nav
          theme={theme}
          onThemeChange={setTheme}
          active={active}
          onChange={navigate}
          outlineOpen={outlineOpen}
          onToggleOutline={() => setOutlineOpen((open) => !open)}
          onFocus={() => setFocusMode(true)}
          highlights={highlights}
          onToggleHighlights={() => setHighlights((enabled) => !enabled)}
          readingStyle={readingStyle}
          onReadingStyle={setReadingStyle}
        />
      )}

      {!focusMode && outlineOpen && (
        <>
          <button
            className="outline-scrim no-print"
            aria-label="Dismiss navigation"
            onClick={() => setOutlineOpen(false)}
          />
          <DocumentOutline
            active={active}
            onChange={navigate}
            onClose={() => setOutlineOpen(false)}
          />
        </>
      )}

      {/* Workspace — gives the paper its breathing room, padded for the nav + status bar.
          Block + mx-auto (not flex centering) so a zoomed-in paper overflows into a
          horizontal scroll instead of getting clipped on the left. */}
      <main id="document-main" tabIndex={-1} className="document-main">
        {!focusMode && (
          <div className="workspace-topline no-print">
            <span>
              Portfolio.docx <span>/</span> {activeLabel}
            </span>
            <span>
              Made to be explored <span>↙</span>
            </span>
          </div>
        )}
        {!focusMode && (
          <div className="document-ruler no-print" aria-hidden="true">
            <span />
            {Array.from({ length: 15 }, (_, i) => (
              <i key={i}>{i === 0 ? "" : i}</i>
            ))}
            <span />
          </div>
        )}
        {/* Each chapter owns its content-sized sheets. This wrapper is also
            the source for word count and read-aloud. */}
        <div
          key={`${active}-v${contentVersion}`}
          id="paper-doc"
          style={{ zoom: zoom / 100 }}
          className="paper-enter document-pages flex flex-col gap-6 md:gap-8 text-ink relative"
        >
          {ready ? (
            <>
              {/* Page numbers restart within each chapter; the status bar
                  reports which chapter is currently open. */}
              {active === "top" && <Home page={1} />}
              {active === "work" && <Projects />}
              {active === "about" && <About page={1} />}
              {active === "stack" && (
                <PaperSheet pageNumber={1}>
                  <Skills />
                </PaperSheet>
              )}
              {active === "credentials" && (
                <PaperSheet pageNumber={1}>
                  <Certifications />
                </PaperSheet>
              )}
              {active === "contact" && (
                <PaperSheet pageNumber={1}>
                  <Contact />
                </PaperSheet>
              )}
            </>
          ) : (
            <PaperSheet pageNumber={1}>
              <TabSkeleton tab={active} />
            </PaperSheet>
          )}

          {/* "{Tab} loading…" overlay — only mounts after the threshold,
              only while the tab is actually still loading */}
          <TabLoader visible={showLoader} label={activeLabel} />
        </div>
      </main>

      {!focusMode && (
        <Footer
          currentPage={currentPage}
          totalPages={totalPages}
          zoom={zoom}
          onZoomChange={setZoom}
          onEnterFocus={() => setFocusMode(true)}
        />
      )}

      {!focusMode && <PwaChips />}
      {!focusMode && <Assistant />}
      <SearchPalette />

      {/* Focus mode: all chrome is hidden, so float a way back out */}
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-1.5 bg-status-bar text-status-bar-fg font-ui text-[12px] px-3 py-1.5 rounded-full shadow-lg hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            close_fullscreen
          </span>
          Exit focus (Esc)
        </button>
      )}
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;
  if (path === "/admin") return <AdminPage />;
  if (path === "/resume")
    return (
      <RequireAuth>
        <ResumePage />
      </RequireAuth>
    );
  if (path === "/status")
    return (
      <RequireAuth>
        <StatusPage />
      </RequireAuth>
    );
  return <PortfolioDoc />;
}
