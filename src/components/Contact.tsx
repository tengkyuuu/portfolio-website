import { useMemo, useState } from "react";
import { getContent } from "../lib/content";
import { renderInline } from "../lib/inline";

export function Contact() {
  const { contact, hero } = useMemo(() => getContent(), []);
  const [copied, setCopied] = useState(false);

  const email = hero.email;

  function copyEmail() {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section>
      <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
        Get in Touch
      </h2>

      {contact.intro && (
        <p className="font-doc text-[16px] leading-[1.7] text-ink mb-5 max-w-2xl">
          {renderInline(contact.intro)}
        </p>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2 font-doc text-[15px]">
        {contact.channels.map((c) => (
          <li key={c.label} className="flex items-baseline gap-3">
            <span
              className="material-symbols-outlined text-ink-subtle"
              style={{ fontSize: 16 }}
            >
              {c.icon}
            </span>
            <span className="font-ui text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-20 shrink-0">
              {c.label}
            </span>
            <a
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="text-ink hover:text-word-blue hover:underline underline-offset-2"
            >
              {c.value}
            </a>
          </li>
        ))}
      </ul>

      {/* Closing note — document sign-off, not a landing-page CTA */}
      <div className="mt-8 pt-5 border-t border-rule">
        <p className="font-doc text-[15px] leading-relaxed text-ink-muted max-w-2xl">
          {hero.available && hero.availableText && (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-word-blue">
                <span className="inline-block h-2 w-2 rounded-full bg-word-blue" />
                {hero.availableText}
              </span>
              {" — "}
            </>
          )}
          open to freelance, internships, and collaborations. Drop a line — I
          read everything.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(
                "Let's work together"
              )}`}
              className={chipClass}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                mail
              </span>
              Email me
            </a>
          )}
          {email && (
            <button onClick={copyEmail} className={chipClass}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied" : "Copy email"}
            </button>
          )}
          <a href="/resume" className={chipClass}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              description
            </span>
            Résumé
          </a>
        </div>
      </div>
    </section>
  );
}

/** Shared bordered link-chip — matches the project links + tech-stack chips. */
const chipClass =
  "inline-flex items-center gap-1.5 font-ui text-[12px] font-medium text-word-blue border border-rule rounded-sm px-2.5 py-1.5 hover:bg-word-blue-light transition-colors";
