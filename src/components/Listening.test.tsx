import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Listening } from "./Listening";

function respond(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

afterEach(() => vi.unstubAllGlobals());

describe("Listening", () => {
  it("stays absent when Spotify isn't configured", async () => {
    respond({ configured: false });
    const { container } = render(<Listening />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("stays absent when the token can't read either list", async () => {
    respond({ configured: true, nowPlaying: null, top: null, recent: null });
    const { container } = render(<Listening />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows whichever list it has", async () => {
    respond({
      configured: true,
      nowPlaying: null,
      top: null,
      recent: [{ title: "Recent Song", artist: "Someone", playedAt: new Date().toISOString() }],
    });
    render(<Listening />);
    expect(await screen.findByRole("heading", { name: "On Repeat" })).toBeInTheDocument();
    expect(screen.getByText("Recent Song")).toBeInTheDocument();
    expect(screen.queryByText(/Most played/)).not.toBeInTheDocument();
  });

  it("stays absent when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { container } = render(<Listening />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
