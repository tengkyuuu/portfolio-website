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

      {/* Call to action */}
      <div className="mt-8 border border-rule rounded-sm bg-row-alt/50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-doc text-[20px] font-bold text-ink leading-tight">
            Let's build something.
          </h3>
          {hero.available && hero.availableText ? (
            <p className="mt-1 inline-flex items-center gap-2 font-ui text-[13px] text-word-blue">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-word-blue opacity-50 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-word-blue" />
              </span>
              {hero.availableText} — usually replies within a day.
            </p>
          ) : (
            <p className="mt-1 font-ui text-[13px] text-ink-muted">
              Open to freelance, internships, and collaborations.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(
                "Let's work together"
              )}`}
              className="inline-flex items-center gap-1.5 bg-word-blue text-white font-ui text-[13px] font-medium px-3.5 py-2 rounded-sm hover:bg-word-blue-dark transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                mail
              </span>
              Email me
            </a>
          )}
          {email && (
            <button
              onClick={copyEmail}
              className="inline-flex items-center gap-1.5 bg-paper text-ink border border-rule font-ui text-[13px] font-medium px-3.5 py-2 rounded-sm hover:bg-ribbon-hover transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied" : "Copy email"}
            </button>
          )}
          <a
            href="/resume"
            className="inline-flex items-center gap-1.5 bg-paper text-ink border border-rule font-ui text-[13px] font-medium px-3.5 py-2 rounded-sm hover:bg-ribbon-hover transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              description
            </span>
            Résumé
          </a>
        </div>
      </div>
    </section>
  );
}
