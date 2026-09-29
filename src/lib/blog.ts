import type { BlogPost } from "./content";

/**
 * Pure helpers for the blog — ordering, slugs, reading time, routing.
 * Kept out of the components so the rules are testable on their own.
 */

/** "Shipping a CMS in a Word doc!" → "shipping-a-cms-in-a-word-doc". */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "post";
}

/** `base`, or `base-2`, `base-3`… — whichever no other post is using. */
export function uniqueSlug(base: string, posts: BlogPost[], selfId?: string): string {
  const taken = new Set(posts.filter((p) => p.id !== selfId).map((p) => p.slug));
  const root = slugify(base);
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/** What visitors see: not drafts, not untitled, newest first. */
export function publishedPosts(posts: BlogPost[]): BlogPost[] {
  return posts
    .filter((p) => !p.draft && p.title.trim() !== "" && p.slug !== "")
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** Whole minutes at ~220 words a minute, never less than one. */
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.round(words / 220));
}

/** "#blog/my-post" → "my-post"; anything else → null. */
export function postSlugFromHash(hash: string): string | null {
  const m = /^#?blog\/([^/?#]+)/.exec(hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/** "2026-09-29" → "September 29, 2026". Malformed input is shown as-is. */
export function formatPostDate(iso: string, locale?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  // Built from parts, not parsed, so no timezone can move it a day.
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

/** Today in the admin's own timezone, as yyyy-mm-dd. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A fresh, empty draft. Starts hidden so nothing half-written goes live. */
export function newPost(): BlogPost {
  return {
    id: crypto.randomUUID(),
    slug: "",
    title: "",
    date: todayIso(),
    excerpt: "",
    body: "",
    tags: [],
    draft: true,
  };
}

/** Why a post can't be published yet, or null if it can. */
export function publishProblem(post: BlogPost, posts: BlogPost[]): string | null {
  if (!post.title.trim()) return "Give it a title.";
  if (!post.slug) return "Give it a URL slug.";
  if (posts.some((p) => p.id !== post.id && p.slug === post.slug)) {
    return `Another post already uses /${post.slug}.`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return "Set a date.";
  if (!post.body.trim()) return "Write something first.";
  if (post.cover && !post.coverAlt?.trim()) return "Describe the cover image (alt text).";
  return null;
}
