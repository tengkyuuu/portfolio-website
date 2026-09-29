import { useEffect, useState } from "react";

/**
 * "On Repeat" — the Spotify panel on the About chapter's Now page.
 *
 * The status-bar chip says what's playing this second; this says what the
 * last few weeks have sounded like: most-played tracks and the last few
 * played. Everything comes from /api/spotify?view=listening, which edge-
 * caches for a minute, so it's fetched once per visit and never polled.
 *
 * Renders nothing unless Spotify actually answered with something, like
 * every optional integration here: unconfigured, a token without the
 * extra scopes, or an empty history all look the same — absent.
 */

type Track = {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  url?: string;
  playedAt?: string;
};

type ListeningResponse = {
  configured: boolean;
  nowPlaying?: { title?: string; artist?: string; albumArt?: string; url?: string } | null;
  top?: Track[] | null;
  recent?: Track[] | null;
};

export function Listening() {
  const [data, setData] = useState<ListeningResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/spotify?view=listening")
      .then((r) => (r.ok ? (r.json() as Promise<ListeningResponse>) : null))
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch(() => {
        /* offline or no function — stay absent */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.configured) return null;
  const top = data.top ?? [];
  const recent = data.recent ?? [];
  const playing = data.nowPlaying?.title ? data.nowPlaying : null;
  if (top.length === 0 && recent.length === 0 && !playing) return null;

  return (
    <section aria-labelledby="listening-heading" className="mt-2 break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-4">
        <h2
          id="listening-heading"
          className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue"
        >
          On Repeat
        </h2>
        <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider">
          Live from Spotify
        </span>
      </div>

      {playing && (
        <a
          href={playing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex items-center gap-3 border border-rule rounded-sm bg-word-blue-light/60 px-3 py-2 hover:border-word-blue transition-colors"
        >
          <Art src={playing.albumArt} size={40} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-word-blue">
              <Bars /> Playing right now
            </span>
            <span className="block truncate font-doc text-[14px] font-semibold text-ink">
              {playing.title}
            </span>
            {playing.artist && (
              <span className="block truncate font-ui text-[11.5px] text-ink-muted">{playing.artist}</span>
            )}
          </span>
        </a>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {top.length > 0 && (
          <TrackList title="Most played · last four weeks" tracks={top} numbered />
        )}
        {recent.length > 0 && <TrackList title="Recently played" tracks={recent} />}
      </div>
    </section>
  );
}

function TrackList({ title, tracks, numbered }: { title: string; tracks: Track[]; numbered?: boolean }) {
  const List = numbered ? "ol" : "ul";
  return (
    <div>
      <h3 className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted mb-2">
        {title}
      </h3>
      <List className="space-y-1.5">
        {tracks.map((t, i) => (
          <li key={`${t.title}-${i}`} className="flex items-center gap-2.5">
            {numbered && (
              <span className="w-4 shrink-0 text-right font-ui text-[11px] tabular-nums text-ink-subtle">
                {i + 1}
              </span>
            )}
            <Art src={t.albumArt} size={34} />
            <span className="min-w-0 flex-1">
              {t.url ? (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-doc text-[13.5px] font-semibold text-ink hover:text-word-blue"
                >
                  {t.title}
                </a>
              ) : (
                <span className="block truncate font-doc text-[13.5px] font-semibold text-ink">{t.title}</span>
              )}
              <span className="block truncate font-ui text-[11px] text-ink-muted">{t.artist}</span>
            </span>
            {t.playedAt && (
              <time
                dateTime={t.playedAt}
                className="shrink-0 font-ui text-[10.5px] tabular-nums text-ink-subtle"
              >
                {ago(t.playedAt)}
              </time>
            )}
          </li>
        ))}
      </List>
    </div>
  );
}

function Art({ src, size }: { src?: string; size: number }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) {
    return (
      <span
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-[2px] bg-ribbon text-ink-subtle material-symbols-outlined"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        music_note
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
      className="shrink-0 rounded-[2px] object-cover border border-rule"
      style={{ width: size, height: size }}
    />
  );
}

/** Three bars — the "live" cue, in Word blue on paper. */
function Bars() {
  return (
    <span aria-hidden="true" className="inline-flex items-end gap-[2px] h-[10px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="eq-bar w-[2px] h-full bg-word-blue rounded-[1px]"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

/** "12m ago" / "3h ago" / "2d ago". */
function ago(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
