import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Certifications } from "./Certifications";
import { certs } from "../lib/data";

/**
 * Two things here are easy to regress without anyone noticing.
 *
 * The course-certificate deck is collapsed on purpose: nine Sololearn
 * cards are supporting evidence, and left open they push the awards that
 * are actually worth reading a screen down the page — and pull nine image
 * fetches nobody asked for. "Collapsed" has to mean *absent from the DOM*,
 * not merely hidden, or the fetches happen anyway.
 *
 * And the awards list is ordered: the most recent, most substantial
 * credential leads. Array order in data.ts is the only thing holding that.
 */

const courseCerts = certs.filter((c) => c.image);
const awards = certs.filter((c) => !c.image);

describe("Certifications", () => {
  it("leads the awards list with the Gen AI Academy certificate", () => {
    render(<Certifications />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAccessibleName(/Gen AI Academy/i);
    expect(links[0]).toHaveAttribute("href", "/credentials/Hack2Skill.pdf");
  });

  it("keeps that certificate first in the data, which is what orders it", () => {
    expect(awards[0].title).toMatch(/Gen AI Academy/i);
    expect(awards[0].issuer).toMatch(/Hack2skill/i);
  });

  it("does not render a single course certificate until asked", () => {
    const { container } = render(<Certifications />);
    // Not "hidden" — not built. No <img> in the tree means no fetch.
    // Asserted against src rather than title: one of them is "C++",
    // which is not a valid regular expression.
    expect(container.querySelectorAll('img[src*="/credentials/"]')).toHaveLength(0);
    expect(screen.queryByRole("region", { name: /course certificates/i })).toBeNull();
  });

  it("offers the deck as a collapsed heading that says how many there are", () => {
    render(<Certifications />);
    const toggle = screen.getByRole("button", {
      name: new RegExp(`${courseCerts.length} Course Certificates`, "i"),
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(toggle).getByText("Show")).toBeInTheDocument();
  });

  it("builds the deck only once the heading is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<Certifications />);
    const toggle = screen.getByRole("button", {
      name: new RegExp(`${courseCerts.length} Course Certificates`, "i"),
    });

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(toggle).getByText("Hide")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /course certificates/i })
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('img[src*="/credentials/"]').length
    ).toBe(courseCerts.length);
  });

  it("collapses again, taking the images back out of the document", async () => {
    const user = userEvent.setup();
    render(<Certifications />);
    const toggle = screen.getByRole("button", {
      name: new RegExp(`${courseCerts.length} Course Certificates`, "i"),
    });

    await user.click(toggle);
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: /course certificates/i })).toBeNull();
  });
});
