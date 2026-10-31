import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { paginateFlow } from "../lib/pagination";

/** One mounted content flow over equal A4 sheets. Continuations preserve state. */
export function PaperSheet({ pageNumber, children }: { pageNumber: number; children: ReactNode }) {
  const group = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ count: 1, height: 1123, gap: 28 });
  const [startPage, setStartPage] = useState(pageNumber);
  useLayoutEffect(() => {
    const wrapper = group.current, flow = content.current;
    if (!wrapper || !flow || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    let disposed = false;
    let previousWidth = 0;
    let previousContentHeight = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed || !wrapper.offsetWidth || window.matchMedia("print").matches) return;
        const width = wrapper.offsetWidth;
        const height = Math.round(width * 1123 / 794);
        const gap = 28;
        const inset = width < 600 ? 23 : 37;
        const bottom = width < 600 ? 54 : 64;
        wrapper.style.setProperty("--sheet-height", `${height}px`);
        wrapper.style.setProperty("--sheet-gap", `${gap}px`);
        const count = paginateFlow(flow, height, gap, inset, bottom);
        wrapper.dataset.pageCount = String(count);
        setLayout((old) => old.count === count && old.height === height ? old : { count, height, gap });
        previousContentHeight = flow.offsetHeight;
        document.dispatchEvent(new Event("document-pagination"));
        // Observe actual controls/content rather than our computed margins.
        mutations.observe(flow, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["open", "src", "class", "hidden"] });
      });
    };
    const observer = new ResizeObserver(() => {
      if (wrapper.offsetWidth !== previousWidth || flow.offsetHeight !== previousContentHeight) {
        previousWidth = wrapper.offsetWidth; previousContentHeight = flow.offsetHeight; measure();
      }
    });
    const mutations = new MutationObserver(measure);
    observer.observe(wrapper);
    observer.observe(flow);
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
  return <div ref={group} className="sheet-flow" data-sheet-group="" data-first-page={pageNumber} data-page-count={layout.count} data-start-page={startPage}
    style={{ height: layout.count * (layout.height + layout.gap) - layout.gap }}>
    {Array.from({ length: layout.count }, (_, i) => <section key={i} className="document-sheet paper-surface" aria-label={`Page ${startPage + i}`}
      style={{ top: i * (layout.height + layout.gap), height: layout.height }}>
      <footer className="document-page-footer"><span>JVC / PORTFOLIO</span><span>— {startPage + i} —</span><span>Thoughtfully put together.</span></footer>
    </section>)}
    <div ref={content} className="document-sheet-content sheet-flow-content">{children}</div>
  </div>;
}
