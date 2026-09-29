import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase-client";

/**
 * Live presence — who else has the portfolio open right now, drawn as
 * anonymous dogs in the title bar the way Word shows co-authors.
 *
 * Supabase Realtime Presence, straight from the browser on the anon key:
 * no table, no Serverless Function (the Hobby plan's twelve are spoken
 * for — see CLAUDE.md). A visitor shares only a breed, the tab they're
 * reading and when they arrived. No name, no IP, nothing that identifies
 * them to anyone else.
 *
 * Degrades to nothing, like every optional integration here: without
 * VITE_SUPABASE_* the hook returns null and the title bar keeps its plain
 * "Viewing" label.
 */

export const BREEDS = [
  { id: "corgi", name: "Corgi" },
  { id: "shiba", name: "Shiba Inu" },
  { id: "husky", name: "Husky" },
  { id: "beagle", name: "Beagle" },
  { id: "dachshund", name: "Dachshund" },
  { id: "pug", name: "Pug" },
  { id: "dalmatian", name: "Dalmatian" },
  { id: "golden", name: "Golden Retriever" },
  { id: "poodle", name: "Poodle" },
  { id: "collie", name: "Border Collie" },
] as const;

export type BreedId = (typeof BREEDS)[number]["id"];

export type Peer = {
  key: string;
  breed: BreedId;
  /** The tab they're reading, if they said. */
  tab?: string;
  /** When they arrived (ms). Orders the stack and settles breed ties. */
  since: number;
  self: boolean;
};

type Meta = { breed?: unknown; tab?: unknown; since?: unknown };

const VISITOR_KEY = "jvc_visitor_v1";
const CHANNEL = "presence:portfolio";

function randomId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Stable per browser, so three open tabs are one visitor, not three dogs:
 * Presence groups every tab's entry under the same key.
 */
export function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The dog a visitor asks to be. Same browser, same dog, every visit. */
export function breedFor(id: string): BreedId {
  return BREEDS[hash(id) % BREEDS.length].id;
}

function isBreed(v: unknown): v is BreedId {
  return typeof v === "string" && BREEDS.some((b) => b.id === v);
}

/**
 * Presence state → one Peer per visitor, earliest arrival first.
 *
 * Supabase keys the state by our visitor id and holds one meta per open
 * tab under it; the most recent meta is the tab that visitor touched last.
 */
export function peersFromState(
  state: Record<string, Meta[] | undefined>,
  selfKey: string
): Peer[] {
  const peers: Peer[] = [];
  for (const [key, metas] of Object.entries(state)) {
    if (!metas || metas.length === 0) continue;
    const latest = metas[metas.length - 1];
    const since = Math.min(
      ...metas.map((m) => (typeof m.since === "number" ? m.since : Number.MAX_SAFE_INTEGER))
    );
    peers.push({
      key,
      breed: isBreed(latest.breed) ? latest.breed : breedFor(key),
      tab: typeof latest.tab === "string" ? latest.tab : undefined,
      since: Number.isFinite(since) ? since : 0,
      self: key === selfKey,
    });
  }
  return peers.sort((a, b) => a.since - b.since || a.key.localeCompare(b.key));
}

/**
 * Give every visitor a different dog while there are dogs to go round.
 * Two Corgis in the stack read as one visitor shown twice. Whoever arrived
 * first keeps their breed; later arrivals move to the next free one.
 * Every browser sees the same state and runs the same rule, so everyone
 * agrees on who is which dog.
 */
export function distinctBreeds(peers: Peer[]): Peer[] {
  const taken = new Set<BreedId>();
  return peers.map((p) => {
    if (taken.size >= BREEDS.length) return p;
    let breed = p.breed;
    if (taken.has(breed)) {
      const start = BREEDS.findIndex((b) => b.id === breed);
      for (let i = 1; i <= BREEDS.length; i += 1) {
        const next = BREEDS[(start + i) % BREEDS.length].id;
        if (!taken.has(next)) {
          breed = next;
          break;
        }
      }
    }
    taken.add(breed);
    return breed === p.breed ? p : { ...p, breed };
  });
}

/** What the title bar draws: a few faces, then "+N". */
export function stackView(peers: Peer[], max = 3) {
  const others = peers.filter((p) => !p.self);
  return {
    total: peers.length,
    others,
    shown: others.slice(0, max),
    overflow: Math.max(0, others.length - max),
  };
}

export function breedName(id: BreedId): string {
  return BREEDS.find((b) => b.id === id)?.name ?? "Dog";
}

/* --------------------------------- hook --------------------------------- */

/**
 * `?presence-demo=N` fills the stack with N fake visitors, in development
 * builds only — for looking at the stack without N browsers. The branch is
 * dead code in production (import.meta.env.DEV is false) and is dropped.
 */
function demoPeers(selfKey: string): Peer[] | null {
  if (!import.meta.env.DEV) return null;
  const n = Number(new URLSearchParams(window.location.search).get("presence-demo"));
  if (!Number.isFinite(n) || n < 1) return null;
  const tabs = ["work", "top", "gallery", "about", "blog", "stack"];
  const now = Date.now();
  return distinctBreeds(
    Array.from({ length: n }, (_, i) => {
      const key = i === 0 ? selfKey : `demo-${i}`;
      return { key, breed: breedFor(key), tab: tabs[i % tabs.length], since: now - (n - i) * 60_000, self: i === 0 };
    })
  );
}

/**
 * Everyone here now, including you (self: true), or null when presence
 * isn't available. `tab` is broadcast as you move around.
 */
export function usePresence(tab: string): Peer[] | null {
  const key = useMemo(visitorId, []);
  const [peers, setPeers] = useState<Peer[] | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const tabRef = useRef(tab);
  const sinceRef = useRef(Date.now());
  tabRef.current = tab;

  useEffect(() => {
    const demo = demoPeers(key);
    if (demo) {
      setPeers(demo);
      return;
    }
    // Crawlers, Lighthouse and test browsers aren't visitors.
    if (typeof navigator !== "undefined" && navigator.webdriver) return;
    const sb = getSupabaseClient();
    if (!sb) return;

    const channel = sb.channel(CHANNEL, { config: { presence: { key } } });
    channel.on("presence", { event: "sync" }, () => {
      setPeers(distinctBreeds(peersFromState(channel.presenceState() as Record<string, Meta[]>, key)));
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ breed: breedFor(key), tab: tabRef.current, since: sinceRef.current });
      }
    });
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void channel.untrack();
      void sb.removeChannel(channel);
    };
  }, [key]);

  // Follow the reader from tab to tab. Re-tracking replaces this tab's
  // meta; `since` stays the time they arrived.
  useEffect(() => {
    void channelRef.current?.track({ breed: breedFor(key), tab, since: sinceRef.current });
  }, [key, tab]);

  return peers;
}
