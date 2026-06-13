import { useEffect, useState } from "react";
import { fetchHealth } from "../../lib/api";
import { getExpectedHash, login, sha256Hex } from "../../lib/auth";
import { Button, Input } from "./ui";

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

function Gate({ onAuth }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [pending, setPending] = useState(false);

  async function attempt() {
    setPending(true);
    const result = await login(value);
    setPending(false);
    if (result.ok) {
      onAuth();
    } else {
      setError(result.error);
      setShaking(true);
      setValue("");
      setTimeout(() => setShaking(false), 500);
    }
  }

  return (
    <div className="min-h-svh bg-workspace flex items-center justify-center px-4">
      <div
        className={
          "bg-paper paper-shadow w-full max-w-sm rounded-sm border border-rule p-8 transition-transform " +
          (shaking ? "animate-[shake_0.4s_ease]" : "")
        }
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="material-symbols-outlined icon-fill text-word-blue"
            style={{ fontSize: 18 }}
          >
            description
          </span>
          <span className="font-ui text-[14px] font-semibold text-ink">
            Portfolio.docx
          </span>
        </div>
        <p className="font-ui text-[11px] uppercase tracking-[0.18em] text-ink-subtle mb-6">
          Admin Console — Sign In
        </p>

        <div className="space-y-3">
          <Input
            type="text"
            value={value}
            onChange={(v) => {
              setValue(v);
              setError(null);
            }}
            placeholder="Password"
          />
          <input
            // Hidden real password input — keeps autofill behavior reasonable
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void attempt();
            }}
            placeholder="Password"
            autoFocus
            className="w-full bg-paper border border-rule rounded-sm px-3 py-2 text-[14px] text-ink placeholder:text-ink-subtle outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20"
          />
          {error && (
            <p className="font-ui text-[12px] text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={attempt} disabled={pending} icon="login">
            {pending ? "Checking…" : "Enter"}
          </Button>
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
  );
}

/** Shown when VITE_ADMIN_PASSWORD_HASH isn't configured.
 *  Includes a tiny hash generator so the user can produce a hash right here. */
function SetupGuide() {
  const [pw, setPw] = useState("");
  const [hash, setHash] = useState("");
  const [copied, setCopied] = useState(false);

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
      <div className="bg-paper paper-shadow w-full max-w-xl rounded-sm border border-rule p-8">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="material-symbols-outlined icon-fill text-word-blue"
            style={{ fontSize: 18 }}
          >
            shield_lock
          </span>
          <span className="font-ui text-[14px] font-semibold text-ink">
            Admin Setup Required
          </span>
        </div>
        <p className="font-ui text-[11px] uppercase tracking-[0.18em] text-ink-subtle mb-5">
          Add VITE_ADMIN_PASSWORD_HASH to .env.local
        </p>

        <div className="space-y-3 font-doc text-[15px] text-ink leading-[1.7]">
          <p>
            The admin is gated by a SHA-256 hash of your password. The hash
            ships in the bundle; the plaintext password does not.
          </p>
          <ol className="list-decimal pl-5 space-y-1.5 text-[14px]">
            <li>Type a strong password below to generate its SHA-256 hash.</li>
            <li>
              Copy the hash and add it to{" "}
              <code className="font-ui bg-ribbon px-1.5 rounded-sm text-[13px]">
                .env.local
              </code>{" "}
              at the project root:
              <pre className="mt-2 bg-ribbon font-ui text-[12px] px-3 py-2 rounded-sm border border-rule overflow-x-auto">
{`VITE_ADMIN_PASSWORD_HASH=<your hash here>`}
              </pre>
            </li>
            <li>Restart the dev server, then reload this page.</li>
          </ol>
        </div>

        <div className="mt-6 space-y-3">
          <input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Type a password to hash"
            className="w-full bg-paper border border-rule rounded-sm px-3 py-2 text-[14px] text-ink placeholder:text-ink-subtle outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20"
          />
          {hash && (
            <div className="border border-rule rounded-sm bg-row-alt p-3">
              <p className="font-ui text-[10px] uppercase tracking-[0.15em] text-ink-subtle mb-1">
                SHA-256 hash
              </p>
              <code className="font-ui text-[12px] text-ink break-all">{hash}</code>
              <div className="mt-3 flex justify-end">
                <Button
                  variant="primary"
                  icon={copied ? "check" : "content_copy"}
                  onClick={() => {
                    navigator.clipboard.writeText(hash);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  {copied ? "Copied" : "Copy hash"}
                </Button>
              </div>
            </div>
          )}
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
  );
}
