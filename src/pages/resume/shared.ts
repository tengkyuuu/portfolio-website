import type { ContactChannel, HeroContent, SiteContent } from "../../lib/content";

/** Strip the inline markdown/HTML we allow in content so it reads as plain
 *  résumé prose (bold/italic markers, links → their text, <em> tags, etc). */
export function plain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

/** Filter out the contact channels a résumé shouldn't repeat verbatim:
 *   • Location — already in the header line
 *   • Anything that duplicates hero.email
 */
export function resumeChannels(hero: HeroContent, channels: ContactChannel[]): ContactChannel[] {
  const heroEmailLower = hero.email.trim().toLowerCase();
  return channels.filter((c) => {
    if (!c.value) return false;
    if (c.icon === "location_on") return false;
    const v = c.value.trim().toLowerCase();
    if (v === heroEmailLower) return false;
    const href = (c.href ?? "").trim().toLowerCase();
    if (href === `mailto:${heroEmailLower}`) return false;
    return true;
  });
}

/** Split certs into "named awards" vs "course certificates" (image-backed)
 *  for the compact tail line. */
export function partitionCerts(content: SiteContent) {
  const award = content.certs.filter((c) => !c.image);
  const course = content.certs.filter((c) => c.image);
  return {
    award,
    course,
    courseIssuer: course[0]?.issuer ?? "online courses",
  };
}
