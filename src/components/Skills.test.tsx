import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Skills } from "./Skills";
import { skillGroups } from "../lib/data";

const TOTAL = skillGroups.reduce((n, g) => n + g.items.length, 0);

/** The first skill in the catalog that no other skill name contains. */
const UNIQUE_SKILL = "Figma";

describe("Skills", () => {
  it("renders every discipline as a card", () => {
    render(<Skills />);
    for (const g of skillGroups) {
      expect(screen.getByRole("heading", { name: g.label })).toBeInTheDocument();
    }
  });

  it("reports the full deck size before any filtering", () => {
    render(<Skills />);
    expect(screen.getByText(`${TOTAL}`, { selector: "b" })).toBeInTheDocument();
  });

  it("narrows the deck as you type", async () => {
    const user = userEvent.setup();
    render(<Skills />);

    const before = screen.getAllByRole("button", { name: /^Open / }).length;
    expect(before).toBe(TOTAL);

    await user.type(screen.getByLabelText("Filter skills"), UNIQUE_SKILL);

    const after = screen.getAllByRole("button", { name: /^Open / });
    expect(after.length).toBeLessThan(before);
    expect(after.some((b) => b.getAttribute("title") === `Open ${UNIQUE_SKILL}`)).toBe(true);
  });

  it("matches on discipline name as well as skill name", async () => {
    const user = userEvent.setup();
    render(<Skills />);
    await user.type(screen.getByLabelText("Filter skills"), "Embedded");

    const embedded = skillGroups.find((g) => g.label === "Embedded")!;
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(
      embedded.items.length
    );
  });

  it("shows an empty state with a reset for a query that matches nothing", async () => {
    const user = userEvent.setup();
    render(<Skills />);
    await user.type(screen.getByLabelText("Filter skills"), "zzzznotaskill");

    expect(screen.getByText(/No skill matches/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Reset filters/i }));
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(TOTAL);
  });

  it("filters by cadence, and toggles that filter off when pressed again", async () => {
    const user = userEvent.setup();
    render(<Skills />);
    const group = screen.getByRole("group", { name: "Filter by cadence" });
    const daily = within(group).getByRole("button", { name: /^Daily/ });

    await user.click(daily);
    expect(daily).toHaveAttribute("aria-pressed", "true");
    const filtered = screen.getAllByRole("button", { name: /^Open / }).length;
    expect(filtered).toBeLessThan(TOTAL);

    await user.click(daily);
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(TOTAL);
  });

  it("switches to a sortable matrix and back", async () => {
    const user = userEvent.setup();
    render(<Skills />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sortable matrix" }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(TOTAL + 1); // + header

    await user.click(screen.getByRole("button", { name: "Discipline grid" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("re-sorts the matrix when a column header is clicked", async () => {
    const user = userEvent.setup();
    render(<Skills />);
    await user.click(screen.getByRole("button", { name: "Sortable matrix" }));

    await user.click(screen.getByRole("button", { name: /^Skill/ }));
    // Read the accessible name, not textContent: the icon-font fallback
    // puts the literal ligature ("chip_extraction") into the text node.
    const names = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((r) =>
        (r.querySelector("td button")?.getAttribute("aria-label") ?? "").replace(/^Open /, "")
      );
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("opens the detail pane for a skill and closes it again", async () => {
    const user = userEvent.setup();
    render(<Skills />);

    await user.click(
      screen.getByRole("button", { name: new RegExp("^Open " + UNIQUE_SKILL) })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: UNIQUE_SKILL })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close skill detail" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("focuses the filter on / and clears it on Escape", async () => {
    const user = userEvent.setup();
    render(<Skills />);
    const input = screen.getByLabelText("Filter skills") as HTMLInputElement;

    await user.keyboard("/");
    expect(input).toHaveFocus();

    await user.type(input, "react");
    expect(input.value).toBe("react");

    await user.keyboard("{Escape}");
    expect(input.value).toBe("");
  });
});
