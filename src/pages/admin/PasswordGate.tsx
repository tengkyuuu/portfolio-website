import { useEffect, useRef, useState } from "react";
import { fetchHealth } from "../../lib/api";
import { getExpectedHash, login, sha256Hex } from "../../lib/auth";

type Props = {
  onAuth: () => void;
};

export function PasswordGate({ onAuth }: Props) {
  const expected = getExpectedHash();
  // The server may have ADMIN_PASSWORD_HASH configured even when the client
  // bundle has no VITE_ hash — ask it before declaring setup incomplete.
  const [serverAuth, setServerAuth] = useState<boolean | null>(null);

  useEffect(() => {
    if (expected) return;
    void fetchHealth().then((h) => setServerAuth(h?.authConfigured ?? false));
  }, [expected]);

  if (expected || serverAuth) return <Gate onAuth={onAuth} />;
  if (serverAuth === null) return null; // health check in flight
  return <SetupGuide />;
}

/* ─── Sign-in dialog — modelled on MS Word's "Restrict editing" / sign-in panel ─── */

function Gate({ onAuth }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the password field on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function attempt() {
    if (pending) return;
    setError(null);
    setPending(true);
    const result = await login(value);
    setPending(false);
    if (result.ok) {
      onAuth();
      return;
    }
    setError(result.error);
    setShaking(true);
    setTimeout(() => setShaking(false), 420);
    // Keep what they typed so they can correct, but select it for easy retry
    requestAnimationFrame(() => inputRef.current?.select());
  }

  return (
    <div className="min-h-svh bg-workspace flex items-center justify-center px-4 py-12">
      <div
        className={
          "w-full max-w-[440px] bg-paper paper-shadow rounded-sm overflow-hidden transition-transform " +
          (shaking ? "animate-[shake_0.4s_ease]" : "")
        }
      >
        {/* Word ribbon strip */}
        <div className="h-[3px] bg-word-blue" aria-hidden="true" />

        {/* Title bar — looks like a Word document title */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-rule bg-ribbon">
          <span
            className="material-symbols-outlined icon-fill text-word-blue"
            style={{ fontSize: 20 }}
          >
            description
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-ui text-[13px] font-semibold text-ink leading-tight">
              Portfolio.docx
            </div>
            <div className="font-ui text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              Restricted — Sign in to edit
            </div>
          </div>
          <a
            href="/"
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-sm text-ink-muted hover:bg-ribbon-hover hover:text-ink transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              close
            </span>
          </a>
        </div>

        {/* Body */}
        <div className="px-7 py-7">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="material-symbols-outlined icon-fill text-word-blue"
              style={{ fontSize: 32 }}
            >
              lock_person
            </span>
            <div>
              <h1 className="font-doc text-[22px] font-bold text-ink leading-tight">
                Sign in
              </h1>
              <p className="font-ui text-[12px] text-ink-subtle">
                Enter the document password to make edits.
              </p>
            </div>
          </div>

          {/* Password field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void attempt();
            }}
            className="space-y-3"
          >
            <label className="block">
              <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Password
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
                  autoComplete="current-password"
                  spellCheck={false}
                  disabled={pending}
                  placeholder="Document password"
                  className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-subtle outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  aria-label={revealed ? "Hide password" : "Show password"}
                  title={revealed ? "Hide password" : "Show password"}
                  tabIndex={-1}
                  className="grid w-10 place-items-center text-ink-muted hover:text-ink hover:bg-ribbon-hover border-l border-rule transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {revealed ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </label>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-1.5 font-ui text-[12px] text-red-700 dark:text-red-400 leading-snug"
              >
                <span
                  className="material-symbols-outlined shrink-0 mt-px"
                  style={{ fontSize: 14 }}
                >
                  error
                </span>
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={pending || !value}
              className="w-full inline-flex items-center justify-center gap-2 bg-word-blue hover:bg-word-blue-dark active:scale-[0.99] text-white font-ui text-[14px] font-semibold py-2.5 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? (
                <>
                  <span
                    className="material-symbols-outlined animate-spin"
                    style={{ fontSize: 16 }}
                  >
                    progress_activity
                  </span>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Helper row */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 font-ui text-[11px]">
            <a
              href="/"
              className="inline-flex items-center gap-1 text-ink-subtle hover:text-ink"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                arrow_back
              </span>
              Back to portfolio
            </a>
            <span className="text-ink-subtle">
              Only the document owner can edit.
            </span>
          </div>
        </div>

        {/* Status strip — Word-style footer */}
        <div className="px-5 py-1.5 border-t border-rule bg-ribbon font-ui text-[10px] uppercase tracking-[0.14em] text-ink-subtle flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            shield
          </span>
          <span>End-to-end encrypted</span>
          <span className="ml-auto tabular-nums">SHA-256</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Setup screen — shown when neither server nor VITE_ADMIN_PASSWORD_HASH is configured ─── */

function SetupGuide() {
  const [pw, setPw] = useState("");
  const [hash, setHash] = useState("");
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!pw) {
      setHash("");
      return;
    }
    let cancelled = false;
    void sha256Hex(pw).then((h) => {
      if (!cancelled) setHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [pw]);

  return (
    <div className="min-h-svh bg-workspace flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[560px] bg-paper paper-shadow rounded-sm overflow-hidden">
        <div className="h-[3px] bg-amber-500" aria-hidden="true" />

        <div className="flex items-center gap-2 px-5 py-3 border-b border-rule bg-ribbon">
          <span
            className="material-symbols-outlined icon-fill text-amber-600 dark:text-amber-400"
            style={{ fontSize: 20 }}
          >
            warning
          </span>
          <div className="flex-1">
            <div className="font-ui text-[13px] font-semibold text-ink leading-tight">
              Portfolio.docx
            </div>
            <div className="font-ui text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              Setup required
            </div>
          </div>
          <a
            href="/"
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-sm text-ink-muted hover:bg-ribbon-hover hover:text-ink transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              close
            </span>
          </a>
        </div>

        <div className="px-7 py-6">
          <h1 className="font-doc text-[22px] font-bold text-ink leading-tight mb-1">
            No admin password configured
          </h1>
          <p className="font-ui text-[13px] text-ink-muted leading-relaxed">
            Generate a SHA-256 hash of your chosen password, then set it as the{" "}
            <code className="font-ui text-[12px] bg-ribbon px-1 rounded-sm">
              VITE_ADMIN_PASSWORD_HASH
            </code>{" "}
            environment variable in your hosting provider and redeploy.
          </p>

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                1 · Type your desired password
              </span>
              <div className="mt-1.5 flex items-stretch border border-rule rounded-sm bg-paper focus-within:border-word-blue focus-within:ring-2 focus-within:ring-word-blue/20 transition-colors">
                <input
                  type={revealed ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  spellCheck={false}
                  placeholder="A long, random passphrase"
                  className="flex-1 bg-transparent px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-subtle outline-none"
                />
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  aria-label={revealed ? "Hide" : "Show"}
                  tabIndex={-1}
                  className="grid w-10 place-items-center text-ink-muted hover:text-ink border-l border-rule"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {revealed ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </label>

            {hash && (
              <div className="border border-rule rounded-sm bg-row-alt p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-ui text-[10px] uppercase tracking-[0.15em] text-ink-subtle">
                    2 · SHA-256 hash
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(hash);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-sm font-ui text-[11px] font-medium bg-word-blue text-white hover:bg-word-blue-dark transition-colors"
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 13 }}
                    >
                      {copied ? "check" : "content_copy"}
                    </span>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <code className="font-ui text-[11px] text-ink break-all leading-relaxed">
                  {hash}
                </code>
              </div>
            )}

            <div className="border border-rule rounded-sm bg-ribbon p-3">
              <div className="font-ui text-[10px] uppercase tracking-[0.15em] text-ink-subtle mb-1.5">
                3 · Paste into your env
              </div>
              <pre className="font-ui text-[12px] text-ink overflow-x-auto">
{`VITE_ADMIN_PASSWORD_HASH=${hash || "<your-hash-here>"}`}
              </pre>
              <p className="font-ui text-[11px] text-ink-subtle mt-2">
                On Vercel: Project → Settings → Environment Variables. Apply to{" "}
                <b>Production · Preview · Development</b>, then trigger a fresh deploy.
              </p>
            </div>
          </div>

          <a
            href="/"
            className="mt-6 inline-flex items-center gap-1 font-ui text-[12px] text-ink-subtle hover:text-ink"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              arrow_back
            </span>
            Back to portfolio
          </a>
        </div>
      </div>
    </div>
  );
}
