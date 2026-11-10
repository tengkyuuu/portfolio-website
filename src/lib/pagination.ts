/** Pure geometry, shared by layout and regression checks. */
export function pagePlacement(top: number, height: number, pageHeight: number, gap: number, inset: number, bottom: number) {
  const stride = pageHeight + gap;
  const page = Math.max(0, Math.floor(top / stride));
  const start = page * stride + inset;
  const end = page * stride + pageHeight - bottom;
  if (top < start) return start - top;
  if (height <= pageHeight - inset - bottom && top + height > end + 0.5)
    return (page + 1) * stride + inset - top;
  return 0;
}

/** Word's "Shrink One Page": the largest scale in [min, 1] at which the
 * content fits. Content that cannot fit even at `min` stays at full size and
 * flows onto a second sheet — small *and* split is the worst of both. */
export function fitScale(fits: (scale: number) => boolean, min: number): number {
  if (fits(1)) return 1;
  if (!fits(min)) return 1;
  let low = min, high = 1;
  for (let i = 0; i < 6; i++) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid; else high = mid;
  }
  return Math.floor(low * 1000) / 1000;
}

/** Where sheet `page` of a vertical flow sits once sheets are laid out
 * `columns` to a row, as an offset from its place in the single column. */
export function pageOffset(page: number, columns: number, columnStride: number, stride: number) {
  return { x: (page % columns) * columnStride, y: (Math.floor(page / columns) - page) * stride };
}

/** Undo every adjustment a previous pass made, so geometry is measured clean. */
export function resetFlow(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-page-shift]").forEach((el) => { el.style.translate = ""; delete el.dataset.pageShift; });
  root.querySelectorAll<HTMLElement>("[data-page-space]").forEach((el) => { el.style.marginTop = el.dataset.pageSpace || ""; delete el.dataset.pageSpace; });
  root.querySelectorAll<HTMLElement>("[data-flow-split], [data-flow-container], [data-flow-leaf]").forEach((el) => { delete el.dataset.flowSplit; delete el.dataset.flowContainer; delete el.dataset.flowLeaf; });
}

/** Scales `target` (a block inside `root`) down just far enough for the whole
 * flow to sit on one sheet. Returns the scale applied. */
export function fitToPage(root: HTMLElement, target: HTMLElement, pageHeight: number, bottom: number, min: number): number {
  resetFlow(root);
  const apply = (scale: number) => { target.style.zoom = scale === 1 ? "" : String(scale); };
  const fits = (scale: number) => {
    apply(scale);
    const box = root.getBoundingClientRect();
    return box.height / (box.width / root.offsetWidth || 1) + bottom - 0.5 <= pageHeight;
  };
  const scale = min < 1 ? fitScale(fits, min) : 1;
  apply(scale);
  return scale;
}

/** Paginates a single mounted content tree by spacing semantic blocks over
 * fixed paper backdrops. No clones, portals between pages, or hidden copies. */
export function paginateFlow(root: HTMLElement, pageHeight: number, gap: number, inset: number, bottom: number): number {
  resetFlow(root);
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    table.dataset.flowTable = "";
    table.style.setProperty("--table-columns", String(Array.from(table.rows[0]?.cells || []).filter((cell) => getComputedStyle(cell).display !== "none").length || 1));
  });
  const origin = root.parentElement!.getBoundingClientRect().top;
  const scale = root.getBoundingClientRect().width / root.offsetWidth || 1;
  const available = pageHeight - inset - bottom;
  const rect = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { top: (r.top - origin) / scale, height: r.height / scale };
  };
  const visit = (el: HTMLElement) => {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.position === "absolute" || style.position === "fixed" || el.matches(".sr-only, dialog, script, style")) return;
    const { top, height } = rect(el);
    if (height < 0.5) return;
    const closed = el.closest("details:not([open])");
    if (closed && el !== closed && !el.closest("summary")) return;
    // Keep headings with the first lines of the following content.
    const following = el.nextElementSibling as HTMLElement | null;
    const keep = /^H[1-6]$/.test(el.tagName) && following ? Math.min(65, rect(following).height) : 0;
    const shift = pagePlacement(top, height + keep, pageHeight, gap, inset, bottom);
    const sequential = el.matches("ol, ul, nav.project-contents, .blog-prose, .about-summary, .github-panel, .project-detail-anchor, section");
    const fragments = Boolean(el.querySelector(":scope > [data-flow-fragment]"));
    const fragmentParagraph = fragments && shift > 0 && height > available / 3;
    if (height + keep <= available && !(sequential && shift > 0) && !fragmentParagraph) {
      // A placed block sits wholly on one sheet, so it can move with that sheet.
      el.dataset.flowLeaf = "";
      if (shift > 0) {
        el.dataset.pageSpace = el.style.marginTop;
        let margin = (parseFloat(style.marginTop) || 0) + shift;
        el.style.marginTop = `${margin}px`;
        // Collapsed sibling margins can absorb part of the requested space.
        // Correct against geometry instead of assuming margins add linearly.
        for (let attempt = 0; attempt < 2; attempt++) {
          const missing = top + shift - rect(el).top;
          if (Math.abs(missing) < 0.5) break;
          margin += missing;
          el.style.marginTop = `${margin}px`;
        }
      }
      return;
    }
    if (el.querySelector(":scope > [data-flow-fragment]")) el.dataset.flowSplit = "";
    const children = Array.from(el.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    // Oversized containers flow at their child boundaries. Tables retain their
    // native rows; grids are single-column when they need to span sheets.
    if (children.length) {
      if (style.display === "block" && !el.matches("table,thead,tbody,tfoot,tr")) el.dataset.flowContainer = "";
      if (style.display.includes("grid")) el.dataset.flowSplit = "";
      children.sort((a, b) => rect(a).top - rect(b).top || a.getBoundingClientRect().left - b.getBoundingClientRect().left).forEach(visit);
    } else el.dataset.flowLeaf = "";
  };
  Array.from(root.children).forEach((el) => { if (el instanceof HTMLElement) visit(el); });
  const height = (root.getBoundingClientRect().bottom - origin) / scale;
  return Math.max(1, Math.ceil((height + bottom + gap - 0.5) / (pageHeight + gap)));
}

/** Lays an already-paginated flow out `columns` sheets to a row, the way Word
 * does when zoomed out. The flow stays one continuous column in the DOM; each
 * placed block is translated to the sheet it belongs to. Run after
 * `paginateFlow`, which marks the blocks and clears earlier translations. */
export function spreadFlow(root: HTMLElement, pageHeight: number, gap: number, columns: number, columnStride: number) {
  if (columns < 2) return;
  const stride = pageHeight + gap;
  const origin = root.parentElement!.getBoundingClientRect().top;
  const scale = root.getBoundingClientRect().width / root.offsetWidth || 1;
  const moves: Array<[HTMLElement, number, number]> = [];
  root.querySelectorAll<HTMLElement>("[data-flow-leaf]").forEach((el) => {
    const box = el.getBoundingClientRect();
    const page = Math.max(0, Math.floor(((box.top - origin) / scale + 1) / stride));
    if (!page) return;
    // A block inside a shrunk-to-fit ancestor measures in that ancestor's units.
    const local = (el.offsetWidth ? box.width / el.offsetWidth : scale) / scale || 1;
    const { x, y } = pageOffset(page, columns, columnStride, stride);
    moves.push([el, x / local, y / local]);
  });
  for (const [el, x, y] of moves) { el.dataset.pageShift = ""; el.style.translate = `${x}px ${y}px`; }
}
