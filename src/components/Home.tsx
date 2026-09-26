import {
  GitHubActivity,
  GitHubDetail,
  gitHubSnapshot,
  hasGitHubDetail,
  useGitHubSnapshot,
} from "./GitHubActivity";
import { Hero } from "./Hero";
import { PaperSheet } from "./PaperSheet";

/**
 * Home — the cover page, then the live read on GitHub.
 *
 * GitHub Activity used to sit at the bottom of the Now tab, which is about
 * the last place anyone would look for it. It is the evidence behind the
 * claims the cover page makes, so it goes directly after them.
 *
 * Each block gets a content-sized sheet. The continuation sheet only
 * appears when GitHub supplies repository or commit details.
 */
export function Home({ page }: { page: number }) {
  const github = useGitHubSnapshot();
  const snapshot = gitHubSnapshot(github);

  return (
    <>
      <PaperSheet pageNumber={page}>
        <Hero />
      </PaperSheet>

      <PaperSheet pageNumber={page + 1}>
        <GitHubActivity state={github} />
      </PaperSheet>

      {snapshot && hasGitHubDetail(github) && (
        <PaperSheet pageNumber={page + 2}>
          <GitHubDetail snapshot={snapshot} />
        </PaperSheet>
      )}
    </>
  );
}
