import { nowGroups, nowUpdated } from "../lib/data";
import { useI18n } from "../lib/i18n";

/**
 * Now — a standing answer to "what are you working on?", dated so a reader
 * can tell how stale it is.
 *
 * It was its own ribbon tab. It reads better as the closing page of About:
 * it is context about the person, not a separate document, and the tab it
 * occupied was one past comfortable. The live GitHub panel that used to
 * sit under it moved the other way, to the cover page — see GitHubActivity.
 */
export function Now() {
  const { t } = useI18n();

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-4">
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue">
          {t("nav.now")}
        </h2>
        <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider">
          Reviewed {nowUpdated}
        </span>
      </div>

      <p className="font-doc italic text-[13px] text-ink-subtle mb-5">
        Kept short, and dated so you can tell how stale it is. If the date
        is old, so is everything under it.
      </p>

      {/* ── What I'm on ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        {nowGroups.map((group) => (
          <div
            key={group.label}
            className="border border-rule rounded-sm bg-row-alt/60 overflow-hidden break-inside-avoid"
          >
            <header className="flex items-center gap-2 px-3 py-2 border-b border-rule bg-paper/70">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-word-blue"
                style={{ fontSize: 17 }}
              >
                {group.icon}
              </span>
              <h3 className="font-doc text-[15px] font-bold text-ink leading-none">
                {group.label}
              </h3>
              <span className="ml-auto font-ui text-[10px] text-ink-subtle tabular-nums">
                {group.items.length}
              </span>
            </header>
            <ul className="px-3 py-2 space-y-2.5">
              {group.items.map((item) => (
                <li key={item.name}>
                  <div className="font-ui text-[12.5px] font-semibold text-ink">
                    {item.name}
                  </div>
                  <p className="font-doc text-[13px] leading-[1.6] text-ink-muted">
                    {item.note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
