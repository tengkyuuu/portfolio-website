import { useMemo } from "react";
import { getContent } from "../lib/content";

export function Certifications() {
  const { certs, timeline } = useMemo(() => getContent(), []);
  const awards = certs.filter((c) => !c.image);
  const gallery = certs.filter((c) => c.image);

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

      {/* Certifications & Awards (text rows) */}
      {awards.length > 0 && (
        <div>
          <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
            Certifications &amp; Awards
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
        </div>
      )}

      {/* Course certificate gallery (Sololearn etc.) */}
      {gallery.length > 0 && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-4">
            <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue">
              Course Certificates
            </h2>
            <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider tabular-nums">
              {gallery.length} from {gallery[0]?.issuer ?? "online courses"}
            </span>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {gallery.map((c) => (
              <li key={c.title + c.issuer}>
                <a
                  href={c.image}
                  target="_blank"
                  rel="noreferrer"
                  title={`${c.title} — ${c.issuer}`}
                  className="group block border border-rule rounded-sm overflow-hidden bg-row-alt hover:border-word-blue transition-colors"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={c.image}
                      alt={`${c.title} certificate — ${c.issuer}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <span className="font-ui text-[12px] font-medium text-ink truncate">
                      {c.title}
                    </span>
                    <span
                      className="material-symbols-outlined text-ink-subtle group-hover:text-word-blue shrink-0"
                      style={{ fontSize: 14 }}
                    >
                      open_in_new
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
