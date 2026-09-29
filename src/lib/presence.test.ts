import { describe, expect, it } from "vitest";
import {
  BREEDS,
  breedFor,
  distinctBreeds,
  peersFromState,
  stackView,
  type Peer,
} from "./presence";

describe("breedFor", () => {
  it("gives the same visitor the same dog every time", () => {
    expect(breedFor("visitor-a")).toBe(breedFor("visitor-a"));
  });

  it("spreads visitors across the breeds", () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => breedFor(`v${i}`)));
    expect(seen.size).toBe(BREEDS.length);
  });
});

describe("peersFromState", () => {
  it("counts a visitor with several tabs open once", () => {
    const peers = peersFromState(
      {
        me: [{ breed: "pug", tab: "top", since: 100 }],
        them: [
          { breed: "corgi", tab: "work", since: 50 },
          { breed: "corgi", tab: "blog", since: 80 },
        ],
      },
      "me"
    );
    expect(peers).toHaveLength(2);
    // Arrival is the earliest tab; location is the latest one.
    expect(peers[0]).toMatchObject({ key: "them", since: 50, tab: "blog", self: false });
    expect(peers[1]).toMatchObject({ key: "me", self: true });
  });

  it("ignores a breed it doesn't know rather than drawing nothing", () => {
    const [peer] = peersFromState({ x: [{ breed: "wolf", since: 1 }] }, "me");
    expect(BREEDS.map((b) => b.id)).toContain(peer.breed);
  });

  it("skips keys with no entries", () => {
    expect(peersFromState({ gone: [] }, "me")).toEqual([]);
  });
});

describe("distinctBreeds", () => {
  const peer = (key: string, breed: Peer["breed"], since: number): Peer => ({
    key,
    breed,
    since,
    self: false,
  });

  it("lets the first arrival keep a contested breed", () => {
    const out = distinctBreeds([peer("a", "corgi", 1), peer("b", "corgi", 2), peer("c", "corgi", 3)]);
    expect(out[0].breed).toBe("corgi");
    expect(new Set(out.map((p) => p.breed)).size).toBe(3);
  });

  it("allows repeats only once every breed is in use", () => {
    const crowd = Array.from({ length: BREEDS.length + 2 }, (_, i) => peer(`p${i}`, "pug", i));
    const out = distinctBreeds(crowd);
    expect(new Set(out.slice(0, BREEDS.length).map((p) => p.breed)).size).toBe(BREEDS.length);
  });
});

describe("stackView", () => {
  it("shows three faces and counts the rest, never counting you as a face", () => {
    const peers: Peer[] = [
      { key: "me", breed: "pug", since: 0, self: true },
      ...["a", "b", "c", "d", "e"].map((key, i) => ({ key, breed: "corgi" as const, since: i + 1, self: false })),
    ];
    const view = stackView(peers);
    expect(view.total).toBe(6);
    expect(view.shown.map((p) => p.key)).toEqual(["a", "b", "c"]);
    expect(view.overflow).toBe(2);
  });
});
