import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONTENT, resetAll, saveContent, type BlogPost } from "../lib/content";
import { Blog } from "./Blog";

const post = (p: Partial<BlogPost>): BlogPost => ({
  id: p.slug ?? "id",
  slug: "a-post",
  title: "A post",
  date: "2026-09-01",
  excerpt: "",
  body: "Body text.",
  tags: [],
  draft: false,
  ...p,
});

beforeEach(() => {
  saveContent({
    ...DEFAULT_CONTENT,
    posts: [
      post({ slug: "older", title: "Older post", date: "2026-08-01", excerpt: "From August." }),
      post({ slug: "newer", title: "Newer post", date: "2026-09-20", body: "## Section\n\nHello **there**." }),
      post({ slug: "secret", title: "Draft post", draft: true }),
    ],
  });
});

afterEach(() => {
  resetAll();
  window.location.hash = "";
});

describe("Blog", () => {
  it("lists published posts newest first, and never the drafts", () => {
    window.location.hash = "#blog";
    render(<Blog />);
    const links = screen.getAllByRole("link").map((a) => a.textContent);
    expect(links).toEqual(["Newer post", "Older post"]);
    expect(screen.queryByText("Draft post")).not.toBeInTheDocument();
  });

  it("opens a post from its deep link, with a way back and to the next one", () => {
    window.location.hash = "#blog/newer";
    render(<Blog />);
    expect(screen.getByRole("heading", { level: 1, name: "Newer post" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All posts/ })).toHaveAttribute("href", "#blog");
    expect(screen.getByRole("link", { name: /Older post/ })).toHaveAttribute("href", "#blog/older");
    expect(document.title).toContain("Newer post");
  });

  it("follows hash changes between the index and a post", () => {
    window.location.hash = "#blog";
    render(<Blog />);
    act(() => {
      window.location.hash = "#blog/older";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("heading", { level: 1, name: "Older post" })).toBeInTheDocument();
  });

  it("says so, rather than showing a draft, when a post isn't published", () => {
    window.location.hash = "#blog/secret";
    render(<Blog />);
    expect(screen.getByRole("heading", { level: 1, name: "That post isn't here." })).toBeInTheDocument();
    expect(screen.queryByText("Draft post")).not.toBeInTheDocument();
  });
});
