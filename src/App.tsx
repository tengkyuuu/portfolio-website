import { useEffect, useMemo, useState } from "react";
import { CONTENT_EVENT, syncFromServer } from "./lib/content";
import { Nav, type TabId, tabs } from "./components/Nav";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Skills } from "./components/Skills";
import { Projects } from "./components/Projects";
import { Certifications } from "./components/Certifications";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";
import { TabLoader } from "./components/TabLoader";
import { TabSkeleton } from "./components/TabSkeleton";
import { useDelayedLoading, useTabReady } from "./lib/tab-ready";
import { AdminPage } from "./pages/AdminPage";
import { ResumePage } from "./pages/ResumePage";

type Theme = "light" | "dark";

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("jvc_theme") as Theme | null;
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    localStorage.setItem("jvc_theme", theme);
  }, [theme]);

  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}

function hashToTab(): TabId {
  const h = window.location.hash.replace(/^#/, "") as TabId;
  return tabs.some((t) => t.id === h) ? h : "top";
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
          Math.max(ZOOM_MIN, z - Math.sign(e.deltaY) * ZOOM_STEP)
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
  const [theme, toggleTheme] = useTheme();
  const [zoom, setZoom] = useZoom();
  const [focusMode, setFocusMode] = useState(false);
  const [active, setActive] = useState<TabId>(() =>
    typeof window !== "undefined" ? hashToTab() : "top"
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
    return () => {
      window.removeEventListener(CONTENT_EVENT, bump);
      window.removeEventListener("storage", bump);
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

  // Reflect tab changes in the URL hash (so deep links + back-button work)
  useEffect(() => {
    if (window.location.hash.replace(/^#/, "") !== active) {
      window.history.replaceState(null, "", `#${active}`);
    }
  }, [active]);

  // Respond to hash navigation (e.g. user pastes a link)
  useEffect(() => {
    const onHash = () => setActive(hashToTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const totalPages = tabs.length;
  const currentPage = useMemo(
    () => tabs.findIndex((t) => t.id === active) + 1,
    [active]
  );
  const activeLabel = useMemo(
    () => tabs.find((t) => t.id === active)?.label ?? "Document",
    [active]
  );

  // Real loading state for the active tab (fonts + images).
  // The loader only flashes if loading lasts longer than the threshold.
  const ready = useTabReady(active);
  const showLoader = useDelayedLoading(!ready);

  return (
    <div className="min-h-screen bg-workspace text-ink">
      {!focusMode && (
        <Nav
          theme={theme}
          onToggleTheme={toggleTheme}
          active={active}
          onChange={setActive}
        />
      )}

      {/* Workspace — gives the paper its breathing room, padded for the nav + status bar.
          Block + mx-auto (not flex centering) so a zoomed-in paper overflows into a
          horizontal scroll instead of getting clipped on the left. */}
      <main
        className={
          "px-3 md:px-8 overflow-x-auto " +
          (focusMode ? "pt-6 pb-6" : "pt-16 pb-12")
        }
      >
        {active === "work" ? (
          /* Projects render as a stack of A4 sheets (Word "Print Layout"),
             so this wrapper is transparent — each project supplies its own
             paper. It still carries id="paper-doc" for word count / read-aloud. */
          <div
            key={`${active}-v${contentVersion}`}
            id="paper-doc"
            style={{ zoom: zoom / 100 }}
            className="paper-enter w-full max-w-[820px] my-2 mx-auto flex flex-col gap-6 md:gap-8 text-ink relative"
          >
            {ready ? (
              <Projects />
            ) : (
              <section className="bg-paper paper-shadow w-full min-h-[1056px] px-6 md:px-14 py-10 md:py-16 flex flex-col">
                <TabSkeleton tab="work" />
              </section>
            )}
            <TabLoader visible={showLoader} label={activeLabel} />
          </div>
        ) : (
          <article
            key={`${active}-v${contentVersion}`}
            id="paper-doc"
            style={{ zoom: zoom / 100 }}
            className="paper-enter bg-paper paper-shadow w-full max-w-[820px] min-h-[1056px] px-6 md:px-14 py-10 md:py-16 my-2 mx-auto flex flex-col text-ink relative overflow-hidden"
          >
            {ready ? (
              <>
                {active === "top" && <Hero />}
                {active === "about" && <About />}
                {active === "stack" && <Skills />}
                {active === "credentials" && <Certifications />}
                {active === "contact" && <Contact />}
              </>
            ) : (
              <TabSkeleton tab={active} />
            )}

            {/* Page number (footer of the paper, Word-style) */}
            <div className="mt-auto pt-12 flex justify-center font-doc italic text-[12px] text-ink-subtle">
              — {currentPage} —
            </div>

            {/* "{Tab} loading…" overlay — only mounts after the threshold,
                only while the tab is actually still loading */}
            <TabLoader visible={showLoader} label={activeLabel} />
          </article>
        )}
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
  if (path === "/resume") return <ResumePage />;
  return <PortfolioDoc />;
}
