import { useMemo, useState } from "react";
import { getContent, type Project, type ProjectImage } from "../lib/content";

const kindLabel: Record<Project["kind"], string> = {
  embedded: "Embedded",
  web: "Web",
  mobile: "Mobile",
  desktop: "Desktop",
  design: "Design",
};

const kindAccent: Record<Project["kind"], string> = {
  embedded: "from-[#2b579a] to-[#063f81]",
  web: "from-[#335ea1] to-[#1f3f73]",
  mobile: "from-[#3a6db5] to-[#23528f]",
  desktop: "from-[#46556f] to-[#2a3a5a]",
  design: "from-[#6a4caf] to-[#3a2a78]",
};

/** An A4 page (210 × 297 mm ≈ 794 × 1123 px @96dpi) styled like a Word sheet.
 *  Content taller than A4 simply extends the page rather than clipping. */
function PaperSheet({
  pageNumber,
  children,
}: {
  pageNumber: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-paper paper-shadow w-full min-h-[1123px] px-6 md:px-14 py-10 md:py-16 flex flex-col text-ink relative overflow-hidden">
      {children}
      <div className="mt-auto pt-12 flex justify-center font-doc italic text-[12px] text-ink-subtle">
        — {pageNumber} —
      </div>
    </section>
  );
}

/** Normalise the two image fields into one ordered list. */
function projectImages(project: Project): ProjectImage[] {
  if (project.gallery && project.gallery.length > 0) return project.gallery;
  if (project.image) return [{ src: project.image, alt: project.imageAlt }];
  return [];
}

function FigurePlaceholder({ project }: { project: Project }) {
  return (
    <div className="relative w-full aspect-[16/9] overflow-hidden border border-rule rounded-sm bg-row-alt">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${kindAccent[project.kind]} opacity-90`}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-between p-5 md:p-7 text-white">
        <div className="flex items-center justify-between font-ui text-[10px] uppercase tracking-[0.18em] opacity-80">
          <span>{kindLabel[project.kind]}</span>
          <span>FIG {parseInt(project.index, 10)}.1</span>
        </div>
        <div>
          <div className="font-doc text-[22px] md:text-[28px] font-bold leading-[1.1] tracking-tight">
            {project.title}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.tags.map((t) => (
              <span
                key={t}
                className="font-ui text-[10px] uppercase tracking-wider border border-white/40 px-1.5 py-0.5 rounded-sm"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Single static screenshot. */
function SingleImage({ project, image }: { project: Project; image: ProjectImage }) {
  return (
    <div className="group relative w-full aspect-[16/9] overflow-hidden border border-rule rounded-sm bg-row-alt">
      <img
        src={image.src}
        alt={image.alt || project.title}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
      />
      <div className="pointer-events-none absolute top-2 right-2 font-ui text-[10px] uppercase tracking-[0.15em] bg-paper/85 text-ink px-1.5 py-0.5 rounded-sm border border-rule">
        FIG {parseInt(project.index, 10)}.1
      </div>
    </div>
  );
}

/** Multi-image gallery with prev/next arrows, dots, and keyboard support. */
function ImageCarousel({
  project,
  images,
}: {
  project: Project;
  images: ProjectImage[];
}) {
  const [idx, setIdx] = useState(0);
  const count = images.length;
  const go = (n: number) => setIdx((n + count) % count);
  const current = images[idx];

  return (
    <div
      className="group relative w-full aspect-[16/9] overflow-hidden border border-rule rounded-sm bg-row-alt focus:outline-none focus-visible:ring-2 focus-visible:ring-word-blue"
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${project.title} screenshots`}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(idx - 1);
        if (e.key === "ArrowRight") go(idx + 1);
      }}
    >
      <img
        key={current.src}
        src={current.src}
        alt={current.alt || `${project.title} — screenshot ${idx + 1} of ${count}`}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />

      {/* FIG badge */}
      <div className="pointer-events-none absolute top-2 right-2 font-ui text-[10px] uppercase tracking-[0.15em] bg-paper/85 text-ink px-1.5 py-0.5 rounded-sm border border-rule">
        FIG {parseInt(project.index, 10)}.{idx + 1}
      </div>

      {/* Counter */}
      <div className="pointer-events-none absolute top-2 left-2 font-ui text-[10px] tabular-nums tracking-wider bg-paper/85 text-ink-muted px-1.5 py-0.5 rounded-sm border border-rule">
        {idx + 1} / {count}
      </div>

      {/* Prev / Next arrows */}
      <button
        type="button"
        aria-label="Previous image"
        onClick={() => go(idx - 1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full bg-paper/90 border border-rule text-ink shadow-sm hover:bg-paper hover:text-word-blue transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
          chevron_left
        </span>
      </button>
      <button
        type="button"
        aria-label="Next image"
        onClick={() => go(idx + 1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full bg-paper/90 border border-rule text-ink shadow-sm hover:bg-paper hover:text-word-blue transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
          chevron_right
        </span>
      </button>

      {/* Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-paper/85 border border-rule rounded-full px-2 py-1">
        {images.map((img, i) => (
          <button
            key={img.src + i}
            type="button"
            aria-label={`Go to image ${i + 1}`}
            aria-current={i === idx}
            onClick={() => go(i)}
            className={
              "h-1.5 rounded-full transition-all " +
              (i === idx ? "w-4 bg-word-blue" : "w-1.5 bg-rule-strong hover:bg-ink-subtle")
            }
          />
        ))}
      </div>
    </div>
  );
}

function ProjectFigure({ project }: { project: Project }) {
  const images = projectImages(project);
  if (images.length === 0) return <FigurePlaceholder project={project} />;
  if (images.length === 1)
    return <SingleImage project={project} image={images[0]} />;
  return <ImageCarousel project={project} images={images} />;
}

function ProjectEntry({ project }: { project: Project }) {
  const ref = project.ref ?? `REF: JVC-${project.index}`;
  const figCaption =
    project.figCaption ?? `FIG ${parseInt(project.index, 10)}.1: ${project.title}.`;
  const hasCaseStudy = Boolean(project.challenge || project.solution);

  return (
    <section>
      {/* Title row */}
      <div className="flex flex-wrap justify-between items-baseline gap-x-4 gap-y-1 border-b border-rule mb-5 pb-1.5">
        <h2 className="font-doc text-[22px] md:text-[24px] font-bold text-word-blue leading-tight">
          Project {project.index}: {project.title}
        </h2>
        <span className="font-ui text-[11px] font-semibold uppercase tracking-wider text-ink-subtle tabular-nums">
          {ref}
        </span>
      </div>

      {/* Figure */}
      <figure className="mb-6">
        <ProjectFigure project={project} />
        <figcaption className="mt-2 text-center font-doc italic text-[12px] text-ink-subtle">
          {figCaption}
        </figcaption>
      </figure>

      {/* Optional metrics table */}
      {project.metrics && project.metrics.length > 0 && (
        <div className="mb-6 border border-rule rounded-sm p-4 md:p-5 bg-row-alt">
          <table className="w-full border-collapse font-ui text-[13px]">
            <thead>
              <tr className="border-b-2 border-word-blue text-ink">
                <th className="text-left font-bold py-2 pr-3 uppercase text-[11px] tracking-wider">
                  Metric
                </th>
                <th className="text-left font-bold py-2 px-3 uppercase text-[11px] tracking-wider">
                  Pre
                </th>
                <th className="text-left font-bold py-2 px-3 uppercase text-[11px] tracking-wider">
                  Post
                </th>
                <th className="text-left font-bold py-2 pl-3 uppercase text-[11px] tracking-wider text-word-blue">
                  Δ
                </th>
              </tr>
            </thead>
            <tbody>
              {project.metrics.map((m) => (
                <tr key={m.label} className="border-b border-rule last:border-0">
                  <td className="py-2.5 pr-3">{m.label}</td>
                  <td className="py-2.5 px-3 tabular-nums">{m.pre}</td>
                  <td className="py-2.5 px-3 tabular-nums">{m.post}</td>
                  <td className="py-2.5 pl-3 font-bold text-word-blue tabular-nums">
                    {m.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Challenge / Solution two-column when available, blurb-only otherwise */}
      {hasCaseStudy ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <h3 className="font-ui text-[12px] font-bold uppercase tracking-[0.18em] text-ink border-l-[3px] border-word-blue pl-3 mb-2.5">
              Challenge
            </h3>
            <p className="font-doc text-[15px] leading-[1.7] text-ink-muted">
              {project.challenge ?? project.blurb}
            </p>
          </div>
          <div>
            <h3 className="font-ui text-[12px] font-bold uppercase tracking-[0.18em] text-ink border-l-[3px] border-word-blue pl-3 mb-2.5">
              Solution
            </h3>
            <p className="font-doc text-[15px] leading-[1.7] text-ink-muted">
              {project.solution ?? project.blurb}
            </p>
          </div>
        </div>
      ) : (
        <p className="font-doc text-[15px] leading-[1.7] text-ink-muted">
          {project.blurb}
        </p>
      )}

      {/* Tech stack */}
      {project.stack && project.stack.length > 0 && (
        <div className="mt-7">
          <h3 className="font-ui text-[12px] font-bold uppercase tracking-[0.18em] text-ink border-l-[3px] border-word-blue pl-3 mb-3">
            Tech Stack
          </h3>
          <div className="flex flex-wrap gap-2">
            {project.stack.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 font-ui text-[12px] font-medium text-ink border border-rule rounded-sm px-2.5 py-1 bg-row-alt"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-word-blue" />
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {project.links.length > 0 && (
        <div className="mt-7 flex flex-wrap gap-2">
          {project.links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="inline-flex items-center gap-1 font-ui text-[12px] font-medium text-word-blue hover:underline underline-offset-2 decoration-word-blue border border-rule rounded-sm px-2.5 py-1"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 14 }}
              >
                arrow_outward
              </span>
              {l.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export function Projects() {
  const { projects } = useMemo(() => getContent(), []);

  // Cover sheet is page 1; each project gets its own A4 sheet after it.
  const pageOf = (i: number) => i + 2;

  return (
    <>
      {/* Cover page — title + table of contents */}
      <PaperSheet pageNumber={1}>
        <header className="border-b-2 border-word-blue pb-3 mb-10">
          <h1 className="font-doc text-[40px] md:text-[48px] font-bold text-word-blue leading-tight tracking-tight">
            Projects Archive
          </h1>
          <p className="font-doc italic text-[13px] text-ink-subtle mt-1">
            Working Portfolio — {new Date().getFullYear()} Executive Summary ·{" "}
            {projects.length} {projects.length === 1 ? "entry" : "entries"}
          </p>
        </header>

        <section>
          <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
            Table of Contents
          </h2>
          <ul className="space-y-2.5 font-doc text-[15px] text-ink">
            {projects.map((p, i) => (
              <li key={p.id} className="flex items-end gap-2">
                <a
                  href={`#proj-${p.id}`}
                  className="font-semibold hover:text-word-blue transition-colors"
                >
                  Project {p.index}: {p.title}
                </a>
                <span className="toc-leader" />
                <span className="font-ui text-[12px] font-semibold text-ink-subtle tabular-nums">
                  {String(pageOf(i)).padStart(2, "0")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </PaperSheet>

      {/* One A4 sheet per project */}
      {projects.map((p, i) => (
        <PaperSheet key={p.id} pageNumber={pageOf(i)}>
          <div id={`proj-${p.id}`} className="scroll-mt-20">
            <ProjectEntry project={p} />
          </div>
          {i === projects.length - 1 && (
            <footer className="mt-12 pt-6 text-center border-t border-rule font-doc italic text-[12px] text-ink-subtle">
              End of Section — Appendix A: Technical Portfolio Reference
            </footer>
          )}
        </PaperSheet>
      ))}
    </>
  );
}
