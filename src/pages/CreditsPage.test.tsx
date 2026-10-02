import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreditsPage } from "./CreditsPage";
import { imageCredits } from "../lib/data";

/**
 * The failure mode this page exists to prevent is quiet: an uncredited
 * image is invisible by definition, so the only way to know this page
 * still does its job is to assert every entry actually renders.
 */
describe("CreditsPage", () => {
  it("renders every credited image with its disclosure", () => {
    render(<CreditsPage />);
    for (const credit of imageCredits) {
      expect(screen.getByAltText(credit.alt)).toBeInTheDocument();
      expect(screen.getByText(credit.usedAs)).toBeInTheDocument();
    }
  });

  it("marks every unknown-artist image as CTTO, not blank", () => {
    render(<CreditsPage />);
    const unknownCount = imageCredits.filter((c) => c.artist === null).length;
    // +1: the page also explains what CTTO means once, in its legend,
    // separately from the per-image badges this test is really checking.
    expect(screen.getAllByText("CTTO")).toHaveLength(unknownCount + 1);
    expect(screen.getAllByText(/Artist unknown/).length).toBeGreaterThan(0);
  });

  it("gives a way to actually reach the real artist, if one comes forward", () => {
    render(<CreditsPage />);
    expect(
      screen.getByRole("link", { name: "jamescalunsag13@gmail.com" })
    ).toHaveAttribute("href", "mailto:jamescalunsag13@gmail.com");
  });
});
