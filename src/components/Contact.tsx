import { useMemo } from "react";
import { getContent } from "../lib/content";
import { renderInline } from "../lib/inline";

export function Contact() {
  const { contact } = useMemo(() => getContent(), []);

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
    </section>
  );
}
