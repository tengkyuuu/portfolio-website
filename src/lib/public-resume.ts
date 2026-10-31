import type { SiteContent } from "./content";
import { defaultHero, defaultAbout, defaultContact, projects, skillGroups, timeline, certs } from "./data";

/** Public selection; never reads a private browser draft. */
export const publicResumeContent: SiteContent = {
  activity: { status: "", note: "", meme: "", memeAlt: "", updatedAt: "" },
  hero: defaultHero,
  about: { ...defaultAbout, highlights: [] },
  contact: defaultContact,
  skills: skillGroups.filter((group) => group.label !== "Embedded"),
  projects: ["stormfresh-erp", "flux", "rallys-transfers"].flatMap((id) => {
    const project = projects.find((p) => p.id === id);
    return project ? [{ ...project, blurb: project.contribution || project.blurb }] : [];
  }),
  timeline, certs, posts: [], designs: [],
};

export const PUBLIC_RESUME_URL = "/james-vincent-calunsag-resume.pdf?v=20261031-engineer";
