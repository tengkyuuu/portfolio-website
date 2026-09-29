import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { breedName, stackView, usePresence, type Peer } from "../lib/presence";
import { DogAvatar } from "./DogAvatar";
import { tabs, type TabId } from "./Nav";
import "./presence.css";

/**
 * The title bar's co-author faces, for visitors: when other people have
 * the portfolio open, a stack of anonymous dogs and how many are here.
 * Alone — or with presence unavailable — it keeps the plain "Viewing"
 * label it always had, so nothing looks broken when there's no one else.
 */
export function PresenceStack({ active }: { active: TabId }) {
  const peers = usePresence(active);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const view = peers ? stackView(peers) : null;

  if (!view || view.others.length === 0) {
    return (
      <span className="office-viewing">
        <span />
        Viewing
      </span>
    );
  }

  const others = view.others.length;
  const label =
    others === 1
      ? "1 other person is viewing this portfolio right now"
      : `${others} other people are viewing this portfolio right now`;

  const tabLabel = (tab?: string) => {
    const match = tabs.find((x) => x.id === tab);
    return match ? t(match.key) : null;
  };

  const describe = (p: Peer) => {
    const where = tabLabel(p.tab);
    return where ? `Reading ${where}` : "Somewhere in here";
  };

  // You go last in the list: it's about who else is here.
  const listed = [...view.others, ...(peers ?? []).filter((p) => p.self)];

  return (
    <div className="presence" ref={wrap}>
      <button
        type="button"
        className="presence-trigger"
        aria-label={`${label}. Show who's here`}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="presence-faces" aria-hidden="true">
          {view.shown.map((p) => (
            <span key={p.key} className="presence-face" title={`Anonymous ${breedName(p.breed)}`}>
              <DogAvatar breed={p.breed} size={26} />
            </span>
          ))}
          {view.overflow > 0 && <span className="presence-more">+{view.overflow}</span>}
        </span>
        <span className="presence-count" aria-hidden="true">
          <b>{view.total}</b> here now
        </span>
        <span className="presence-live" aria-hidden="true" />
      </button>

      {open && (
        <div id={popoverId} className="presence-popover" role="region" aria-label="Who's here">
          <h2>Here now · {view.total}</h2>
          <ul>
            {listed.map((p) => (
              <li key={p.key}>
                <DogAvatar breed={p.breed} size={30} />
                <div>
                  <strong>
                    Anonymous {breedName(p.breed)}
                    {p.self && <em>You</em>}
                  </strong>
                  <span>{describe(p)}</span>
                </div>
              </li>
            ))}
          </ul>
          <p>
            Everyone here is anonymous. Nobody sees who you are — only a dog,
            and which page you're on.
          </p>
        </div>
      )}
    </div>
  );
}
