import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Peer } from "../lib/presence";

/**
 * Presence is optional, so its quiet failure mode is the one to pin: no
 * Supabase, or nobody else here, must look exactly like the title bar
 * always did. And the stack's accessible name has to be a sentence — an
 * icon-plus-number button announces as gibberish (CLAUDE.md).
 */

let peers: Peer[] | null = null;
vi.mock("../lib/presence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/presence")>()),
  usePresence: () => peers,
}));

const { PresenceStack } = await import("./PresenceStack");

function crowd(others: number): Peer[] {
  const breeds = ["corgi", "shiba", "husky", "beagle", "pug", "golden"] as const;
  return [
    { key: "me", breed: "dalmatian", since: 0, self: true, tab: "top" },
    ...Array.from({ length: others }, (_, i) => ({
      key: `v${i}`,
      breed: breeds[i % breeds.length],
      since: i + 1,
      self: false,
      tab: i === 0 ? "work" : undefined,
    })),
  ];
}

beforeEach(() => {
  peers = null;
});

describe("PresenceStack", () => {
  it("keeps the plain Viewing label when presence is unavailable", () => {
    render(<PresenceStack active="top" />);
    expect(screen.getByText("Viewing")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps it when you're the only one here", () => {
    peers = crowd(0);
    render(<PresenceStack active="top" />);
    expect(screen.getByText("Viewing")).toBeInTheDocument();
  });

  it("names the crowd in a sentence and folds the overflow into +N", () => {
    peers = crowd(5);
    render(<PresenceStack active="top" />);
    const button = screen.getByRole("button", {
      name: "5 other people are viewing this portfolio right now. Show who's here",
    });
    expect(button).toHaveTextContent("+2");
    expect(button).toHaveTextContent("6 here now");
  });

  it("lists everyone, anonymously, with where they are", async () => {
    peers = crowd(2);
    const user = userEvent.setup();
    render(<PresenceStack active="top" />);
    await user.click(screen.getByRole("button", { name: /2 other people/ }));
    const region = screen.getByRole("region", { name: "Who's here" });
    expect(region).toHaveTextContent("Anonymous Corgi");
    expect(region).toHaveTextContent("Reading Projects");
    expect(region).toHaveTextContent("Anonymous DalmatianYou");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
