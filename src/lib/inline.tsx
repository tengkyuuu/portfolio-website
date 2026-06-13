import type { ReactNode } from "react";

/**
 * Tiny inline formatter used to render admin-edited prose with limited
 * markdown-style emphasis. Intentionally minimal — escapes, no nesting, no
 * block-level features (paragraphs are split outside this).
 *
 * Supported:
 *   **bold**            → <strong>
 *   *italic*            → <em>
 *   `code`              → <code>
 *   [label](href)       → <a href="...">
 *   <em>…</em>, <strong>, <a>, <br>, <code>  → passed through as HTML
 *
 * Everything else is treated as plain text.
 */

const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|<\/?(?:em|strong|a|br|code)(?:\s+[^>]*)?\/?>)/g;

export function renderInline(text: string): ReactNode[] {
  if (!text) return [];
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > lastIndex) {
      out.push(text.slice(lastIndex, m.index));
    }
    const token = m[0];
    if (token.startsWith("**")) {
      out.push(<strong key={`k${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      out.push(
        <code key={`k${key++}`} className="font-ui text-[0.9em] bg-ribbon px-1 rounded-sm">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*")) {
      out.push(<em key={`k${key++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const external = /^https?:/.test(href);
        out.push(
          <a
            key={`k${key++}`}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            className="text-word-blue underline decoration-word-blue underline-offset-2 hover:text-word-blue-dark"
          >
            {label}
          </a>
        );
      } else {
        out.push(token);
      }
    } else {
      // Inline HTML tag — render as html via dangerouslySetInnerHTML on a span
      out.push(
        <span
          key={`k${key++}`}
          dangerouslySetInnerHTML={{ __html: token }}
        />
      );
    }
    lastIndex = m.index + token.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

/** Splits multi-paragraph text on blank lines and renders inline emphasis in each. */
export function renderParagraphs(text: string): ReactNode[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((para, i) => (
      <p key={i} className="leading-[1.7]">
        {renderInline(para)}
      </p>
    ));
}
