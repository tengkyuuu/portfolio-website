import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PortraitPhoto } from "./PortraitPhoto";

it("uses a bundled portrait and keeps it visible when the hover image fails", () => {
  const { container } = render(<PortraitPhoto name="James" />);
  const base = screen.getByRole("img", { name: "James" });
  expect(base.getAttribute("src")).toContain("portrait.jpg");
  fireEvent.error(container.querySelector(".portrait-shades")!);
  expect(container.querySelector(".portrait-no-shades")).toBeInTheDocument();
  expect(container.querySelector(".portrait-shades")).not.toBeInTheDocument();
  expect(base).toBeInTheDocument();
});

it("falls back to the bundled deployment's public portrait on a load error", () => {
  render(<PortraitPhoto name="James" />);
  const base = screen.getByRole("img", { name: "James" });
  fireEvent.error(base);
  expect(base).toHaveAttribute("src", "/james.jpg");
});
