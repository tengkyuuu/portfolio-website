import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fitToPage, paginateFlow, spreadFlow } from "../lib/pagination";

/** Smallest scale "shrink to one page" will use before giving up and letting
 * the content continue on a second sheet. */
const FIT_MIN = 0.8;

/** One mounted content flow over equal A4 sheets. Continuations preserve state.
 *
 * Inside a `.document-pages` grid the sheets also sit side by side when the
 * zoom leaves room, as Word's Print Layout does: the grid's tracks say how
 * many fit, a multi-sheet flow spans that many, and its blocks are moved onto
 * their sheets. A `[data-fit-page]` block in the flow is shrunk, within
 * reason, so that the flow needs only one sheet. */
export function PaperSheet({ pageNumber, children }: { pageNumber: number; children: ReactNode }) {
  const group = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ count: 1, height: 1123, gap: 28, width: 0, columns: 1 });
  const [startPage, setStartPage] = useState(pageNumber);
  useLayoutEffect(() => {
    const wrapper = group.current, flow = content.current;
    if (!wrapper || !flow || typeof ResizeObserver === "undefined") return;
    const parent = wrapper.parentElement;
    let frame = 0;
    let disposed = false;
    let previous = "";
    const signature = () => `${parent?.clientWidth}|${wrapper.offsetWidth}|${flow.offsetHeight}`;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed || !wrapper.offsetWidth || window.matchMedia("print").matches) return;
        // The grid's resolved tracks are the single source for sheet width
        // and for how many sheets fit in a row at the current zoom.
        const tracks = parent ? getComputedStyle(parent).gridTemplateColumns.split(" ").map(parseFloat).filter((n) => !Number.isNaN(n)) : [];
        const track = tracks.find((n) => n > 0);
        const width = Math.floor(track ?? wrapper.offsetWidth);
        const fitting = track ? tracks.length : 1;
        const height = Math.round(width * 1123 / 794);
        const gap = 28;
        const inset = width < 600 ? 23 : 37;
        const bottom = width < 600 ? 54 : 64;
        wrapper.style.setProperty("--sheet-height", `${height}px`);
        wrapper.style.setProperty("--sheet-gap", `${gap}px`);
        if (track) wrapper.style.setProperty("--sheet-width", `${width}px`);
        const target = flow.querySelector<HTMLElement>("[data-fit-page]");
        if (target) fitToPage(flow, target, height, bottom, width < 600 ? 1 : FIT_MIN);
        const count = paginateFlow(flow, height, gap, inset, bottom);
        const columns = Math.min(count, fitting);
        spreadFlow(flow, height, gap, columns, width + gap);
        wrapper.dataset.pageCount = String(count);
        setLayout((old) => old.count === count && old.height === height && old.width === width && old.columns === columns ? old : { count, height, gap, width, columns });
        previous = signature();
        document.dispatchEvent(new Event("document-pagination"));
        // Observe actual controls/content rather than our computed margins.
        mutations.observe(flow, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["open", "src", "class", "hidden"] });
      });
    };
    const observer = new ResizeObserver(() => {
      if (signature() !== previous) { previous = signature(); measure(); }
    });
    const mutations = new MutationObserver(measure);
    observer.observe(wrapper);
    observer.observe(flow);
    // Zoom changes the room around the sheets without resizing the sheets.
    if (parent) observer.observe(parent);
    mutations.observe(flow, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["open", "src", "class", "hidden"] });
    flow.addEventListener("load", measure, true);
    flow.addEventListener("toggle", measure, true);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(() => { if (!disposed) measure(); });
    measure();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect(); flow.removeEventListener("load", measure, true); flow.removeEventListener("toggle", measure, true); window.removeEventListener("resize", measure); };
  }, [children]);
  useEffect(() => {
    const renumber = () => {
      const parent = group.current?.parentElement;
      if (!parent) return;
      const groups = Array.from(parent.querySelectorAll<HTMLElement>("[data-sheet-group]"));
      let n = Number(groups[0]?.dataset.firstPage || 1);
      for (const item of groups) {
        if (item === group.current) break;
        n += Number(item.dataset.pageCount || 1);
      }
      if (group.current) group.current.dataset.startPage = String(n);
      setStartPage(n);
    };
    document.addEventListener("document-pagination", renumber);
    renumber();
    return () => document.removeEventListener("document-pagination", renumber);
  }, []);
  const { count, height, gap, width, columns } = layout;
  const rows = Math.ceil(count / columns);
  const spread = columns > 1;
  const sheetStyle = (i: number): CSSProperties => spread
    ? { top: Math.floor(i / columns) * (height + gap), left: (i % columns) * (width + gap), width, right: "auto", height }
    : { top: i * (height + gap), height };
  return <div ref={group} className={"sheet-flow" + (spread ? " is-spread" : "")} data-sheet-group="" data-first-page={pageNumber} data-page-count={count} data-start-page={startPage}
    style={{ height: rows * (height + gap) - gap, gridColumn: spread ? `span ${columns}` : undefined }}>
    {Array.from({ length: count }, (_, i) => <section key={i} className="document-sheet paper-surface" aria-label={`Page ${startPage + i}`} style={sheetStyle(i)}>
      <footer className="document-page-footer"><span>JVC / PORTFOLIO</span><span>— {startPage + i} —</span><span>Thoughtfully put together.</span></footer>
    </section>)}
    <div ref={content} className="document-sheet-content sheet-flow-content">{children}</div>
  </div>;
}
