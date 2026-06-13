import { useMemo } from "react";
import { getContent } from "../lib/content";

export function Skills() {
  const { skills } = useMemo(() => getContent(), []);

  return (
    <section>
      <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
        Core Competencies
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        {skills.map((group) => (
          <div key={group.label}>
            <h3 className="font-doc text-[16px] font-bold text-ink mb-2">{group.label}</h3>
            <ul className="bullet-blue font-doc text-[15px] text-ink list-disc pl-5 space-y-1">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
