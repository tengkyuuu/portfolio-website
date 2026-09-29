import { useEffect, useRef, useState } from "react";
import { establishSession } from "../../lib/auth";
import { acceptInvite, checkInvite } from "../../lib/team-api";

type Props = {
  token: string;
  onAuthed: () => void;
};

/**
 * The other half of "invite an admin by email" — what opens when someone
 * clicks the link. Validates the token first (so a stale link says so
 * before anyone types a password), then lets them pick their own, and
 * signs them straight in on success. Modelled on PasswordGate's sign-in
 * dialog for visual consistency — same restricted-document framing.
 */
export function AcceptInvite({ token, onAuthed }: Props) {
  const [check, setCheck] = useState<{ name: string; username: string } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkInvite(token).then((r) => {
      if (cancelled) return;
      setCheck(r.ok ? { name: r.name, username: r.username } : { error: r.message });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-svh bg-workspace flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] bg-paper paper-shadow rounded-sm overflow-hidden">
        <div className="h-[3px] bg-word-blue" aria-hidden="true" />
        <div className="flex items-center gap-2 px-5 py-3 border-b border-rule bg-ribbon">
          <span className="material-symbols-outlined icon-fill text-word-blue" style={{ fontSize: 20 }}>
            description
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-ui text-[13px] font-semibold text-ink leading-tight">Portfolio.docx</div>
            <div className="font-ui text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              You're invited to edit
            </div>
          </div>
        </div>

        <div className="px-7 py-7">
          {check === null && (
            <p className="font-ui text-[13px] text-ink-subtle">Checking your invite…</p>
          )}
          {check && "error" in check && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined icon-fill text-red-500" style={{ fontSize: 32 }}>
                  link_off
                </span>
                <h1 className="font-doc text-[20px] font-bold text-ink leading-tight">
                  That invite link doesn't work anymore
                </h1>
              </div>
              <p className="font-ui text-[13px] text-ink-muted leading-relaxed">{check.error}</p>
              <a
                href="/"
                className="mt-6 inline-flex items-center gap-1 font-ui text-[12px] text-ink-subtle hover:text-ink"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  arrow_back
                </span>
                Back to portfolio
              </a>
            </>
          )}
          {check && "name" in check && (
            <SetPasswordForm token={token} name={check.name} onAuthed={onAuthed} />
          )}
        </div>

        <div className="px-5 py-1.5 border-t border-rule bg-ribbon font-ui text-[10px] uppercase tracking-[0.14em] text-ink-subtle flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            shield
          </span>
          <span>This link works once</span>
        </div>
      </div>
    </div>
  );
}

function SetPasswordForm({ token, name, onAuthed }: { token: string; name: string; onAuthed: () => void }) {
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit() {
    if (pending) return;
    if (value.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (value !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setError(null);
    setPending(true);
    const result = await acceptInvite(token, value);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    establishSession(result.token, result.user);
    onAuthed();
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined icon-fill text-word-blue" style={{ fontSize: 32 }}>
          person_add
        </span>
        <div>
          <h1 className="font-doc text-[22px] font-bold text-ink leading-tight">Hi {name}</h1>
          <p className="font-ui text-[12px] text-ink-subtle">
            Set a password to finish setting up your account.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            New password
          </span>
          <div
            className={
              "mt-1.5 flex items-stretch border rounded-sm bg-paper transition-colors " +
              (error
                ? "border-red-500 focus-within:ring-2 focus-within:ring-red-500/20"
                : "border-rule focus-within:border-word-blue focus-within:ring-2 focus-within:ring-word-blue/20")
            }
          >
            <input
              ref={inputRef}
              type={revealed ? "text" : "password"}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              autoComplete="new-password"
              spellCheck={false}
              disabled={pending}
              placeholder="At least 10 characters"
              className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-subtle outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide password" : "Show password"}
              tabIndex={-1}
              className="grid w-10 place-items-center text-ink-muted hover:text-ink hover:bg-ribbon-hover border-l border-rule transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {revealed ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </label>

        <label className="block">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Confirm password
          </span>
          <input
            type={revealed ? "text" : "password"}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (error) setError(null);
            }}
            autoComplete="new-password"
            spellCheck={false}
            disabled={pending}
            className="mt-1.5 w-full border border-rule rounded-sm bg-paper px-3 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-word-blue focus:ring-2 focus:ring-word-blue/20 disabled:opacity-50"
          />
        </label>

        {error && (
          <p role="alert" className="flex items-start gap-1.5 font-ui text-[12px] text-red-700 dark:text-red-400 leading-snug">
            <span className="material-symbols-outlined shrink-0 mt-px" style={{ fontSize: 14 }}>
              error
            </span>
            <span>{error}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !value || !confirm}
          className="w-full inline-flex items-center justify-center gap-2 bg-word-blue hover:bg-word-blue-dark active:scale-[0.99] text-paper font-ui text-[14px] font-semibold py-2.5 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>
                progress_activity
              </span>
              Setting up…
            </>
          ) : (
            <>
              Set password and sign in
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                arrow_forward
              </span>
            </>
          )}
        </button>
      </form>
    </>
  );
}
