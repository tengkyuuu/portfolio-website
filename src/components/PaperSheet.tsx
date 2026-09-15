/**
 * One sheet of the document's bond paper — 820 × 1056 px, the same size on
 * every tab.
 *
 * This used to be a private helper inside Projects, which is why Projects
 * was the only tab that paginated: everywhere else the tab rendered into a
 * single sheet that simply grew, so a long tab produced one absurdly tall
 * page next to everyone else's A4. Sharing the component means a tab with
 * more content than fits spills onto a second sheet of identical size
 * rather than stretching the first one.
 *
 * min-h rather than h: content taller than the page still extends it
 * instead of being clipped, exactly like a Word document does between
 * page breaks.
 */
export function PaperSheet({
  pageNumber,
  children,
}: {
  pageNumber: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-paper paper-shadow w-full min-h-[1056px] px-6 md:px-14 py-10 md:py-16 flex flex-col text-ink relative overflow-hidden">
      {children}
      <div className="mt-auto pt-12 flex justify-center font-doc italic text-[12px] text-ink-subtle">
        — {pageNumber} —
      </div>
    </section>
  );
}
