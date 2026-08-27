import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * /api/spotify
 *   GET public — what the author is listening to right now.
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
 *   2. Authorize once with scope `user-read-currently-playing`, take the
 *      ?code= off the redirect, and exchange it for a refresh token.
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
  // Smallest image that still looks sharp at 14px on a 2x display.
  const art = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]?.url;
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
