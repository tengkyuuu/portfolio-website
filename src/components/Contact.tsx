import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Copy,
  Mail,
  MapPin,
  MessageSquare,
  Send,
} from "lucide-react";
import { getContent } from "../lib/content";
import { renderInline } from "../lib/inline";
import { ContactForm } from "./ContactForm";
import { ChapterHeading } from "./ui/ChapterHeading";
import { chapterNumber } from "./Nav";

export function Contact() {
  const { contact, hero } = useMemo(() => getContent(), []);
  const [copyStatus, setCopyStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(hero.email);
      setCopyStatus("Email copied");
    } catch {
      setCopyStatus("Couldn’t copy. Select the email above, or use Email me.");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyStatus(""), 4000);
  }
  return (
    <section>
      <ChapterHeading
        number={chapterNumber("contact")}
        eyebrow="THE NEXT CHAPTER"
        title={
          <>
            Let’s make <br />
            <em>something good.</em>
          </>
        }
        description="An idea, an opportunity, or just a hello. There’s room for your comment in this document."
      >
        <Send />
      </ChapterHeading>
      <div className="contact-layout">
        <div className="contact-info">
          {contact.intro && <p>{renderInline(contact.intro)}</p>}
          <ul className="contact-channels">
            {contact.channels.map((channel) => (
              <li key={channel.label}>
                {channel.href && channel.href !== "#" ? (
                  <a
                    href={channel.href}
                    target={
                      channel.href.startsWith("http") ? "_blank" : undefined
                    }
                    rel={
                      channel.href.startsWith("http") ? "noreferrer" : undefined
                    }
                  >
                    <span
                      className="material-symbols-outlined text-word-blue"
                      style={{ fontSize: 19 }}
                      aria-hidden="true"
                    >
                      {channel.icon}
                    </span>
                    <span>
                      <small>{channel.label}</small>
                      <strong>{channel.value}</strong>
                    </span>
                    <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <div className="contact-location">
                    <MapPin size={18} />
                    <span>
                      <small>{channel.label}</small>
                      <strong>{channel.value}</strong>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {hero.email && (
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`mailto:${hero.email}`}
                className="doc-button doc-button-primary"
              >
                <Mail size={14} /> Email me
              </a>
              <button className="doc-button" onClick={() => void copyEmail()}>
                {copyStatus === "Email copied" ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}{" "}
                Copy email
              </button>
            </div>
          )}
          {copyStatus && (
            <p role="status" className="mt-3 text-sm text-word-blue">
              {copyStatus}
            </p>
          )}
          {hero.available && (
            <div className="contact-note">
              <strong>
                <span className="availability-dot" />
                {hero.availableText}
              </strong>
              Open to freelance, internships, and collaborations. Let’s see what
              we can build together.
            </div>
          )}
          <p className="contact-signoff">{hero.name.split(" ")[0]}.</p>
        </div>
        <div className="contact-form-column">
          <div className="contact-comment-intro">
            <MessageSquare size={16} />
            <span>Good things start with a conversation.</span>
          </div>
          <ContactForm />
        </div>
      </div>
      {contact.bookingUrl && <BookingSection url={contact.bookingUrl} />}
    </section>
  );
}

function BookingSection({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8 border border-rule rounded-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-rule bg-ribbon px-4 py-3">
        <CalendarDays size={17} />
        <h2 className="text-sm font-semibold">Prefer a conversation?</h2>
        <a
          className="doc-text-link ml-auto"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          Open scheduler <ArrowUpRight size={13} />
        </a>
      </div>
      {open ? (
        <iframe
          src={url}
          title="Book a meeting"
          loading="lazy"
          className="w-full bg-paper h-[620px] border-0"
        />
      ) : (
        <div className="p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-doc text-sm text-ink-muted">
            Find a time that works for you.
          </p>
          <button
            className="doc-button doc-button-primary"
            onClick={() => setOpen(true)}
          >
            Show available times
          </button>
        </div>
      )}
    </div>
  );
}
