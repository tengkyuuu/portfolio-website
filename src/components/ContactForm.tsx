import { useEffect, useRef, useState } from "react";
import { submitInquiry, type SubmitInquiryResult } from "../lib/inquiry-api";

/**
 * Word "New Comment" style contact form. Ships a full-fidelity form:
 *   - Client-side validation with per-field error state
 *   - Hidden honeypot (name="website") to filter dumb bots
 *   - Loading / success / error UX all styled as Word "balloons"
 *   - Rate-limit + offline distinguished from generic 500s
 *   - Keyboard-accessible (Enter submits, focus lands on first invalid field)
 *   - character counters on subject and message
 *
 * The whole card is a themed <form>. On success it collapses into a small
 * confirmation balloon with a "Send another" affordance so a happy path
 * doesn't strand the user on a completed form.
 */

const LIMITS = {
  name: 100,
  email: 200,
  subject: 200,
  message: 5000,
} as const;

type FieldName = "name" | "email" | "subject" | "message";
type FieldErrors = Partial<Record<FieldName, string>>;

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success" }
  | { kind: "error"; message: string; field?: FieldName };

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // First-field ref doubles as focus target after "Send another" —
  // the name field is always the top of the form.
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // After sending completes, put focus somewhere sensible so a screen
  // reader announcement lands next to the status.
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status.kind === "success" || status.kind === "error") {
      statusRef.current?.focus();
    }
  }, [status.kind]);

  function focusFirstInvalid(errs: FieldErrors) {
    const order: FieldName[] = ["name", "email", "subject", "message"];
    for (const f of order) {
      if (errs[f]) {
        const el = { name: nameRef, email: emailRef, subject: subjectRef, message: messageRef }[f];
        el.current?.focus();
        return;
      }
    }
  }

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    const nameT = name.trim();
    if (!nameT) errs.name = "Please add your name.";
    else if (nameT.length > LIMITS.name) errs.name = `Name is too long (max ${LIMITS.name}).`;

    const emailT = email.trim();
    if (!emailT) errs.email = "Please add your email.";
    else if (emailT.length > LIMITS.email) errs.email = `Email is too long.`;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailT))
      errs.email = "That doesn't look like a valid email.";

    if (subject.trim().length > LIMITS.subject)
      errs.subject = `Subject is too long (max ${LIMITS.subject}).`;

    const messageT = message.trim();
    if (!messageT) errs.message = "Please add a message.";
    else if (messageT.length > LIMITS.message)
      errs.message = `Message is too long (max ${LIMITS.message.toLocaleString()}).`;

    return errs;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "sending") return;

    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setStatus({ kind: "error", message: "Please fix the highlighted fields." });
      focusFirstInvalid(errs);
      return;
    }

    setStatus({ kind: "sending" });
    const result: SubmitInquiryResult = await submitInquiry({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      website,
    });

    if (result.ok) {
      setStatus({ kind: "success" });
      return;
    }

    if (result.kind === "validation") {
      // Server said no — merge its errors on top of the client set.
      const serverErrs: FieldErrors = {};
      for (const e of result.errors) {
        if ((e.field as FieldName) in LIMITS) {
          serverErrs[e.field as FieldName] = e.message;
        }
      }
      setErrors(serverErrs);
      setStatus({
        kind: "error",
        message: "The server rejected the message — please fix the highlighted fields.",
      });
      focusFirstInvalid(serverErrs);
      return;
    }
    if (result.kind === "rate_limit") {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    if (result.kind === "offline") {
      setStatus({
        kind: "error",
        message: "Couldn't reach the server. Check your connection and try again.",
      });
      return;
    }
    setStatus({ kind: "error", message: result.message });
  }

  function sendAnother() {
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setWebsite("");
    setErrors({});
    setStatus({ kind: "idle" });
    // Focus the first field on the reset form.
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  // Success view — collapse into a Word "comment posted" balloon
  if (status.kind === "success") {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="mt-8 border-l-4 border-word-blue bg-word-blue-light dark:bg-word-blue-light rounded-r-sm p-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="material-symbols-outlined icon-fill text-word-blue"
            style={{ fontSize: 20 }}
          >
            check_circle
          </span>
          <span className="font-ui text-[13px] font-semibold uppercase tracking-[0.12em] text-word-blue">
            Comment posted
          </span>
        </div>
        <p className="font-doc text-[15px] text-ink leading-relaxed">
          Your message is in — I'll get back to you at your email. Thanks for
          reaching out.
        </p>
        <button
          type="button"
          onClick={sendAnother}
          className="mt-3 inline-flex items-center gap-1.5 font-ui text-[12px] font-medium text-word-blue hover:underline decoration-word-blue underline-offset-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            add_comment
          </span>
          Send another
        </button>
      </div>
    );
  }

  const disabled = status.kind === "sending";
  const errorMsg = status.kind === "error" ? status.message : null;
  const charCount = (v: string, limit: number) =>
    `${v.length.toLocaleString()} / ${limit.toLocaleString()}`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 border border-rule rounded-sm bg-row-alt"
      aria-labelledby="contact-form-title"
    >
      {/* Word "New Comment" title strip */}
      <div className="flex items-center gap-2 border-b border-rule px-4 py-2">
        <span
          className="material-symbols-outlined icon-fill text-word-blue"
          style={{ fontSize: 16 }}
        >
          chat_bubble
        </span>
        <h3
          id="contact-form-title"
          className="font-ui text-[12px] font-semibold uppercase tracking-[0.12em] text-word-blue"
        >
          New Comment
        </h3>
        <span className="font-ui text-[11px] text-ink-subtle ml-auto">
          Send me a message
        </span>
      </div>

      <div className="p-4 md:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWrap label="Name" required htmlFor="contact-name" error={errors.name}>
            <input
              id="contact-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
              }}
              autoComplete="name"
              disabled={disabled}
              maxLength={LIMITS.name}
              className={inputClass(errors.name)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
            />
          </FieldWrap>

          <FieldWrap label="Email" required htmlFor="contact-email" error={errors.email}>
            <input
              id="contact-email"
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
              autoComplete="email"
              inputMode="email"
              disabled={disabled}
              maxLength={LIMITS.email}
              className={inputClass(errors.email)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "contact-email-error" : undefined}
            />
          </FieldWrap>
        </div>

        <FieldWrap
          label="Subject"
          htmlFor="contact-subject"
          error={errors.subject}
          hint={charCount(subject, LIMITS.subject)}
        >
          <input
            id="contact-subject"
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              if (errors.subject) setErrors((p) => ({ ...p, subject: undefined }));
            }}
            disabled={disabled}
            maxLength={LIMITS.subject}
            placeholder="(optional)"
            className={inputClass(errors.subject)}
            aria-invalid={Boolean(errors.subject)}
            aria-describedby={errors.subject ? "contact-subject-error" : undefined}
          />
        </FieldWrap>

        <FieldWrap
          label="Message"
          required
          htmlFor="contact-message"
          error={errors.message}
          hint={charCount(message, LIMITS.message)}
        >
          <textarea
            id="contact-message"
            ref={messageRef}
            rows={6}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (errors.message) setErrors((p) => ({ ...p, message: undefined }));
            }}
            disabled={disabled}
            maxLength={LIMITS.message}
            className={inputClass(errors.message) + " resize-y font-doc"}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? "contact-message-error" : undefined}
          />
        </FieldWrap>

        {/* Honeypot — hidden from users, catches naive bots. Off-screen +
             tabindex=-1 so keyboard nav can't stumble into it either. */}
        <div aria-hidden="true" className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden">
          <label htmlFor="contact-website">Website (leave empty)</label>
          <input
            id="contact-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {errorMsg && (
          <div
            ref={statusRef}
            tabIndex={-1}
            role="alert"
            className="border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-sm px-3 py-2 font-ui text-[12px] text-red-700 dark:text-red-300 flex items-start gap-1.5"
          >
            <span
              className="material-symbols-outlined shrink-0"
              style={{ fontSize: 14, marginTop: 1 }}
            >
              error
            </span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="font-ui text-[11px] text-ink-subtle italic">
            Your email is used only to reply. Not stored or shared.
          </p>
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-1.5 bg-word-blue hover:bg-word-blue-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-ui text-[13px] font-semibold px-4 py-2 rounded-sm transition-colors"
          >
            {disabled ? (
              <>
                <span
                  className="material-symbols-outlined animate-spin"
                  style={{ fontSize: 15 }}
                >
                  progress_activity
                </span>
                Posting…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  send
                </span>
                Post comment
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function FieldWrap({
  label,
  required,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label
          htmlFor={htmlFor}
          className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted"
        >
          {label}
          {required && <span className="text-word-blue ml-0.5">*</span>}
        </label>
        {hint && !error && (
          <span className="font-ui text-[11px] text-ink-subtle tabular-nums">
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p
          id={`${htmlFor}-error`}
          className="mt-1 font-ui text-[11px] text-red-700 dark:text-red-400 flex items-center gap-1"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            error
          </span>
          {error}
        </p>
      )}
    </div>
  );
}

function inputClass(error?: string): string {
  return (
    "w-full bg-paper border rounded-sm px-3 py-2 text-[14px] text-ink placeholder:text-ink-subtle outline-none transition-colors " +
    (error
      ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
      : "border-rule focus:border-word-blue focus:ring-2 focus:ring-word-blue/20") +
    " disabled:opacity-60"
  );
}
