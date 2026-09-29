import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * /api/spotify
 *   GET                  public — what the author is listening to right now
 *   GET ?view=listening  public — that, plus top tracks (last ~4 weeks) and
 *                        recently played, for the "On Repeat" panel on About
 *
 * Returns `{ configured: false }` when the credentials aren't set, so an
 * unconfigured deployment renders nothing at all rather than an error —
 * same contract as /api/chat.
 *
 * Auth: Spotify's user endpoints need a user-authorized token, so this
 * holds a long-lived refresh token in env and exchanges it for a short
 * access token on demand. The client secret never leaves the function.
 *
 * Setup (one time):
 *   1. developer.spotify.com → Create app. Add a redirect URI (any URL
 *      you control; it only has to match during the one-time authorize).
 *   2. Authorize once with the scopes
 *        user-read-currently-playing user-read-recently-played user-top-read
 *      take the ?code= off the redirect, and exchange it for a refresh token.
 *      A token authorized with only the first scope keeps the status-bar
 *      chip working; the two lists on About stay hidden until the token is
 *      re-issued with all three (Spotify answers 403 without them).
 *   3. Set on Vercel: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET,
 *      SPOTIFY_REFRESH_TOKEN.
 *
 * Rate limiting: two layers. Access tokens are reused until they near
 * expiry, and the track itself is memoized for TRACK_TTL_MS per warm
 * instance. On top of that the response carries s-maxage so Vercel's
 * edge serves one upstream call to every visitor in the window — polling
 * visitors cost nothing extra.
 *
 * Self-contained by design: no imports from a shared api/_lib, because
 * Vercel's dependency tracer has been unreliable about bundling that
 * folder here (see the note in api/content.ts).
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing?additional_types=track";

/** How long a fetched track is reused within one warm instance. */
const TRACK_TTL_MS = 15_000;
/** Refresh the access token this long before it actually expires. */
const TOKEN_SKEW_MS = 60_000;

type NowPlaying = {
  configured: true;
  playing: boolean;
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  url?: string;
  progressMs?: number;
  durationMs?: number;
  /** Present only when something upstream failed; the UI still hides. */
  error?: string;
};

let tokenCache: { token: string; expiresAt: number } | null = null;
let trackCache: { at: number; body: NowPlaying } | null = null;

function credentials() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  return id && secret && refresh ? { id, secret, refresh } : null;
}

async function accessToken(c: {
  id: string;
  secret: string;
  refresh: string;
}): Promise<string | null> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - TOKEN_SKEW_MS > now) {
    return tokenCache.token;
  }
  const basic = Buffer.from(`${c.id}:${c.secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: c.refresh,
    }),
  });
  if (!res.ok) {
    tokenCache = null;
    return null;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  tokenCache = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

/* Spotify's payload is loosely typed; pick out only what the chip needs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNowPlaying(raw: any): NowPlaying {
  const item = raw?.item;
  if (!item || raw?.currently_playing_type !== "track") {
    return { configured: true, playing: false };
  }
  const images: { url?: string; width?: number }[] = item?.album?.images ?? [];
  // Sharp enough for the expanded player as well as the status-bar chip.
  const art = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find(i => (i.width ?? 0) >= 160)?.url ?? images[0]?.url;
  return {
    configured: true,
    playing: Boolean(raw?.is_playing),
    title: typeof item?.name === "string" ? item.name : undefined,
    artist: Array.isArray(item?.artists)
      ? item.artists.map((a: { name?: string }) => a?.name).filter(Boolean).join(", ")
      : undefined,
    album: item?.album?.name,
    albumArt: art,
    url: item?.external_urls?.spotify,
    progressMs: typeof raw?.progress_ms === "number" ? raw.progress_ms : undefined,
    durationMs: typeof item?.duration_ms === "number" ? item.duration_ms : undefined,
  };
}

/* ---------------- listening (top + recent) ---------------- */

export function listeningRange(value: unknown): string {
  return value === "medium_term" || value === "long_term" ? value : "short_term";
}
const TOP_BASE = "https://api.spotify.com/v1/me/top/";
const RECENT_URL = "https://api.spotify.com/v1/me/player/recently-played?limit=20";
/** Top tracks move over weeks and recents over minutes; one TTL covers both. */
const LISTENING_TTL_MS = 5 * 60_000;
const RECENT_SHOWN = 5;

export type Track = {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  url?: string;
  /** Recently played only: when it finished. */
  playedAt?: string;
};

type Listening = {
  configured: true;
  /** Null when nothing is playing (or it couldn't be read). */
  nowPlaying: NowPlaying | null;
  /** Null when the token lacks the scope, or Spotify failed. */
  top: Track[] | null;
  recent: Track[] | null;
  artists?: Artist[] | null;
};

type Artist = { name: string; image?: string; url?: string };
const listeningCache = new Map<string, { at: number; top: Track[] | null; recent: Track[] | null; artists: Artist[] | null }>();
export function toArtists(raw: { items?: unknown[] } | null): Artist[] {
  return (Array.isArray(raw?.items) ? raw.items : []).flatMap((value) => {
    const item = value as { name?: string; images?: { url?: string }[]; external_urls?: { spotify?: string } } | null;
    return item && typeof item.name === "string" ? [{ name: item.name, image: item.images?.[0]?.url, url: item.external_urls?.spotify }] : [];
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toTrack(item: any, playedAt?: string): Track | null {
  if (!item || typeof item.name !== "string") return null;
  const images: { url?: string; width?: number }[] = item?.album?.images ?? [];
  // The smallest image at least 64px wide: sharp at 40px on a 2x screen.
  const art =
    [...images]
      .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
      .find((i) => (i.width ?? 0) >= 64)?.url ?? images[0]?.url;
  return {
    title: item.name,
    artist: Array.isArray(item.artists)
      ? item.artists.map((a: { name?: string }) => a?.name).filter(Boolean).join(", ")
      : "",
    album: item?.album?.name,
    albumArt: art,
    url: item?.external_urls?.spotify,
    ...(playedAt ? { playedAt } : {}),
  };
}

/** Recently played, newest first, one entry per track: a song on loop is
 *  one line, not five. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toRecent(raw: any): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const entry of Array.isArray(raw?.items) ? raw.items : []) {
    const id = entry?.track?.id ?? entry?.track?.name;
    if (!id || seen.has(id)) continue;
    const t = toTrack(entry.track, typeof entry.played_at === "string" ? entry.played_at : undefined);
    if (!t) continue;
    seen.add(id);
    out.push(t);
    if (out.length >= RECENT_SHOWN) break;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toTop(raw: any): Track[] {
  return (Array.isArray(raw?.items) ? raw.items : [])
    .map((item: unknown) => toTrack(item))
    .filter((t: Track | null): t is Track => t !== null);
}

async function getJson(url: string, token: string): Promise<{ status: number; body: unknown }> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: r.ok && r.status !== 204 ? await r.json() : null };
}

async function listening(creds: { id: string; secret: string; refresh: string }, range: string): Promise<Listening> {
  const token = await accessToken(creds);
  if (!token) return { configured: true, nowPlaying: null, top: null, recent: null };

  const now = Date.now();
  const entry = listeningCache.get(range);
  const cached = entry && now - entry.at < LISTENING_TTL_MS ? entry : null;

  const [playing, top, recent, artists] = await Promise.all([
    getJson(NOW_PLAYING_URL, token).catch(() => ({ status: 0, body: null })),
    cached ? null : getJson(`${TOP_BASE}tracks?time_range=${range}&limit=5`, token).catch(() => ({ status: 0, body: null })),
    cached ? null : getJson(RECENT_URL, token).catch(() => ({ status: 0, body: null })),
    cached ? null : getJson(`${TOP_BASE}artists?time_range=${range}&limit=5`, token).catch(() => ({ status: 0, body: null })),
  ]);

  // 403 is a missing scope — see the setup note above. Anything that
  // isn't a 200 leaves that list null, and the panel hides it.
  const lists = cached ?? {
    at: now,
    top: top && top.status === 200 ? toTop(top.body) : null,
    recent: recent && recent.status === 200 ? toRecent(recent.body) : null,
    artists: artists && artists.status === 200 ? toArtists(artists.body as { items?: unknown[] }) : null,
  };
  if (!cached) listeningCache.set(range, lists);

  const np = playing.status === 200 ? toNowPlaying(playing.body) : null;
  return {
    configured: true,
    nowPlaying: np?.playing ? np : null,
    top: lists.top,
    recent: lists.recent,
    artists: lists.artists,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const creds = credentials();
  if (!creds) {
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.status(200).json({ configured: false });
  }

  const view = Array.isArray(req.query.view) ? req.query.view[0] : req.query.view;
  if (view === "listening") {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    try {
      return res.status(200).json(await listening(creds, listeningRange(req.query.range)));
    } catch {
      return res
        .status(200)
        .json({ configured: true, nowPlaying: null, top: null, recent: null } satisfies Listening);
    }
  }

  // Edge-cache so a hundred polling visitors cost one upstream call.
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");

  const now = Date.now();
  if (trackCache && now - trackCache.at < TRACK_TTL_MS) {
    return res.status(200).json(trackCache.body);
  }

  try {
    const token = await accessToken(creds);
    if (!token) {
      // Refresh token revoked or credentials wrong. Don't cache the failure
      // for long — it should recover the moment it's fixed.
      return res
        .status(200)
        .json({ configured: true, playing: false, error: "auth" } satisfies NowPlaying);
    }

    const upstream = await fetch(NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // 204 = nothing playing right now. 200 with a body = something is.
    let body: NowPlaying;
    if (upstream.status === 204) {
      body = { configured: true, playing: false };
    } else if (upstream.ok) {
      body = toNowPlaying(await upstream.json());
    } else {
      if (upstream.status === 401) tokenCache = null; // force a refresh next call
      body = { configured: true, playing: false, error: `upstream_${upstream.status}` };
    }

    trackCache = { at: now, body };
    return res.status(200).json(body);
  } catch {
    return res
      .status(200)
      .json({ configured: true, playing: false, error: "network" } satisfies NowPlaying);
  }
}
