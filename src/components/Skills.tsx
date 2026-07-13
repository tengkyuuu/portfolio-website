import { useEffect, useMemo, useState } from "react";
import { getContent, type Project } from "../lib/content";
import { useI18n } from "../lib/i18n";
import { getSkillMeta, skillLogoUrl } from "../lib/skill-catalog";
import { SkillDetailPanel } from "./SkillDetailPanel";

/** Material Symbol per competency group; falls back to a generic chip icon. */
const groupIcon: Record<string, string> = {
  Embedded: "memory",
  Frontend: "code",
  Design: "palette",
  "Tools & Backend": "terminal",
  "AI & Data": "smart_toy",
};

export function Skills() {
  const { t } = useI18n();
  const { skills, projects } = useMemo(() => getContent(), []);
  const total = skills.reduce((n, g) => n + g.items.length, 0);
  const [selected, setSelected] = useState<string | null>(null);

  // Compute related projects up front so lookup at panel-open time is O(1).
  const projectsBySkill = useMemo(() => {
    const map = new Map<string, Project[]>();
    const norm = (s: string) => s.trim().toLowerCase();
    for (const p of projects) {
      const bag = new Set<string>();
      (p.tags ?? []).forEach((t) => bag.add(norm(t)));
      (p.stack ?? []).forEach((s) => bag.add(norm(s)));
      for (const skill of bag) {
        const list = map.get(skill) ?? [];
        list.push(p);
        map.set(skill, list);
      }
    }
    return map;
  }, [projects]);

  // Escape closes the panel; also drop out of the panel when the tab remounts.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-5">
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue">
          {t("section.coreCompetencies")}
        </h2>
        <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider tabular-nums">
          {skills.length} disciplines · {total} skills
        </span>
      </div>

      <p className="font-doc italic text-[13px] text-ink-subtle mb-4">
        Click any chip to open its detail card — a Word info pane with the code
        I actually reach for, why I chose it, and where it shipped.
      </p>

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
                <SkillChip
                  key={item}
                  name={item}
                  onClick={() => setSelected(item)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {selected && (
        <SkillDetailPanel
          name={selected}
          related={
            projectsBySkill.get(selected.trim().toLowerCase()) ?? []
          }
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function SkillChip({ name, onClick }: { name: string; onClick: () => void }) {
  const meta = getSkillMeta(name);
  const [logoOk, setLogoOk] = useState(true);
  const hasLogo = Boolean(meta?.logo && logoOk);

  return (
    <li>
      <button
        onClick={onClick}
        title={`Open ${name}`}
        className="group inline-flex items-center gap-1.5 font-ui text-[12px] font-medium text-ink bg-paper border border-rule rounded-sm pl-1.5 pr-2 py-1 hover:border-word-blue hover:bg-word-blue-light transition-colors"
      >
        {hasLogo && meta?.logo ? (
          <img
            src={skillLogoUrl(meta.logo)}
            alt=""
            aria-hidden="true"
            width={14}
            height={14}
            loading="lazy"
            decoding="async"
            onError={() => setLogoOk(false)}
            className="w-[14px] h-[14px] object-contain shrink-0"
          />
        ) : (
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-ink-subtle group-hover:text-word-blue transition-colors"
            style={{ fontSize: 12 }}
          >
            chip_extraction
          </span>
        )}
        {name}
        {meta?.level && (
          <span
            aria-hidden="true"
            className="ml-1 w-1 h-1 rounded-full bg-word-blue opacity-60 group-hover:opacity-100"
          />
        )}
      </button>
    </li>
  );
}
