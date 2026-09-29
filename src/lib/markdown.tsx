import type { ReactNode } from "react";
import { renderInline, safeHref } from "./inline";

/**
 * Block-level Markdown for blog posts — the subset a writer actually uses,
 * rendered straight to React elements. No HTML passes through: this is
 * admin-authored content on the same origin as the admin token, and with
 * team accounts not every author is the owner (see lib/inline.tsx).
 *
 *   ## Heading / ### Subheading     (a single # is demoted to ##: the
 *                                    post title is the page's h1)
 *   paragraphs, separated by a blank line
 *   - bullets   /   1. numbered
 *   > a pull quote
 *   ```lang
 *   code
 *   ```
 *   ![alt text](https://…/image.webp "Optional caption")   on its own line
 *   ---                              a section break
 *
 * Inline emphasis, code and links inside any of these come from
 * renderInline, including its link-scheme allow-list.
 */

type Block =
  | { kind: "heading"; level: 2 | 3 | 4; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; lang: string; code: string }
  | { kind: "image"; src: string; alt: string; caption?: string }
  | { kind: "rule" };

const IMAGE_LINE = /^!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+"([^"]*)")?\s*\)$/;
const BULLET = /^[-*+]\s+/;
const NUMBERED = /^\d+[.)]\s+/;

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const isBlockStart = (line: string) =>
    /^#{1,4}\s/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    BULLET.test(line) ||
    NUMBERED.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line) ||
    IMAGE_LINE.test(line);

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }

    const fence = /^```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or end of input)
      blocks.push({ kind: "code", lang: fence[1], code: body.join("\n") });
      continue;
    }

    const heading = /^(#{1,4})\s+(.+?)\s*#*$/.exec(line);
    if (heading) {
      const level = Math.max(2, heading[1].length) as 2 | 3 | 4;
      blocks.push({ kind: "heading", level, text: heading[2] });
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ kind: "rule" });
      i += 1;
      continue;
    }

    const image = IMAGE_LINE.exec(line);
    if (image) {
      const src = safeHref(image[2]);
      if (src) blocks.push({ kind: "image", alt: image[1], src, caption: image[3] || undefined });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", text: quote.join(" ") });
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const marker = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (marker.test(cur)) {
          items.push(cur.replace(marker, ""));
        } else if (cur && items.length > 0 && !isBlockStart(cur)) {
          // A wrapped continuation of the previous item.
          items[items.length - 1] += " " + cur;
        } else {
          break;
        }
        i += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i].trim())) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: para.join(" ") });
  }

  return blocks;
}

export function renderMarkdown(src: string): ReactNode[] {
  let figure = 0;
  return parseMarkdown(src).map((b, i) => {
    switch (b.kind) {
      case "heading": {
        const Tag = `h${b.level}` as "h2" | "h3" | "h4";
        return <Tag key={i}>{renderInline(b.text)}</Tag>;
      }
      case "paragraph":
        return <p key={i}>{renderInline(b.text)}</p>;
      case "list": {
        const Tag = b.ordered ? "ol" : "ul";
        return (
          <Tag key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ))}
          </Tag>
        );
      }
      case "quote":
        return (
          <blockquote key={i}>
            <p>{renderInline(b.text)}</p>
          </blockquote>
        );
      case "code":
        return (
          <pre key={i} data-lang={b.lang || undefined}>
            <code>{b.code}</code>
          </pre>
        );
      case "image":
        figure += 1;
        return (
          <figure key={i}>
            <img src={b.src} alt={b.alt} loading="lazy" decoding="async" />
            {b.caption && (
              <figcaption>
                <span>Figure {figure}</span> {b.caption}
              </figcaption>
            )}
          </figure>
        );
      case "rule":
        return <hr key={i} />;
    }
  });
}
