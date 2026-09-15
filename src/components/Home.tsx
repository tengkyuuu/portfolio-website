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
 * One block per sheet rather than one long scroll: every page here comes
 * out the same height as every other tab's paper, which is the whole point
 * of paginating instead of letting a tab grow. The continuation sheet only
 * appears when GitHub actually answered — a blank page is worse than a
 * short document.
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
