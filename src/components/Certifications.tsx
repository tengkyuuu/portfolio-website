import { useMemo } from "react";
import { getContent } from "../lib/content";

export function Certifications() {
  const { certs, timeline } = useMemo(() => getContent(), []);

  return (
    <section className="space-y-10">
      {/* Education + Experience */}
      <div>
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
          Education &amp; Experience
        </h2>
        <ul className="space-y-4 font-doc text-[15px]">
          {timeline.map((entry) => (
            <li
              key={entry.title}
              className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1"
            >
              <div className="flex-1">
                <h3 className="font-bold text-ink leading-snug">{entry.title}</h3>
                <p className="text-ink-muted text-[14px]">{entry.org}</p>
                <p className="text-ink-muted text-[14px] mt-1 leading-relaxed">
                  {entry.blurb}
                </p>
              </div>
              <span className="font-ui text-[12px] text-ink-subtle uppercase tracking-wider sm:text-right shrink-0 sm:ml-6 tabular-nums">
                {entry.range}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Certifications */}
      <div>
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
          Certifications &amp; Awards
        </h2>
        <ul className="font-doc text-[15px] divide-y divide-rule">
          {certs.map((c) => (
            <li
              key={c.title + c.issuer}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={c.href ?? "#"}
                  target={c.href && c.href !== "#" ? "_blank" : undefined}
                  rel={c.href && c.href !== "#" ? "noreferrer" : undefined}
                  className="font-semibold text-ink hover:text-word-blue hover:underline underline-offset-2"
                >
                  {c.title}
                </a>
                <span className="text-ink-muted text-[14px]"> — {c.issuer}</span>
              </div>
              <span className="font-ui text-[12px] text-ink-subtle uppercase tracking-wider tabular-nums">
                {c.date}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
