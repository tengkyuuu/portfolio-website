import type { ReactNode } from "react";

export function ChapterHeading({
  number,
  eyebrow,
  title,
  description,
  children,
}: {
  number: string;
  eyebrow: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="chapter-heading">
      <div>
        <p className="document-eyebrow">
          CHAPTER {number} <span>/</span> {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className="chapter-description">{description}</p>
      </div>
      {children && (
        <div className="chapter-art" aria-hidden="true">
          {children}
        </div>
      )}
    </header>
  );
}
