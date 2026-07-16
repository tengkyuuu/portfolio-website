import { useEffect, useMemo, useState } from "react";
import type { Project } from "../lib/content";

/**
 * Interactive project figure — the project isn't just a screenshot anymore.
 *
 * A Word-style view-tab strip (like Word's Print Layout / Web Layout view
 * switcher) selects between up to three modes:
 *
 *   Print Layout — the existing screenshot / carousel (children slot)
 *   Web Layout   — the LIVE project embedded in an iframe, with a
 *                  desktop / tablet / phone device-frame toggle, loading
 *                  shimmer, and "Open in new tab"
 *   Media        — a demo video: YouTube (privacy-enhanced nocookie embed)
 *                  or a direct .mp4/.webm file
 *
 * Tabs render only when their data exists; a project with only
 * screenshots shows no strip at all (zero regression).
 *
 * QA notes:
 *   • The iframe mounts ONLY when its tab is first activated (lazy) and
 *     stays mounted after, so switching tabs doesn't reload the demo.
 *   • sandbox + referrerPolicy on the iframe; some sites deny embedding
 *     via X-Frame-Options — the panel shows a fallback hint + open button
 *     (we can't detect the denial from JS, so the hint is always present
 *     in the footer).
 *   • Device widths: desktop fills, tablet 768px, phone 390px — centred,
 *     with the paper's width as the ceiling.
 */

type ViewTab = "print" | "web" | "media";
type Device = "desktop" | "tablet" | "phone";

const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  phone: "390px",
};

const DEVICE_ICON: Record<Device, string> = {
  desktop: "desktop_windows",
  tablet: "tablet_mac",
  phone: "smartphone",
};

/** Parse a YouTube URL into an embeddable nocookie URL, or null. */
function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/"))
        id = u.pathname.split("/")[2];
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}`;
  } catch {
    return null;
  }
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

export function InteractiveFigure({
  project,
  children,
}: {
  project: Project;
  children: React.ReactNode; // the screenshot / carousel / placeholder
}) {
  const hasDemo = Boolean(project.demoUrl);
  const video = useMemo(() => {
    if (!project.videoUrl) return null;
    const yt = youtubeEmbed(project.videoUrl);
    if (yt) return { kind: "youtube" as const, src: yt };
    if (isDirectVideo(project.videoUrl))
      return { kind: "file" as const, src: project.videoUrl };
    return null;
  }, [project.videoUrl]);

  const tabs: { id: ViewTab; label: string; icon: string }[] = [
    { id: "print", label: "Print Layout", icon: "article" },
    ...(hasDemo ? [{ id: "web" as const, label: "Web Layout", icon: "public" }] : []),
    ...(video ? [{ id: "media" as const, label: "Media", icon: "play_circle" }] : []),
  ];

  const [active, setActive] = useState<ViewTab>("print");
  // Lazy-mount flags — once a tab has been visited its content stays
  // mounted (hidden), so the iframe / video don't reload on tab switches.
  const [visited, setVisited] = useState<Record<ViewTab, boolean>>({
    print: true,
    web: false,
    media: false,
  });

  function switchTab(id: ViewTab) {
    setActive(id);
    setVisited((v) => (v[id] ? v : { ...v, [id]: true }));
  }

  // No demo, no video → render the screenshot exactly as before.
  if (tabs.length === 1) return <>{children}</>;

  return (
    <div>
      {/* Word view-tab strip */}
      <div
        role="tablist"
        aria-label={`${project.title} figure views`}
        className="flex items-end gap-0.5 border-b border-rule mb-2"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => switchTab(tab.id)}
              className={
                "inline-flex items-center gap-1.5 px-3 pt-1.5 pb-1 font-ui text-[12px] font-medium border-b-2 -mb-px transition-colors " +
                (isActive
                  ? "text-word-blue border-word-blue"
                  : "text-ink-muted border-transparent hover:bg-ribbon-hover hover:text-ink")
              }
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div hidden={active !== "print"}>{children}</div>

      {hasDemo && (
        <div hidden={active !== "web"}>
          {visited.web && (
            <LiveDemo url={project.demoUrl as string} title={project.title} />
          )}
        </div>
      )}

      {video && (
        <div hidden={active !== "media"}>
          {visited.media &&
            (video.kind === "youtube" ? (
              <div className="relative w-full aspect-video overflow-hidden rounded-sm border border-rule bg-black">
                <iframe
                  src={video.src}
                  title={`${project.title} — demo video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            ) : (
              <video
                src={video.src}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-sm border border-rule bg-black max-h-[480px]"
              >
                Your browser doesn't support embedded video.{" "}
                <a href={video.src}>Download it instead.</a>
              </video>
            ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ live demo ------------------------------ */

/**
 * Browsers can't tell the parent page when an iframe is refused by
 * X-Frame-Options / frame-ancestors — the frame just renders blank. So we
 * ask our own /api/embed-check first, which probes the target's headers
 * server-side. Blocked sites get an honest fallback card instead of an
 * empty frame. If the probe itself fails (offline, timeout), we try the
 * iframe anyway — false negatives shouldn't kill working demos.
 */
type EmbedProbe =
  | { state: "checking" }
  | { state: "embeddable" }
  | { state: "blocked"; reason: string };

function LiveDemo({ url, title }: { url: string; title: string }) {
  const [device, setDevice] = useState<Device>("desktop");
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [probe, setProbe] = useState<EmbedProbe>({ state: "checking" });

  useEffect(() => {
    let alive = true;
    fetch(`/api/embed-check?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { embeddable: boolean; reason: string | null }) => {
        if (!alive) return;
        setProbe(
          data.embeddable
            ? { state: "embeddable" }
            : { state: "blocked", reason: data.reason ?? "framing denied" }
        );
      })
      .catch(() => {
        // Probe unavailable — optimistically attempt the embed.
        if (alive) setProbe({ state: "embeddable" });
      });
    return () => {
      alive = false;
    };
  }, [url]);

  if (probe.state === "blocked") {
    return (
      <div className="border border-rule rounded-sm overflow-hidden bg-row-alt">
        <div className="flex items-center gap-2 border-b border-rule bg-ribbon px-2.5 py-1.5">
          <div className="hidden sm:flex items-center gap-1" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-rule-strong" />
            <span className="w-2.5 h-2.5 rounded-full bg-rule-strong" />
            <span className="w-2.5 h-2.5 rounded-full bg-rule-strong" />
          </div>
          <div className="flex-1 min-w-0 bg-paper border border-rule rounded-sm px-2.5 py-0.5 font-ui text-[11px] text-ink-muted truncate">
            {url}
          </div>
        </div>
        <div className="grid place-items-center py-12 px-6 text-center">
          <span
            className="material-symbols-outlined text-ink-subtle"
            style={{ fontSize: 40 }}
          >
            vpn_lock
          </span>
          <h4 className="mt-3 font-doc text-[16px] font-bold text-ink">
            This site doesn't allow embedding
          </h4>
          <p className="mt-1 font-ui text-[12px] text-ink-muted max-w-sm">
            {title} sends{" "}
            <code className="bg-ribbon border border-rule rounded-sm px-1 text-[11px]">
              {probe.reason}
            </code>{" "}
            — browsers refuse to render it inside another page. Open it in
            its own tab instead:
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 bg-word-blue hover:bg-word-blue-dark text-white font-ui text-[13px] font-semibold px-4 py-2 rounded-sm transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              open_in_new
            </span>
            Open {title}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-rule rounded-sm overflow-hidden bg-row-alt">
      {/* Browser-chrome bar */}
      <div className="flex items-center gap-2 border-b border-rule bg-ribbon px-2.5 py-1.5">
        <div className="hidden sm:flex items-center gap-1" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-rule-strong" />
          <span className="w-2.5 h-2.5 rounded-full bg-rule-strong" />
          <span className="w-2.5 h-2.5 rounded-full bg-rule-strong" />
        </div>
        <div className="flex-1 min-w-0 bg-paper border border-rule rounded-sm px-2.5 py-0.5 font-ui text-[11px] text-ink-muted truncate">
          {url}
        </div>

        {/* Device toggle */}
        <div className="flex items-center gap-0.5" role="group" aria-label="Preview device">
          {(Object.keys(DEVICE_WIDTH) as Device[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              aria-label={`${d} width`}
              aria-pressed={device === d}
              title={`${d[0].toUpperCase()}${d.slice(1)} width`}
              className={
                "grid place-items-center w-7 h-7 rounded-sm transition-colors " +
                (device === d
                  ? "bg-word-blue text-white"
                  : "text-ink-muted hover:bg-ribbon-hover")
              }
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                {DEVICE_ICON[d]}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setLoaded(false);
            setReloadKey((k) => k + 1);
          }}
          aria-label="Reload preview"
          title="Reload preview"
          className="grid place-items-center w-7 h-7 rounded-sm text-ink-muted hover:bg-ribbon-hover transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
            refresh
          </span>
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in new tab"
          title="Open in new tab"
          className="grid place-items-center w-7 h-7 rounded-sm text-ink-muted hover:bg-ribbon-hover hover:text-word-blue transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
            open_in_new
          </span>
        </a>
      </div>

      {/* Frame */}
      <div className="relative flex justify-center bg-workspace py-3 px-2 min-h-[320px]">
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <div className="flex flex-col items-center gap-2">
              <span
                className="material-symbols-outlined animate-spin text-word-blue"
                style={{ fontSize: 24 }}
              >
                progress_activity
              </span>
              <span className="font-ui text-[11px] text-ink-subtle">
                Loading live preview…
              </span>
            </div>
          </div>
        )}
        {probe.state === "embeddable" && (
          <iframe
            key={reloadKey}
            src={url}
            title={`${title} — live preview`}
            onLoad={() => setLoaded(true)}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="strict-origin-when-cross-origin"
            className={
              "relative bg-paper border border-rule rounded-sm shadow-md transition-opacity duration-300 " +
              (loaded ? "opacity-100" : "opacity-0")
            }
            style={{
              width: DEVICE_WIDTH[device],
              maxWidth: "100%",
              height: device === "phone" ? 620 : 460,
            }}
          />
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-rule bg-ribbon px-3 py-1 font-ui text-[10px] uppercase tracking-[0.12em] text-ink-subtle flex items-center gap-2">
        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
          info
        </span>
        Live embed — if it stays blank, the site blocks framing; use ↗ to open it directly.
      </div>
    </div>
  );
}
