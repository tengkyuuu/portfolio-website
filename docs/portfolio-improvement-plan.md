# Portfolio improvement plan

Prepared October 30, 2026. **Status: approved and implemented locally on October 31, 2026.**

This plan keeps the Word-document portfolio concept while simplifying the presentation, making the interactions useful, and shifting the identity toward AI-driven software development. All copy below is proposed unless it repeats a fact you supplied. Branding and interaction recommendations remain reviewable choices.

## 1. Direction and request coverage

The portfolio should help a recruiter or potential client understand what you build, how you work, and what you personally contributed. The document interface should make that information easy to browse.

| Your request | Planned outcome |
| --- | --- |
| Simplify the portrait | Straight, stationary photo; keep the existing sunglasses hover swap; remove surrounding visual clutter. |
| Fix Home Download Resume | Generate the public PDF using the same ATS layout and formatting rules as the admin résumé builder. |
| Change the branding | Choose a software-first identity from the options below; retain hardware/IoT as supporting experience. |
| Equal paper sizes | Consistent A4-proportioned sheets with actual pagination and continuation pages. |
| Certificates open in a modal | One accessible preview dialog for certificates with images or PDFs. |
| Useful highlighting | Visitors select and highlight document text, including arbitrary passages in project case studies. |
| Projects starts with contents | A typographic table of contents replaces the opening project-card gallery. |
| SHM simulation behind a button | Mount and show the alert-logic demo only after an explicit click. |
| Four engineers on Tropical Poultry Farm | Correct Stormfresh/Tropical Poultry Farms references throughout the content. |
| Remove Flux metrics | Remove its metrics table and replace accompanying metrics-focused result copy with qualitative explanation. |
| Explain your actual workflow | Show the Opus planning → approved documents → Sonnet implementation → verification procedure. |
| Update About | State that you are building your own orchestrator software and learning multi-agent programming. |

## 2. Branding options

| Option | Main title | Supporting line | Positioning |
| --- | --- | --- | --- |
| **A — recommended** | **AI-Driven Software Developer** | I turn ideas into useful software through clear planning, thoughtful interfaces, and AI-assisted development. | Directly reflects the identity you requested while keeping software development central. |
| B | Software Developer · AI-Assisted Engineering | I plan carefully, build with AI, and verify the details before shipping. | More understated; emphasizes the process behind the work. |
| C | AI-Driven Product Developer | From requirements and design systems to working software. | Emphasizes end-to-end product work, including interface design. |
| D | Full-Stack Developer · AI-Assisted Workflows | I build interfaces, connect systems, and use AI throughout the development process. | Leads with a familiar hiring category and supports it with your workflow. |

**Recommended direction: A.** Use the full title once in the hero and a shorter “Software Developer” where space is limited. Explain what “AI-driven” means through the How I Work section. Avoid implying that you already specialize in training models or have completed a production multi-agent platform.

### Proposed copy using option A

- **Hero title:** AI-Driven Software Developer
- **Hero supporting line:** I turn ideas into useful software through clear planning, thoughtful interfaces, and AI-assisted development.
- **Home capability labels:** Product planning · Software development · Interface design
- **Projects introduction:** Selected software projects, the problems behind them, and my contribution to each build.
- **Contact introduction:** Have a software project in mind? Let's talk about the product, the interface, and what it needs to do.
- **About opening:** I'm James, a software developer with a background in computer engineering. I use AI throughout my workflow—from defining requirements and planning the system to implementing, testing, and refining the experience.
- **About current work:** I'm currently building my own orchestrator software and learning multi-agent programming.

Hardware and IoT remain where they explain real work: the SHM case study, relevant skills, and a brief background reference if useful. Remove their repeated use as the headline identity, home-page pillars, general introduction, and default social-preview message. Keep your actual degree and historical role titles accurate.

Apply the selected direction consistently to hero content, About facts, Contact, project introductions, general résumé defaults, metadata, structured data, the web manifest, and the generated social-preview image. Review the featured-project selection so the home page supports the chosen software-first direction without rewriting project history.

## 3. Portrait: simple, upright, familiar

The current presentation adds a rotated photo frame, selection handles, an annotation, a sticker, a caption, and a hover hint. The supplied screenshot confirms that these compete with the photograph.

Planned changes:

- Remove rotation in both the default and hover states. No tilt, lift, or scale interaction.
- Remove the blue selection handles, curiosity sticker, handwritten annotation/arrow, decorative sparkle, and redundant hover instruction.
- Keep a restrained frame and the existing base portrait and sunglasses image. Match their crop and position exactly.
- Preserve the sunglasses reveal on hover, with no layout movement. Provide an equivalent keyboard-focus state; touch devices may show the normal portrait without requiring a gesture.
- Preserve the existing image-load fallback so a failed sunglasses image cannot hide the original portrait.

**Done when:** the photograph remains upright before, during, and after interaction; hovering reveals the existing sunglasses treatment; surrounding decoration no longer dominates the cover.

Primary files: `src/components/Hero.tsx`, `src/components/PortraitPhoto.tsx`, and the portrait rules in the stylesheets.

## 4. Public résumé: reuse the admin ATS output

The Home link currently downloads a static PDF. Its generator, `scripts/generate-public-resume.mjs`, builds a separate HTML résumé with its own colors, columns, content selection, and typography. The admin builder already has an `ATSTemplate` and résumé content helpers. This duplication explains the inconsistent output.

Planned changes:

1. Extract a shared ATS document renderer and print styles from the existing admin implementation. Both the admin ATS preview/export and public PDF generation use it.
2. Define an explicit public résumé preset using approved portfolio content, the selected branding, and relevant software projects. A private admin draft must not silently become the public résumé.
3. Keep a single-column reading order, selectable text, standard headings, readable dates and contact details, and restrained black-on-white formatting. Avoid decorative icons, skill bars, photos, and layout tables.
4. Allow a sensible second page when needed. Do not squeeze all content onto one page by shrinking the font.
5. Fix the generation/build order. The current command builds before writing the PDF into `public/`, so that already-created `dist/` can contain the previous PDF. Ensure the final distributable contains the newly generated file.
6. Point Home and Contact to the same current download. Handle asset caching so an existing visitor receives the updated version.

Keep generation outside the authenticated route; downloading the résumé must not require a login. Reuse the existing browser/PDF tooling without introducing a server endpoint solely for this task.

**Done when:** Home and Contact download the same readable PDF; its layout matches the admin ATS template; extracted text reads in the intended order; no section is clipped; the deployed artifact is the current version. “ATS-friendly” here means simple formatting and reliable text extraction, not a guarantee of any employer's ATS score.

Primary files: `src/pages/resume/ATSTemplate.tsx`, `ResumePage.tsx`, `shared.ts`, `src/lib/resume-builder.ts`, `resume-roles.ts`, `scripts/generate-public-resume.mjs`, `package.json`, Hero, and Contact.

## 5. One consistent paper system

Currently `PaperSheet` uses an A4 minimum height and grows with its contents. Setting a fixed height alone would hide or overflow longer content. Equal sheets require pagination.

### Intended behavior

- Use one shared page geometry: the existing approximately 794 × 1123 logical-pixel A4 canvas on desktop, with common margins and footer positions.
- All document sheets in Home, Projects, About, Skills, Credentials, Blog, Gallery, Contact, and Credits follow that geometry.
- Long content continues onto another sheet. It must never disappear behind a footer or be silently clipped.
- On smaller screens, sheets fit the available width and share consistent proportions within that viewport. Maintain readable text and create more continuation sheets rather than scaling text down to fit.
- Keep chapter-local numbering, but calculate the actual sheet numbers. Project identifiers and figure identifiers remain stable and separate from physical page numbers.
- Keep ordinary admin forms and dialogs naturally scrollable. Résumé preview/export uses the same A4 dimensions, with its own ATS margins and browser print pagination.

### Implementation approach

Create a shared pagination layer around semantic content blocks. Keep a heading with its following content; keep captions with images; split long prose and lists at safe boundaries. Define explicit handling for oversized tables, code blocks, and images so they cannot force a sheet beyond its bounds.

Measure after fonts and images settle, reserve image dimensions, and recompute on meaningful width, content, language, or expansion changes. Keep interactive components mounted once with stable keys. Do not clone live DOM or duplicate IDs to manufacture pages.

Migrate all chapter renderers to the same mechanism, then remove their independent sizing assumptions. Use stable content anchors for navigation and highlights. Contents-page references must derive from the completed layout; fixed-width page-number slots should prevent measurement loops.

**Done when:** every visible sheet has the same outer dimensions at a given viewport/zoom; all content remains reachable; expanding content and changing languages cannot overlap footers; page numbers and links stay correct. Print output must retain complete content without duplicate blank pages.

This is the largest layout change in the plan and should be implemented before the final Projects contents and highlighting integrations.

## 6. Certificates: click to preview in a modal

Image certificates currently have a lightbox through `CertStack`, while other certificate links can navigate directly to a PDF. Unify the behavior.

- Clicking or pressing Enter on any certificate with a preview opens a dialog in the current page.
- Show its title, issuer/date when available, and a readable image or all PDF preview pages. Include an explicit download-original action.
- Support Escape, a visible close button, contained keyboard focus, and focus restoration to the triggering certificate.
- Load the full preview on demand; show useful loading and unavailable-file states.
- Entries without a supplied certificate file remain informational and must not pretend to offer a preview.

**Presentation recommendation:** replace the elaborate certificate stack with a compact list or restrained thumbnail grid. Each item has one clear action: preview certificate. This is an optional simplification supporting the quieter direction.

The current security policy blocks embedded objects and framing. For the existing PDF certificates, prefer generated local page-preview images plus the original PDF download. This avoids weakening the site's global security headers or depending on an external PDF viewer. Document the preview-generation step for future uploaded certificates; unsupported files should show an honest fallback inside the modal.

**Done when:** certificate clicks do not unexpectedly leave the portfolio or open a new tab; image and PDF certificates share the same keyboard-accessible modal behavior.

Primary files: `Certifications.tsx`, `CertStack.tsx`, certificate content/types, and local credential assets. Reuse existing dialog conventions where suitable.

## 7. Highlighting: mark the text the visitor chooses

**Scope interpretation for review:** “any part of the project” means arbitrary selectable text throughout the portfolio document, including project descriptions, headings, lists, and blog text. It does not mean drawing over photographs or highlighting browser controls.

The existing highlight control only toggles emphasis on predefined elements. Replace that with visitor-created text highlights:

1. The visitor selects text using normal mouse, touch, or keyboard selection.
2. A clearly labeled Highlight action applies a marker to that selection. The ribbon action must preserve the selection when clicked; a nearby selection action may supplement it.
3. Visitors can remove an individual highlight or clear their saved highlights with confirmation.
4. Save marks locally in that browser. They do not modify published content or appear for other visitors.

Use stable content-block IDs with selected quotes, surrounding context, and offsets to anchor marks. Store a versioned format and distinguish languages. Restore marks after pagination, navigation, and content remounts. If edited text cannot be matched confidently, omit the stale highlight rather than marking the wrong passage. Handle selections crossing paragraphs and overlapping highlights deliberately.

Prefer a rendering approach that preserves normal selection and React ownership. Evaluate the CSS Custom Highlight API with a safe fallback; do not inject selected text as HTML. Existing editorial emphasis can remain a separate, restrained visual treatment.

Exclude form fields, document chrome, and modal controls. Keep marker contrast readable across all themes. Storage failures must not block reading. Exclude visitor highlights from the public résumé and default print output.

**Done when:** a visitor can highlight a passage that was not preselected by the developer, revisit the chapter and find it again, remove it, and retain correct placement when pagination changes.

Primary integration points: `src/App.tsx`, ribbon controls, document content rendering, shared styles, and a new isolated highlight-state module.

## 8. Projects: contents first, case studies after

Replace the first Projects sheet's image-card gallery and filter controls with a table-of-contents layout:

```text
PROJECTS
Contents

01   Project title ................................ 2
02   Project title ................................ 4
03   Project title ................................ 6
```

The numbers above illustrate the layout; actual references must be calculated after pagination.

- Use project number, title, a restrained optional category label, and its actual starting page.
- Make the entire entry a clear keyboard-accessible link to the existing project anchor.
- Keep screenshots, descriptions, stacks, and detailed contributions on the case-study sheets.
- Add a small return-to-contents link to case studies.
- Allow a contents continuation sheet if future additions or mobile reflow require it.
- Preserve direct project links and stable project IDs. Update tests and content conventions that currently assume every project occupies exactly one sheet at `index + 2`.

**Done when:** the opening Projects sheet reads like a document index, and every entry reaches the correct case study after layout settles.

### SHM alert-logic interaction

Replace the always-visible simulator with a button labeled **Try the alert logic**. Recommended behavior: open the simulator in an accessible modal and mount it only when opened. This keeps the case-study sheet stable and gives the controls enough room.

Keep the simulator's explanatory context clear: it demonstrates alert behavior; it is not a live sensor feed. Closing restores focus to the launch button. Reset to a predictable initial state when reopened unless a later preference calls for preserving inputs.

An inline expandable panel is an alternative if you prefer it, but it must trigger repagination. The default recommendation for this plan is a modal.

### Tropical Poultry Farms / Stormfresh correction

The project is stored as `stormfresh-erp`, with the display title “Stormfresh — Poultry ERP.” Correct its team size to **four engineers**, including:

- Solution and personal-contribution text in `src/lib/data.ts`.
- The related blog and gallery caption in `src/lib/editorial.ts`.
- Any corresponding published content, translations, generated résumé text, and other derived copies.

Use “one of four engineers” where describing your role. Preserve the existing project ID and your actual contribution. This correction does not require renaming the project.

### Flux metrics removal

Remove the Flux metrics table. Rewrite its adjacent results copy around what changed in the interface and workflow, without moving the same counts into another prominent section. Review related Flux editorial copy for repeated metrics-focused claims.

Retain its problem, contribution, screenshots, and qualitative outcome. Keep the generic metrics capability available for other projects; this is a Flux-specific content change. Ensure a published content snapshot cannot restore the removed table.

## 9. How I Work: your actual Opus-to-Sonnet procedure

Replace the generic process stages with the following proposed procedure. Model names describe your chosen workflow; they do not claim that either model guarantees correctness.

| Stage | Who / model | Concrete work and output |
| --- | --- | --- |
| 1. Understand the project | You + Opus | Review the existing project, user problem, constraints, references, and unknowns. Agree on scope and evidence of success. |
| 2. Define the product | Opus, reviewed by you | Write `PRD.md`: users, goals, workflows, requirements, non-goals, and acceptance criteria. Resolve important ambiguity before coding. |
| 3. Set engineering rules | Opus, reviewed by you | Plan architecture and write/update `CLAUDE.md`: repository conventions, system boundaries, commands, data/security rules, testing expectations, and relevant constraints. |
| 4. Define the design system | Opus, reviewed by you | Write `DESIGN.md`: typography, colors/tokens, spacing, components and states, responsive behavior, accessibility, and key screen patterns. Align with any existing system. |
| 5. Make the implementation plan | Opus, reviewed by you | Write `IMPLEMENTATION_PLAN.md`: dependency-ordered tasks, affected files, acceptance checks, risks, and checkpoints. Reference the other documents instead of duplicating them. |
| 6. Approve and hand off | You | Check that the four documents agree and that the tasks are actionable. Approve the plan before implementation starts. |
| 7. Build in small steps | Sonnet | Implement the approved tasks, inspect each diff, run relevant checks, and record progress. Use the agreed design system and repository rules. |
| 8. Verify and finish | Sonnet + your review | Check behavior against the PRD, test important paths, inspect responsive/accessibility states, and fix regressions. Review the final result before release. |

**Escalation rule:** if implementation uncovers a new architectural decision, unclear requirement, or change in scope, return that issue to Opus, revise the affected planning documents, and review the change before Sonnet continues. Do not let implementation silently redefine the product.

**Proposed section introduction:** “I use Opus to turn a brief into a clear PRD, project rules, design system, and implementation plan. Once that plan is reviewed, I use Sonnet to build in small steps, check the results, and refine the product.”

Keep the visitor-facing summary concise; expandable details can explain the artifacts and handoff. Link to real examples only when those files actually exist and are suitable to share. Do not create broken repository links or imply every historical project used this exact process.

This task creates only this review plan. The four filenames above describe your process; they are not four additional deliverables to create now.

Primary files: `src/lib/data.ts` process stages, `src/components/Process.tsx`, translations, and related content/link tests.

## 10. About: current work and learning

Add the user-confirmed sentence prominently:

> I'm currently building my own orchestrator software and learning multi-agent programming.

Reflect it in the About introduction and the “Now” content:

- **Building:** My own orchestrator software.
- **Learning:** Multi-agent programming.
- **Background:** Computer engineering, with practical software, interface, and embedded-project experience.

Use a current reviewed date when the updated copy is actually reviewed and shipped. Check whether older “Now” items are still current before retaining them. Do not invent a product name, launch date, repository, supported features, or finished capabilities for the orchestrator.

Keep the main About text in the content consumed by the site's assistant so its answers reflect your current work. The standalone process/Now data is not automatically part of every content export.

## 11. Content consistency and publishing

The repository defaults and live published content are separate concerns. Supabase content can replace default arrays wholesale; changing `data.ts` alone may not change the live site.

During implementation:

1. Read and preserve the latest published content before preparing targeted updates.
2. Update repo defaults, existing editorial content, and supported translation dictionaries together. Revisit translated stage IDs and labels when process stages change.
3. Prepare section-scoped updates against the current published content, using stable project IDs and preserving unrelated admin edits. Do not reset the entire site to defaults.
4. Regenerate derived assets: the public résumé, social-preview image, relevant certificate previews, and build content exports. Review search/assistant content for old positioning or incorrect facts.
5. Verify cache behavior for replaced PDF and image assets, including returning visitors using the PWA.

Publishing and deployment belong to the later implementation/release task. Nothing is published as part of this planning pass. Existing unrelated local files and application documents are outside this change.

## 12. Implementation order

| Phase | Work | Review checkpoint |
| --- | --- | --- |
| 1 | Select branding and finalize proposed copy; map published-content updates. | Wording accurately represents you and your role. |
| 2 | Simplify portrait; correct team size; remove Flux metrics; update About and How I Work. | Content and cover presentation match the approved direction. |
| 3 | Share the ATS renderer and repair public PDF generation/build order. | Inspect the actual generated PDF and extracted text. |
| 4 | Build the shared pagination system and migrate all paper views. | Equal sheets without missing content, duplicate controls, or broken anchors. |
| 5 | Implement the Projects contents page, certificate modal, and SHM launch modal. | Navigation and previews work with mouse, touch, and keyboard. |
| 6 | Implement visitor highlights on stable content blocks. | Persistence, repagination, edits, and language changes preserve correct marks. |
| 7 | Integrate translations, metadata, generated assets, and publication changes; complete validation. | Ready for your final review and the agreed release process. |

Keep changes in reviewable groups. The main engineering risk is the interaction between pagination, selectable text, dynamic content, and saved highlights; resolve the page/block model before adding annotation persistence.

## 13. Validation before calling implementation complete

- **Content:** selected branding is consistent; hardware/IoT appears in relevant factual contexts; four-engineer references are correct; Flux has no metrics section; About and process copy match the approved wording.
- **Portrait:** no angle or position change; sunglasses align; failed overlays leave the base photo visible.
- **Résumé:** public and admin ATS use the shared layout; PDF has readable selectable text in order; correct contact details; no clipped content; final build contains the new PDF.
- **Pagination:** compare sheet dimensions across every chapter, long content, missing images, expanded process stages, and supported languages. No lost text, footer collisions, duplicate IDs, or unstable page loops.
- **Navigation:** Projects contents page numbers and deep links remain correct after layout settles; return-to-contents works.
- **Dialogs:** certificate image/PDF previews and the SHM simulator open only on request; Escape and focus restoration work; file failures have a useful fallback.
- **Highlights:** arbitrary and multi-paragraph selections, overlapping marks, removal, reload, content edits, pagination changes, language changes, and unavailable storage behave predictably.
- **Visual pass:** inspect representative desktop and narrow mobile widths, all five themes, reduced motion, portfolio zoom extremes, and browser text zoom. Check print preview as well as the live page.
- **Automated checks:** run TypeScript, the relevant regression tests, the full existing test suite, and the production build. Add meaningful tests for pagination integrity, modal behavior, highlight anchoring, PDF content, and corrected facts.
- **Release verification:** if deployment is included in the later task, verify that the intended commit actually reached production and check the public download and published content there.

Honor the repository's existing constraints: no new serverless endpoint is needed, content stays safely rendered, admin writes remain section-scoped, and no credentials move into client code.

## 14. Decisions for your review

The plan is ready to implement after your review. The main choices are:

1. **Branding:** A, B, C, or D. Recommendation: **A — AI-Driven Software Developer**.
2. **SHM:** modal or inline expansion. Recommendation: **modal**.
3. **Certificates:** simplify the stack to a list/grid or retain its presentation with unified modal opening. Recommendation: **simple list/grid**.
4. **Highlight scope:** document text throughout the site, saved only in the visitor's browser. Recommendation: **use this scope**.
5. **Paper sizing:** consistent page geometry with continuation sheets, including mobile reflow. Recommendation: **use this behavior**.

Implementation details and verification are recorded below. Deployment remains separate from these local changes.


## Implementation record — October 31, 2026

Implemented the recommended choices, with the later branding revision: AI-Driven Computer Engineer, focused on Full-Stack Development & Design; upright portrait with sunglasses; shared admin/public ATS rendering; equal paper geometry with continuation sheets; certificate list and modal previews; button-launched SHM modal; text-only Projects contents; locally saved visitor highlights; four-engineer correction; Flux metrics removal; the Opus-to-Sonnet process; and current orchestrator/multi-agent work in About.

### Engineering notes

- `PaperSheet` spaces one mounted content tree across equal paper backdrops. It measures semantic blocks, keeps headings with following content, handles long text/code/table fragments, and recalculates on content, font, image, and size changes. It does not clone interactive controls. Numbering and contents references come from actual layout; the admin no longer asks for a manual TOC page.
- Visitor highlights use text quotes and surrounding context, scoped by chapter, language, and blog post. Native CSS highlights preserve selection; a non-mutating overlay fallback supports browsers without that API. Marks stay in local browser storage and are omitted from print.
- Known legacy branding is migrated on read, preserving unrelated published/admin edits. Stormfresh and Flux corrections are targeted by project ID. The assistant applies the same legacy branding correction from shipped content. No published database row was reset or overwritten.
- `npm run resume:public` generates the public PDF from `ATSTemplate` and shared print styles before the final build copies it. The public preset is separate from private résumé drafts.
- `npm run certificates:previews` uses Poppler (`pdftoppm` on PATH) to regenerate local PDF preview pages and their manifest. New remote PDFs without prepared previews show an honest modal fallback with an original-file action.
- The PWA cache version and résumé URL version were updated. Social preview graphics use the new branding.
- Existing translation dictionaries are empty and correctly fall back to the updated English content; no stale translations were reintroduced.

### Reproduce checks

Run `npm test` and `npm run build`. With the Vite development server running at `http://127.0.0.1:5173`, run `node scripts/check-portfolio-interactions.mjs` and `node scripts/check-paper-layout.mjs` for browser interaction and page-boundary checks. Both browser checks use shipped content independently of any local admin draft. `node scripts/check-long-content.mjs` stress-tests long prose/code and print availability.


### Verification result

- 471 automated tests passed, including content migration, assistant grounding, modal lifecycle, text anchoring, and pagination geometry.
- Browser interaction checks passed for portrait/sunglasses, the ATS download, Projects contents/deep links, Flux, SHM, highlight persistence/removal, certificate image/PDF previews, workflow expansion, Skills matrix, and Blog.
- Page-boundary checks passed across nine document views at 1440px, 390px, and 320px widths. Long prose and code stress checks preserved every character across continuation sheets and print mode.
- The two-page ATS PDF was rendered and inspected; extracted text follows the single-column reading order. Local PDF certificate previews were also inspected.
- TypeScript and the production build passed. The existing large-bundle warning remains; production SEO generation uses `SITE_URL` or Vercel's production-domain environment variable.
- Changes are local. No deployment or published database write was performed.


### Branding revision — October 31, 2026

The approved identity is now **AI-Driven Computer Engineer**, with **Full-Stack Development & Design** alongside it. This supersedes the software-developer title in the original options above. Hero, About, résumé defaults, metadata, manifest, and social preview were updated to match.
