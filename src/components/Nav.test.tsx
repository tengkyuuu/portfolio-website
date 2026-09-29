import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_CONTENT, saveContent, resetAll } from "../lib/content";
import { Nav, tabs, visibleTabs } from "./Nav";

/**
 * The ribbon has to show every tab. It briefly did not: the document title
 * was absolutely centred, so it sat outside the flow and the tab strip grew
 * underneath it — "Credentials" rendered on top of "Portfolio.docx" and
 * "Contact" was clipped away by the strip's own overflow.
 */

function renderNav(active: (typeof tabs)[number]["id"] = "top") {
  const onChange = vi.fn();
  render(
    <Nav
      theme="colorful"
      onThemeChange={vi.fn()}
      active={active}
      onChange={onChange}
    />,
  );
  return { onChange };
}

afterEach(() => resetAll());

describe("Nav", () => {
  it("renders a button for every visible tab", () => {
    renderNav();
    for (const tab of visibleTabs()) {
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^${labelOf(tab.id)}$`),
        }),
      ).toBeInTheDocument();
    }
  });

  it("offers every tab on mobile too", () => {
    renderNav();
    const select = screen.getByLabelText("Switch tab");
    expect(select.querySelectorAll("option")).toHaveLength(visibleTabs().length);
  });

  it("keeps Blog and Gallery off the ribbon until they have something in them", () => {
    renderNav();
    expect(screen.queryByRole("button", { name: /^Blog$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Gallery$/ })).not.toBeInTheDocument();
  });

  it("adds them once there is a published post and a finished design", () => {
    saveContent({
      ...DEFAULT_CONTENT,
      posts: [
        { id: "p", slug: "hello", title: "Hello", date: "2026-09-29", excerpt: "", body: "Hi.", tags: [], draft: false },
        { id: "d", slug: "wip", title: "WIP", date: "2026-09-29", excerpt: "", body: "…", tags: [], draft: true },
      ],
      designs: [
        { id: "a", title: "Poster", image: "/x.webp", alt: "A red poster with a white sun" },
        { id: "b", title: "", image: "/y.webp", alt: "" },
      ],
    });
    renderNav();
    expect(screen.getByRole("button", { name: /^Blog$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Gallery$/ })).toBeInTheDocument();
    // Order follows the ribbon: the gallery sits beside Projects.
    expect(visibleTabs().map((t) => t.id)).toEqual(tabs.map((t) => t.id));
  });

  it("reports the tab that was clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = renderNav();
    await user.click(screen.getByRole("button", { name: /^Skills$/ }));
    expect(onChange).toHaveBeenCalledWith("stack");
  });

  it("keeps the document title out of the tab strip's column", () => {
    renderNav();
    // A floating title can overlap; one in its own grid column cannot.
    const title = screen.getByText("Portfolio.docx")
      .parentElement as HTMLElement;
    expect(title.className).not.toMatch(/\babsolute\b/);
  });

  it("exposes the active section to assistive technology", () => {
    renderNav("work");
    expect(screen.getByRole("button", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("closes the File menu with Escape", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole("button", { name: "File" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("connects the ribbon tools to their workspace actions", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onToggleOutline = vi.fn();
    const onToggleHighlights = vi.fn();
    const onReadingStyle = vi.fn();
    render(
      <Nav
        theme="colorful"
        onThemeChange={vi.fn()}
        active="top"
        onChange={vi.fn()}
        onFocus={onFocus}
        onToggleOutline={onToggleOutline}
        onToggleHighlights={onToggleHighlights}
        onReadingStyle={onReadingStyle}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Focus mode" }));
    await user.click(
      screen.getByRole("button", { name: "Toggle navigation pane" }),
    );
    await user.click(screen.getByRole("button", { name: "Highlights" }));
    await user.click(
      screen.getByRole("button", { name: "Modern reading style" }),
    );
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onToggleOutline).toHaveBeenCalledOnce();
    expect(onToggleHighlights).toHaveBeenCalledOnce();
    expect(onReadingStyle).toHaveBeenCalledWith("modern");
  });
});

/** English labels, matching the default i18n dictionary. */
function labelOf(id: string): string {
  const map: Record<string, string> = {
    top: "Home",
    work: "Projects",
    about: "About",
    stack: "Skills",
    credentials: "Credentials",
    contact: "Contact",
    blog: "Blog",
    gallery: "Gallery",
  };
  return map[id] ?? id;
}
