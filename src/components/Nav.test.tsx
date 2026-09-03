import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Nav, tabs } from "./Nav";

/**
 * The ribbon has to show every tab. It briefly did not: the document title
 * was absolutely centred, so it sat outside the flow and the tab strip grew
 * underneath it — "Credentials" rendered on top of "Portfolio.docx" and
 * "Contact" was clipped away by the strip's own overflow.
 */

function renderNav(active: (typeof tabs)[number]["id"] = "top") {
  const onChange = vi.fn();
  render(
    <Nav theme="colorful" onThemeChange={vi.fn()} active={active} onChange={onChange} />
  );
  return { onChange };
}

describe("Nav", () => {
  it("renders a button for every tab", () => {
    renderNav();
    for (const tab of tabs) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${labelOf(tab.id)}$`) })
      ).toBeInTheDocument();
    }
  });

  it("offers every tab on mobile too", () => {
    renderNav();
    const select = screen.getByLabelText("Switch tab");
    expect(select.querySelectorAll("option")).toHaveLength(tabs.length);
  });

  it("reports the tab that was clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = renderNav();
    await user.click(screen.getByRole("button", { name: /^Now$/ }));
    expect(onChange).toHaveBeenCalledWith("now");
  });

  it("keeps the document title out of the tab strip's column", () => {
    renderNav();
    // A floating title can overlap; one in its own grid column cannot.
    const title = screen.getByText("Portfolio.docx").parentElement as HTMLElement;
    expect(title.className).not.toMatch(/\babsolute\b/);
  });
});

/** English labels, matching the default i18n dictionary. */
function labelOf(id: string): string {
  const map: Record<string, string> = {
    top: "Home",
    work: "Projects",
    about: "About",
    stack: "Skills",
    now: "Now",
    credentials: "Credentials",
    contact: "Contact",
  };
  return map[id] ?? id;
}
