/**
 * A content-sized document sheet. Sections decide their own page breaks;
 * shared margins and footers keep the document consistent without forcing
 * shorter content to fill a screen of empty paper. Print adds page breaks.
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
      {children}
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
