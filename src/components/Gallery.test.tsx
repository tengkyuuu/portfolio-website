import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONTENT, resetAll, saveContent, type Design } from "../lib/content";
import { Gallery } from "./Gallery";

const design = (p: Partial<Design>): Design => ({
  id: "x",
  title: "Piece",
  image: "/x.webp",
  alt: "A poster with a big orange sun",
  ...p,
});

beforeEach(() => {
  window.location.hash = "#gallery";
  saveContent({
    ...DEFAULT_CONTENT,
    designs: [
      design({ id: "a", title: "Festival poster", category: "Poster", year: "2026" }),
      design({ id: "b", title: "Cafe logo", category: "Logo", alt: "A coffee cup drawn in one line" }),
      design({ id: "c", title: "Unfinished", alt: "" }),
      design({ id: "d", title: "Night poster", category: "Poster", link: "javascript:alert(1)" }),
    ],
  });
});

afterEach(() => {
  resetAll();
  window.location.hash = "";
});

describe("Gallery", () => {
  it("hangs finished pieces only, numbered as figures", () => {
    render(<Gallery />);
    const tiles = screen.getAllByRole("button", { name: /full size$/ });
    expect(tiles.map((t) => t.getAttribute("aria-label"))).toEqual([
      "Open Festival poster full size",
      "Open Cafe logo full size",
      "Open Night poster full size",
    ]);
    expect(tiles[2]).toHaveTextContent("Fig. 3");
    expect(screen.getByAltText("A coffee cup drawn in one line")).toBeInTheDocument();
  });

  it("filters by category without renumbering the figures", async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    await user.click(screen.getByRole("button", { name: /^Logo/ }));
    const tiles = screen.getAllByRole("button", { name: /full size$/ });
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toHaveTextContent("Fig. 2");
    expect(screen.getByRole("button", { name: /^Logo/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a piece in a labelled dialog, steps through, and mirrors it in the hash", async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    await user.click(screen.getByRole("button", { name: "Open Festival poster full size" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByRole("heading", { name: "Festival poster", hidden: true })).toBeInTheDocument();
    expect(window.location.hash).toBe("#gallery/a");

    await user.click(within(dialog).getByRole("button", { name: "Next design", hidden: true }));
    expect(within(dialog).getByRole("heading", { name: "Cafe logo", hidden: true })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close", hidden: true }));
    expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#gallery");
  });

  it("opens straight to a piece from a deep link, and drops an unsafe project link", () => {
    window.location.hash = "#gallery/d";
    render(<Gallery />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByRole("heading", { name: "Night poster", hidden: true })).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { hidden: true })).not.toBeInTheDocument();
  });
});
