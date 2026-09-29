import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Images, X } from "lucide-react";
import { getContent, type Design } from "../lib/content";
import {
  designIdFromHash,
  filterDesigns,
  galleryCategories,
  paginate,
  publicDesigns,
} from "../lib/gallery";
import { safeHref } from "../lib/inline";
import { chapterNumber } from "./Nav";
import { PaperSheet } from "./PaperSheet";
import { ChapterHeading } from "./ui/ChapterHeading";
import "./gallery.css";

/** First sheet carries the chapter heading, so it holds two rows, not three. */
const FIRST_SHEET = 6;
const PER_SHEET = 9;

/**
 * Gallery — graphic design work, one matted figure per piece.
 *
 * Tiles are square mats with the work contained inside, never cropped: a
 * poster and a wordmark have nothing in common but the frame. Selecting
 * one opens a native <dialog> — focus trap, Esc and an inert page come
 * with it. The open piece is mirrored into the hash (#gallery/<id>) with
 * replaceState, so it can be linked to without every open and close
 * stacking up history or tripping the app's scroll-to-top on hashchange.
 */
export function Gallery() {
  const designs = useMemo(() => publicDesigns(getContent().designs), []);
  const categories = useMemo(() => galleryCategories(designs), [designs]);
  const [category, setCategory] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(() =>
    designIdFromHash(window.location.hash)
  );

  const shown = useMemo(() => filterDesigns(designs, category), [designs, category]);
  const sheets = paginate(shown, FIRST_SHEET, PER_SHEET);

  // Search jumps here with a real hash change.
  useEffect(() => {
    const onHash = () => setOpenId(designIdFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const open = useCallback((id: string | null) => {
    setOpenId(id);
    window.history.replaceState(null, "", id ? `#gallery/${encodeURIComponent(id)}` : "#gallery");
  }, []);

  // Figure numbers follow the full gallery, not the filter, so "Fig. 7"
  // means the same piece whichever chip is pressed.
  const figureOf = (d: Design) => designs.indexOf(d) + 1;
  const openIndex = shown.findIndex((d) => d.id === openId);
  // A deep link to a piece hidden by the filter still opens it.
  const lightboxList = openIndex >= 0 ? shown : designs;
  const lightboxIndex = lightboxList.findIndex((d) => d.id === openId);

  return (
    <>
      {sheets.map((sheet, page) => (
        <PaperSheet key={page} pageNumber={page + 1}>
          {page === 0 ? (
            <>
              <ChapterHeading
                number={chapterNumber("gallery")}
                eyebrow="GRAPHIC DESIGN"
                title={
                  <>
                    Made to be <em>looked at.</em>
                  </>
                }
                description="Posters, marks, and pieces made for a screen. Open any one to see it full size."
              >
                <Images />
              </ChapterHeading>
              {categories.length > 1 && (
                <div className="gallery-filters" role="group" aria-label="Filter by category">
                  {[null, ...categories].map((c) => (
                    <button
                      key={c ?? "all"}
                      type="button"
                      aria-pressed={category === c}
                      onClick={() => setCategory(c)}
                    >
                      {c ?? "All"}
                      <span aria-hidden="true">
                        {c ? filterDesigns(designs, c).length : designs.length}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="document-eyebrow gallery-continued">GRAPHIC DESIGN (CONT.)</p>
          )}

          {sheet.length === 0 ? (
            <p className="gallery-empty">Nothing hung here yet.</p>
          ) : (
            <ul className="gallery-grid" aria-label={page === 0 ? "Designs" : `Designs, page ${page + 1}`}>
              {sheet.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="gallery-tile"
                    onClick={() => open(d.id)}
                    aria-label={`Open ${d.title} full size`}
                  >
                    <span className="gallery-mat">
                      <img src={d.image} alt={d.alt} loading="lazy" decoding="async" />
                    </span>
                    <span className="gallery-caption">
                      <span className="gallery-fig">Fig. {figureOf(d)}</span>
                      <span className="gallery-title">{d.title}</span>
                      {(d.category || d.year) && (
                        <span className="gallery-sub">
                          {[d.category, d.year].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PaperSheet>
      ))}

      {lightboxIndex >= 0 && (
        <Lightbox
          design={lightboxList[lightboxIndex]}
          figure={figureOf(lightboxList[lightboxIndex])}
          position={lightboxIndex + 1}
          total={lightboxList.length}
          onPrev={
            lightboxIndex > 0 ? () => open(lightboxList[lightboxIndex - 1].id) : undefined
          }
          onNext={
            lightboxIndex < lightboxList.length - 1
              ? () => open(lightboxList[lightboxIndex + 1].id)
              : undefined
          }
          onClose={() => open(null)}
        />
      )}
    </>
  );
}

function Lightbox({
  design,
  figure,
  position,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  design: Design;
  figure: number;
  position: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const link = safeHref(design.link);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    returnFocus.current = document.activeElement;
    if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      // Back to the tile that opened it.
      (returnFocus.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  return (
    <dialog
      ref={ref}
      className="gallery-lightbox no-print"
      aria-labelledby="gallery-lightbox-title"
      // Esc fires "cancel"; route it through our state so the hash follows.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gallery-lightbox-body">
        <figure>
          <img key={design.id} src={design.image} alt={design.alt} decoding="async" />
        </figure>
        <aside>
          <p className="document-eyebrow">
            FIG. {figure} <span>/</span> {position} OF {total}
          </p>
          <h2 id="gallery-lightbox-title">{design.title}</h2>
          {design.caption && <p className="gallery-lightbox-caption">{design.caption}</p>}
          <dl>
            {design.category && (
              <>
                <dt>Type</dt>
                <dd>{design.category}</dd>
              </>
            )}
            {design.year && (
              <>
                <dt>Year</dt>
                <dd>{design.year}</dd>
              </>
            )}
            {design.tools && design.tools.length > 0 && (
              <>
                <dt>Made with</dt>
                <dd>{design.tools.join(", ")}</dd>
              </>
            )}
          </dl>
          {link && (
            <a className="gallery-lightbox-link" href={link} target="_blank" rel="noreferrer">
              See the full project <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          )}
          <div className="gallery-lightbox-nav">
            <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous design">
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next design">
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </aside>
      </div>
      <button type="button" className="gallery-lightbox-close" onClick={onClose} aria-label="Close">
        <X size={18} aria-hidden="true" />
      </button>
    </dialog>
  );
}
