import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AcceptInvite } from "./AcceptInvite";

const { checkInvite, acceptInvite } = vi.hoisted(() => ({
  checkInvite: vi.fn(),
  acceptInvite: vi.fn(),
}));
const establishSession = vi.hoisted(() => vi.fn());

vi.mock("../../lib/team-api", () => ({ checkInvite, acceptInvite }));
vi.mock("../../lib/auth", () => ({ establishSession }));

afterEach(() => {
  vi.clearAllMocks();
});

it("shows a loading state while the invite is being checked", () => {
  checkInvite.mockReturnValue(new Promise(() => {}));
  render(<AcceptInvite token="tok" onAuthed={vi.fn()} />);
  expect(screen.getByText("Checking your invite…")).toBeInTheDocument();
});

it("shows the server's reason and a way back for an invalid or expired invite", async () => {
  checkInvite.mockResolvedValue({ ok: false, message: "This invite link is invalid or has expired." });
  render(<AcceptInvite token="tok" onAuthed={vi.fn()} />);
  await screen.findByText("That invite link doesn't work anymore");
  expect(screen.getByText("This invite link is invalid or has expired.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Back to portfolio/ })).toHaveAttribute("href", "/");
});

it("rejects a too-short password and a mismatched confirmation without calling the server", async () => {
  checkInvite.mockResolvedValue({ ok: true, name: "Maria Santos", username: "maria" });
  render(<AcceptInvite token="tok" onAuthed={vi.fn()} />);
  await screen.findByText("Hi Maria Santos");

  fireEvent.change(screen.getByPlaceholderText("At least 10 characters"), { target: { value: "short" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "short" } });
  fireEvent.click(screen.getByRole("button", { name: /Set password and sign in/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Password must be at least 10 characters.");
  expect(acceptInvite).not.toHaveBeenCalled();

  fireEvent.change(screen.getByPlaceholderText("At least 10 characters"), {
    target: { value: "a-long-enough-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "a-different-password" } });
  fireEvent.click(screen.getByRole("button", { name: /Set password and sign in/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("The two passwords don't match.");
  expect(acceptInvite).not.toHaveBeenCalled();
});

it("sets the password, establishes the session, and signs in on success", async () => {
  checkInvite.mockResolvedValue({ ok: true, name: "Maria Santos", username: "maria" });
  const user = { id: "1", username: "maria", name: "Maria Santos", role: "admin" as const };
  acceptInvite.mockResolvedValue({ ok: true, token: "new-token", user });
  const onAuthed = vi.fn();
  render(<AcceptInvite token="tok-123" onAuthed={onAuthed} />);
  await screen.findByText("Hi Maria Santos");

  fireEvent.change(screen.getByPlaceholderText("At least 10 characters"), {
    target: { value: "a-long-enough-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "a-long-enough-password" } });
  fireEvent.click(screen.getByRole("button", { name: /Set password and sign in/ }));

  await waitFor(() => expect(onAuthed).toHaveBeenCalled());
  expect(acceptInvite).toHaveBeenCalledWith("tok-123", "a-long-enough-password");
  expect(establishSession).toHaveBeenCalledWith("new-token", user);
});

it("shows the server's error instead of signing in when the link was already redeemed", async () => {
  checkInvite.mockResolvedValue({ ok: true, name: "Maria Santos", username: "maria" });
  acceptInvite.mockResolvedValue({ ok: false, message: "This invite link is invalid or has expired." });
  const onAuthed = vi.fn();
  render(<AcceptInvite token="tok" onAuthed={onAuthed} />);
  await screen.findByText("Hi Maria Santos");

  fireEvent.change(screen.getByPlaceholderText("At least 10 characters"), {
    target: { value: "a-long-enough-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "a-long-enough-password" } });
  fireEvent.click(screen.getByRole("button", { name: /Set password and sign in/ }));

  expect(await screen.findByRole("alert")).toHaveTextContent("This invite link is invalid or has expired.");
  expect(onAuthed).not.toHaveBeenCalled();
  expect(establishSession).not.toHaveBeenCalled();
});
