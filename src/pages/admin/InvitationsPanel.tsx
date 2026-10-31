import { useEffect, useRef, useState } from "react";
import { Mail, Send, Eye, CheckCircle2, ArrowUpRight, ArrowLeft, Monitor, Smartphone, RotateCcw, Pause, Play, LoaderCircle } from "lucide-react";
import { getAdminToken } from "../../lib/auth";
import { clearStaleAdminAuth } from "../../lib/api";
import { Button, Field } from "./ui";
import "./invitations.css";

type Config = { configured: boolean; missing: string[]; from: string; siteUrl: string };
type Draft = { recipients: string; subject: string; message: string; requestId: string };
type Preview = { html: string; text: string; subject: string; recipients: string[]; from: string; siteUrl: string };
const DRAFT_KEY = "jvc_invitation_draft";
const fieldClass = "w-full border border-rule rounded-lg bg-paper text-ink px-3 py-2 font-ui text-sm focus:outline-word-blue disabled:opacity-60";

function freshDraft(): Draft {
  return { recipients: "", subject: "You're invited to explore my portfolio", message: "Hi there!\n\nI'd love to invite you to explore my portfolio — a little space for the projects, designs, and ideas I've been working on. Take a look around, meet Blue, and let me know what you think.\n\nSee you there,\nJames", requestId: crypto.randomUUID() };
}

function readDraft(): Draft {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    if (draft && ["recipients", "subject", "message", "requestId"].every(key => typeof draft[key] === "string")) return draft;
  } catch { /* use a fresh draft */ }
  return freshDraft();
}

async function invitationRequest<T>(body?: object): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new Error("Sign in with a server connection to preview and send invitations.");
  const response = await fetch("/api/inquiries?op=invitations", {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 401) clearStaleAdminAuth();
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The invitation service is unavailable.");
  return result as T;
}

export function InvitationsPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [draft, setDraft] = useState(readDraft);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<{ email: string; id: string }[]>([]);
  const sending = useRef(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [still, setStill] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const [replay, setReplay] = useState(0);
  useEffect(() => { if (preview) previewHeading.current?.focus(); }, [preview]);
  const recipients = [...new Set(draft.recipients.split(/[\s,;]+/).map(value => value.trim().toLowerCase()).filter(Boolean))];

  useEffect(() => {
    let active = true;
    invitationRequest<Config>().then(data => { if (active) setConfig(data); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* draft stays in memory */ }
  }, [draft]);

  function edit(key: keyof Pick<Draft, "recipients" | "subject" | "message">, value: string) {
    setDraft(current => ({ ...current, [key]: value, requestId: crypto.randomUUID() }));
    setPreview(null);
    setError("");
  }

  async function submit(send: boolean) {
    if (sending.current || (send && (!preview || !config?.configured))) return;
    sending.current = true;
    setBusy(send ? "send" : "preview");
    setError("");
    try {
      const payload = { ...draft, recipients, preview: !send };
      if (send) {
        const result = await invitationRequest<{ accepted: { email: string; id: string }[] }>(payload);
        setAccepted(result.accepted);
        setPreview(null);
        try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* no storage */ }
      } else setPreview(await invitationRequest<Preview>(payload));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn't reach the invitation service. Retry this same invitation.");
    } finally { sending.current = false; setBusy(null); }
  }

  const previewHtml = preview && still
    ? preview.html.replace("</head>", '<style>.invite-motion{display:none!important}.invite-still{display:block!important;max-height:none!important;overflow:visible!important}</style></head>')
    : preview?.html;
  return <section className="invitation-studio" aria-label="Invitation studio">
    <header className="invite-intro">
      <div><h2>A little mail.<br /><em>A proper entrance.</em></h2><p>A personal note, dressed for the occasion. Invite people to the work—and the person behind it.</p></div>
      <picture><source media="(prefers-reduced-motion: reduce)" srcSet="/invitations/letter-open-v1.png" /><img src="/invitations/letter-opening-v1.gif" alt="" width="600" height="260" /></picture>
    </header>
    <ol className="invite-steps" aria-label="Invitation progress">
      {["Write your note", "Review the email", "Send it personally"].map((label, index) => <li key={label} aria-current={(accepted.length ? 2 : preview ? 1 : 0) === index ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}
    </ol>
    <div className="invite-workspace">
      <div className="invite-connection"><span><Mail size={14} />{config?.configured ? "Resend ready" : config ? "Resend setup" : "Checking sender…"}</span>{config?.from && <small>{config.from}</small>}</div>
      {config && !config.configured && <div className="invite-setup">
        <p>Set {config.missing.map(key => <code key={key}>{key} </code>)} on the server to send the designed email.</p>
        <p>Resend needs a verified sending domain. Gmail drafts are available as a plain-text alternative.</p>
        <a href="https://resend.com/domains" target="_blank" rel="noreferrer">Set up your sender <ArrowUpRight size={13} /></a>
      </div>}
      {accepted.length ? <div role="status" className="invite-success invite-enter">
        <CheckCircle2 size={38} strokeWidth={1.5} /><h3>Your invitations are on their way.</h3>
        <p>{accepted.length} invitation{accepted.length === 1 ? "" : "s"} accepted by Resend</p>
        <ul>{accepted.map(item => <li key={item.id}>{item.email}</li>)}</ul>
        <p className="invite-fine">Check the Resend dashboard for delivery and bounce details.</p>
        <Button onClick={() => { setAccepted([]); setDraft(freshDraft()); }}>Write another invitation</Button>
      </div> : preview ? <div className="invite-review invite-enter">
        <div className="invite-review-heading"><h3 ref={previewHeading} tabIndex={-1}>A look inside their inbox.</h3><Button variant="ghost" disabled={!!busy} onClick={() => setPreview(null)}><ArrowLeft size={14} />Edit note</Button></div>
        <dl className="invite-addresses"><dt>To</dt><dd>{preview.recipients.join(", ")}</dd><dt>Subject</dt><dd>{preview.subject}</dd></dl>
        <div className="invite-preview-controls">
          <div role="group" aria-label="Preview size"><button aria-label="Desktop preview" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={15} /><span>Desktop</span></button><button aria-label="Mobile preview" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}><Smartphone size={15} /><span>Mobile</span></button></div>
          <div><button aria-label={still ? "Play animation" : "Show still preview"} onClick={() => { setStill(!still); setReplay(n => n + 1); }}>{still ? <Play size={15} /> : <Pause size={15} />}<span>{still ? "Play" : "Still"}</span></button><button aria-label="Replay invitation animation" disabled={still} onClick={() => setReplay(n => n + 1)}><RotateCcw size={15} /><span>Replay</span></button></div>
        </div>
        <div className="invite-preview-stage" data-device={device}><iframe key={`${replay}-${still}`} title="Invitation email preview" sandbox="" srcDoc={previewHtml} /></div>
        <div className="invite-dispatch"><div><strong>Ready to make an entrance?</strong><p>Each person receives their own email. Recipient addresses stay private.</p></div><Button className="invite-primary" variant="primary" disabled={!!busy || !config?.configured} onClick={() => void submit(true)}>{busy === "send" ? <LoaderCircle className="invite-spinner" size={16} /> : <Send size={16} />}{busy === "send" ? "Sending…" : `Send ${preview.recipients.length} invitation${preview.recipients.length === 1 ? "" : "s"}`}</Button></div>
        <details className="invite-gmail"><summary>Prefer a plain-text Gmail draft?</summary><p>These drafts contain your message and link, without the design or animation. Review and send in Gmail.</p><div>{preview.recipients.map(email => <a key={email} href={`https://mail.google.com/mail/?${new URLSearchParams({ view: "cm", fs: "1", to: email, su: preview.subject, body: preview.text })}`} target="_blank" rel="noreferrer">Open in Gmail · {email}<ArrowUpRight size={12} /></a>)}</div></details>
      </div> : <form onSubmit={event => { event.preventDefault(); void submit(false); }} className="invite-compose">
        <div className="invite-compose-heading"><h3>Make it personal.</h3><p>The animation and design are taken care of. These words are yours.</p></div>
        <Field label="Recipients" hint="Up to 10 · commas or new lines" required><textarea className={fieldClass} rows={2} value={draft.recipients} onChange={event => edit("recipients", event.target.value)} placeholder="friend@example.com, collaborator@example.com" maxLength={2600} disabled={!!busy} required /></Field>
        <Field label="Subject" required><input className={fieldClass} value={draft.subject} onChange={event => edit("subject", event.target.value)} maxLength={150} disabled={!!busy} required /></Field>
        <Field label="Your message" required><textarea className={fieldClass + " invite-message"} rows={8} value={draft.message} onChange={event => edit("message", event.target.value)} maxLength={3000} disabled={!!busy} required /></Field>
        <div className="invite-compose-footer"><span>{recipients.length ? `${recipients.length} recipient${recipients.length === 1 ? "" : "s"}` : "Add someone to your guest list."}<small>Nothing sends until you review it.</small></span><Button className="invite-primary" variant="primary" type="submit" disabled={!!busy || !config?.siteUrl || recipients.length === 0 || recipients.length > 10}>{busy === "preview" ? <LoaderCircle className="invite-spinner" size={16} /> : <Eye size={16} />}{busy === "preview" ? "Preparing preview…" : "Preview invitation"}</Button></div>
      </form>}
      {error && <p role="alert" className="invite-error">{error}</p>}
    </div>
  </section>;
}
