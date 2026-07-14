import { useMemo } from "react";
import { getContent } from "../lib/content";
import { useI18n } from "../lib/i18n";
import { CertStack } from "./CertStack";

export function Certifications() {
  const { t } = useI18n();
  const { certs, timeline } = useMemo(() => getContent(), []);
  const awards = certs.filter((c) => !c.image);
  const courseCerts = certs.filter((c) => c.image);
  const courseIssuer = courseCerts[0]?.issuer ?? "Online courses";

  return (
    <section className="space-y-10">
      {/* Education + Experience */}
      <div>
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
          {t("section.educationExperience")}
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

      {/* Certifications & Awards */}
      <div>
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
          {t("section.certificationsAwards")}
        </h2>
        <ul className="font-doc text-[15px] divide-y divide-rule">
          {awards.map((c) => {
            const isLink = Boolean(c.href && c.href !== "#");
            return (
              <li
                key={c.title + c.issuer}
                className="flex items-baseline justify-between gap-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={c.href ?? "#"}
                    target={isLink ? "_blank" : undefined}
                    rel={isLink ? "noreferrer" : undefined}
                    className={
                      "font-semibold text-ink" +
                      (isLink
                        ? " hover:text-word-blue hover:underline underline-offset-2"
                        : " pointer-events-none")
                    }
                  >
                    {c.title}
                  </a>
                  <span className="text-ink-muted text-[14px]"> — {c.issuer}</span>
                </div>
                {c.date && (
                  <span className="font-ui text-[12px] text-ink-subtle uppercase tracking-wider tabular-nums shrink-0">
                    {c.date}
                  </span>
                )}
              </li>
            );
          })}

        </ul>

        {/* Sololearn course certs — inline scroll-to-view card deck */}
        {courseCerts.length > 0 && (
          <div className="mt-6">
            <CertStack certs={courseCerts} issuer={courseIssuer} />
          </div>
        )}
      </div>
    </section>
  );
}
