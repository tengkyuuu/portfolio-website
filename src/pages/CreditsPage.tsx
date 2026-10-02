import { imageCredits } from "../lib/data";
import { PaperSheet } from "../components/PaperSheet";

/**
 * /credits — a public, honest accounting of the images on this site that
 * aren't mine.
 *
 * Blue's reaction stickers and its launcher mark came from Pinterest, and
 * I don't know who originally drew them. Rather than quietly use found
 * art with no attribution, this page says so directly and gives the
 * actual artist, if they ever identify themselves, somewhere to be
 * credited. "CTTO" — credit to the original creator — is the honest
 * label for "not mine, and I don't yet know whose it is."
 *
 * Deliberately not gated behind RequireAuth (unlike /resume and /status):
 * there's nothing private here, and a disclosure page that visitors can't
 * reach isn't much of a disclosure.
 */
export function CreditsPage() {
  return (
    <div className="min-h-screen bg-workspace flex justify-center items-start py-10 px-4">
      <div className="w-full max-w-[820px]">
        <PaperSheet pageNumber={1}>
          <header className="border-b-2 border-word-blue pb-4 mb-6">
            <h1 className="font-doc text-[32px] font-bold text-word-blue leading-tight">
              Image Credits
            </h1>
            <p className="font-doc italic text-[14px] text-ink-subtle mt-2">
              The handful of images on this site that aren't mine.
            </p>
          </header>

          <p className="font-doc text-[15px] leading-[1.7] text-ink-muted mb-6">
            Blue, the chat assistant, uses a set of reaction images and a
            launcher icon that I found on Pinterest rather than drew
            myself. I don't know who the original artist is. If that's
            you, or you know who it is, email{" "}
            <a
              href="mailto:jamescalunsag13@gmail.com"
              className="text-word-blue hover:underline"
            >
              jamescalunsag13@gmail.com
            </a>{" "}
            and I'll credit you properly here, by name, right away.
          </p>

          <div className="border border-rule rounded-sm bg-row-alt/50 px-4 py-2 mb-6 font-ui text-[11px] text-ink-subtle">
            <strong className="text-ink">CTTO</strong> — credit to the
            original creator. Used below for every image whose artist I
            don't yet know.
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {imageCredits.map((credit) => (
              <li
                key={credit.src}
                className="flex items-center gap-3 border border-rule rounded-sm p-3 bg-paper"
              >
                <img
                  src={credit.src}
                  alt={credit.alt}
                  className="w-14 h-14 object-contain shrink-0 border border-rule rounded-sm bg-row-alt"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <div className="font-ui text-[12.5px] font-semibold text-ink">
                    {credit.usedAs}
                  </div>
                  <div className="font-ui text-[11px] text-ink-subtle mt-0.5">
                    {credit.artist ?? "Artist unknown"} · found via{" "}
                    {credit.source}
                  </div>
                  {!credit.artist && (
                    <div className="font-ui text-[10px] uppercase tracking-wider text-word-blue mt-1">
                      CTTO
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="font-doc italic text-[12px] text-ink-subtle mt-8 text-center">
            Everything else on this site — the writing, the code, the
            project screenshots, the portrait — is mine.
          </p>
        </PaperSheet>
      </div>
    </div>
  );
}
