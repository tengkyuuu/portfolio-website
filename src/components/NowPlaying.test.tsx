import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NowPlaying } from "./NowPlaying";

/**
 * The chip's whole contract is that it stays quiet. Every way this can
 * fail — unconfigured, revoked token, paused player, closed app — has to
 * render nothing rather than an error or an empty shell in the status bar.
 */

function mockApi(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), { status: ok ? 200 : 500 })
    )
  );
}

const TRACK = {
  configured: true,
  playing: true,
  title: "Bohemian Rhapsody",
  artist: "Queen",
  album: "A Night at the Opera",
  albumArt: "https://i.scdn.co/image/abc",
  url: "https://open.spotify.com/track/abc",
  progressMs: 60_000,
  durationMs: 355_000,
};

describe("NowPlaying", () => {
  it("renders nothing when the deployment has no credentials", async () => {
    mockApi({ configured: false });
    const { container } = render(<NowPlaying />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the player is idle", async () => {
    mockApi({ configured: true, playing: false });
    const { container } = render(<NowPlaying />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the token has been revoked", async () => {
    mockApi({ configured: true, playing: false, error: "auth" });
    const { container } = render(<NowPlaying />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the endpoint itself fails", async () => {
    mockApi({ error: "boom" }, false);
    const { container } = render(<NowPlaying />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the track and artist while something is playing", async () => {
    mockApi(TRACK);
    render(<NowPlaying />);
    expect(await screen.findByText("Bohemian Rhapsody — Queen")).toBeInTheDocument();
  });

  it("links to the track on Spotify", async () => {
    mockApi(TRACK);
    render(<NowPlaying />);
    const link = await screen.findByRole("link");
    expect(link).toHaveAttribute("href", TRACK.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("falls back to plain text when Spotify gives no track URL", async () => {
    mockApi({ ...TRACK, url: undefined });
    render(<NowPlaying />);
    expect(await screen.findByText(/Bohemian Rhapsody/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the title alone when there is no artist", async () => {
    mockApi({ ...TRACK, artist: undefined });
    render(<NowPlaying />);
    expect(await screen.findByText("Bohemian Rhapsody")).toBeInTheDocument();
  });

  it("survives a track with no progress or duration", async () => {
    mockApi({ ...TRACK, progressMs: undefined, durationMs: undefined });
    render(<NowPlaying />);
    expect(await screen.findByText(/Bohemian Rhapsody/)).toBeInTheDocument();
  });

  it("keeps quiet when the network throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { container } = render(<NowPlaying />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
