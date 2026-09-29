import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, NotebookPen } from "lucide-react";
import {
  formatPostDate,
  postSlugFromHash,
  publishedPosts,
  readingMinutes,
} from "../lib/blog";
import { getContent, type BlogPost } from "../lib/content";
import { renderMarkdown } from "../lib/markdown";
import { chapterNumber } from "./Nav";
import { PaperSheet } from "./PaperSheet";
import { ChapterHeading } from "./ui/ChapterHeading";
import "./blog.css";

/** Entries per index sheet, so every sheet stays paper-length. */
const PER_SHEET = 6;

/**
 * Blog — posts written in the admin, published as pages of the document.
 *
 * #blog is the index, laid out like a table of contents; #blog/<slug> is
 * one post on its own sheet. The paper is keyed on the tab rather than
 * the hash, so this listens for hash changes itself to move between the
 * two without a remount.
 */
export function Blog() {
  const posts = useMemo(() => publishedPosts(getContent().posts), []);
  const [slug, setSlug] = useState(() => postSlugFromHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setSlug(postSlugFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (slug) {
    const at = posts.findIndex((p) => p.slug === slug);
    if (at < 0) return <MissingPost />;
    return <PostSheet post={posts[at]} newer={posts[at - 1]} older={posts[at + 1]} />;
  }
  return <BlogIndex posts={posts} />;
}

/* --------------------------------- index --------------------------------- */

function BlogIndex({ posts }: { posts: BlogPost[] }) {
  const sheets: BlogPost[][] = [];
  for (let i = 0; i < posts.length; i += PER_SHEET) sheets.push(posts.slice(i, i + PER_SHEET));
  if (sheets.length === 0) sheets.push([]);

  return (
    <>
      {sheets.map((sheet, page) => (
        <PaperSheet key={page} pageNumber={page + 1}>
          {page === 0 ? (
            <ChapterHeading
              number={chapterNumber("blog")}
              eyebrow="THE NOTEBOOK"
              title={
                <>
                  Notes, <em>written down.</em>
                </>
              }
              description="What I learned building things, and the odd thing I changed my mind about."
            >
              <NotebookPen />
            </ChapterHeading>
          ) : (
            <p className="document-eyebrow blog-continued">THE NOTEBOOK (CONT.)</p>
          )}

          {sheet.length === 0 ? (
            <p className="blog-empty">Nothing's published here yet.</p>
          ) : (
            <section aria-label={page === 0 ? "Posts" : `Posts, continued (page ${page + 1})`}>
              <h2 className="sr-only">Posts</h2>
              <ol className="blog-index">
                {sheet.map((post) => (
                  <li key={post.id}>
                    <PostEntry post={post} />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </PaperSheet>
      ))}
    </>
  );
}

function PostEntry({ post }: { post: BlogPost }) {
  const minutes = readingMinutes(post.body);
  return (
    <article className="blog-entry">
      <div className="blog-entry-text">
        <p className="blog-meta">
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          <span aria-hidden="true">·</span>
          <span>{minutes} min read</span>
        </p>
        <h3>
          <a href={`#blog/${encodeURIComponent(post.slug)}`}>{post.title}</a>
        </h3>
        {post.excerpt && <p className="blog-excerpt">{post.excerpt}</p>}
        {post.tags.length > 0 && <Tags tags={post.tags} />}
      </div>
      {post.cover && (
        <img
          className="blog-entry-cover"
          src={post.cover}
          alt={post.coverAlt ?? ""}
          loading="lazy"
          decoding="async"
        />
      )}
    </article>
  );
}

/* ---------------------------------- post --------------------------------- */

function PostSheet({ post, newer, older }: { post: BlogPost; newer?: BlogPost; older?: BlogPost }) {
  // The tab title is what a bookmark or a shared tab shows.
  useEffect(() => {
    const previous = document.title;
    document.title = `${post.title} — Portfolio.docx`;
    return () => {
      document.title = previous;
    };
  }, [post.title]);

  return (
    <PaperSheet pageNumber={1}>
      <article className="blog-post">
        <nav aria-label="Breadcrumb" className="blog-crumbs">
          <a href="#blog">
            <ArrowLeft size={13} aria-hidden="true" />
            All posts
          </a>
        </nav>
        <header>
          <p className="document-eyebrow">
            NOTE <span>/</span> <time dateTime={post.date}>{formatPostDate(post.date).toUpperCase()}</time>{" "}
            <span>/</span> {readingMinutes(post.body)} MIN READ
          </p>
          <h1>{post.title}</h1>
          {post.excerpt && <p className="blog-standfirst">{post.excerpt}</p>}
        </header>

        {post.cover && (
          <figure className="blog-cover">
            <img src={post.cover} alt={post.coverAlt ?? ""} decoding="async" />
          </figure>
        )}

        <div className="blog-prose">{renderMarkdown(post.body)}</div>

        {post.tags.length > 0 && (
          <footer className="blog-post-tags">
            <Tags tags={post.tags} />
          </footer>
        )}

        {(newer || older) && (
          <nav aria-label="More posts" className="blog-pager">
            {older ? (
              <a href={`#blog/${encodeURIComponent(older.slug)}`} rel="prev">
                <small>
                  <ArrowLeft size={12} aria-hidden="true" /> Older
                </small>
                <span>{older.title}</span>
              </a>
            ) : (
              <span />
            )}
            {newer && (
              <a href={`#blog/${encodeURIComponent(newer.slug)}`} rel="next" className="is-next">
                <small>
                  Newer <ArrowRight size={12} aria-hidden="true" />
                </small>
                <span>{newer.title}</span>
              </a>
            )}
          </nav>
        )}
      </article>
    </PaperSheet>
  );
}

function MissingPost() {
  return (
    <PaperSheet pageNumber={1}>
      <div className="blog-post">
        <p className="document-eyebrow">NOTE <span>/</span> NOT FOUND</p>
        <h1>That post isn't here.</h1>
        <p className="blog-standfirst">
          It may have been renamed, unpublished, or never existed.
        </p>
        <p>
          <a className="blog-back" href="#blog">
            <ArrowLeft size={13} aria-hidden="true" /> See every post
          </a>
        </p>
      </div>
    </PaperSheet>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <ul className="blog-tags" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}
