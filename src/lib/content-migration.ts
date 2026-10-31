import type { SiteContent } from "./content";
import { defaultAbout, defaultHero, defaultContact, projects } from "./data";
import legacy from "./legacy-branding.json";

/** Idempotent read migration: replace known obsolete copy, retain admin additions.
 * Section-scoped admin saves persist the migrated fields on the next edit.
 */
export function migratePortfolioContent(content: SiteContent): SiteContent {
  const oldAbout = [legacy.about.paragraphs, legacy.previous.about.paragraphs].includes(content.about.paragraphs);
  const four = (text: string) => text.replace(/\bfive engineers\b/g, "four engineers").replace(/\bfive-engineer\b/g, "four-engineer");
  const flux = projects.find((p) => p.id === "flux")!;
  return {
    ...content,
    hero: { ...content.hero,
      role: [legacy.hero.role, legacy.previous.hero.role].includes(content.hero.role) ? defaultHero.role : content.hero.role,
      tagline: [legacy.hero.tagline, legacy.previous.hero.tagline].includes(content.hero.tagline) ? defaultHero.tagline : content.hero.tagline,
    },
    about: oldAbout ? { ...content.about, paragraphs: defaultAbout.paragraphs,
      highlights: JSON.stringify(content.about.highlights) === JSON.stringify(legacy.about.highlights) ? defaultAbout.highlights : content.about.highlights,
      specs: content.about.specs.map((spec) => ((legacy.about.specs as Record<string, string>)[spec.label] === spec.value || (spec.label === "Role" && spec.value === legacy.previous.about.role) || (spec.label === "Focus" && spec.value === legacy.previous.about.focus)) ? defaultAbout.specs.find((next) => next.label === spec.label) ?? spec : spec),
    } : content.about,
    contact: { ...content.contact, intro: content.contact.intro === legacy.contact.intro ? defaultContact.intro : content.contact.intro },
    projects: content.projects.map((project) => {
      if (project.id === "stormfresh-erp") return { ...project,
        solution: project.solution && four(project.solution), contribution: project.contribution && four(project.contribution), blurb: four(project.blurb) };
      if (project.id === "flux") return { ...project, metrics: undefined,
        result: project.result?.includes("19 contrast pairs") ? flux.result : project.result };
      return project;
    }),
    posts: content.posts.map((post) => ({ ...post, body: post.id.includes("stormfresh") ? four(post.body) : post.id === "editorial-flux-contrast" ? post.body
      .replace("checks 19 shipping colour pairs", "checks the shipping colour pairs")
      .replace(/The \[Flux case study\]\(#proj-flux\) records the technical scope:[^\n]+/, "The [Flux case study](#proj-flux) shows the interface, the contrast rules, and my contribution to making prelaunch states explicit.") : post.body })),
    designs: content.designs.map((design) => ({ ...design, caption: design.id.includes("stormfresh") && design.caption ? four(design.caption) : design.caption })),
  };
}
