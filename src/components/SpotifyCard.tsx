import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, Disc3, Headphones, Music2 } from "lucide-react";
import { safeHref } from "../lib/inline";
import "./spotify-card.css";

export type Playback = { configured: boolean; playing?: boolean; title?: string; artist?: string; album?: string; albumArt?: string; url?: string; progressMs?: number; durationMs?: number; error?: string };
type Track = { title: string; artist: string; albumArt?: string; url?: string; playedAt?: string };
type Artist = { name: string; image?: string; url?: string };
type Listening = { configured: boolean; top?: Track[] | null; recent?: Track[] | null; artists?: Artist[] | null };
type View = "top" | "recent" | "artists";

function time(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SpotifyCard({ playback, failed, fetchedAt, sticker }: { playback: Playback | null; failed: boolean; fetchedAt: number; sticker: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<View>("top");
  const [range, setRange] = useState("short_term");
  const [listening, setListening] = useState<Listening | null>(null);
  const [listError, setListError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [tick, setTick] = useState(Date.now);
  const playing = Boolean(playback?.configured && playback.playing && playback.title && !playback.error && !failed);

  useEffect(() => {
    if (!playing) return;
    setTick(Date.now());
    const timer = window.setInterval(() => { if (!document.hidden) setTick(Date.now()); }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, fetchedAt]);

  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    let active = true;
    setListening(null);
    setListError(false);
    fetch(`/api/spotify?view=listening&range=${range}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.json() as Promise<Listening>; })
      .then(data => { if (active) setListening(data); })
      .catch(() => { if (active) setListError(true); });
    return () => { active = false; controller.abort(); };
  }, [expanded, range, retry]);

  const elapsed = Math.min(playback?.durationMs ?? 0, (playback?.progressMs ?? 0) + (playing ? Math.max(0, tick - fetchedAt) : 0));
  const tracks = listening?.[view === "recent" ? "recent" : "top"];
  const items = view === "artists" ? listening?.artists : tracks;
  const href = safeHref(playback?.url);
  const message = failed || playback?.error ? "Spotify is temporarily unavailable." : !playback ? "Checking the music…" : !playback.configured ? "The soundtrack is coming soon." : "Nothing playing right now. Enjoying a quiet moment.";

  return <section className="spotify-section" aria-label="James's music">
    <div className="music-card">
      <header className="music-card-header">
        <span className="music-brand"><Disc3 size={17} aria-hidden="true" /> Spotify</span>
        <span className="music-live">{playing && <span className="music-bars" aria-hidden="true"><i /><i /><i /></span>}{playing ? "NOW PLAYING" : "OFF THE RECORD"}</span>
      </header>
      <div className="music-now" aria-live="polite">
        <MusicArt src={playing ? playback?.albumArt : undefined} />
        <div className="music-track-info">
          <span className="music-eyebrow">The soundtrack to my day</span>
          {playing ? <><h3>{playback!.title}</h3><p>{playback!.artist}</p>{playback?.album && <small>{playback.album}</small>}</> : <p className="music-empty">{message}</p>}
        </div>
      </div>
      {playing && !!playback?.durationMs && <div className="music-timeline">
        <progress aria-label="Track progress" max={playback.durationMs} value={elapsed} />
        <div><span>{time(elapsed)}</span><span>{time(playback.durationMs)}</span></div>
      </div>}
      <div className="music-card-footer">
        {playing && href ? <a className="music-open" href={href} target="_blank" rel="noreferrer" aria-label="Listen on Spotify">Open in Spotify <ArrowUpRight size={14} aria-hidden="true" /></a> : <span className="music-quiet"><Headphones size={14} aria-hidden="true" /> A little listening break</span>}
        <span className="music-sticker">{sticker}</span>
      </div>
    </div>
    <button className="music-explore" aria-expanded={expanded} aria-controls="listening-room" onClick={() => setExpanded(value => !value)}>
      <span><Music2 size={16} aria-hidden="true" />{expanded ? "Close listening room" : "My top songs & more"}</span><ChevronDown size={16} className={expanded ? "is-expanded" : ""} aria-hidden="true" />
    </button>
    {expanded && <div id="listening-room" className="listening-room">
      <div className="music-view-buttons" role="group" aria-label="Listening view">
        {([ ["top", "Top songs"], ["recent", "Recent"], ["artists", "Artists"] ] as const).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
      </div>
      <div className="music-list-heading"><span>{view === "recent" ? "Last played" : view === "artists" ? "Favorite artists" : "On repeat"}</span>
        {view !== "recent" && <select aria-label="Listening period" value={range} onChange={event => setRange(event.target.value)}><option value="short_term">4 weeks</option><option value="medium_term">6 months</option><option value="long_term">1 year</option></select>}
      </div>
      {listError ? <div role="status" className="music-list-empty">Couldn't load the listening room. <button onClick={() => setRetry(n => n + 1)}>Try again</button></div> : !listening ? <p role="status" className="music-list-empty">Finding the favorites…</p> : !listening.configured || items == null ? <p className="music-list-empty">This part of the soundtrack isn't available yet.</p> : items.length === 0 ? <p className="music-list-empty">No listening history for this view yet.</p> : <ol className="music-list">
        {view === "artists" ? listening.artists!.map((artist, index) => <MusicRow key={`${artist.name}-${index}`} index={index} title={artist.name} subtitle="Artist on Spotify" image={artist.image} url={artist.url} round />) : tracks!.map((track, index) => <MusicRow key={`${track.title}-${index}`} index={index} title={track.title} subtitle={track.artist} image={track.albumArt} url={track.url} playedAt={view === "recent" ? track.playedAt : undefined} />)}
      </ol>}
      <p className="music-attribution">A small window into my Spotify rotation.</p>
    </div>}
  </section>;
}

function MusicArt({ src, round = false }: { src?: string; round?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const image = safeHref(src);
  return <span className={`music-art${round ? " is-round" : ""}`}>{image && !failed ? <img src={image} alt="" onError={() => setFailed(true)} /> : <Music2 size={22} aria-hidden="true" />}</span>;
}

function MusicRow({ index, title, subtitle, image, url, round, playedAt }: { index: number; title: string; subtitle: string; image?: string; url?: string; round?: boolean; playedAt?: string }) {
  const href = safeHref(url);
  const inner = <><span className="music-rank">{String(index + 1).padStart(2, "0")}</span><MusicArt src={image} round={round} /><span className="music-row-copy"><strong>{title}</strong><small>{subtitle}</small>{playedAt && !Number.isNaN(Date.parse(playedAt)) && <time dateTime={playedAt}>{new Date(playedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>}</span>{href && <ArrowUpRight size={13} aria-hidden="true" />}</>;
  return <li>{href ? <a className="music-row" href={href} target="_blank" rel="noreferrer">{inner}</a> : <div className="music-row">{inner}</div>}</li>;
}
