export type TextMark = { id: string; scope: string; block: string; quote: string; prefix: string; suffix: string; start: number };
export const HIGHLIGHT_STORAGE = "jvc_text_marks_v1";

/** Require unambiguous context. Never guess between repeated phrases. */
export function locateQuote(text: string, mark: Pick<TextMark, "quote" | "prefix" | "suffix" | "start">): number | null {
  if (!mark.quote) return null;
  const matches: number[] = [];
  let at = text.indexOf(mark.quote);
  while (at !== -1) {
    if (text.slice(Math.max(0, at - mark.prefix.length), at) === mark.prefix &&
      text.slice(at + mark.quote.length, at + mark.quote.length + mark.suffix.length) === mark.suffix) matches.push(at);
    at = text.indexOf(mark.quote, at + 1);
  }
  return matches.length === 1 ? matches[0] : null;
}

export function readMarks(): TextMark[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIGHLIGHT_STORAGE) || "null");
    if (parsed?.version !== 1 || !Array.isArray(parsed.marks)) return [];
    return parsed.marks.filter((m: Partial<TextMark>) => m && [m.id, m.scope, m.block, m.quote, m.prefix, m.suffix].every((v) => typeof v === "string") && Number.isFinite(m.start)).slice(0, 500);
  } catch { return []; }
}

const excluded = "button,input,textarea,select,summary,dialog,.no-print,[aria-hidden=true],.material-symbols-outlined,.document-page-footer";
function annotationOwner(node: Node): HTMLElement | null {
  const parent = node.parentElement;
  if (!parent || parent.closest(excluded)) return null;
  return parent.closest<HTMLElement>("p,h1,h2,h3,h4,h5,h6,li,td,th,dt,dd,figcaption,.contents-title") || parent.closest<HTMLElement>("a,span,label,div,section,article");
}

export function textNodes(block: HTMLElement): Text[] {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => annotationOwner(node) === block ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

export function markBlocks(root: HTMLElement): HTMLElement[] {
  const blocks = new Set<HTMLElement>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const owner = annotationOwner(node);
    if (owner && node.textContent?.trim()) blocks.add(owner);
  }
  return [...blocks];
}

export function rangeAt(nodes: Text[], start: number, length: number): Range | null {
  const range = document.createRange();
  let offset = 0, began = false;
  for (const node of nodes) {
    const end = offset + node.length;
    if (!began && start < end) { range.setStart(node, Math.max(0, start - offset)); began = true; }
    if (began && start + length <= end) { range.setEnd(node, start + length - offset); return range; }
    offset = end;
  }
  return null;
}

export function selectionMarks(root: HTMLElement, selection: Range, scope: string): TextMark[] {
  return markBlocks(root).flatMap((block, index) => {
    const nodes = textNodes(block);
    let offset = 0, start = -1, end = 0;
    for (const node of nodes) {
      if (selection.intersectsNode(node)) {
        const from = selection.startContainer === node ? selection.startOffset : 0;
        const to = selection.endContainer === node ? selection.endOffset : node.length;
        if (to > from) { if (start === -1) start = offset + from; end = offset + to; }
      }
      offset += node.length;
    }
    const text = nodes.map((node) => node.data).join("");
    if (start === -1 || !text.slice(start, end).trim()) return [];
    return [{ id: crypto.randomUUID(), scope, block: blockIdentity(block, index), start,
      quote: text.slice(start, end), prefix: text.slice(Math.max(0, start - 32), start), suffix: text.slice(end, end + 32) }];
  });
}

export function blockIdentity(block: HTMLElement, index: number): string {
  const anchor = block.closest("[id]")?.id || "document";
  return `${anchor}:${block.tagName}:${index}`;
}
