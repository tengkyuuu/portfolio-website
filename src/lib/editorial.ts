import type { BlogPost, Design } from "./content";

/** Published writing and interface studies grounded in the shipped projects. */
export const editorialPosts: BlogPost[] = [
  {
    id: "editorial-stormfresh-source-records",
    slug: "stormfresh-source-records",
    title: "What the poultry dashboard calculates from source records",
    date: "2026-10-05",
    excerpt:
      "The reporting choice behind Stormfresh: keep purchases, sales, and expenses as the source of truth, then calculate the management view from them.",
    body: `A dashboard is easy to trust when the numbers look tidy. It is much harder to trust when each total has been copied into several places and can drift from the transactions underneath it.

Stormfresh replaced a poultry operation's separate spreadsheets for purchases, dressing output, invoices, commissions, and monthly profit. I worked on the management dashboard and reporting layer as one of four engineers. The decision that shaped the interface was to calculate gain, balance, and trends from source records instead of storing another set of totals for the dashboard to display.

That meant the visible figures could be traced back to the records that produced them. It also made the role model part of the data layer: Postgres row-level security keeps drafts private to their author, while Management controls approval and deletion. A disabled button alone would not have been enough protection.

The [case study](#proj-stormfresh-erp) shows the dashboard and the scope of my work. It does not claim a measured time saving or revenue increase; those would need evidence from the business, not an attractive chart.`,
    tags: ["Engineering", "Data", "Case study"],
    cover: "/projects/poias-dashboard.webp",
    coverAlt: "Stormfresh management dashboard with gain, purchases, sales, and expense figures.",
    draft: false,
  },
  {
    id: "editorial-flux-contrast",
    slug: "flux-contrast-tests",
    title: "When a brand colour fails its own text",
    date: "2026-10-05",
    excerpt:
      "Flux's primary teal could not carry white text at accessible contrast. The answer was a set of rules the build could enforce.",
    body: `A brand colour can look confident on a mood board and still fail as a button. Flux's primary teal was too light for white text at AA contrast, so applying the palette literally would have made core calls to action harder to read.

I treated the colour system as a build constraint. The web test suite checks the shipping colour pairs. Inverted guards fail if light text is placed on the brand teal or teal becomes body copy. That keeps the rule in place when someone edits a screen later, without depending on a reviewer remembering every combination.

The same project had a product-truth problem: this was a prelaunch bank, and its screens could not imply that unavailable services already worked. Fixture-driven states show the intended flow while naming the current blocker. The app navigation was also condensed from five fixed tabs into a floating menu for thirteen destinations.

The [Flux case study](#proj-flux) shows the interface, the contrast rules, and my contribution to making prelaunch states explicit.`,
    tags: ["Accessibility", "Design systems", "Case study"],
    cover: "/projects/flux-1.png",
    coverAlt: "Flux landing page with a green bank card and prelaunch waitlist call to action.",
    draft: false,
  },
  {
    id: "editorial-shm-alerts",
    slug: "shm-alerts",
    title: "An alert should explain what crossed the line",
    date: "2026-10-05",
    excerpt:
      "A short note on turning acceleration, velocity, and deflection readings into a dashboard state people can inspect.",
    body: `A sensor dashboard can show a lot of motion and still leave the important question unanswered: which reading needs attention right now?

The SHM project brings acceleration, velocity, and deflection readings from ESP32 sensor nodes into a per-node view. It displays current values and history, then changes the alert state when a reading crosses a safe limit. The alert clears when the motion settles. This gives someone both the status and the readings behind it.

The [interactive example](#proj-shm) lets you move three readings and see the state change. It is deliberately labelled as a simulation. Its values and thresholds are invented for the portfolio; it is not a live bridge feed or a structural safety assessment.

That distinction matters. A useful demo should let a visitor understand the behavior without borrowing authority from measurements it never made. The linked project demo shows the real interface, while the simulation makes the decision rule easy to explore.`,
    tags: ["Embedded", "Interface", "Case study"],
    cover: "/projects/shm-dashboard.webp",
    coverAlt: "SHM dashboard showing per-node deflection and motion charts.",
    draft: false,
  },
];

export const editorialDesigns: Design[] = [
  {
    id: "study-stormfresh-dashboard",
    title: "Stormfresh management view",
    image: "/projects/poias-dashboard.webp",
    alt: "Dark green Stormfresh dashboard with gain, balance, and sales figures arranged beside module navigation.",
    caption:
      "A reporting screen for a poultry operation. The hierarchy puts gain and its component figures together; the underlying totals come from source records. Built as part of a four-engineer team.",
    category: "Interface",
    tools: ["React", "Supabase", "Recharts"],
    year: "2026",
    link: "/#proj-stormfresh-erp",
  },
  {
    id: "study-flux-landing",
    title: "Flux prelaunch story",
    image: "/projects/flux-1.png",
    alt: "Flux prelaunch hero with a green digital bank card, phone mockup, and waitlist button.",
    caption:
      "A marketing surface for a service that had not launched. The card makes the product tangible, while the waitlist keeps the call to action honest. The palette is backed by contrast tests.",
    category: "Interface",
    tools: ["Next.js", "TypeScript", "Vitest"],
    year: "2026",
    link: "/#proj-flux",
  },
  {
    id: "study-shm-dashboard",
    title: "SHM motion dashboard",
    image: "/projects/shm-dashboard.webp",
    alt: "SHM dashboard with a node selector, current deflection, and acceleration and velocity history charts.",
    caption:
      "Current reading, history, and alert state share one per-node view, so the status has evidence next to it. The portfolio simulation explores the same interaction with clearly illustrative data.",
    category: "Interface",
    tools: ["React", "WebSockets", "ESP32"],
    year: "2026",
    link: "/#proj-shm",
  },
];
