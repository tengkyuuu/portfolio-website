import { useRef, useState } from "react";
import {
  formatPostDate,
  newPost,
  publishProblem,
  readingMinutes,
  slugify,
  uniqueSlug,
} from "../../lib/blog";
import type { BlogPost } from "../../lib/content";
import { renderMarkdown } from "../../lib/markdown";
import { uploadImage } from "../../lib/upload";
import { ImageField } from "./ImageField";
import { Button, Card, Field, IconButton, Input, Row, Textarea, Toggle } from "./ui";
import { useEditableSection } from "./useEditableSection";
import "../../components/blog.css";

/**
 * Blog — write, preview and publish posts.
 *
 * Posts autosave like every other section. A new post starts as a draft
 * and stays off the site until it's switched to Published, which is
 * refused until the post has what a reader needs (publishProblem).
 */
export function BlogEditor() {
  const { value: posts, update } = useEditableSection("posts");
  const [editing, setEditing] = useState<string | null>(null);
  const current = posts.find((p) => p.id === editing);

  function patch(id: string, next: Partial<BlogPost>) {
    update(posts.map((p) => (p.id === id ? { ...p, ...next } : p)));
  }

  if (current) {
    return (
      <PostForm
        post={current}
        posts={posts}
        onChange={(next) => patch(current.id, next)}
        onBack={() => setEditing(null)}
        onDelete={() => {
          update(posts.filter((p) => p.id !== current.id));
          setEditing(null);
        }}
      />
    );
  }

  const ordered = [...posts].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card
      title="Posts"
      description="Drafts stay off the site. Published posts appear on the Blog tab, newest first — the tab itself shows up once there's one."
      actions={
        <Button
          variant="primary"
          icon="add"
          onClick={() => {
            const fresh = newPost();
            update([fresh, ...posts]);
            setEditing(fresh.id);
          }}
        >
          New post
        </Button>
      }
    >
      {ordered.length === 0 ? (
        <p className="font-ui text-[13px] text-ink-subtle">
          No posts yet. Start one — it stays a draft until you publish it.
        </p>
      ) : (
        <ul className="divide-y divide-rule border border-rule rounded-sm">
          {ordered.map((post) => (
            <li key={post.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setEditing(post.id)}
                  className="font-doc text-[16px] font-semibold text-ink hover:text-word-blue text-left"
                >
                  {post.title.trim() || <span className="italic text-ink-subtle">Untitled draft</span>}
                </button>
                <div className="font-ui text-[11px] text-ink-subtle">
                  {formatPostDate(post.date)} · {readingMinutes(post.body)} min read
                  {post.slug && <> · #blog/{post.slug}</>}
                </div>
              </div>
              <StatusPill draft={post.draft} />
              <IconButton icon="edit" label={`Edit ${post.title || "draft"}`} onClick={() => setEditing(post.id)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StatusPill({ draft }: { draft: boolean }) {
  return (
    <span
      className={
        "shrink-0 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm " +
        (draft ? "bg-ribbon text-ink-muted" : "bg-word-blue-light text-word-blue")
      }
    >
      {draft ? "Draft" : "Published"}
    </span>
  );
}

function PostForm({
  post,
  posts,
  onChange,
  onBack,
  onDelete,
}: {
  post: BlogPost;
  posts: BlogPost[];
  onChange: (next: Partial<BlogPost>) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [view, setView] = useState<"write" | "preview">("write");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  const [insertNote, setInsertNote] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // The slug follows the title until someone edits it by hand.
  const slugFollowsTitle =
    !post.slug || post.slug === slugify(post.title) || post.slug.startsWith(`${slugify(post.title)}-`);

  function setTitle(title: string) {
    onChange(
      slugFollowsTitle && title.trim()
        ? { title, slug: uniqueSlug(title, posts, post.id) }
        : { title }
    );
  }

  function setPublished(published: boolean) {
    if (!published) {
      setPublishError(null);
      onChange({ draft: true });
      return;
    }
    const problem = publishProblem(post, posts);
    setPublishError(problem);
    if (!problem) onChange({ draft: false });
  }

  /** Upload an image and drop Markdown for it at the cursor. */
  async function insertImage(file: File | undefined) {
    if (!file) return;
    setInserting(true);
    setInsertNote(null);
    try {
      const result = await uploadImage(file, "blog");
      const textarea = bodyRef.current?.querySelector("textarea");
      const at = textarea?.selectionStart ?? post.body.length;
      const snippet = `\n\n![Describe what's in the picture](${result.url} "Caption")\n\n`;
      onChange({ body: post.body.slice(0, at) + snippet + post.body.slice(at) });
      if (result.note) setInsertNote(`Saved inline instead of to storage — ${result.note}`);
    } catch (e) {
      setInsertNote(e instanceof Error ? e.message : "Couldn't add that image.");
    } finally {
      setInserting(false);
      if (imageRef.current) imageRef.current.value = "";
    }
  }

  // A published post that stops qualifying (title cleared, slug clash)
  // says so rather than quietly going on being live.
  const liveProblem = !post.draft ? publishProblem(post, posts) : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" icon="arrow_back" onClick={onBack}>
          All posts
        </Button>
        <div className="flex items-center gap-2">
          <StatusPill draft={post.draft} />
          {!post.draft && post.slug && (
            <a
              href={`/#blog/${encodeURIComponent(post.slug)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-ui text-[12px] font-medium text-word-blue hover:underline underline-offset-2"
            >
              View on site
              <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">
                open_in_new
              </span>
            </a>
          )}
        </div>
      </div>

      <Card title={post.title.trim() || "Untitled draft"}>
        <div className="space-y-4">
          <Field label="Title" required>
            <Input value={post.title} onChange={setTitle} placeholder="What I learned shipping a CMS inside a Word doc" />
          </Field>
          <Row>
            <Field label="URL" hint={`#blog/${post.slug || "…"}`}>
              <Input
                value={post.slug}
                // Gentler than slugify while typing: a trailing hyphen has to
                // survive the keystroke, or "my-post" can't be typed at all.
                onChange={(v) =>
                  onChange({
                    slug: v
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, "-")
                      .replace(/-{2,}/g, "-")
                      .replace(/^-/, ""),
                  })
                }
                placeholder="shipping-a-cms"
                monospace
              />
            </Field>
            <Field label="Date">
              <Input type="date" value={post.date} onChange={(v) => onChange({ date: v })} />
            </Field>
          </Row>
          <Field label="Excerpt" hint={`${post.excerpt.length}/200 — shown on the index and in search`}>
            <Textarea
              value={post.excerpt}
              onChange={(v) => onChange({ excerpt: v })}
              rows={2}
              placeholder="One or two sentences that make someone want to read the rest."
            />
          </Field>
          <Field label="Tags" hint="Comma-separated">
            <Input
              value={post.tags.join(", ")}
              onChange={(v) =>
                onChange({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) })
              }
              placeholder="react, supabase, lessons"
            />
          </Field>
        </div>
      </Card>

      <Card title="Cover image" description="Optional. Shown on the index and at the top of the post.">
        <ImageField
          image={post.cover}
          alt={post.coverAlt}
          folder="blog"
          uploadLabel="Upload cover"
          altPlaceholder="Laptop on a desk showing a Word document with a blue ribbon"
          onChange={({ image, alt }) => onChange({ cover: image, coverAlt: alt })}
        />
      </Card>

      <Card
        title="Post"
        description={`${readingMinutes(post.body)} min read`}
        actions={
          <div className="flex rounded-sm border border-rule overflow-hidden" role="group" aria-label="Editor view">
            {(["write", "preview"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={
                  "px-3 py-1 font-ui text-[12px] font-medium transition-colors " +
                  (view === v ? "bg-word-blue text-paper" : "text-ink-muted hover:bg-ribbon-hover")
                }
              >
                {v === "write" ? "Write" : "Preview"}
              </button>
            ))}
          </div>
        }
      >
        {view === "write" ? (
          <div className="space-y-2" ref={bodyRef}>
            <Textarea
              value={post.body}
              onChange={(v) => onChange({ body: v })}
              rows={18}
              placeholder={"Start writing…\n\n## A heading\n\nA paragraph with **bold**, *italics* and a [link](https://example.com).\n\n- A list\n- of things"}
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={imageRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="sr-only"
                onChange={(e) => void insertImage(e.target.files?.[0])}
              />
              <Button
                variant="secondary"
                icon={inserting ? "hourglass_top" : "add_photo_alternate"}
                onClick={() => imageRef.current?.click()}
                disabled={inserting}
              >
                {inserting ? "Uploading…" : "Insert image"}
              </Button>
              <span className="font-ui text-[11px] text-ink-subtle">
                Markdown: <code>## Heading</code> <code>**bold**</code> <code>*italic*</code>{" "}
                <code>[link](url)</code> <code>- list</code> <code>&gt; quote</code> <code>```code```</code>
              </span>
            </div>
            {insertNote && <p className="font-ui text-[12px] text-ink-muted">{insertNote}</p>}
          </div>
        ) : (
          <div className="blog-prose max-w-[640px]">
            {post.body.trim() ? (
              renderMarkdown(post.body)
            ) : (
              <p className="italic text-ink-subtle">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </Card>

      <Card title="Publishing">
        <div className="space-y-3">
          <Toggle
            checked={!post.draft}
            onChange={setPublished}
            label="Published"
            hint="Drafts are hidden from the Blog tab and search. They aren't secret: like all content, they travel in the published JSON."
          />
          {(publishError || liveProblem) && (
            <p role="alert" className="font-ui text-[12px] text-red-700 dark:text-red-400">
              {publishError ?? `Live, but needs attention: ${liveProblem}`}
            </p>
          )}
          <div className="pt-2 border-t border-rule">
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-ui text-[13px] text-ink">
                  Delete this post? You can get it back from History for a while.
                </span>
                <Button variant="danger" icon="delete" onClick={onDelete}>
                  Delete
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button variant="danger" icon="delete" onClick={() => setConfirmDelete(true)}>
                Delete post
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
