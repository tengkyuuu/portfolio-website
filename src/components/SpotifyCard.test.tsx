import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SpotifyCard } from "./SpotifyCard";

afterEach(() => vi.unstubAllGlobals());
it("loads listening history only after clicking, with artist and recent views", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ configured: true,
    top: [{ title: "Top track", artist: "Top artist", url: "https://open.spotify.com/track/one" }],
    recent: [{ title: "Recent track", artist: "Another artist" }],
    artists: [{ name: "Favorite artist", url: "https://open.spotify.com/artist/one" }],
  }))));
  render(<SpotifyCard playback={{ configured: true, playing: false }} failed={false} fetchedAt={Date.now()} sticker={<span>Blue</span>} />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "My top songs & more" }));
  expect(await screen.findByText("Top track")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Recent" }));
  expect(screen.getByText("Recent track")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Artists" }));
  expect(screen.getByText("Favorite artist")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Listening period" }), { target: { value: "medium_term" } });
  expect(await screen.findByText("Favorite artist")).toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain("range=medium_term");
});

it("shows a recoverable list error without hiding the playing song", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
  render(<SpotifyCard playback={{ configured: true, playing: true, title: "Live song", durationMs: 120000, progressMs: 30000 }} failed={false} fetchedAt={Date.now()} sticker={null} />);
  expect(screen.getByText("0:30")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "My top songs & more" }));
  expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  expect(screen.getByText("Live song")).toBeInTheDocument();
});
