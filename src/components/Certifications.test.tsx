import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Certifications } from "./Certifications";
import { certs } from "../lib/data";

describe("Certifications", () => {
  it("leads with the Gen AI Academy certificate and loads previews on demand", () => {
    const { container } = render(<Certifications />);
    expect(screen.getAllByRole("button")[0]).toHaveAccessibleName(/Gen AI Academy/);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it.each([certs[0], certs.find((c) => c.image)!])("opens $title inside a modal and restores focus", async (cert) => {
    const user = userEvent.setup();
    render(<Certifications />);
    const trigger = screen.getAllByRole("button").find((button) => button.textContent?.startsWith(cert.title))!;
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: cert.title });
    expect(within(dialog).getAllByRole("img").length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("link", { name: "Open original certificate" })).toHaveAttribute("href", cert.href || cert.image);
    await user.click(within(dialog).getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("does not offer a preview for awards without files", () => {
    render(<Certifications />);
    const award = screen.getByText(/Champion — Regional/);
    expect(award.closest("button, a")).toBeNull();
  });
});
