import { useMemo } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Code2,
  Cpu,
  MapPin,
  MousePointer2,
  PenTool,
  Sparkles,
} from "lucide-react";
import { getContent } from "../lib/content";
import { renderInline, renderParagraphs } from "../lib/inline";
import { visibleTabs } from "./Nav";
import { useI18n } from "../lib/i18n";
import { PortraitPhoto } from "./PortraitPhoto";

export function Hero() {
  const { t } = useI18n();
  const { hero, projects } = useMemo(() => getContent(), []);
  const names = hero.name.split(" ");
  const featured = projects
    .filter((project) => project.gallery?.length || project.image)
    .slice(0, 3);

  return (
    <div className="cover-page">
      <div className="cover-meta">
        <p className="document-eyebrow">
          {hero.eyebrow || "A PERSONAL PORTFOLIO"}
        </p>
        <span>
          <span className="tiny-star">✳</span> More than a document.
        </span>
      </div>
      <div className="cover-hero">
        <div className="cover-intro">
          <p className="cover-hello">
            <span className="hello-line" /> Hello, I’m
          </p>
          <h1>
            {names.length > 1 && (
              <>
                {names.slice(0, -1).join(" ")} <br />
              </>
            )}
            <span className="name-highlight">
              {names.at(-1)}
              <span className="cover-period">.</span>
            </span>
            <span className="word-caret cover-caret" aria-hidden="true" />
          </h1>
          <p className="cover-role">{hero.role}</p>
          <p className="cover-tagline">{renderInline(hero.tagline)}</p>
          <div className="cover-actions">
            <a className="doc-button doc-button-primary" href="#work">
              Explore my work <ArrowUpRight size={16} />
            </a>
            <a className="doc-text-link" href="#contact">
              Let’s talk <ArrowRight size={15} />
            </a>
          </div>
          <div className="cover-location">
            <MapPin size={13} />
            <span>{hero.location}</span>
            {hero.available && (
              <>
                <span className="location-divider" />
                <span className="availability-dot" />
                <span>{hero.availableText}</span>
              </>
            )}
          </div>
        </div>
        <div className="cover-visual">
          <span className="portrait-annotation">
            the human behind the work <span>↴</span>
          </span>
          <div className="portrait-object" aria-label={`${hero.name} portrait`}>
            <span className="selection-handle handle-tl" />
            <span className="selection-handle handle-tr" />
            <span className="selection-handle handle-bl" />
            <span className="selection-handle handle-br" />
            <PortraitPhoto name={hero.name} />
            <span className="portrait-caption">
              <span>Engineer. Designer. Curious human.</span>
              <Sparkles size={15} />
            </span>
          </div>
          <div className="portrait-sticker" aria-hidden="true">
            <span>✳</span>
            <small>
              BUILT WITH
              <br />
              CURIOSITY
            </small>
          </div>
          <span className="portrait-hint">
            <MousePointer2 size={13} /> hover the photo
          </span>
        </div>
      </div>
      <div className="cover-disciplines">
        <a href="#stack">
          <Cpu size={17} />
          <span>Hardware that works.</span>
        </a>
        <a href="#stack">
          <Code2 size={17} />
          <span>Software that connects.</span>
        </a>
        <a href="#stack">
          <PenTool size={17} />
          <span>Design that feels right.</span>
        </a>
      </div>
      {featured.length > 0 && (
        <section className="cover-selected">
          <div className="cover-section-heading">
            <div>
              <span className="document-eyebrow">A FEW THINGS I’VE MADE</span>
              <h2>
                From an idea to <em>something real.</em>
              </h2>
            </div>
            <a className="doc-text-link" href="#work">
              All projects <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="featured-projects">
            {featured.map((project) => (
              <a
                key={project.id}
                className="featured-project"
                href={`#proj-${project.id}`}
              >
                <div className="featured-image">
                  <img
                    src={project.gallery?.[0]?.src || project.image}
                    alt={
                      project.gallery?.[0]?.alt ||
                      project.imageAlt ||
                      project.title
                    }
                    loading="lazy"
                  />
                  <span>
                    <ArrowUpRight size={18} />
                  </span>
                </div>
                <div className="featured-project-caption">
                  <div>
                    <small>
                      {project.kind} <span>/</span>{" "}
                      {project.year || "Selected work"}
                    </small>
                    <h3>{project.title}</h3>
                  </div>
                  <span className="featured-index">{project.index}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
      {hero.showContents && (
        <details className="cover-footnote">
          <summary>
            <ArrowDown size={13} />
            {t("section.contents")}
          </summary>
          <ol className="cover-contents">
            {visibleTabs()
              .filter((tab) => tab.id !== "top")
              .map((tab, index) => (
                <li key={tab.id}>
                  <a href={`#${tab.id}`}>
                    <span>{String(index + 2).padStart(2, "0")}</span>
                    {t(tab.key)}
                    <ArrowRight size={12} />
                  </a>
                </li>
              ))}
          </ol>
        </details>
      )}
      {hero.abstract && (
        <details className="cover-footnote">
          <summary>
            <ArrowDown size={13} /> A note about this document
          </summary>
          <div>{renderParagraphs(hero.abstract)}</div>
        </details>
      )}
    </div>
  );
}
