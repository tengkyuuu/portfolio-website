import { useEffect, useRef, useState } from "react";

/**
 * "Now Playing" chip for the Word status bar.
 *
 * Word's status bar reports the state of the document; this reports the
 * state of its author. It sits with the other status readouts and stays
 * quiet: nothing renders unless /api/spotify says a track is actually
 * playing, so an unconfigured deployment, a revoked token, a paused
 * player, and a closed Spotify all look identical — absent.
 *
 * Polling is deliberately lazy. Every 30s while the tab is visible, never
 * while it's hidden, and once immediately on becoming visible again so a
 * returning tab isn't showing a stale track. The progress bar is
 * interpolated locally between polls, so it moves smoothly at 1fps
 * without asking the server anything.
 */

const POLL_MS = 30_000;
const TICK_MS = 1_000;

type NowPlayingResponse = {
  configured: boolean;
  playing?: boolean;
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  url?: string;
  progressMs?: number;
  durationMs?: number;
};

type Snapshot = { data: NowPlayingResponse; fetchedAt: number };

export function NowPlaying() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [, forceTick] = useState(0);
  const [artOk, setArtOk] = useState(true);
  // Held in a ref so the poll effect never re-subscribes on every response.
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    let timer: number | undefined;

    const load = async () => {
      try {
        const res = await fetch("/api/spotify");
        if (!res.ok) return;
        const data = (await res.json()) as NowPlayingResponse;
        if (!stopped.current) setSnap({ data, fetchedAt: Date.now() });
      } catch {
        // Offline or the function is down — keep whatever we last had.
      }
    };

    const schedule = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      timer = window.setTimeout(async () => {
        await load();
        schedule();
      }, POLL_MS);
    };

    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
      } else {
        void load();
        schedule();
      }
    };

    void load();
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped.current = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const playing = Boolean(snap?.data.configured && snap.data.playing && snap.data.title);

  // Drive the progress bar between polls. Only runs while a track plays
  // and the tab is visible, so an idle tab costs nothing.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (!document.hidden) forceTick((n) => n + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  if (!snap || !playing) return null;

  const { title, artist, albumArt, url, progressMs, durationMs } = snap.data;

  const elapsed =
    progressMs !== undefined
      ? Math.min(progressMs + (Date.now() - snap.fetchedAt), durationMs ?? Infinity)
      : undefined;
  const pct =
    elapsed !== undefined && durationMs
      ? Math.max(0, Math.min(100, (elapsed / durationMs) * 100))
      : null;

  const label = artist ? `${title} — ${artist}` : (title as string);

  const inner = (
    <>
      {albumArt && artOk ? (
        <img
          src={albumArt}
          alt=""
          aria-hidden="true"
          width={14}
          height={14}
          loading="lazy"
          decoding="async"
          onError={() => setArtOk(false)}
          className="w-[14px] h-[14px] rounded-[2px] object-cover shrink-0"
        />
      ) : (
        <Equalizer />
      )}
      <span className="truncate max-w-[150px] lg:max-w-[230px]">{label}</span>
      {pct !== null && (
        <span
          aria-hidden="true"
          className="hidden lg:block w-10 h-[3px] rounded-full bg-white/25 overflow-hidden shrink-0"
        >
          <span
            className="block h-full bg-white/80 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </span>
      )}
    </>
  );

  const classes =
    "hidden md:inline-flex items-center gap-1.5 border-l border-white/30 pl-3 max-w-[300px]";

  // Wrap in a link only when Spotify gave us one.
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Now playing on Spotify — ${label}`}
      className={classes + " hover:underline underline-offset-2 decoration-white/50"}
    >
      {inner}
    </a>
  ) : (
    <span title={`Now playing — ${label}`} className={classes}>
      {inner}
    </span>
  );
}

/** Three bouncing bars — the album-art fallback, and the "this is live" cue. */
function Equalizer() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-end gap-[2px] h-[11px] shrink-0"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="eq-bar w-[2px] h-full bg-white/80 rounded-[1px]"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}
