import { useCallback, useEffect, useState } from "react";
import { getAdminUser, getAuthMode, setAdminToken } from "../../lib/auth";
import {
  addTeamMember,
  changeOwnPassword,
  generatePassword,
  listTeam,
  removeTeamMember,
  updateTeamMember,
  type TeamMember,
} from "../../lib/team-api";
import { displayName, initials } from "./AdminLayout";
import { Button, Card, Field, Input, Row } from "./ui";

/**
 * Team — who can edit this portfolio, and your own account.
 *
 * The owner signs in with the document password and manages everyone
 * else. Team admins can edit every section but this one; for them the
 * panel is just their account and a password change.
 */
export function TeamPanel() {
  const user = getAdminUser();
  const local = getAuthMode() === "local";

  return (
    <>
      <AccountCard />
      {user.role === "owner" ? (
        local ? (
          <Card title="Admins">
            <p className="font-ui text-[13px] text-ink-muted">
              Team accounts live on the server, and this session is local-only
              (no content API reachable). Sign in on the deployed site to add
              admins.
            </p>
          </Card>
        ) : (
          <AdminsCard />
        )
      ) : (
        <Card title="Admins">
          <p className="font-ui text-[13px] text-ink-muted">
            The document owner decides who can edit. Ask them to add someone,
            reset a password, or change your access.
          </p>
        </Card>
      )}
    </>
  );
}

/* ---------------------------------- you ---------------------------------- */

function AccountCard() {
  const user = getAdminUser();
  const name = displayName(user);
  return (
    <Card title="Your account">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 place-items-center rounded-full bg-word-blue text-paper font-ui text-[14px] font-semibold"
        >
          {initials(name)}
        </span>
        <div className="min-w-0">
          <div className="font-doc text-[17px] font-bold text-ink leading-tight">{name}</div>
          <div className="font-ui text-[12px] text-ink-subtle">
            {user.role === "owner" ? "Document owner" : `@${user.username} · Admin`}
          </div>
        </div>
      </div>
      {user.role === "owner" ? (
        <p className="mt-4 font-ui text-[12px] text-ink-muted leading-relaxed max-w-prose">
          You sign in with the document password, set by{" "}
          <code className="font-ui text-[11px] bg-ribbon px-1 rounded-sm">ADMIN_PASSWORD_HASH</code>{" "}
          in your hosting environment. Nothing stored here can lock you out, and
          only you can manage the admins below.
        </p>
      ) : (
        <ChangePasswordForm />
      )}
    </Card>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (next !== confirm) {
      setStatus({ tone: "error", text: "The new passwords don't match." });
      return;
    }
    setPending(true);
    setStatus(null);
    const r = await changeOwnPassword(current, next);
    setPending(false);
    if (!r.ok) {
      setStatus({ tone: "error", text: r.message });
      return;
    }
    // Every older session is refused now, this one included.
    setAdminToken(r.data.token);
    setCurrent("");
    setNext("");
    setConfirm("");
    setStatus({
      tone: "ok",
      text: "Password changed. Other devices you were signed in on are now signed out.",
    });
  }

  return (
    <form
      className="mt-5 space-y-3 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3 className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Change password
      </h3>
      <PasswordInput label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordInput label="New password" hint="At least 10 characters" value={next} onChange={setNext} autoComplete="new-password" />
      <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {status && <StatusLine {...status} />}
      <Button type="submit" variant="primary" icon="key" disabled={pending || !current || next.length < 10 || !confirm}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}

/* --------------------------------- admins -------------------------------- */

type Load =
  | { state: "loading" }
  | { state: "ready"; items: TeamMember[] }
  | { state: "setup"; message: string }
  | { state: "error"; message: string };

/** Shown once after a reset or a fresh invite, then gone for good. */
type Handoff =
  | { kind: "reset"; name: string; username: string; password: string }
  | { kind: "invite"; name: string; email: string; inviteLink: string; emailSent: boolean };

/** True while the invite hasn't been redeemed — expired or not. */
function isPending(member: TeamMember): boolean {
  return Boolean(member.invite_expires_at);
}

function AdminsCard() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  const refresh = useCallback(async () => {
    const r = await listTeam();
    if (r.ok) setLoad({ state: "ready", items: r.data.items });
    else if (r.kind === "setup") setLoad({ state: "setup", message: r.message });
    else setLoad({ state: "error", message: r.message });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = load.state === "ready" ? load.items : [];

  return (
    <>
      {handoff && <HandoffCard handoff={handoff} onDismiss={() => setHandoff(null)} />}
      <Card
        title="Admins"
        description="People you invite can edit every section except this one. Removing or disabling someone signs them out at once."
      >
        {load.state === "loading" && (
          <p className="font-ui text-[13px] text-ink-subtle">Loading the team…</p>
        )}
        {load.state === "setup" && (
          <div className="border border-rule rounded-sm bg-row-alt p-4 font-ui text-[13px] text-ink-muted leading-relaxed">
            <p className="font-semibold text-ink mb-1">One-time setup needed</p>
            <p>{load.message}</p>
          </div>
        )}
        {load.state === "error" && <StatusLine tone="error" text={load.message} />}
        {load.state === "ready" &&
          (items.length === 0 ? (
            <p className="font-ui text-[13px] text-ink-subtle">
              No admins yet — it's just you. Add someone below.
            </p>
          ) : (
            <ul className="divide-y divide-rule border border-rule rounded-sm">
              {items.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onChanged={refresh}
                  onReset={(password) =>
                    setHandoff({ kind: "reset", name: m.display_name, username: m.username, password })
                  }
                  onResend={(email, inviteLink, emailSent) =>
                    setHandoff({ kind: "invite", name: m.display_name, email, inviteLink, emailSent })
                  }
                />
              ))}
            </ul>
          ))}
      </Card>

      {load.state === "ready" && (
        <AddAdminCard
          onAdded={(h) => {
            setHandoff(h);
            void refresh();
          }}
        />
      )}
    </>
  );
}

function MemberRow({
  member,
  onChanged,
  onReset,
  onResend,
}: {
  member: TeamMember;
  onChanged: () => void;
  onReset: (password: string) => void;
  onResend: (email: string, inviteLink: string, emailSent: boolean) => void;
}) {
  const [mode, setMode] = useState<"idle" | "reset" | "remove">("idle");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    const r = await action();
    setPending(false);
    if (!r.ok) {
      setError(r.message ?? "That didn't work.");
      return false;
    }
    return true;
  }

  const toggle = () =>
    run(async () => {
      const r = await updateTeamMember(member.id, { disabled: !member.disabled });
      return r.ok ? { ok: true } : { ok: false, message: r.message };
    }).then((ok) => ok && onChanged());

  const reset = () =>
    run(async () => {
      const r = await updateTeamMember(member.id, { password });
      return r.ok ? { ok: true } : { ok: false, message: r.message };
    }).then((ok) => {
      if (!ok) return;
      onReset(password);
      setPassword("");
      setMode("idle");
      onChanged();
    });

  const remove = () =>
    run(async () => {
      const r = await removeTeamMember(member.id);
      return r.ok ? { ok: true } : { ok: false, message: r.message };
    }).then((ok) => ok && onChanged());

  async function resend() {
    setPending(true);
    setError(null);
    const r = await updateTeamMember(member.id, { resendInvite: true });
    setPending(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    if (r.data.inviteLink) {
      onResend(member.email ?? "", r.data.inviteLink, r.data.emailSent ?? false);
    }
    onChanged();
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className={
            "grid h-9 w-9 shrink-0 place-items-center rounded-full font-ui text-[12px] font-semibold " +
            (member.disabled ? "bg-ribbon text-ink-subtle" : "bg-word-blue-light text-word-blue")
          }
        >
          {initials(member.display_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-ui text-[14px] font-medium text-ink">{member.display_name}</span>
            <span className="font-ui text-[12px] text-ink-subtle">@{member.username}</span>
            {member.disabled && (
              <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted bg-ribbon px-1.5 py-0.5 rounded-sm">
                Disabled
              </span>
            )}
            {isPending(member) && (
              <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-sm">
                {Date.parse(member.invite_expires_at!) > Date.now() ? "Invite pending" : "Invite expired"}
              </span>
            )}
          </div>
          <div className="font-ui text-[11px] text-ink-subtle">
            {isPending(member)
              ? `Hasn't set a password yet${member.email ? ` · sent to ${member.email}` : ""}`
              : member.last_login_at
                ? `Last signed in ${relativeTime(member.last_login_at)}`
                : "Hasn't signed in yet"}
          </div>
        </div>
        {mode === "idle" && (
          <div className="flex flex-wrap gap-1.5">
            {isPending(member) && (
              <Button variant="ghost" icon="forward_to_inbox" onClick={() => void resend()} disabled={pending}>
                Resend invite
              </Button>
            )}
            <Button variant="ghost" icon="key" onClick={() => { setPassword(generatePassword()); setMode("reset"); }} disabled={pending}>
              Reset password
            </Button>
            <Button variant="ghost" icon={member.disabled ? "check_circle" : "block"} onClick={() => void toggle()} disabled={pending}>
              {member.disabled ? "Enable" : "Disable"}
            </Button>
            <Button variant="ghost" icon="person_remove" onClick={() => setMode("remove")} disabled={pending}>
              Remove
            </Button>
          </div>
        )}
      </div>

      {mode === "reset" && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 pl-12"
          onSubmit={(e) => {
            e.preventDefault();
            void reset();
          }}
        >
          <div className="flex-1 min-w-[14rem]">
            <Field label={`New password for ${member.display_name}`} hint="Signs them out everywhere">
              <Input value={password} onChange={setPassword} monospace />
            </Field>
          </div>
          <Button variant="secondary" icon="casino" onClick={() => setPassword(generatePassword())}>
            Generate
          </Button>
          <Button type="submit" variant="primary" disabled={pending || password.length < 10}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => setMode("idle")}>
            Cancel
          </Button>
        </form>
      )}

      {mode === "remove" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-12">
          <span className="font-ui text-[13px] text-ink">
            Remove {member.display_name}? They're signed out immediately. Their past edits stay in History.
          </span>
          <Button variant="danger" icon="person_remove" onClick={() => void remove()} disabled={pending}>
            Remove
          </Button>
          <Button variant="ghost" onClick={() => setMode("idle")}>
            Keep
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-2 pl-12">
          <StatusLine tone="error" text={error} />
        </div>
      )}
    </li>
  );
}

const EMAIL_RE = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;

/** "Maria Santos" -> "maria", sanitized to match the server's USERNAME_RE. */
function suggestUsername(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 32);
}

function AddAdminCard({ onAdded }: { onAdded: (h: Handoff) => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    const r = await addTeamMember({ name, username, email });
    setPending(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    onAdded({
      kind: "invite",
      name: r.data.display_name,
      email,
      inviteLink: r.data.inviteLink,
      emailSent: r.data.emailSent,
    });
    setName("");
    setUsername("");
    setUsernameTouched(false);
    setEmail("");
  }

  return (
    <Card
      title="Add an admin"
      description="They'll get a link by email to set their own password and sign in — you never see or send it yourself."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Row>
          <Field label="Display name" hint="Shown in History">
            <Input
              value={name}
              onChange={(v) => {
                setName(v);
                if (!usernameTouched) setUsername(suggestUsername(v));
              }}
              placeholder="Maria Santos"
            />
          </Field>
          <Field label="Username" hint="Lowercase, 3–32 characters">
            <Input
              value={username}
              onChange={(v) => {
                setUsername(v.toLowerCase().replace(/\s+/g, ""));
                setUsernameTouched(true);
              }}
              placeholder="maria"
            />
          </Field>
        </Row>
        <Field label="Email" hint="Where their invite link goes">
          <Input type="email" value={email} onChange={setEmail} placeholder="maria@example.com" />
        </Field>
        {error && <StatusLine tone="error" text={error} />}
        <Button
          type="submit"
          variant="primary"
          icon="forward_to_inbox"
          disabled={pending || !name.trim() || username.length < 3 || !EMAIL_RE.test(email.trim())}
        >
          {pending ? "Sending invite…" : "Send invite"}
        </Button>
      </form>
    </Card>
  );
}

/** The only time a password is shown in full. Copy it, send it, done. */
function HandoffCard({ handoff, onDismiss }: { handoff: Handoff; onDismiss: () => void }) {
  if (handoff.kind === "reset") return <ResetHandoff handoff={handoff} onDismiss={onDismiss} />;
  return <InviteHandoff handoff={handoff} onDismiss={onDismiss} />;
}

/** The only time a password is shown in full. Copy it, send it, done. */
function ResetHandoff({
  handoff,
  onDismiss,
}: {
  handoff: Extract<Handoff, { kind: "reset" }>;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const signIn = `${window.location.origin}/admin`;
  const text = `Sign in to edit the portfolio: ${signIn}\nUsername: ${handoff.username}\nPassword: ${handoff.password}`;

  return (
    <section role="status" className="mb-6 border border-word-blue rounded-sm bg-paper overflow-hidden">
      <div className="flex items-center gap-2 border-b border-rule bg-word-blue-light px-4 py-2">
        <span aria-hidden="true" className="material-symbols-outlined icon-fill text-word-blue" style={{ fontSize: 16 }}>
          key
        </span>
        <span className="font-ui text-[12px] font-semibold text-word-blue">
          New password for {handoff.name}
        </span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <p className="font-ui text-[12px] text-ink-muted">
          Send this privately. The password won't be shown again — if it's lost, reset it again.
        </p>
        <pre className="font-ui text-[12px] text-ink bg-row-alt border border-rule rounded-sm px-3 py-2 whitespace-pre-wrap break-all">
          {text}
        </pre>
        <div className="flex gap-2">
          <Button
            variant="primary"
            icon={copied ? "check" : "content_copy"}
            onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
          >
            {copied ? "Copied" : "Copy details"}
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Done
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Shown right after inviting (or resending an invite to) an admin. */
function InviteHandoff({
  handoff,
  onDismiss,
}: {
  handoff: Extract<Handoff, { kind: "invite" }>;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const gmailHref = `https://mail.google.com/mail/?${new URLSearchParams({
    view: "cm",
    fs: "1",
    to: handoff.email,
    su: "You're invited to edit Portfolio.docx",
    body: `Hi ${handoff.name},\n\nYou've been added as an admin on the portfolio. Set your password here (this link works once and expires in 7 days):\n${handoff.inviteLink}`,
  })}`;

  return (
    <section role="status" className="mb-6 border border-word-blue rounded-sm bg-paper overflow-hidden">
      <div className="flex items-center gap-2 border-b border-rule bg-word-blue-light px-4 py-2">
        <span aria-hidden="true" className="material-symbols-outlined icon-fill text-word-blue" style={{ fontSize: 16 }}>
          how_to_reg
        </span>
        <span className="font-ui text-[12px] font-semibold text-word-blue">
          {handoff.emailSent ? `Invite sent to ${handoff.name}` : `${handoff.name}'s invite is ready`}
        </span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <p className="font-ui text-[12px] text-ink-muted">
          {handoff.emailSent
            ? `An email went to ${handoff.email} with a link to set their password. It works once and expires in 7 days.`
            : `Email sending isn't set up yet, so nothing was sent automatically. Share this link with ${handoff.name} yourself — it works once and expires in 7 days.`}
        </p>
        <pre className="font-ui text-[12px] text-ink bg-row-alt border border-rule rounded-sm px-3 py-2 whitespace-pre-wrap break-all">
          {handoff.inviteLink}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={copied ? "check" : "content_copy"}
            onClick={() => void navigator.clipboard.writeText(handoff.inviteLink).then(() => setCopied(true))}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button variant="secondary" icon="mail" onClick={() => window.open(gmailHref, "_blank", "noopener")}>
            Open in Gmail
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Done
          </Button>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- pieces -------------------------------- */

function PasswordInput({
  label,
  hint,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full bg-paper border border-rule rounded-sm px-3 py-2 text-[14px] text-ink outline-none transition-colors focus:border-word-blue focus:ring-2 focus:ring-word-blue/20"
      />
    </Field>
  );
}

function StatusLine({ tone, text }: { tone: "ok" | "error"; text: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        "flex items-start gap-1.5 font-ui text-[12px] leading-snug " +
        (tone === "error" ? "text-red-700 dark:text-red-400" : "text-word-blue")
      }
    >
      <span aria-hidden="true" className="material-symbols-outlined shrink-0 mt-px" style={{ fontSize: 14 }}>
        {tone === "error" ? "error" : "check_circle"}
      </span>
      <span>{text}</span>
    </p>
  );
}

/** Compact "2h ago"; falls back to a date past a week. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
