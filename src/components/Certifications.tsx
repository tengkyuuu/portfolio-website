import { useState } from "react";
import type { Cert } from "../lib/content";
import { PreviewDialog } from "./PreviewDialog";
import { safeHref } from "../lib/inline";
import previews from "../lib/certificate-previews.json";
import { useLocalizedContent } from "../lib/localized-content";
import { useI18n } from "../lib/i18n";
import { Award } from "lucide-react";
import { ChapterHeading } from "./ui/ChapterHeading";
import { chapterNumber } from "./Nav";

export function Certifications() {
  const { t } = useI18n();
  const { certs, timeline } = useLocalizedContent();
  const [selected, setSelected] = useState<Cert | null>(null);

  return (
    <section className="space-y-10">
      <ChapterHeading
        number={chapterNumber("credentials")}
        eyebrow="THE JOURNEY SO FAR"
        title={
          <>
            Always a <em>student.</em>
          </>
        }
        description="The experiences, milestones, and small steps that shape the way I build."
      >
        <Award />
      </ChapterHeading>
      {/* Education + Experience */}
      <div>
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
          {t("section.educationExperience")}
        </h2>
        <ul className="credentials-timeline space-y-4 font-doc text-[15px]">
          {timeline.map((entry) => (
            <li
              key={entry.title}
              className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1"
            >
              <div className="flex-1">
                <h3 className="font-bold text-ink leading-snug">
                  {entry.title}
                </h3>
                <p className="text-ink-muted text-[14px]">{entry.org}</p>
                <p className="text-ink-muted text-[14px] mt-1 leading-relaxed">
                  {entry.blurb}
                </p>
              </div>
              <span className="font-ui text-[12px] text-ink-subtle uppercase tracking-wider sm:text-right shrink-0 sm:ml-6 tabular-nums">
                {entry.range}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Certifications & Awards */}
      <div>
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
          {t("section.certificationsAwards")}
        </h2>
        <ul className="certificate-list">
          {certs.map((cert) => (
            <li key={cert.title + cert.issuer}>
              {cert.image || (safeHref(cert.href) && cert.href !== "#") ? (
                <button type="button" onClick={() => setSelected(cert)} aria-haspopup="dialog">
                  <span><strong>{cert.title}</strong><small>{cert.issuer}{cert.date && ` · ${cert.date}`}</small></span>
                  <span className="certificate-preview-label">Preview</span>
                </button>
              ) : <div><strong>{cert.title}</strong><small>{cert.issuer}{cert.date && ` · ${cert.date}`}</small></div>}
            </li>
          ))}
        </ul>
        {selected && <CertificatePreview cert={selected} onClose={() => setSelected(null)} />}
      </div>
    </section>
  );
}

function CertificatePreview({ cert, onClose }: { cert: Cert; onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const image = safeHref(cert.image);
  const pages = image ? [image] : (previews as Record<string, string[]>)[cert.href || ""] || [];
  const original = safeHref(cert.href || cert.image);
  return <PreviewDialog title={cert.title} onClose={onClose}>
    <p className="preview-meta">{cert.issuer}{cert.date && ` · ${cert.date}`}</p>
    {pages.length > 0 && !failed && loaded < pages.length && <p role="status">Loading certificate…</p>}
    {failed || pages.length === 0 ? <p role="status">A preview is unavailable. You can open the original certificate below.</p> :
      <div className="certificate-pages">{pages.map((src, i) => <img key={src} src={src} alt={`${cert.title}, page ${i + 1} of ${pages.length}`} onLoad={() => setLoaded((n) => n + 1)} onError={() => setFailed(true)} />)}</div>}
    {original && <a className="doc-button" href={original} download target="_blank" rel="noopener noreferrer">Open original certificate</a>}
  </PreviewDialog>;
}
