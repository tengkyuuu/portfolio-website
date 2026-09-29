import type { ReactNode } from "react";

/**
 * Tiny inline formatter used to render admin-edited prose with limited
 * markdown-style emphasis. Intentionally minimal — no block-level features
 * (paragraphs are split outside this).
 *
 * Supported:
 *   **bold**            → <strong>
 *   *italic*            → <em>
 *   `code`              → <code>
 *   [label](href)       → <a href="...">
 *   <em>…</em>, <strong>…</strong>, <code>…</code>, <a href="…">…</a>, <br>
 *
 * Everything is built as React elements; nothing reaches innerHTML. That
 * used to be the escape hatch for the HTML forms, one tag per span, which
 * had two faults. An <a> token kept every attribute it was written with,
 * so `<a onmouseover=…>` in any content field ran script on the origin
 * that holds the admin token — harmless with one editor, a privilege
 * escalation once other admins can write content. And a tag rendered on
 * its own wraps nothing, so `<em>adapt</em>` never italicised "adapt".
 *
 * Anything that isn't one of the forms above renders as literal text.
 */

const TOKEN =
  /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|<(em|strong|code)>[\s\S]*?<\/\2>|<a\s[^>]*>[\s\S]*?<\/a>|<br\s*\/?>)/g;

const LINK_CLASS =
  "text-word-blue underline decoration-word-blue underline-offset-2 hover:text-word-blue-dark";

/**
 * The href if it is safe to put in a link or image, else null.
 *
 * Allow-list, not deny-list: http(s), mailto, tel, and scheme-less
 * relative paths or fragments. Browsers ignore ASCII whitespace and
 * control characters inside a scheme ("java\tscript:" still runs), so
 * those are stripped before the scheme is read.
 */
export function safeHref(href: string | undefined | null): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  // eslint-disable-next-line no-control-regex
  const compact = trimmed.replace(/[\u0000- \u007f]/g, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (!scheme) return trimmed;
  return /^(https?|mailto|tel)$/i.test(scheme[1]) ? trimmed : null;
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

function link(key: string, href: string, children: ReactNode): ReactNode {
  const external = /^https?:/i.test(href);
  return (
    <a
      key={key}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={LINK_CLASS}
    >
      {children}
    </a>
  );
}

export function renderInline(text: string): ReactNode[] {
  if (!text) return [];
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const TOKEN_RE = new RegExp(TOKEN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      out.push(text.slice(lastIndex, m.index));
    }
    const token = m[0];
    const k = `k${key++}`;
    if (token.startsWith("**")) {
      out.push(<strong key={k}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      out.push(
        <code key={k} className="font-ui text-[0.9em] bg-ribbon px-1 rounded-sm">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*")) {
      out.push(<em key={k}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = linkMatch ? safeHref(linkMatch[2]) : null;
      out.push(linkMatch && href ? link(k, href, linkMatch[1]) : token);
    } else if (/^<br/i.test(token)) {
      out.push(<br key={k} />);
    } else if (/^<a\s/i.test(token)) {
      const open = token.slice(0, token.indexOf(">") + 1);
      const inner = token.slice(open.length, -"</a>".length);
      const href = safeHref(attr(open, "href"));
      // An unsafe or missing href keeps the words and drops the link.
      out.push(href ? link(k, href, renderInline(inner)) : <span key={k}>{renderInline(inner)}</span>);
    } else {
      const tag = m[2];
      const raw = token.slice(tag.length + 2, -(tag.length + 3));
      if (tag === "em") out.push(<em key={k}>{renderInline(raw)}</em>);
      else if (tag === "strong") out.push(<strong key={k}>{renderInline(raw)}</strong>);
      else
        out.push(
          // Code is literal: an asterisk in it is not emphasis.
          <code key={k} className="font-ui text-[0.9em] bg-ribbon px-1 rounded-sm">
            {raw}
          </code>
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
