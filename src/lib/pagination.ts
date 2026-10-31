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

/** Paginates a single mounted content tree by spacing semantic blocks over
 * fixed paper backdrops. No clones, portals between pages, or hidden copies. */
export function paginateFlow(root: HTMLElement, pageHeight: number, gap: number, inset: number, bottom: number): number {
  const adjusted = root.querySelectorAll<HTMLElement>("[data-page-space]");
  adjusted.forEach((el) => { el.style.marginTop = el.dataset.pageSpace || ""; delete el.dataset.pageSpace; });
  root.querySelectorAll<HTMLElement>("[data-flow-split], [data-flow-container]").forEach((el) => { delete el.dataset.flowSplit; delete el.dataset.flowContainer; });
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    table.dataset.flowTable = "";
    table.style.setProperty("--table-columns", String(Array.from(table.rows[0]?.cells || []).filter((cell) => getComputedStyle(cell).display !== "none").length || 1));
  });
  const origin = root.parentElement!.getBoundingClientRect().top;
  const scale = root.parentElement!.getBoundingClientRect().width / root.parentElement!.offsetWidth || 1;
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
    }
  };
  Array.from(root.children).forEach((el) => { if (el instanceof HTMLElement) visit(el); });
  const height = (root.getBoundingClientRect().bottom - origin) / scale;
  return Math.max(1, Math.ceil((height + bottom + gap - 0.5) / (pageHeight + gap)));
}
