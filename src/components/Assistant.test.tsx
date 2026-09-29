import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { Assistant } from "./Assistant";

beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
});

it("shows Gemini's reaction even if only the visitor's message was saved", async () => {
  let posted = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === "POST") { posted = true; return new Response(JSON.stringify({ reply: "James builds embedded systems.", reaction: "working", mode: "ai" })); }
    if (url.includes("?session=")) return new Response(JSON.stringify({ mode: "ai", messages: posted ? [{ id: 1, role: "visitor", body: "Tell me about his projects", created_at: "2026-09-29T08:00:00Z" }] : [] }));
    return new Response(JSON.stringify({ configured: true }));
  }));
  render(<Assistant />);
  fireEvent.click(await screen.findByRole("button", { name: "Open Blue" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Message Blue" }), { target: { value: "Tell me about his projects" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("James builds embedded systems.")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /working at a laptop/ })).toHaveAttribute("src", "/blue/working-blue.jpg");
  expect(screen.getAllByText("Tell me about his projects")).toHaveLength(1);
});

it("restores saved reactions and labels human replies separately", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("?session=") ? {
    mode: "human", messages: [
      { id: 1, role: "ai", body: "Happy to help.", reaction: "like", created_at: "2026-09-29T08:00:00Z" },
      { id: 2, role: "human", body: "James here. Thanks for visiting!", created_at: "2026-09-29T08:01:00Z" },
    ],
  } : { configured: true }))));
  render(<Assistant />);
  fireEvent.click(await screen.findByRole("button", { name: /Open Blue/ }));
  expect(await screen.findByRole("img", { name: /thumbs-up/ })).toBeInTheDocument();
  expect(screen.getByText("James", { selector: "span" })).toBeInTheDocument();
});
