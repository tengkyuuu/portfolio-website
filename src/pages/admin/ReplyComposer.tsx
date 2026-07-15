import { useEffect, useMemo, useRef, useState } from "react";
import type { Inquiry } from "../../lib/inquiry-api";
import { Button } from "./ui";

/**
 * "Compose reply" modal for the inbox — auto-generated email templates.
 *
 * Two built-in templates with {{placeholders}} merged from the inquiry.
 * The merged text is editable before sending. Three send paths, since we
 * have no SMTP: copy to clipboard, open in Gmail compose, or the default
 * mail app (mailto:). Word "New Message" dialog aesthetics.
 */

type TemplateId = "reply" | "resume";

const TEMPLATES: Record<
  TemplateId,
  { label: string; icon: string; subject: (i: Inquiry) => string; body: (i: Inquiry) => string }
> = {
  reply: {
    label: "General reply",
    icon: "reply",
    subject: (i) =>
      i.subject && i.subject.trim().length > 0
        ? i.subject.startsWith("Re:")
          ? i.subject
          : `Re: ${i.subject}`
        : "Re: your message",
    body: (i) => `Hi ${firstName(i.name)},

Thanks for reaching out${i.subject ? ` about "${i.subject}"` : ""} — I appreciate the message.

{{your reply here}}

If it's easier, feel free to book a quick call from the Contact page on my site.

Best,
James Vincent Calunsag
engrjamescalunsag.vercel.app`,
  },
  resume: {
    label: "Résumé request",
    icon: "description",
    subject: () => "Résumé — James Vincent Calunsag",
    body: (i) => `Hi ${firstName(i.name)},

Thanks for your interest! You can view and download my résumé here:

https://engrjamescalunsag.vercel.app/resume

It supports role-specific views (Frontend / Full-Stack / IT Support) and an ATS-friendly format — use the pickers at the top, then Download PDF.

Happy to walk through any project in more detail.

Best,
James Vincent Calunsag`,
  },
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "there";
}

export function ReplyComposer({
  inquiry,
  onClose,
}: {
  inquiry: Inquiry;
  onClose: () => void;
}) {
  const [template, setTemplate] = useState<TemplateId>("reply");
  const [subject, setSubject] = useState(() => TEMPLATES.reply.subject(inquiry));
  const [body, setBody] = useState(() => TEMPLATES.reply.body(inquiry));
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Re-merge when the template changes (overwrites edits deliberately —
  // switching template means "start over from that template").
  function pickTemplate(id: TemplateId) {
    setTemplate(id);
    setSubject(TEMPLATES[id].subject(inquiry));
    setBody(TEMPLATES[id].body(inquiry));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const gmailHref = useMemo(
    () =>
      "https://mail.google.com/mail/?view=cm&fs=1" +
      `&to=${encodeURIComponent(inquiry.email)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`,
    [inquiry.email, subject, body]
  );

  const mailtoHref = useMemo(
    () =>
      `mailto:${inquiry.email}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`,
    [inquiry.email, subject, body]
  );

  async function copyAll() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compose reply"
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 no-print"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" aria-hidden="true" />
      <div
        className="relative w-full max-w-2xl bg-paper border border-rule rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[88svh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-rule bg-ribbon px-4 py-2.5">
          <span
            className="material-symbols-outlined icon-fill text-word-blue"
            style={{ fontSize: 16 }}
          >
            outgoing_mail
          </span>
          <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.12em] text-word-blue">
            Compose Reply
          </span>
          <span className="font-ui text-[11px] text-ink-subtle truncate">
            → {inquiry.name} &lt;{inquiry.email}&gt;
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid w-7 h-7 place-items-center rounded-sm text-ink-muted hover:bg-ribbon-hover hover:text-ink transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              close
            </span>
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Template picker */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Template">
            {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => {
              const t = TEMPLATES[id];
              const isActive = template === id;
              return (
                <button
                  key={id}
                  onClick={() => pickTemplate(id)}
                  aria-pressed={isActive}
                  className={
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-ui text-[12px] font-medium transition-colors " +
                    (isActive
                      ? "bg-word-blue text-white"
                      : "text-ink-muted border border-rule bg-paper hover:bg-ribbon-hover")
                  }
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              );
            })}
            <span className="font-ui text-[11px] text-ink-subtle italic self-center ml-1">
              Switching templates resets the draft.
            </span>
          </div>

          {/* Subject */}
          <div>
            <label
              htmlFor="reply-subject"
              className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted"
            >
              Subject
            </label>
            <input
              id="reply-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full bg-paper border border-rule rounded-sm px-3 py-2 text-[14px] text-ink outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20"
            />
          </div>

          {/* Body */}
          <div>
            <label
              htmlFor="reply-body"
              className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted"
            >
              Message
            </label>
            <textarea
              id="reply-body"
              ref={bodyRef}
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full bg-paper border border-rule rounded-sm px-3 py-2 font-doc text-[14px] leading-[1.6] text-ink outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20 resize-y"
            />
            <p className="mt-1 font-ui text-[11px] text-ink-subtle italic">
              Replace the {"{{your reply here}}"} placeholder before sending.
            </p>
          </div>

          {/* Original message, for reference */}
          <details className="border border-rule rounded-sm bg-row-alt">
            <summary className="cursor-pointer px-3 py-2 font-ui text-[12px] font-medium text-ink-muted hover:text-ink">
              Original message
            </summary>
            <p className="px-3 pb-3 font-doc text-[13px] leading-[1.6] text-ink-muted whitespace-pre-wrap break-words">
              {inquiry.message}
            </p>
          </details>
        </div>

        {/* Send bar */}
        <div className="border-t border-rule bg-ribbon px-4 py-2.5 flex flex-wrap items-center gap-2">
          <a
            href={gmailHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 bg-word-blue hover:bg-word-blue-dark text-white font-ui text-[13px] font-semibold px-3.5 py-1.5 rounded-sm transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              send
            </span>
            Open in Gmail
          </a>
          <a
            href={mailtoHref}
            className="inline-flex items-center gap-1.5 border border-rule bg-paper text-ink font-ui text-[13px] font-medium px-3 py-1.5 rounded-sm hover:bg-ribbon-hover transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              mail
            </span>
            Mail app
          </a>
          <Button
            variant="secondary"
            icon={copied ? "check" : "content_copy"}
            onClick={() => void copyAll()}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <span className="ml-auto font-ui text-[10px] uppercase tracking-[0.12em] text-ink-subtle">
            No SMTP — sends via your own mail client
          </span>
        </div>
      </div>
    </div>
  );
}
