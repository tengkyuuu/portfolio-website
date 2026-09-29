import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseMarkdown, renderMarkdown } from "./markdown";

function html(src: string): HTMLElement {
  const { container } = render(<article>{renderMarkdown(src)}</article>);
  return container.firstElementChild as HTMLElement;
}

describe("parseMarkdown", () => {
  it("splits a post into the blocks a writer uses", () => {
    const blocks = parseMarkdown(
      [
        "# Title-ish",
        "",
        "First paragraph",
        "wraps onto a second line.",
        "",
        "- one",
        "- two",
        "  continues",
        "",
        "1. first",
        "2. second",
        "",
        "> quoted",
        "> still quoted",
        "",
        "```ts",
        "const a = 1;",
        "",
        "const b = 2;",
        "```",
        "",
        "---",
        '![A poster with a red sun](https://example.com/p.webp "Poster for a festival")',
      ].join("\n")
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "quote",
      "code",
      "rule",
      "image",
    ]);
    expect(blocks[0]).toMatchObject({ level: 2 }); // # is demoted: the post title is the h1
    expect(blocks[1]).toMatchObject({ text: "First paragraph wraps onto a second line." });
    expect(blocks[2]).toMatchObject({ ordered: false, items: ["one", "two continues"] });
    expect(blocks[5]).toMatchObject({ lang: "ts", code: "const a = 1;\n\nconst b = 2;" });
    expect(blocks[7]).toMatchObject({ alt: "A poster with a red sun", caption: "Poster for a festival" });
  });

  it("survives an unclosed code fence", () => {
    const blocks = parseMarkdown("```\nnever closed");
    expect(blocks).toEqual([{ kind: "code", lang: "", code: "never closed" }]);
  });
});

describe("renderMarkdown", () => {
  it("renders figures with numbered captions", () => {
    const a = html('![one](/a.webp "First")\n\n![two](/b.webp "Second")');
    const captions = [...a.querySelectorAll("figcaption")].map((f) => f.textContent);
    expect(captions).toEqual(["Figure 1 First", "Figure 2 Second"]);
    expect(a.querySelector("img")?.getAttribute("alt")).toBe("one");
  });

  it("passes no HTML through, anywhere", () => {
    const a = html(
      [
        "<script>alert(1)</script>",
        "",
        "## <img src=x onerror=alert(1)>",
        "",
        "- <iframe src=//evil></iframe>",
        "",
        "```",
        "<b>code is text</b>",
        "```",
      ].join("\n")
    );
    expect(a.querySelector("script, img, iframe, b")).toBeNull();
    expect(a.textContent).toContain("<script>alert(1)</script>");
    expect(a.querySelector("pre code")?.textContent).toBe("<b>code is text</b>");
  });

  it("drops an image whose source isn't a safe URL", () => {
    const a = html("![x](javascript:alert(1))");
    expect(a.querySelector("img")).toBeNull();
  });

  it("drops a script-scheme link but keeps its words", () => {
    const a = html("Click [here](javascript:alert(1)) now.");
    expect(a.querySelector("a")).toBeNull();
    expect(a.textContent).toContain("here");
  });
});
