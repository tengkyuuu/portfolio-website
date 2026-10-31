import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const selection = useRef<Range | null>(null);
  const matched = useRef<{ mark: TextMark; range: Range }[]>([]);
  const visible = marks.filter((mark) => mark.scope === scope);

  useEffect(() => {
    try { localStorage.setItem(HIGHLIGHT_STORAGE, JSON.stringify({ version: 1, marks })); }
    catch { setNotice("Highlights work for this visit; browser storage is unavailable."); }
  }, [marks]);

  useEffect(() => {
    const capture = () => {
      const current = window.getSelection();
      const root = document.getElementById("paper-doc");
      if (!root || !current?.rangeCount || current.isCollapsed) { setSelected(false); return; }
      const range = current.getRangeAt(0);
      if (root.contains(range.startContainer) && root.contains(range.endContainer)) {
        selection.current = range.cloneRange(); setSelected(true);
      }
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && enabled) onClose(); };
    document.addEventListener("selectionchange", capture);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("selectionchange", capture); document.removeEventListener("keydown", key); };
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
    window.getSelection()?.removeAllRanges(); setSelected(false);
  }
  function removeSelected() {
    const selectedRange = selection.current;
    if (!selectedRange) return;
    const ids = new Set(matched.current.filter(({ range }) => range.compareBoundaryPoints(Range.END_TO_START, selectedRange) < 0 && range.compareBoundaryPoints(Range.START_TO_END, selectedRange) > 0).map(({ mark }) => mark.id));
    setMarks((old) => old.filter((mark) => !ids.has(mark.id)));
    setNotice(ids.size ? "Selected highlights removed." : "Select highlighted text to remove it.");
  }
  if (!enabled) return null;
  return createPortal(<aside className="highlight-tools no-print" aria-label="Text highlighting">
    <p>Select document text, then highlight it. <small>Saved only in this browser.</small></p>
    <div onPointerDown={(event) => event.preventDefault()}>
      <button className="doc-button" disabled={!selected} onClick={add}>Highlight selection</button>
      <button className="doc-button" disabled={!selected || !visible.length} onClick={removeSelected}>Remove selected</button>
      <button className="doc-button" disabled={!marks.length} onClick={() => setConfirmClear(true)}>Clear all</button>
      <button className="doc-button" onClick={onClose}>Done</button>
    </div>
    {confirmClear && <div><span>Clear all saved highlights?</span><button className="doc-button" onClick={() => { setMarks([]); setConfirmClear(false); setNotice("Highlights cleared."); }}>Clear highlights</button><button className="doc-button" onClick={() => setConfirmClear(false)}>Cancel</button></div>}
    {notice && <p role="status">{notice}</p>}
  </aside>, document.body);
}
