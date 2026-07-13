import { useEffect, useState } from "react";

/**
 * /status — engineering-facing dashboard for this site.
 *
 * Three panels:
 *
 *   1) BUILD  — bundle sizes + gzip totals from dist/metrics.json,
 *               written by scripts/collect-metrics.mjs on postbuild.
 *   2) DEPLOY — commit SHA, ref, message, environment (from Vercel env),
 *               plus generatedAt timestamp.
 *   3) LIVE   — measured Core Web Vitals for the current visit
 *               (LCP, INP, CLS) using native PerformanceObserver — no
 *               third-party dependency. Renders "—" until a real value
 *               is captured; each metric has a green/amber/red bracket
 *               keyed to Google's public thresholds.
 *
 * The page is intentionally styled as a Word "System Info" style pane:
 *   • Every card is a bordered paper block.
 *   • Numbers are tabular-nums so alignment holds across values.
 *   • Colour tiers are conservative; a11y-safe contrast against paper.
 */

type Bundle = {
  name: string;
  kind: "js" | "css";
  rawBytes: number;
  gzipBytes: number;
};

type Metrics = {
  generatedAt: string;
  environment: string;
  commit: {
    sha: string | null;
    shortSha: string | null;
    ref: string | null;
    message: string | null;
  };
  bundles: Bundle[];
  totals: { rawBytes: number; gzipBytes: number };
  indexHtmlBytes: number;
};

type Vital = {
  value: number | null;
  rating: "good" | "needs" | "poor" | null;
};

export function StatusPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [lcp, setLcp] = useState<Vital>({ value: null, rating: null });
  const [inp, setInp] = useState<Vital>({ value: null, rating: null });
  const [cls, setCls] = useState<Vital>({ value: null, rating: null });

  // Fetch build-time metrics
  useEffect(() => {
    let alive = true;
    fetch("/metrics.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: Metrics) => {
        if (alive) setMetrics(m);
      })
      .catch((e) => {
        if (alive) setMetricsError((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Live LCP
  useEffect(() => {
    const supported =
      "PerformanceObserver" in window &&
      PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint");
    if (!supported) return;
    let last: number | null = null;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        last = (entry as PerformanceEntry & { startTime: number }).startTime;
      }
      if (last !== null) {
        const v = Math.round(last);
        setLcp({ value: v, rating: rateLcp(v) });
      }
    });
    try {
      po.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      /* no-op */
    }
    return () => po.disconnect();
  }, []);

  // Live INP (Interaction to Next Paint) — Chromium only, degrades gracefully
  useEffect(() => {
    const supported =
      "PerformanceObserver" in window &&
      PerformanceObserver.supportedEntryTypes?.includes("event");
    if (!supported) return;
    let worstDuration = 0;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const d = (entry as PerformanceEntry & { duration: number }).duration;
        if (d > worstDuration) worstDuration = d;
      }
      if (worstDuration > 0) {
        const v = Math.round(worstDuration);
        setInp({ value: v, rating: rateInp(v) });
      }
    });
    try {
      // durationThreshold=40 keeps the observer cheap.
      po.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    } catch {
      /* no-op */
    }
    return () => po.disconnect();
  }, []);

  // Live CLS
  useEffect(() => {
    const supported =
      "PerformanceObserver" in window &&
      PerformanceObserver.supportedEntryTypes?.includes("layout-shift");
    if (!supported) return;
    let running = 0;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!e.hadRecentInput) running += e.value;
      }
      const v = Number(running.toFixed(3));
      setCls({ value: v, rating: rateCls(v) });
    });
    try {
      po.observe({ type: "layout-shift", buffered: true });
    } catch {
      /* no-op */
    }
    return () => po.disconnect();
  }, []);

  return (
    <div className="min-h-svh bg-workspace text-ink py-6 md:py-10 px-3">
      <div className="max-w-[820px] mx-auto space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 font-ui text-[13px] text-ink-muted hover:text-ink"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_back
            </span>
            Back to portfolio
          </a>
          <span className="font-ui text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
            /status — engineering dashboard
          </span>
        </div>

        {/* Header */}
        <div className="bg-paper paper-shadow rounded-sm border border-rule px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="material-symbols-outlined icon-fill text-word-blue"
              style={{ fontSize: 18 }}
            >
              monitoring
            </span>
            <h1 className="font-doc text-[22px] font-bold text-ink leading-tight">
              System Info
            </h1>
          </div>
          <p className="font-ui text-[12px] text-ink-subtle">
            Honest, live numbers for this deployment. Build metrics come from{" "}
            <code className="bg-ribbon px-1 rounded-sm">scripts/collect-metrics.mjs</code>.
            Web Vitals are measured on <em>this</em> page load.
          </p>
        </div>

        {/* Build panel */}
        <Card icon="package_2" title="Build">
          {metricsError && !metrics ? (
            <p className="font-ui text-[13px] text-ink-subtle italic">
              Couldn't load <code className="bg-ribbon px-1 rounded-sm">/metrics.json</code>
              {" "}({metricsError}). Run <code className="bg-ribbon px-1 rounded-sm">npm run build</code>{" "}
              once and the file appears in <code className="bg-ribbon px-1 rounded-sm">dist/</code>.
            </p>
          ) : !metrics ? (
            <SkeletonRows count={3} />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Stat
                  label="Bundles"
                  value={String(metrics.bundles.length)}
                  hint="JS + CSS chunks"
                />
                <Stat
                  label="Raw total"
                  value={fmtBytes(metrics.totals.rawBytes)}
                  hint="uncompressed"
                />
                <Stat
                  label="Gzipped"
                  value={fmtBytes(metrics.totals.gzipBytes)}
                  hint="over the wire"
                  emphasis
                />
                <Stat
                  label="index.html"
                  value={fmtBytes(metrics.indexHtmlBytes)}
                  hint="shell"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full font-ui text-[12px] border-collapse">
                  <thead>
                    <tr className="text-left text-ink-subtle uppercase tracking-wider text-[10px]">
                      <th className="py-1.5 pr-3 font-semibold">Bundle</th>
                      <th className="py-1.5 pr-3 font-semibold">Kind</th>
                      <th className="py-1.5 pr-3 font-semibold text-right tabular-nums">Raw</th>
                      <th className="py-1.5 font-semibold text-right tabular-nums">Gzip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {metrics.bundles.map((b) => (
                      <tr key={b.name}>
                        <td className="py-1.5 pr-3 text-ink truncate max-w-[220px]">{b.name}</td>
                        <td className="py-1.5 pr-3 text-ink-muted">{b.kind.toUpperCase()}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-ink-muted">
                          {fmtBytes(b.rawBytes)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-ink font-semibold">
                          {fmtBytes(b.gzipBytes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Deploy panel */}
        <Card icon="rocket_launch" title="Deploy">
          {!metrics ? (
            <SkeletonRows count={3} />
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 font-ui text-[13px]">
              <Row
                dt="Environment"
                dd={
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider " +
                      (metrics.environment === "production"
                        ? "bg-word-blue-light text-word-blue"
                        : "bg-ribbon text-ink-muted")
                    }
                  >
                    {metrics.environment}
                  </span>
                }
              />
              <Row dt="Branch" dd={metrics.commit.ref ?? "—"} />
              <Row
                dt="Commit"
                dd={
                  metrics.commit.shortSha ? (
                    <code className="bg-ribbon px-1.5 rounded-sm">
                      {metrics.commit.shortSha}
                    </code>
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                dt="Message"
                dd={
                  <span className="text-ink-muted truncate block max-w-full">
                    {metrics.commit.message ?? "—"}
                  </span>
                }
              />
              <Row dt="Built" dd={formatWhen(metrics.generatedAt)} full />
            </dl>
          )}
        </Card>

        {/* Live vitals panel */}
        <Card icon="speed" title="Core Web Vitals (this visit)">
          <p className="font-ui text-[12px] text-ink-subtle mb-3 italic">
            Measured on this page load — real, not synthetic. Numbers fill in as
            the observers fire. INP requires an interaction; move your cursor or
            scroll to seed it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <VitalTile
              label="LCP"
              full="Largest Contentful Paint"
              value={fmtMs(lcp.value)}
              rating={lcp.rating}
              thresholds="≤ 2.5s good · ≤ 4s ok"
            />
            <VitalTile
              label="INP"
              full="Interaction to Next Paint"
              value={fmtMs(inp.value)}
              rating={inp.rating}
              thresholds="≤ 200ms good · ≤ 500ms ok"
            />
            <VitalTile
              label="CLS"
              full="Cumulative Layout Shift"
              value={cls.value === null ? "—" : cls.value.toFixed(3)}
              rating={cls.rating}
              thresholds="≤ 0.1 good · ≤ 0.25 ok"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- pieces ---------------- */

function Card({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-paper paper-shadow rounded-sm border border-rule">
      <header className="flex items-center gap-2 border-b border-rule px-5 py-2.5 bg-ribbon">
        <span
          className="material-symbols-outlined icon-fill text-word-blue"
          style={{ fontSize: 16 }}
        >
          {icon}
        </span>
        <h2 className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-word-blue">
          {title}
        </h2>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </div>
      <div
        className={
          "font-doc tabular-nums leading-none mt-0.5 " +
          (emphasis
            ? "text-[24px] font-bold text-word-blue"
            : "text-[20px] font-bold text-ink")
        }
      >
        {value}
      </div>
      {hint && (
        <div className="font-ui text-[10px] text-ink-subtle italic mt-0.5">
          {hint}
        </div>
      )}
    </div>
  );
}

function Row({
  dt,
  dd,
  full,
}: {
  dt: string;
  dd: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {dt}
      </dt>
      <dd className="font-ui text-[13px] text-ink mt-0.5">{dd}</dd>
    </div>
  );
}

function VitalTile({
  label,
  full,
  value,
  rating,
  thresholds,
}: {
  label: string;
  full: string;
  value: string;
  rating: Vital["rating"];
  thresholds: string;
}) {
  const tone =
    rating === "good"
      ? "border-l-4 border-word-blue"
      : rating === "needs"
        ? "border-l-4 border-amber-500"
        : rating === "poor"
          ? "border-l-4 border-red-500"
          : "border-l-4 border-rule";
  const ratingChip = ratingLabel(rating);
  return (
    <div className={"bg-row-alt rounded-sm px-3 py-2.5 " + tone}>
      <div className="flex items-baseline gap-1">
        <span className="font-ui text-[11px] font-bold uppercase tracking-wider text-ink">
          {label}
        </span>
        <span className="font-ui text-[10px] text-ink-subtle italic">— {full}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-doc text-[24px] font-bold text-ink tabular-nums">
          {value}
        </span>
        {ratingChip && (
          <span
            className={
              "inline-flex items-center rounded-sm px-1.5 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wider " +
              ratingChip.tone
            }
          >
            {ratingChip.label}
          </span>
        )}
      </div>
      <div className="font-ui text-[10px] text-ink-subtle mt-1">{thresholds}</div>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-3 bg-rule/80 rounded-sm animate-pulse" style={{ width: `${80 - i * 8}%` }} />
      ))}
    </div>
  );
}

/* ---------------- rating + formatters ---------------- */

function rateLcp(ms: number): "good" | "needs" | "poor" {
  if (ms <= 2500) return "good";
  if (ms <= 4000) return "needs";
  return "poor";
}
function rateInp(ms: number): "good" | "needs" | "poor" {
  if (ms <= 200) return "good";
  if (ms <= 500) return "needs";
  return "poor";
}
function rateCls(v: number): "good" | "needs" | "poor" {
  if (v <= 0.1) return "good";
  if (v <= 0.25) return "needs";
  return "poor";
}

function ratingLabel(r: Vital["rating"]) {
  if (r === "good") return { label: "Good", tone: "bg-word-blue-light text-word-blue" };
  if (r === "needs") return { label: "Improve", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" };
  if (r === "poor") return { label: "Poor", tone: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" };
  return null;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtMs(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(2)} s`;
  return `${Math.round(v)} ms`;
}

function formatWhen(iso: string): string {
  try {
    const then = new Date(iso);
    const diff = Date.now() - then.getTime();
    const abs = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(then);
    return `${abs} · ${humanDiff(diff)} ago`;
  } catch {
    return iso;
  }
}

function humanDiff(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
