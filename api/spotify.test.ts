import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fakeReq, fakeRes } from "../src/test/fake-supabase";

/**
 * The listening view has one silent failure worth pinning: a refresh
 * token issued before the extra scopes gets a 403 on the two lists, and
 * that must hide those lists — not the whole panel, and never the
 * status-bar chip, which keeps working on the old scope.
 */

const { default: handler, toRecent, toTop, toArtists, listeningRange } = await import("./spotify");

const track = (id: string, name: string, width = 64) => ({
  id,
  name,
  artists: [{ name: "Artist A" }, { name: "Artist B" }],
  album: {
    name: "Album",
    images: [
      { url: `https://i.scdn.co/${id}-640`, width: 640 },
      { url: `https://i.scdn.co/${id}-${width}`, width },
      { url: `https://i.scdn.co/${id}-32`, width: 32 },
    ],
  },
  external_urls: { spotify: `https://open.spotify.com/track/${id}` },
});

describe("shaping", () => {
  it("picks album art that stays sharp at 40px on a 2x screen", () => {
    const [t] = toTop({ items: [track("a", "Song")] });
    expect(t).toMatchObject({ title: "Song", artist: "Artist A, Artist B", albumArt: "https://i.scdn.co/a-64" });
  });

  it("collapses a song played on loop into one recent entry", () => {
    const recent = toRecent({
      items: [
        { track: track("a", "Loop"), played_at: "2026-09-29T08:00:00Z" },
        { track: track("a", "Loop"), played_at: "2026-09-29T07:56:00Z" },
        { track: track("b", "Other"), played_at: "2026-09-29T07:50:00Z" },
      ],
    });
    expect(recent.map((t) => t.title)).toEqual(["Loop", "Other"]);
    expect(recent[0].playedAt).toBe("2026-09-29T08:00:00Z");
  });

  it("caps recent at five and skips junk", () => {
    const items = [
      { track: null },
      ...Array.from({ length: 9 }, (_, i) => ({ track: track(`t${i}`, `Song ${i}`), played_at: "x" })),
    ];
    expect(toRecent({ items })).toHaveLength(5);
    expect(toRecent(null)).toEqual([]);
  });
});

describe("GET ?view=listening", () => {
  beforeEach(() => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
    vi.stubEnv("SPOTIFY_REFRESH_TOKEN", "refresh");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hides only the lists the token has no scope for", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("accounts.spotify.com")) {
          return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
        }
        if (url.includes("currently-playing")) return new Response(null, { status: 204 });
        if (url.includes("/me/top/")) return new Response("{}", { status: 403 });
        if (url.includes("recently-played")) {
          return new Response(JSON.stringify({ items: [{ track: track("r", "Recent"), played_at: "2026-09-29T08:00:00Z" }] }), { status: 200 });
        }
        throw new Error(`unexpected ${url}`);
      })
    );
    const res = fakeRes();
    await handler(fakeReq({ method: "GET", query: { view: "listening" } }) as unknown as VercelRequest, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ configured: true, nowPlaying: null, top: null });
    expect((res.body as { recent: { title: string }[] }).recent[0].title).toBe("Recent");
  });

  it("reports unconfigured, and nothing else, without credentials", async () => {
    vi.unstubAllEnvs();
    const res = fakeRes();
    await handler(fakeReq({ method: "GET", query: { view: "listening" } }) as unknown as VercelRequest, res as unknown as VercelResponse);
    expect(res.body).toEqual({ configured: false });
  });
});


describe("listening room", () => {
  it("accepts only known time periods", () => {
    expect(listeningRange("medium_term")).toBe("medium_term");
    expect(listeningRange("long_term")).toBe("long_term");
    expect(listeningRange("long_term&limit=50")).toBe("short_term");
    expect(listeningRange(undefined)).toBe("short_term");
  });
  it("shapes artists without relying on deprecated genres or popularity", () => {
    expect(toArtists({ items: [null, {}, { name: "Artist", images: [{ url: "https://image.test/art" }], external_urls: { spotify: "https://open.spotify.com/artist/test" } }] })).toEqual([{ name: "Artist", image: "https://image.test/art", url: "https://open.spotify.com/artist/test" }]);
  });
  it("keeps cached favorites separate for each period", async () => {
    vi.resetModules();
    const { default: freshHandler } = await import("./spotify");
    vi.stubEnv("SPOTIFY_CLIENT_ID", "id"); vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret"); vi.stubEnv("SPOTIFY_REFRESH_TOKEN", "refresh");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("accounts.spotify.com")) return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }));
      if (url.includes("currently-playing")) return new Response(null, { status: 204 });
      const period = new URL(url).searchParams.get("time_range") || "short_term";
      return new Response(JSON.stringify({ items: [track(period, period)] }));
    }));
    try {
      for (const range of ["short_term", "medium_term", "short_term"]) {
        const res = fakeRes();
        await freshHandler(fakeReq({ method: "GET", query: { view: "listening", range } }) as unknown as VercelRequest, res as unknown as VercelResponse);
        expect((res.body as { top: { title: string }[] }).top[0].title).toBe(range);
      }
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  });
});
