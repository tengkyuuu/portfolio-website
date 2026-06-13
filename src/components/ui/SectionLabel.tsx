import type { ReactNode } from "react";

type Props = {
  number: string;
  children: ReactNode;
};

export function SectionLabel({ number, children }: Props) {
  return (
    <div className="mb-12 flex items-center gap-4 font-mono text-xs uppercase tracking-[0.25em] text-fg-muted">
      <span className="text-accent-gradient font-semibold">{number}</span>
      <span className="h-px flex-1 max-w-[2rem] bg-border-strong" />
      <span className="text-fg-subtle">{children}</span>
    </div>
  );
}
