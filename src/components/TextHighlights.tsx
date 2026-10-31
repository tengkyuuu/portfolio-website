import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Highlighter, Eraser, Trash2, X, Check } from "lucide-react";
import { HIGHLIGHT_STORAGE, blockIdentity, locateQuote, markBlocks, rangeAt, readMarks, selectionMarks, textNodes, type TextMark } from "../lib/highlights";

type HighlightWindow = Window & typeof globalThis & { Highlight?: new (...ranges: Range[]) => unknown };
type HighlightCSS = typeof CSS & { highlights?: Map<string, unknown> };

export function TextHighlights({ scope: chapterScope, enabled, onClose }: { scope: string; enabled: boolean; onClose: () => void }) {
  const [post, setPost] = useState(() => window.location.hash.startsWith("#blog/") ? window.location.hash : "");
  useEffect(() => {
    const update = () => setPost(window.location.hash.startsWith("#blog/") ? window.location.hash : "");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const scope = `${chapterScope}${post}`;
  const [marks, setMarks] = useState(readMarks);
  const [selected, setSelected] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const [removable, setRemovable] = useState(false);
  const toolbar = useRef<HTMLElement>(null);
  const wasConfirming = useRef(false);
  const selection = useRef<Range | null>(null);
  const matched = useRef<{ mark: TextMark; range: Range }[]>([]);
  const visible = marks.filter((mark) => mark.scope === scope);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => { setConfirmClear(false); setSelected(false); setAnchor(null); selection.current = null; }, [scope, enabled]);
  useEffect(() => {
    if (confirmClear) toolbar.current?.querySelector<HTMLButtonElement>(".highlight-confirm button")?.focus();
    else if (wasConfirming.current) toolbar.current?.querySelector<HTMLButtonElement>(marks.length ? '[aria-label="Clear all highlights"]' : '[aria-label="Done highlighting"]')?.focus();
    wasConfirming.current = confirmClear;
  }, [confirmClear, marks.length]);

  useEffect(() => {
    try { localStorage.setItem(HIGHLIGHT_STORAGE, JSON.stringify({ version: 1, marks })); }
    catch { setNotice("Highlights work for this visit; browser storage is unavailable."); }
  }, [marks]);

  useEffect(() => {
    const capture = () => {
      if (document.activeElement?.closest(".highlight-tools")) return;
      const current = window.getSelection();
      const root = document.getElementById("paper-doc");
      if (!root || !current?.rangeCount || current.isCollapsed) { setSelected(false); setAnchor(null); selection.current = null; return; }
      const range = current.getRangeAt(0);
      if (root.contains(range.startContainer) && root.contains(range.endContainer) && range.toString().trim()) {
        selection.current = range.cloneRange(); setSelected(true);
        setRemovable(matched.current.some(({ range: markRange }) => overlaps(markRange, range)));
        const rect = range.getBoundingClientRect();
        const width = Math.min(400, window.innerWidth - 24);
        const top = rect.top >= 82 ? rect.top - 70 : rect.bottom + 12;
        setAnchor(top > 12 && top < window.innerHeight - 120 && window.innerWidth > 600 ? {
          left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)), top,
        } : null);
      } else { setSelected(false); setAnchor(null); selection.current = null; }
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && enabled) onClose(); };
    document.addEventListener("selectionchange", capture);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", capture, true);
    window.addEventListener("resize", capture);
    return () => { document.removeEventListener("selectionchange", capture); document.removeEventListener("keydown", key); window.removeEventListener("scroll", capture, true); window.removeEventListener("resize", capture); };
  }, [enabled, onClose]);

  useEffect(() => {
    let frame = 0;
    let overlays: HTMLDivElement[] = [];
    const clear = () => { overlays.forEach((node) => node.remove()); overlays = []; (CSS as HighlightCSS).highlights?.delete("visitor-marks"); };
    const render = () => {
      clear();
      const root = document.getElementById("paper-doc");
      if (!root) return;
      const blocks = markBlocks(root).map((block, i) => ({ block, id: blockIdentity(block, i), nodes: textNodes(block) }));
      matched.current = [];
      for (const mark of marks.filter((m) => m.scope === scope)) {
        // Prefer the original block; quote/context can recover an inserted block.
        const candidates = blocks.flatMap((block) => {
          const at = locateQuote(block.nodes.map((n) => n.data).join(""), mark);
          return at === null ? [] : [{ ...block, at }];
        });
        const target = candidates.find((block) => block.id === mark.block) || (candidates.length === 1 ? candidates[0] : null);
        if (!target) continue;
        const range = rangeAt(target.nodes, target.at, mark.quote.length);
        if (range) matched.current.push({ mark, range });
      }
      const ranges = matched.current.map((item) => item.range);
      const Highlight = (window as HighlightWindow).Highlight;
      if (Highlight && (CSS as HighlightCSS).highlights) {
        (CSS as HighlightCSS).highlights!.set("visitor-marks", new Highlight(...ranges));
      } else {
        // Progressive fallback: paint behind the text without changing its DOM.
        for (const range of ranges) for (const rect of range.getClientRects()) {
          const node = document.createElement("div");
          node.className = "visitor-highlight-fallback no-print";
          node.setAttribute("aria-hidden", "true");
          Object.assign(node.style, { top: `${rect.top + scrollY}px`, left: `${rect.left + scrollX}px`, width: `${rect.width}px`, height: `${rect.height}px` });
          document.body.append(node); overlays.push(node);
        }
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(render); };
    const observer = new MutationObserver(schedule);
    const root = document.getElementById("paper-doc");
    if (root) observer.observe(root, { childList: true, subtree: true, characterData: true });
    document.addEventListener("document-pagination", schedule);
    window.addEventListener("resize", schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("document-pagination", schedule); window.removeEventListener("resize", schedule); clear(); };
  }, [marks, scope]);

  function add() {
    const root = document.getElementById("paper-doc");
    if (!root || !selection.current) return;
    const additions = selectionMarks(root, selection.current, scope);
    setMarks((old) => {
      const next = [...old];
      for (const mark of additions) {
        if (!next.some((m) => m.scope === mark.scope && m.block === mark.block && m.quote === mark.quote && m.start === mark.start)) next.push(mark);
      }
      return next.slice(-500);
    });
    setNotice(additions.length ? "Highlight saved in this browser." : "Select document text to highlight.");
    window.getSelection()?.removeAllRanges(); setSelected(false); setAnchor(null);
  }
  function removeSelected() {
    const selectedRange = selection.current;
    if (!selectedRange) return;
    const ids = new Set(matched.current.filter(({ range }) => overlaps(range, selectedRange)).map(({ mark }) => mark.id));
    setMarks((old) => old.filter((mark) => !ids.has(mark.id)));
    setNotice(ids.size ? "Selected highlights removed." : "Select highlighted text to remove it.");
    window.getSelection()?.removeAllRanges(); setSelected(false); setAnchor(null);
  }
  if (!enabled) return null;
  return createPortal(<aside ref={toolbar} className={`highlight-tools no-print ${anchor && !confirmClear ? "is-anchored" : ""}`} aria-label="Text highlighting" style={anchor && !confirmClear ? { left: anchor.left, top: anchor.top } : undefined}>
    <div className="highlight-toolbar" onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}>
      {confirmClear ? <div className="highlight-confirm"><strong>Clear {marks.length} saved {marks.length === 1 ? "highlight" : "highlights"}?</strong><span>This removes highlights from every page.</span><div><button className="highlight-action" onClick={() => { setMarks([]); setConfirmClear(false); setNotice("Highlights cleared."); }}>Clear highlights</button><button onClick={() => setConfirmClear(false)}>Keep them</button></div></div> : <>
        {selected ? <>
          <button className="highlight-action" aria-label="Highlight selection" onClick={add}><Highlighter size={17} /><span>Highlight</span></button>
          <button className="highlight-remove" aria-label="Remove selected" disabled={!removable} onClick={removeSelected}><Eraser size={17} /><span>Erase</span></button>
        </> : <div className="highlight-guidance"><span className="highlight-pen"><Highlighter size={19} /></span><div><strong>{notice ? "Your highlights" : "Make a little mark."}</strong><span>{notice || "Select any text to highlight it."}</span></div></div>}
        <div className="highlight-utilities"><span className="highlight-count" title="Highlights on this page">{visible.length}<span className="sr-only"> highlights on this page</span></span><button aria-label="Clear all highlights" title="Clear all highlights" disabled={!marks.length} onClick={() => setConfirmClear(true)}><Trash2 size={16} /></button><button aria-label="Done highlighting" title="Done highlighting (Esc)" onClick={onClose}><X size={17} /></button></div>
      </>}
    </div>
    {!selected && !confirmClear && <div className="highlight-footnote"><Check size={11} />Only you can see your highlights.<span>Esc to close</span></div>}
    <span role="status" className="sr-only">{notice}</span>
  </aside>, document.body);
}

function overlaps(mark: Range, selection: Range): boolean {
  return mark.compareBoundaryPoints(Range.END_TO_START, selection) < 0 && mark.compareBoundaryPoints(Range.START_TO_END, selection) > 0;
}
