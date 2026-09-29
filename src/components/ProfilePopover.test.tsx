import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProfilePopover } from "./ProfilePopover";
import { DEFAULT_CONTENT, saveSection } from "../lib/content";
import { philippineTime } from "../lib/blue";

beforeEach(() => {
  saveSection("activity", DEFAULT_CONTENT.activity);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ configured: true, playing: false }))));
});

it("keeps memes and Spotify requests behind the profile button", async () => {
  render(<ProfilePopover />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "James's status and Spotify" }));
  expect(await screen.findByText(/Nothing playing right now/)).toBeInTheDocument();
  expect(screen.getByText(/Philippine Standard Time/)).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "James's status and Spotify" })).toHaveFocus();
});

it("shows published activity and a live Spotify track", async () => {
  saveSection("activity", { status: "Working", note: "Finishing a design", meme: "working", memeAlt: "", updatedAt: "2026-09-29T08:00:00Z" });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ configured: true, playing: true, title: "Test song", artist: "Test artist", url: "https://open.spotify.com/track/example", durationMs: 100000, progressMs: 5000 }))));
  render(<ProfilePopover />);
  fireEvent.click(screen.getByRole("button", { name: "James's status and Spotify" }));
  expect(await screen.findByText("Test song")).toBeInTheDocument();
  expect(screen.getByText("Finishing a design")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /working at a laptop/ })).toHaveAttribute("src", "/blue/working-blue.jpg");
  expect(screen.getByRole("link", { name: /Listen on Spotify/ })).toHaveAttribute("href", "https://open.spotify.com/track/example");
});

it("does not show stale playback when a request fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
  render(<ProfilePopover />);
  fireEvent.click(screen.getByRole("button", { name: "James's status and Spotify" }));
  await waitFor(() => expect(screen.getByText("Spotify is temporarily unavailable.")).toBeInTheDocument());
});

it("formats time in the Philippines regardless of the visitor timezone", () => {
  expect(philippineTime(new Date("2026-09-29T00:30:00Z"))).toMatch(/8:30\s*AM/i);
});
