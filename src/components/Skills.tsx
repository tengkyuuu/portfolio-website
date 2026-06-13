import { useMemo } from "react";
import { getContent } from "../lib/content";

/** Material Symbol per competency group; falls back to a generic chip icon. */
const groupIcon: Record<string, string> = {
  Embedded: "memory",
  Frontend: "code",
  Design: "palette",
  "Tools & Backend": "terminal",
  "AI & Data": "smart_toy",
};

export function Skills() {
  const { skills } = useMemo(() => getContent(), []);
  const total = skills.reduce((n, g) => n + g.items.length, 0);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-5">
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue">
          Core Competencies
        </h2>
        <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider tabular-nums">
          {skills.length} disciplines · {total} skills
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.map((group) => (
          <div
            key={group.label}
            className="border border-rule rounded-sm bg-row-alt/50 p-4 break-inside-avoid"
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className="material-symbols-outlined text-word-blue"
                style={{ fontSize: 18 }}
              >
                {groupIcon[group.label] ?? "category"}
              </span>
              <h3 className="font-doc text-[16px] font-bold text-ink leading-none">
                {group.label}
              </h3>
              <span className="ml-auto font-ui text-[11px] text-ink-subtle tabular-nums">
                {group.items.length}
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="font-ui text-[12px] font-medium text-ink bg-paper border border-rule rounded-sm px-2.5 py-1"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
