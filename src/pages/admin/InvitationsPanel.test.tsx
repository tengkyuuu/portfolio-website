import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InvitationsPanel } from "./InvitationsPanel";

vi.mock("../../lib/auth", () => ({ getAdminToken: () => "test-token" }));
afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); });

it("previews first, opens separate Gmail drafts, and preserves the send key when retrying", async () => {
  const sends: { requestId: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === "GET") return new Response(JSON.stringify({ configured: true, missing: [], from: "James <hello@example.com>", siteUrl: "https://example.com" }));
    const body = JSON.parse(options?.body as string);
    if (body.preview) return new Response(JSON.stringify({ html: "<p>Preview</p>", text: body.message + "\nhttps://example.com", subject: body.subject, recipients: body.recipients, from: "hello@example.com", siteUrl: "https://example.com" }));
    sends.push(body);
    return sends.length === 1 ? new Response(JSON.stringify({ error: "Please retry" }), { status: 502 }) : new Response(JSON.stringify({ accepted: [{ email: "one@example.com", id: "1" }, { email: "two@example.com", id: "2" }] }));
  }));
  render(<InvitationsPanel />);
  await screen.findByText("Resend ready");
  expect(screen.queryByRole("button", { name: /^Send \d/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Recipients/), { target: { value: "one@example.com, two@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview invitation" }));
  const send = await screen.findByRole("button", { name: "Send 2 invitations" });
  expect(screen.getByTitle("Invitation email preview")).toHaveAttribute("sandbox", "");
  const gmail = screen.getAllByRole("link", { name: /Open in Gmail/ });
  expect(gmail).toHaveLength(2);
  expect(new URL(gmail[0].getAttribute("href")!).searchParams.get("to")).toBe("one@example.com");
  expect(sends).toHaveLength(0);
  fireEvent.click(send);
  await screen.findByText("Please retry");
  fireEvent.click(send);
  await screen.findByText("2 invitations accepted by Resend");
  expect(sends[0].requestId).toBe(sends[1].requestId);
  expect(sessionStorage.getItem("jvc_invitation_draft")).toBeNull();
});
