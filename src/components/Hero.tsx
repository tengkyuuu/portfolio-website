import { useMemo } from "react";
import { getContent } from "../lib/content";
import { renderInline, renderParagraphs } from "../lib/inline";

export function Hero() {
  const { hero } = useMemo(() => getContent(), []);

  return (
    <div className="flex flex-col gap-8">
      {/* Document title block */}
      <header className="border-b-2 border-word-blue pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="min-w-0">
          {hero.eyebrow && (
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle mb-2">
              {hero.eyebrow}
            </p>
          )}
          <h1 className="font-doc text-[44px] md:text-[56px] leading-[1.05] font-bold text-word-blue tracking-tight">
            {hero.name.includes(" ") ? (
              (() => {
                const parts = hero.name.split(" ");
                const lead = parts.slice(0, -1).join(" ");
                const tail = parts[parts.length - 1];
                return (
                  <>
                    {lead}{" "}
                    <span className="whitespace-nowrap">
                      {tail}
                      <span className="word-caret inline-block w-[2px] h-[0.9em] align-middle ml-1 bg-word-blue" />
                    </span>
                  </>
                );
              })()
            ) : (
              <span className="whitespace-nowrap">
                {hero.name}
                <span className="word-caret inline-block w-[2px] h-[0.9em] align-middle ml-1 bg-word-blue" />
              </span>
            )}
          </h1>
          {hero.role && (
            <p className="font-ui text-[20px] md:text-[24px] font-semibold leading-tight text-ink-muted mt-1">
              {hero.role}
            </p>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-[13px] text-ink-muted font-ui">
            {hero.email && (
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  mail
                </span>
                {hero.email}
              </span>
            )}
            {hero.website && (
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  link
                </span>
                {hero.website}
              </span>
            )}
            {hero.location && (
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  location_on
                </span>
                {hero.location}
              </span>
            )}
            {hero.available && hero.availableText && (
              <span className="inline-flex items-center gap-1.5 text-word-blue">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-word-blue opacity-50 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-word-blue" />
                </span>
                {hero.availableText}
              </span>
            )}
          </div>
        </div>

        {/* Portrait — default + hover state */}
        <div className="portrait-group relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-rule-strong dark:border-rule shrink-0 paper-shadow cursor-pointer">
          <img
            alt="James Vincent Calunsag"
            src="/james.jpg"
            className="portrait-light-default absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-out"
          />
          <img
            alt="James Vincent Calunsag (dark mode portrait)"
            src="/james-dark.jpg"
            className="portrait-dark-default absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-out"
          />
          <img
            alt="James Vincent Calunsag, wearing sunglasses"
            src="/james-shades.jpg"
            className="portrait-light-hover absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-out"
          />
          <img
            alt="James Vincent Calunsag (dark mode, peace sign)"
            src="/james-dark-peace.jpg"
            className="portrait-dark-hover absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-out"
          />
        </div>
      </header>

      {/* Tagline */}
      {hero.tagline && (
        <p className="font-doc italic text-[20px] md:text-[22px] leading-snug text-ink">
          “{renderInline(hero.tagline)}”
        </p>
      )}

      {/* Abstract */}
      {hero.abstract && (
        <div className="font-doc text-[16px] leading-[1.7] text-ink space-y-3">
          {renderParagraphs(hero.abstract)}
        </div>
      )}

      {/* Contents (auto-generated from tabs) */}
      {hero.showContents && (
        <section className="mt-2">
          <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-3">
            Contents
          </h2>
          <ol className="font-doc text-[15px] text-ink space-y-1.5">
            {[
              ["I.", "Projects", "Selected works across embedded, mobile, web, desktop, and design."],
              ["II.", "About", "Background, philosophy, and the way I think about systems."],
              ["III.", "Skills", "Core competencies across four disciplines."],
              ["IV.", "Credentials", "Education, experience, and certifications."],
              ["V.", "Contact", "How to reach me."],
            ].map(([num, title, desc]) => (
              <li
                key={title}
                className="flex items-baseline gap-3 border-b border-dotted border-rule pb-1"
              >
                <span className="font-ui text-[12px] font-semibold text-ink-subtle w-7 shrink-0 tabular-nums">
                  {num}
                </span>
                <span className="font-semibold text-ink shrink-0">{title}</span>
                <span className="flex-1 text-[13px] text-ink-muted truncate">— {desc}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
