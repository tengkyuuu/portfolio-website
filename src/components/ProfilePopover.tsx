import { useEffect, useRef, useState } from "react";
import { CONTENT_EVENT, getContent } from "../lib/content";
import { BLUE_MEMES, philippineTime } from "../lib/blue";
import { safeHref } from "../lib/inline";
import { BlueSticker } from "./BlueSticker";

import { SpotifyCard, type Playback } from "./SpotifyCard";

export function ProfilePopover({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(getContent);
  const [now, setNow] = useState(() => new Date());
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [failed, setFailed] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const refresh = () => setContent(getContent());
    window.addEventListener(CONTENT_EVENT, refresh);
    return () => window.removeEventListener(CONTENT_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    let cancelled = false;
    const controller = new AbortController();
    setPlayback(null);
    setFailed(false);
    const load = async () => {
      if (document.hidden) return;
      setNow(new Date());
      try {
        const response = await fetch("/api/spotify", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Spotify unavailable");
        const data = await response.json() as Playback;
        if (!cancelled) { setPlayback(data); setFetchedAt(Date.now()); setFailed(false); }
      } catch {
        if (!cancelled) { setFailed(true); setPlayback(null); }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    document.addEventListener("visibilitychange", load);
    const outside = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const activity = content.activity;
  const customMeme = !Object.hasOwn(BLUE_MEMES, activity.meme) && (
    /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(activity.meme) ? activity.meme : safeHref(activity.meme)
  );
  return <div ref={wrap} className="profile-wrap" onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button ref={trigger} className="office-avatar" aria-label="James's status and Spotify" aria-expanded={open} aria-controls="profile-popover" onClick={() => { if (!open) onOpen?.(); setOpen(value => !value); }}>JV</button>
    {open && <section id="profile-popover" role="dialog" aria-label="James's status and Spotify" className="profile-popover">
      <button ref={closeButton} className="profile-close" aria-label="Close profile" onClick={() => { setOpen(false); trigger.current?.focus(); }}>✕</button>
      <span className="text-word-blue text-[10px] uppercase tracking-widest">Behind the document</span>
      <h2>{content.hero.name.split(" ")[0]}, currently</h2>
      <p className="profile-clock"><time dateTime={now.toISOString()}>{philippineTime(now)}</time> · Philippines<br />Philippine Standard Time · UTC+8 · Asia/Manila</p>
      <div className="profile-status">
        <div><strong>{activity.status || "Hello from the Philippines"}</strong>{activity.note && <p>{activity.note}</p>}
          {activity.updatedAt && !Number.isNaN(Date.parse(activity.updatedAt)) && <p className="text-[10px]">Updated {new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(activity.updatedAt))} PHT</p>}
        </div>
      </div>
      <SpotifyCard playback={playback} failed={failed} fetchedAt={fetchedAt} sticker={customMeme
        ? <img src={customMeme} alt={activity.memeAlt || "Activity meme"} />
        : <BlueSticker mood={activity.meme} />} />
      <a href="#about" className="inline-block mt-4 text-word-blue underline" onClick={() => setOpen(false)}>More about James →</a>
    </section>}
  </div>;
}
