import { useState } from "react";
import { ArrowUpRight, FileText, PanelLeftClose, Search } from "lucide-react";
import { visibleTabs, type TabId } from "./Nav";
import { useI18n } from "../lib/i18n";
import { useLocalizedContent } from "../lib/localized-content";

const descriptions: Record<TabId, string> = {
  top: "A little introduction",
  work: "Things I’ve brought to life",
  gallery: "Graphic design, up close",
  about: "The person behind the work",
  stack: "My everyday toolkit",
  credentials: "Learning along the way",
  blog: "Notes, written down",
  contact: "Start a conversation",
};

export function DocumentOutline({
  active,
  onChange,
  onClose,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<"headings" | "pages">("headings");
  const { hero } = useLocalizedContent();
  return (
    <aside
      className="document-outline no-print"
      aria-label="Document navigation"
    >
      <div className="outline-heading">
        <h2>Navigation</h2>
        <button onClick={onClose} aria-label="Close navigation pane">
          <PanelLeftClose size={17} />
        </button>
      </div>
      <button
        className="outline-search"
        onClick={() => window.dispatchEvent(new CustomEvent("jvc:open-search"))}
      >
        <Search size={14} />
        <span>Search document</span>
        <kbd>⌘ K</kbd>
      </button>
      <div className="outline-view" aria-label="Navigation view">
        <button
          aria-pressed={view === "headings"}
          onClick={() => setView("headings")}
        >
          Headings
        </button>
        <button
          aria-pressed={view === "pages"}
          onClick={() => setView("pages")}
        >
          Pages
        </button>
      </div>
      <p className="outline-eyebrow">INSIDE THIS DOCUMENT</p>
      <div
        className={"outline-items " + (view === "pages" ? "outline-pages" : "")}
      >
        {visibleTabs().map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-current={active === tab.id ? "page" : undefined}
            className={"outline-item " + (active === tab.id ? "is-active" : "")}
          >
            {view === "pages" && (
              <span
                className={"mini-page mini-page-" + tab.id}
                aria-hidden="true"
              >
                <FileText size={23} />
                <i />
                <i />
                <i />
              </span>
            )}
            <span className="outline-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{t(tab.key)}</strong>
              <small>{descriptions[tab.id]}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="outline-bottom">
        <div className="outline-person">
          <img src="/no-shades.jpg" alt="" />
          <div>
            <strong>{hero.name.split(" ").slice(0, 2).join(" ")}</strong>
            <span>{hero.location}</span>
          </div>
        </div>
        {hero.available && (
          <a href="#contact" className="outline-availability">
            <span className="availability-dot" />
            {hero.availableText}
            <ArrowUpRight size={13} />
          </a>
        )}
        <p>Made with care. And a few revisions.</p>
      </div>
    </aside>
  );
}
