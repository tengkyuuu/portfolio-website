import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInline, safeHref } from "./inline";

function html(text: string): HTMLElement {
  const { container } = render(<p>{renderInline(text)}</p>);
  return container.firstElementChild as HTMLElement;
}

describe("renderInline", () => {
  it("renders the markdown-style forms", () => {
    const p = html("**bold** and *soft* with `x*y` and [docs](https://example.com)");
    expect(p.querySelector("strong")?.textContent).toBe("bold");
    expect(p.querySelector("em")?.textContent).toBe("soft");
    expect(p.querySelector("code")?.textContent).toBe("x*y");
    const a = p.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com");
    expect(a?.getAttribute("rel")).toBe("noreferrer");
  });

  it("wraps the words between paired HTML tags", () => {
    // Regression: each tag used to render on its own through innerHTML,
    // so the cover tagline's <em>adapt</em> italicised nothing.
    const p = html("The ability to <em>adapt</em> is what makes a good <em>engineer</em>.");
    expect([...p.querySelectorAll("em")].map((e) => e.textContent)).toEqual([
      "adapt",
      "engineer",
    ]);
    expect(p.textContent).toBe("The ability to adapt is what makes a good engineer.");
  });

  it("keeps only the href of an HTML link", () => {
    const p = html('<a href="https://example.com" onmouseover="alert(1)" style="position:fixed">hi</a>');
    const a = p.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://example.com");
    expect(a.hasAttribute("onmouseover")).toBe(false);
    expect(a.hasAttribute("style")).toBe(false);
    expect(a.textContent).toBe("hi");
  });

  it("drops script-scheme links but keeps their words", () => {
    const md = html("[click](javascript:alert(1))");
    expect(md.querySelector("a")).toBeNull();

    const tag = html('<a href="java\tscript:alert(1)">click</a>');
    expect(tag.querySelector("a")).toBeNull();
    expect(tag.textContent).toBe("click");
  });

  it("renders any other markup as literal text", () => {
    const p = html('<img src=x onerror="alert(1)"> <script>alert(1)</script>');
    expect(p.querySelector("img")).toBeNull();
    expect(p.querySelector("script")).toBeNull();
    expect(p.textContent).toContain("<img src=x");
  });
});

describe("safeHref", () => {
  it.each([
    ["https://example.com", true],
    ["mailto:me@example.com", true],
    ["tel:+63123", true],
    ["/projects/foo.png", true],
    ["#contact", true],
    ["javascript:alert(1)", false],
    [" JavaScript:alert(1)", false],
    ["data:text/html;base64,xx", false],
    ["vbscript:msgbox", false],
    ["", false],
  ])("%s → %s", (href, ok) => {
    expect(safeHref(href) !== null).toBe(ok);
  });
});
