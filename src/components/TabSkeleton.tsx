import type { TabId } from "./Nav";

function Bar({ className = "" }: { className?: string }) {
  return <div className={"rounded-sm bg-rule animate-pulse " + className} />;
}

function Block({ className = "" }: { className?: string }) {
  return <div className={"rounded-sm bg-rule animate-pulse " + className} />;
}

/**
 * Word-style content placeholder rendered while a tab's data is loading.
 * Layout roughly mirrors the real tab so the page doesn't jump on reveal.
 */
export function TabSkeleton({ tab }: { tab: TabId }) {
  if (tab === "top") {
    return (
      <div className="flex flex-col gap-8">
        <header className="border-b-2 border-rule pb-6 flex justify-between items-start gap-6">
          <div className="flex-1 space-y-3">
            <Bar className="h-3 w-32" />
            <Bar className="h-12 w-3/4" />
            <Bar className="h-6 w-2/3" />
            <div className="flex flex-wrap gap-3 mt-2">
              <Bar className="h-3 w-44" />
              <Bar className="h-3 w-20" />
              <Bar className="h-3 w-28" />
            </div>
          </div>
          <Block className="w-28 h-28 md:w-36 md:h-36 rounded-full shrink-0" />
        </header>
        <Bar className="h-6 w-5/6" />
        <div className="space-y-2">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-11/12" />
          <Bar className="h-4 w-3/4" />
        </div>
        <div className="space-y-2 pt-2">
          <Bar className="h-3 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-end gap-3 pt-1">
              <Bar className="h-4 w-1/3" />
              <div className="flex-1 border-b border-dotted border-rule mb-1.5" />
              <Bar className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "work") {
    return (
      <div className="space-y-8">
        {/* Title block */}
        <div className="space-y-3 border-b-2 border-rule pb-3">
          <Bar className="h-10 w-2/3" />
          <Bar className="h-3 w-1/2" />
        </div>
        {/* TOC */}
        <div>
          <Bar className="h-3 w-40 mb-4" />
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-end gap-3">
                <Bar className="h-4 w-2/5" />
                <div className="flex-1 border-b border-dotted border-rule mb-1.5" />
                <Bar className="h-4 w-6" />
              </div>
            ))}
          </div>
        </div>
        {/* One project entry preview */}
        <div className="space-y-4">
          <div className="flex justify-between items-baseline border-b border-rule pb-2">
            <Bar className="h-7 w-2/5" />
            <Bar className="h-3 w-32" />
          </div>
          <Block className="w-full aspect-[16/9]" />
          <Bar className="h-3 w-3/4 mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <Bar className="h-3 w-24" />
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-11/12" />
              <Bar className="h-4 w-2/3" />
            </div>
            <div className="space-y-2">
              <Bar className="h-3 w-24" />
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-10/12" />
              <Bar className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "stack") {
    return (
      <div className="space-y-6">
        <Bar className="h-3 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-5 w-1/3" />
              {Array.from({ length: 4 }).map((_, j) => (
                <Bar key={j} className="h-3 w-3/4" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Generic document skeleton — used for About, Credentials, Contact
  return (
    <div className="space-y-6">
      <Bar className="h-3 w-40" />
      <Bar className="h-8 w-2/3" />
      <div className="space-y-2 pt-2">
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-11/12" />
        <Bar className="h-4 w-3/4" />
      </div>
      <div className="space-y-2 pt-2">
        <Bar className="h-4 w-5/6" />
        <Bar className="h-4 w-2/3" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Bar className="h-3 w-20" />
            <Bar className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
