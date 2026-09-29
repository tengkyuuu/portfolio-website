import { describe, expect, it } from "vitest";
import {
  formatPostDate,
  postSlugFromHash,
  publishedPosts,
  publishProblem,
  readingMinutes,
  slugify,
  uniqueSlug,
} from "./blog";
import type { BlogPost } from "./content";

function post(p: Partial<BlogPost>): BlogPost {
  return {
    id: p.id ?? p.slug ?? "id",
    slug: "a-post",
    title: "A post",
    date: "2026-09-01",
    excerpt: "",
    body: "Words.",
    tags: [],
    draft: false,
    ...p,
  };
}

describe("publishedPosts", () => {
  it("keeps drafts and untitled posts off the site", () => {
    const list = publishedPosts([
      post({ id: "1", slug: "live" }),
      post({ id: "2", slug: "draft", draft: true }),
      post({ id: "3", slug: "untitled", title: "  " }),
      post({ id: "4", slug: "" }),
    ]);
    expect(list.map((p) => p.id)).toEqual(["1"]);
  });

  it("orders newest first, then by title", () => {
    const list = publishedPosts([
      post({ id: "old", slug: "old", date: "2026-01-01" }),
      post({ id: "b", slug: "b", title: "Beta", date: "2026-09-01" }),
      post({ id: "a", slug: "a", title: "Alpha", date: "2026-09-01" }),
    ]);
    expect(list.map((p) => p.id)).toEqual(["a", "b", "old"]);
  });
});

describe("slugs", () => {
  it("slugifies titles, accents and punctuation included", () => {
    expect(slugify("Shipping a CMS — in a Word doc!")).toBe("shipping-a-cms-in-a-word-doc");
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
    expect(slugify("!!!")).toBe("post");
  });

  it("finds a free slug, ignoring the post's own", () => {
    const posts = [post({ id: "1", slug: "hello" }), post({ id: "2", slug: "hello-2" })];
    expect(uniqueSlug("Hello", posts)).toBe("hello-3");
    expect(uniqueSlug("Hello", posts, "1")).toBe("hello");
  });

  it("reads the slug out of a deep link", () => {
    expect(postSlugFromHash("#blog/my-first-post")).toBe("my-first-post");
    expect(postSlugFromHash("#blog")).toBeNull();
    expect(postSlugFromHash("#work")).toBeNull();
    expect(postSlugFromHash("#blog/%E0%A4%A")).toBeNull();
  });
});

describe("readingMinutes", () => {
  it("rounds to whole minutes with a floor of one", () => {
    expect(readingMinutes("short")).toBe(1);
    expect(readingMinutes(Array(660).fill("word").join(" "))).toBe(3);
  });

  it("doesn't count code or image markup as reading", () => {
    const code = "```\n" + Array(2000).fill("x").join(" ") + "\n```";
    expect(readingMinutes(code + " one two")).toBe(1);
  });
});

describe("formatPostDate", () => {
  it("never shifts the day across timezones", () => {
    expect(formatPostDate("2026-01-01", "en-US")).toBe("January 1, 2026");
  });

  it("shows malformed input unchanged", () => {
    expect(formatPostDate("soon")).toBe("soon");
  });
});

describe("publishProblem", () => {
  it("blocks a clashing slug and a cover without alt text", () => {
    const others = [post({ id: "other", slug: "taken" })];
    expect(publishProblem(post({ id: "me", slug: "taken" }), others)).toMatch(/already uses/);
    expect(publishProblem(post({ id: "me", cover: "/x.webp" }), [])).toMatch(/alt text/);
    expect(publishProblem(post({ id: "me" }), others)).toBeNull();
  });
});
