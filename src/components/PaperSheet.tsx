/**
 * A document sheet with an A4 minimum height. Longer sections can grow so
 * interactive content never overlaps the footer or disappears off the paper.
 * Print lets the browser paginate the content at natural block boundaries.
 */
export function PaperSheet({
  pageNumber,
  children,
}: {
  pageNumber: number;
  children: React.ReactNode;
}) {
  return (
    <section className="document-sheet bg-paper paper-shadow w-full flex flex-col text-ink relative">
      <div className="document-sheet-content">{children}</div>
      <div className="document-page-footer">
        <span>
          JVC <span className="page-footer-slash">/</span> PORTFOLIO
        </span>
        <span className="font-doc italic">— {pageNumber} —</span>
        <span>Thoughtfully put together.</span>
      </div>
    </section>
  );
}
