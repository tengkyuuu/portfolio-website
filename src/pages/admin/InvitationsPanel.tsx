import { useEffect, useRef, useState } from "react";
import { Mail, Send, Eye, CheckCircle2, ArrowUpRight } from "lucide-react";
import { getAdminToken } from "../../lib/auth";
import { clearStaleAdminAuth } from "../../lib/api";
import { Button, Card, Field } from "./ui";

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

  return <>
    <Card title="A personal invitation" description="Invite someone into your corner of the internet. Each person receives their own email, with a link to your portfolio.">
      <div className="flex flex-wrap items-center gap-2 font-ui text-xs text-ink-muted mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1"><Mail size={13} />{config?.configured ? "Resend ready" : "Resend setup"}</span>
        {config?.from && <span>From {config.from}</span>}
      </div>
      {config && !config.configured && <div className="border border-rule rounded-lg bg-row-alt p-4 mb-5 font-ui text-xs text-ink-muted space-y-2">
        <p>Set {config.missing.map(key => <code key={key} className="mr-2 font-semibold text-ink">{key}</code>)} in your server environment, then restart or redeploy.</p>
        <p>Resend needs a sender on a domain you own. Gmail can be your Reply-To address. You can use the Gmail drafts below while you set up a domain.</p>
        <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-word-blue underline">Open Resend <ArrowUpRight size={12} /></a>
      </div>}
      {accepted.length ? <div role="status" className="space-y-4 font-ui">
        <div className="flex items-center gap-2 text-word-blue"><CheckCircle2 size={22} /><strong>{accepted.length} invitation{accepted.length === 1 ? "" : "s"} accepted by Resend</strong></div>
        <ul className="text-sm text-ink-muted space-y-1">{accepted.map(item => <li key={item.id}>{item.email}</li>)}</ul>
        <p className="text-xs text-ink-muted">You can check delivery and bounce details in the Resend dashboard.</p>
        <Button onClick={() => { setAccepted([]); setDraft(freshDraft()); }}>Write another invitation</Button>
      </div> : <form onSubmit={event => { event.preventDefault(); void submit(false); }} className="space-y-5">
        <Field label="Recipients" hint="Up to 10 · separate with commas or new lines" required>
          <textarea className={fieldClass} rows={2} value={draft.recipients} onChange={event => edit("recipients", event.target.value)} placeholder="friend@example.com, collaborator@example.com" maxLength={2600} disabled={!!busy} required />
        </Field>
        <Field label="Subject" required><input className={fieldClass} value={draft.subject} onChange={event => edit("subject", event.target.value)} maxLength={150} disabled={!!busy} required /></Field>
        <Field label="Your message" required><textarea className={fieldClass + " leading-relaxed"} rows={8} value={draft.message} onChange={event => edit("message", event.target.value)} maxLength={3000} disabled={!!busy} required /></Field>
        <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={!!busy || !config?.siteUrl || recipients.length === 0 || recipients.length > 10}><Eye size={15} />{busy === "preview" ? "Preparing preview…" : "Preview invitation"}</Button><span className="font-ui text-xs text-ink-subtle">{recipients.length} recipient{recipients.length === 1 ? "" : "s"} · sent individually</span></div>
      </form>}
      {error && <p role="alert" className="mt-4 font-ui text-sm text-red-600 dark:text-red-300">{error}</p>}
    </Card>
    {preview && <Card title="Ready to send?" description="Review the email and recipients below.">
      <dl className="font-ui text-xs text-ink-muted grid grid-cols-[60px_1fr] gap-2 mb-4"><dt>To</dt><dd className="break-words">{preview.recipients.join(", ")}</dd><dt>From</dt><dd>{preview.from}</dd><dt>Subject</dt><dd className="font-semibold text-ink">{preview.subject}</dd></dl>
      <iframe title="Invitation email preview" sandbox="" srcDoc={preview.html} className="w-full h-[520px] border border-rule rounded-lg bg-white" />
      <div className="mt-5 flex flex-wrap items-center gap-3"><Button disabled={!!busy || !config?.configured} onClick={() => void submit(true)}><Send size={14} />{busy === "send" ? "Sending…" : `Send ${preview.recipients.length} invitation${preview.recipients.length === 1 ? "" : "s"}`}</Button><span className="font-ui text-xs text-ink-subtle">An invitation to visit your website.</span></div>
      <div className="mt-6 border-t border-rule pt-4 font-ui">
        <h3 className="text-sm font-semibold text-ink">Send with Gmail</h3>
        <p className="text-xs text-ink-muted mt-1 mb-3">Open a plain-text draft for each person. Choose your Gmail account, review it, and send there.</p>
        <div className="flex flex-wrap gap-2">{preview.recipients.map(email => <a key={email} className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-rule px-3 py-2 text-word-blue hover:bg-row-alt" href={`https://mail.google.com/mail/?${new URLSearchParams({ view: "cm", fs: "1", to: email, su: preview.subject, body: preview.text })}`} target="_blank" rel="noreferrer">Open in Gmail · {email}<ArrowUpRight size={12} /></a>)}</div>
      </div>
    </Card>}
  </>;
}
