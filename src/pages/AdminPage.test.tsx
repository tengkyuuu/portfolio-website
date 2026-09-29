import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The console used to open on whatever this browser had cached — or on the
 * shipped defaults for a new admin, a new device, or any browser whose
 * cache a deploy had invalidated — and the first edit published that copy
 * over the real document. Editors now wait for the published content.
 */

const published = {
  hero: { name: "Published Name" },
  about: { paragraphs: "", specs: [] },
  skills: [],
  projects: [],
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.setItem("jvc_admin_auth_v1", "1");
  sessionStorage.setItem("jvc_admin_token_v1", "token");
  sessionStorage.setItem("jvc_admin_mode_v1", "server");
  sessionStorage.setItem("jvc_admin_expires_v1", String(Date.now() + 60_000));
  window.location.hash = "#hero";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/content") return new Response(JSON.stringify(published), { status: 200 });
      if (url.startsWith("/api/login?op=me")) {
        return new Response(JSON.stringify({ user: { id: "owner", username: "owner", name: "Owner", role: "owner" } }), { status: 200 });
      }
      if (url.startsWith("/api/inquiries")) return new Response(JSON.stringify({ items: [], unreadCount: 0 }), { status: 200 });
      if (url.startsWith("/api/chat")) return new Response(JSON.stringify({ sessions: [], waitingCount: 0 }), { status: 200 });
      return new Response("{}", { status: 404 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe("AdminPage", () => {
  it("opens the editors on the published document, not the defaults", async () => {
    vi.resetModules();
    const { AdminPage } = await import("./AdminPage");
    render(<AdminPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the published document");
    expect(await screen.findByDisplayValue("Published Name")).toBeInTheDocument();
  });
});
