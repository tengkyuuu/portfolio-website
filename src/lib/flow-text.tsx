import { Fragment, type ReactNode } from "react";

/** Normally inline. A very long paragraph can expose these safe fragments to
 * the sheet paginator without rewriting DOM text or losing links/emphasis. */
export function flowFragments(nodes: ReactNode[]): ReactNode[] {
  const groups: ReactNode[][] = [[]];
  let length = 0;
  for (const node of nodes) {
    const pieces = typeof node === "string" ? node.match(/\S+\s*|\s+/g) || [] : [node];
    for (const piece of pieces) {
      groups[groups.length - 1].push(piece);
      length += typeof piece === "string" ? piece.length : 25;
      if (length >= 120) { groups.push([]); length = 0; }
    }
  }
  return groups.filter((group) => group.length).map((group, i) =>
    <span data-flow-fragment="" key={i}>{group.map((part, j) => <Fragment key={j}>{part}</Fragment>)}</span>);
}

export function FlowText({ text }: { text: string }) { return <>{flowFragments([text])}</>; }
