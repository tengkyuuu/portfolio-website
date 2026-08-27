export type Metric = {
  label: string;
  pre: string;
  post: string;
  delta: string;
};

export type ProjectImage = {
  /** URL/path (e.g. "/projects/foo.jpg") or a data URL from admin upload. */
  src: string;
  alt?: string;
};

export type Project = {
  id: string;
  index: string;
  title: string;
  blurb: string;
  tags: string[];
  kind: "embedded" | "web" | "mobile" | "desktop" | "design";
  links: { label: string; href: string }[];
  ref?: string;
  year?: string;
  page?: string;
  figCaption?: string;
  challenge?: string;
  solution?: string;
  metrics?: Metric[];
  /** Tech stack, shown as a labelled chip row. */
  stack?: string[];
  /** Single screenshot displayed in the project's figure. Either a URL/path
   *  (e.g. "/projects/foo.jpg") or a data URL produced by admin upload.
   *  Superseded by `gallery` when that has entries. */
  image?: string;
  imageAlt?: string;
  /** Multiple screenshots. When more than one, the figure becomes a
   *  carousel with left/right arrows. */
  gallery?: ProjectImage[];
  /** Live site URL. When set, the figure gains a "Web Layout" tab that
   *  embeds the project in an iframe with desktop/tablet/phone frames. */
  demoUrl?: string;
  /** Demo video: a YouTube watch/short URL or a direct .mp4/.webm file.
   *  When set, the figure gains a "Media" tab. */
  videoUrl?: string;
};

export const projects: Project[] = [
  {
    id: "physiopano-app",
    index: "01",
    title: "Physiopaño App",
    blurb:
      "Flutter companion app for the Physiopaño wearable — pairs over Bluetooth, streams physiological signals in real time, and turns them into a daily well-being score.",
    tags: ["Flutter", "BLE", "Firebase"],
    stack: [
      "Flutter",
      "Dart",
      "BLE (flutter_blue_plus)",
      "Firebase Auth",
      "Cloud Firestore",
      "Riverpod",
    ],
    kind: "mobile",
    ref: "REF: JVC-2026-01",
    year: "2026",
    page: "02",
    figCaption:
      "FIG 1.1: Physiopaño companion app — live session view with the real-time well-being ring and sensor readouts.",
    challenge:
      "The Physiopaño wearable produces a continuous stream of physiological data — GSR, PPG, skin temperature, and motion — but raw signals mean nothing to the person wearing it. The companion app had to pair reliably over Bluetooth, stay legible for non-technical users, and keep working when the phone is offline in the field.",
    solution:
      "A Flutter app that pairs with the Physiopaño band over BLE, streams the four sensor channels in real time, and distils them into a single daily well-being score with trends and gentle nudges. Sessions are cached on-device and sync to Firebase when a connection returns, so a dropped signal never loses a reading.",
    gallery: [
      {
        src: "/projects/physiopano-app.webp",
        alt: "Physiopaño mobile app on a phone, showing a green well-being ring, live sensor readouts, and session controls on a dark UI.",
      },
    ],
    links: [
      { label: "Repo", href: "#" },
      { label: "Case study", href: "#" },
    ],
  },
  {
    id: "physiopano-admin",
    index: "02",
    title: "Physiopaño Admin Web Portal",
    blurb:
      "React + TypeScript dashboard behind the Physiopaño wearable — enrol participants, monitor live sessions across devices, and export labelled data to retrain the on-device model.",
    tags: ["React", "TypeScript", "Firebase"],
    stack: [
      "React",
      "TypeScript",
      "Tailwind CSS",
      "Firebase",
      "Cloud Functions",
      "Recharts",
    ],
    kind: "web",
    ref: "REF: JVC-2026-02",
    year: "2026",
    page: "03",
    figCaption:
      "FIG 2.1: Admin portal — marketing landing page and Firebase-backed research sign-in.",
    challenge:
      "Behind the wearable sits a research workflow: enrolling participants, watching sessions across many devices, and exporting clean, labelled data to retrain the on-device classifier. Doing that from a phone is hopeless — clinicians and researchers needed a real dashboard.",
    solution:
      "A React + TypeScript portal with role-based auth, a participant roster, and live session monitoring across every paired device. Researchers review and label sessions inline, then export the curated set as training data for the Random Forest model — closing the loop between the field and the firmware.",
    gallery: [
      {
        src: "/projects/physiopano-admin-landing.webp",
        alt: "Physiopaño admin portal landing page — 'Listen to what your body is telling you' hero with a live session dashboard preview.",
      },
      {
        src: "/projects/physiopano-admin-login.webp",
        alt: "Physiopaño admin portal sign-in page — 'Stress, made visible.' panel with a live PPG signal beside a Firebase-backed research login form.",
      },
    ],
    links: [
      { label: "Repo", href: "#" },
      { label: "Live demo", href: "#" },
    ],
  },
  {
    id: "famecrm",
    index: "03",
    title: "FameCRM",
    blurb:
      "The agency operating system — a CRM that lets creator agencies track talent, discover trends, and manage their team across socials from one dashboard.",
    tags: ["React", "TypeScript", "SaaS"],
    stack: [
      "React",
      "TypeScript",
      "Tailwind CSS",
      "Firebase",
      "Recharts",
    ],
    kind: "web",
    ref: "REF: JVC-2026-03",
    year: "2026",
    page: "04",
    figCaption:
      "FIG 3.1: FameCRM — agency landing page, sign-in, and the per-creator analytics dashboard.",
    challenge:
      "Creator agencies juggle talent across Instagram, TikTok, X, and more, with performance data scattered across every platform. They needed one place to track creators, smart links, and engagement — without living in a dozen tabs.",
    solution:
      "A React + TypeScript CRM that pulls each creator's accounts into a single dashboard: seed/usage tracking, smart-link analytics, viral rankings, and click-through metrics, all rendered in a fast, dark, agency-grade UI.",
    gallery: [
      {
        src: "/projects/famecrm-landing.webp",
        alt: "FameCRM landing page — 'The smarter way to run your agency' hero on a dark UI.",
      },
      {
        src: "/projects/famecrm-dashboard.webp",
        alt: "FameCRM dashboard — per-creator analytics with seed usage, total creators/followers/views, and engagement metrics.",
      },
      {
        src: "/projects/famecrm-login.webp",
        alt: "FameCRM sign-in page — 'Your agency, supercharged' panel beside a login form.",
      },
    ],
    demoUrl: "https://www.famecrm.com/",
    links: [{ label: "Repo", href: "#" }],
  },
  {
    id: "shm",
    index: "04",
    title: "SHM — Structural Health Monitoring",
    blurb:
      "An IoT structural-health monitor for bridges — sensor nodes stream acceleration, velocity, and deflection to a real-time dashboard that flags unsafe movement.",
    tags: ["ESP32", "IoT", "Real-time"],
    stack: ["ESP32", "C / C++", "React", "WebSockets", "Recharts"],
    kind: "embedded",
    ref: "REF: JVC-2026-04",
    year: "2026",
    page: "05",
    figCaption:
      "FIG 4.1: SHM — real-time monitoring landing page and the live per-node deflection dashboard.",
    challenge:
      "Bridges flex constantly, but dangerous structural movement is hard to catch by eye. Continuous, remote monitoring meant cheap sensor nodes that could sample motion reliably and surface a clear safe/unsafe signal in real time.",
    solution:
      "ESP32-based sensor nodes sample acceleration, velocity, and deflection and stream them live to a web dashboard. It classifies movement against safe limits, shows per-node readings and history, and auto-clears alerts once motion settles.",
    gallery: [
      {
        src: "/projects/shm-landing.webp",
        alt: "SHM landing page — 'Watch your bridge breathe in real time' with a live waveform background.",
      },
      {
        src: "/projects/shm-dashboard.webp",
        alt: "SHM live dashboard — Miputak Dacu Node showing 2.97 mm current deflection with acceleration and velocity sensor charts.",
      },
    ],
    demoUrl: "https://shm-dashboard.vercel.app/",
    links: [{ label: "Repo", href: "#" }],
  },
  {
    id: "stormfresh-erp",
    index: "05",
    title: "Stormfresh — Poultry ERP",
    blurb:
      "Role-gated ERP for a Philippine poultry operation — tracks live-bird purchases through dressing output to invoices and staff commissions, with profit recomputed live from source records rather than stored.",
    tags: ["Next.js", "React", "Supabase", "Tailwind"],
    stack: [
      "Next.js (App Router)",
      "React",
      "Supabase Postgres (RLS)",
      "Supabase Auth",
      "Tailwind CSS",
      "Zustand",
      "Recharts / Chart.js",
      "Vitest",
    ],
    kind: "web",
    ref: "REF: JVC-2026-05",
    year: "2026",
    page: "06",
    figCaption:
      "FIG 5.1: Stormfresh — management dashboard, marketing landing page, and the invitation-only workspace sign-in.",
    challenge:
      "A poultry business bought live birds, dressed them, and sold the output — but the money lived in spreadsheets. Flock grow-out, commission payroll, and monthly P&L each sat in a separate workbook, several carrying arithmetic defects nobody had caught. Profit was only knowable after month-end reconciliation, and approving a purchase order meant whoever happened to sign the paper.",
    solution:
      "One of five engineers on the build. I owned the management dashboard and reporting layer — gain, balance, and trend figures recomputed live from source rows rather than stored, so the numbers can't drift out of sync — and the role model, pushed down into Postgres row-level security so drafts stay private to their author and only Management approves or deletes. The interface language across the app is mine as well.",
    gallery: [
      {
        src: "/projects/poias-dashboard.webp",
        alt: "Stormfresh management dashboard — left module sidebar, a dark green welcome banner, and a Gain panel breaking sales, bird cost, and expenses down to a red loss figure.",
      },
      {
        src: "/projects/poias-landing.webp",
        alt: "Stormfresh landing page — 'Fresh from the farm. Sharp on the numbers.' headline in dark green over cream, with an illustrated chicken and floating gain and dressed-weight cards.",
      },
      {
        src: "/projects/poias-login.webp",
        alt: "Stormfresh sign-in — a green 'Welcome back!' panel with the Tropical Poultry Farms logo, split diagonally by an orange band from an invitation-only email and password form.",
      },
    ],
    demoUrl: "https://poias.vercel.app",
    links: [{ label: "Repo", href: "https://github.com/mykd13/POIAS" }],
  },
  {
    id: "flux",
    index: "06",
    title: "Flux",
    blurb:
      "Pre-launch site for a Shariah-compliant Pakistani digital bank — a waitlist funnel and product story where accessible contrast, and honesty about what isn't live yet, are enforced by the test suite.",
    tags: ["Next.js", "TypeScript", "Tailwind", "Expo"],
    stack: [
      "Next.js (App Router)",
      "TypeScript",
      "Tailwind CSS",
      "React Native (Expo Router)",
      "Vitest + Testing Library",
      "Google Sheets API",
      "Three.js",
    ],
    kind: "web",
    ref: "REF: JVC-2026-06",
    year: "2026",
    page: "07",
    figCaption:
      "FIG 6.1: Flux — the pre-launch hero and the digital-card section of the marketing site.",
    challenge:
      "A bank that has not opened yet still has to collect real names, phone numbers, and emails from the public, and show an earned-wage product it cannot yet run — every screen risks implying a service already exists. The client also settled a four-colour brand mid-build whose primary teal is light enough that white text on it fails AA outright, so the palette could not simply be dropped in.",
    solution:
      "Honesty is enforced mechanically rather than by review: a contrast suite pins every shipping colour pair, with inverted guards that fail if light text lands on the brand teal or teal is used as body copy. Unbuilt products get working, fixture-driven screens that state their own blocker instead of dead-ending, and the companion Expo app swaps a five-slot tab bar for one floating menu across thirteen destinations.",
    metrics: [
      {
        label: "Contrast pairs under test",
        pre: "0",
        post: "19",
        delta: "+19",
      },
      {
        label: "App font sizes in use",
        pre: "16",
        post: "6",
        delta: "−10",
      },
      {
        label: "Web test suite",
        pre: "—",
        post: "235 tests / 35 files",
        delta: "—",
      },
    ],
    gallery: [
      {
        src: "/projects/flux-1.png",
        alt: "Flux marketing site hero — an angled phone mockup with a green Flux debit card floating over it, beside the headline 'No riba. No hidden fee. No exceptions.' and a Join the waitlist button.",
      },
      {
        src: "/projects/flux-2.png",
        alt: "Flux card section — 'An Islamic bank card that lives in your phone' beside a large green geometric debit card, with Apple Pay, Google Wallet, Contactless, and Instant Control listed below.",
      },
    ],
    demoUrl: "https://fluxpk.co",
    links: [
      { label: "Live site", href: "https://fluxpk.co" },
      { label: "Repo", href: "https://github.com/mykd13/flux-website" },
    ],
  },
  {
    id: "rallys-equities",
    index: "07",
    title: "Rallys Equities",
    blurb:
      "Investor-facing website and admin CMS for a licensed PSX brokerage in Lahore — a single 4,400-line vanilla-JS SPA with live market data, eight financial calculators, and a click-to-edit content editor. No framework, no build step.",
    tags: ["Vanilla JS", "Supabase", "Vercel", "Node.js"],
    stack: [
      "Vanilla JavaScript",
      "Supabase Postgres",
      "Supabase Auth",
      "Supabase Edge Functions (Deno)",
      "Vercel Serverless Functions",
      "Node.js / Express",
      "SQLite (node:sqlite)",
      "Multer + Nodemailer",
    ],
    kind: "web",
    ref: "REF: JVC-2026-07",
    year: "2026",
    page: "08",
    figCaption:
      "FIG 7.1: Rallys Equities — homepage hero in light mode, with a live KSE-100 index card showing a price chart, sub-indices, and a five-stock ticker.",
    challenge:
      "A SECP-licensed PSX brokerage needed a credible, content-heavy investor site — real market data, dozens of compliance and investor-relations pages, eight financial calculators — without an engineering team or a budget for a CMS platform. With the site a single static HTML file and no backend behind it, every future change — a new blog post, a swapped photo, a colour tweak, a contact form landing somewhere readable — meant reopening the codebase and redeploying.",
    solution:
      "One dependency-free HTML file, vanilla JS and no build step, so it stays trivially deployable to Vercel — with Supabase layered on as an invisible backend. A click-to-edit visual CMS writes draft and published JSON to Postgres, images go to Supabase Storage, and forms insert straight into a submissions table under row-level security. The owner controls content, theme, and blog posts without touching code or running a server.",
    gallery: [
      {
        src: "/projects/rallys-equities.jpg",
        alt: "Rallys Equities homepage on cream — a green PSX ticker strip above an 'Invest in Pakistan's Future' headline, beside a dark market panel showing the KSE-100 index, a line chart, and top movers.",
      },
    ],
    demoUrl: "https://rallysequities.com",
    links: [
      { label: "Live site", href: "https://rallysequities.com" },
      { label: "Repo", href: "https://github.com/tengkyuuu/rallys-equities-website" },
    ],
  },
  {
    id: "myktech",
    index: "08",
    title: "MYKTECH — Software Studio Website",
    blurb:
      "An immersive, awwwards-style marketing site for an IT studio — a WebGL hero, scroll-driven storytelling, and a real working contact pipeline.",
    tags: ["Next.js", "WebGL", "GSAP"],
    stack: [
      "Next.js 15 (App Router)",
      "React 19",
      "TypeScript",
      "Tailwind CSS",
      "GSAP + ScrollTrigger",
      "React Three Fiber",
      "Lenis smooth scroll",
    ],
    kind: "web",
    ref: "REF: JVC-2026-08",
    year: "2026",
    page: "09",
    figCaption:
      "FIG 8.1: MYKTECH — the WebGL gradient hero with the outlined-and-gradient headline over a pale studio backdrop.",
    challenge:
      "MYKTECH needed a site that proved a small IT studio ships software with genuine craft — memorable and immersive, yet clean and editorial rather than the usual templated agency look. It also had to work end to end: a functioning lead pipeline, real SEO, and fast, accessible performance on desktop and mobile, all on one maintainable codebase.",
    solution:
      "A Next.js 15 App Router site on a custom design system — Syne display type with Geist, a slate palette holding one reserved magenta-to-gold accent, and a bespoke gradient K mark. GSAP and ScrollTrigger drive the experience against Lenis smooth scroll: a WebGL gradient-blob hero, horizontally pinned services, and a 160-frame showreel scrubbed onto canvas — every bit of it gated behind prefers-reduced-motion.",
    gallery: [
      {
        src: "/projects/myktech.jpg",
        alt: "MYKTECH homepage on pale grey — a pill navbar above the headline 'We build software that feels designed', with 'software that' in outlined type and 'designed.' in a pink-to-orange gradient.",
      },
    ],
    demoUrl: "https://it-company-website-omega.vercel.app/",
    links: [
      { label: "Live site", href: "https://it-company-website-omega.vercel.app/" },
    ],
  },
];

export type SkillGroup = {
  label: string;
  items: string[];
};

export const skillGroups: SkillGroup[] = [
  {
    label: "Embedded",
    items: [
      "ESP32",
      "Arduino",
      "PIC MCU",
      "FPGA / Verilog",
      "PCB Design",
      "Firmware",
      "I2C / SPI / UART",
      "Sensor Integration",
    ],
  },
  {
    label: "Frontend",
    items: [
      "React",
      "TypeScript",
      "Tailwind CSS",
      "Flutter",
      "HTML / CSS / JS",
      "Responsive Design",
      "Web APIs",
      "Three.js",
    ],
  },
  {
    label: "Design",
    items: [
      "Figma",
      "Canva",
      "Google Stitch",
      "Adobe Photoshop",
      "Illustrator",
      "UI / UX",
      "Framer",
    ],
  },
  {
    label: "Tools & Backend",
    items: [
      "Python",
      "C / C++",
      "Git",
      "Firebase",
      "SQL",
      "Node.js",
      "Linux",
      "VS Code",
    ],
  },
  {
    label: "AI & Data",
    items: ["Claude", "ChatGPT", "Jupyter"],
  },
];

export type Cert = {
  title: string;
  issuer: string;
  date: string;
  href?: string;
  /** Optional certificate image. Certs with an image render in the visual
   *  gallery (thumbnail → opens full image); the rest render as text rows. */
  image?: string;
};

export const certs: Cert[] = [
  {
    title: "Champion — Regional Programming Competition (C++)",
    issuer: "ICpEP.SE",
    date: "2023",
  },
  {
    title: "Service Award — VP for External Affairs",
    issuer: "ICpEP.SE",
    date: "1 year",
  },
  {
    title: "AI Fundamentals",
    issuer: "IBM SkillsBuild",
    date: "2024",
    href: "/credentials/ibm-ai-fundamentals.pdf",
  },
  {
    title: "Establishing & Operating Micro, Small & Medium Enterprises",
    issuer: "TESDA",
    date: "2025",
    href: "/credentials/Certificate_of_Completion.pdf",
  },
  // Sololearn course certificates — rendered as an image gallery
  { title: "Python", issuer: "Sololearn", date: "", image: "/credentials/sololearn-python.webp" },
  { title: "C", issuer: "Sololearn", date: "", image: "/credentials/sololearn-c.webp" },
  { title: "C++", issuer: "Sololearn", date: "", image: "/credentials/sololearn-cpp.webp" },
  { title: "Java", issuer: "Sololearn", date: "", image: "/credentials/sololearn-java.webp" },
  { title: "Intro to Java", issuer: "Sololearn", date: "", image: "/credentials/sololearn-java-intro.webp" },
  { title: "SQL", issuer: "Sololearn", date: "", image: "/credentials/sololearn-sql.webp" },
  { title: "SQL Intermediate", issuer: "Sololearn", date: "", image: "/credentials/sololearn-sql-intermediate.webp" },
  { title: "HTML", issuer: "Sololearn", date: "", image: "/credentials/sololearn-html.webp" },
  { title: "Machine Learning", issuer: "Sololearn", date: "", image: "/credentials/sololearn-ml.webp" },
];

export type TimelineEntry = {
  range: string;
  title: string;
  org: string;
  blurb: string;
};

export const timeline: TimelineEntry[] = [
  {
    range: "2022 — 2026",
    title: "BS Computer Engineering",
    org: "Jose Rizal Memorial State University",
    blurb:
      "Lead software engineer on our IoT-based thesis, and Vice President for External Affairs of ICpEP.SE.",
  },
  {
    range: "Freelance",
    title: "SaaS Frontend Developer & Designer",
    org: "Self-employed",
    blurb:
      "Build and design responsive SaaS web frontends for clients — UI/UX, design systems, and production React.",
  },
  {
    range: "Internship",
    title: "IT Support",
    org: "Sangguniang Panlungsod — City Government Center of Dapitan",
    blurb:
      "Hardware and software troubleshooting, plus graphics design for the city council.",
  },
  {
    range: "College",
    title: "Undergraduate Research — IoT Systems",
    org: "JRMSU · Multi-disciplinary Research",
    blurb:
      "Developed IoT-based theses contributing to multi-disciplinary undergraduate research.",
  },
];

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "Work", href: "#work" },
  { label: "Stack", href: "#stack" },
  { label: "Credentials", href: "#credentials" },
  { label: "Contact", href: "#contact" },
];

/* ─── HOW I WORK ──────────────────────────────────────────────────────
   Every stage below points at a file that actually exists in this repo.
   If you change the workflow, change the artifact path too — the Process
   tab links to it, and data.test.ts asserts the file is really there. */

export type ProcessStage = {
  /** Two-digit ordinal, rendered as the step number. */
  n: string;
  title: string;
  /** One line, shown collapsed. */
  summary: string;
  /** The reasoning. Two or three sentences. */
  detail: string;
  /** A real path in this repository that demonstrates the stage. */
  artifact?: { label: string; path: string };
};

export const processStages: ProcessStage[] = [
  {
    n: "01",
    title: "Write the spec before the prompt",
    summary:
      "A new project entry starts as a filled-in contract, not a conversation.",
    detail:
      "Documenting a repo means pasting a fixed prompt into it that returns one JSON object with a rigid shape — field-by-field rules, hard limits on invention, and a mandatory \"uncertain\" array listing everything the model inferred rather than confirmed. The uncertainty list is the point: it tells me exactly which claims to go and verify before any of it reaches the site.",
    artifact: { label: "docs/project-intake-prompt.md", path: "docs/project-intake-prompt.md" },
  },
  {
    n: "02",
    title: "Put the conventions where the agent reads them",
    summary: "Standing rules live in CLAUDE.md, not in my memory of them.",
    detail:
      "Anything I would otherwise repeat every session — the deployment limits, which file is the source of truth for content, what a commit message has to explain — is written down in the file Claude Code loads automatically. A convention that only exists in chat history gets violated the next session.",
    artifact: { label: "CLAUDE.md", path: "CLAUDE.md" },
  },
  {
    n: "03",
    title: "Keep the plan in the open",
    summary: "A tiered backlog, with shipped work marked shipped.",
    detail:
      "Features are graded by payoff against scope before anything is built, and the list records what actually landed. It stops the same idea being relitigated, and it makes the next thing to build a lookup rather than a decision.",
    artifact: { label: "ROADMAP.md", path: "ROADMAP.md" },
  },
  {
    n: "04",
    title: "Commits explain the cause, not the change",
    summary: "The diff shows what moved. The message says why it had to.",
    detail:
      "A subject line plus a body that states the problem, the mechanism behind it, and the reasoning for this fix over the alternatives. Six months later the diff is still readable but the reason is gone, and the reason is the expensive part to reconstruct.",
  },
  {
    n: "05",
    title: "Turn every incident into a test",
    summary: "Bugs that cost a day get a guard so they cannot cost another.",
    detail:
      "The suite is weighted toward things that have actually gone wrong here: a cache that hid freshly deployed content, project numbering that silently collided, a deployment cap that fails after the build succeeds so the log stays green. Each one is now a failing test before it is a broken site.",
    artifact: { label: "api/limits.test.ts", path: "api/limits.test.ts" },
  },
  {
    n: "06",
    title: "CI is the checkpoint, not the reviewer",
    summary: "Machines gate the merge; I decide what ships.",
    detail:
      "Every push runs typecheck and the full suite and blocks on red, then publishes counts, coverage and Lighthouse scores to a dashboard on this site. Automation tells me the state of the build. It does not get to tell me the work is done.",
    artifact: { label: ".github/workflows/tests.yml", path: ".github/workflows/tests.yml" },
  },
];

/* ─── NOW ─────────────────────────────────────────────────────────────
   A /now page: what has my attention this month. Keep it short and
   keep it current — a stale Now page is worse than no Now page. */

export type NowGroup = {
  label: string;
  icon: string;
  items: { name: string; note: string }[];
};

/** Month this list was last reviewed. Shown verbatim on the tab. */
export const nowUpdated = "August 2026";

export const nowGroups: NowGroup[] = [
  {
    label: "Learning",
    icon: "school",
    items: [
      {
        name: "React Native",
        note: "Moving from Flutter's widget tree to a JS-driven native runtime, and learning where that trade actually bites.",
      },
      {
        name: "Reanimated 3",
        note: "Animations that run on the UI thread instead of the JS one — the shared-value and worklet model.",
      },
      {
        name: "TanStack Query",
        note: "Treating server state as a cache with rules rather than something to hand-roll into component state.",
      },
    ],
  },
  {
    label: "Building",
    icon: "construction",
    items: [
      {
        name: "This document",
        note: "A portfolio built as a Word file. Live chat, a grounded assistant, and a status dashboard that reports its own test and Lighthouse scores.",
      },
      {
        name: "Client frontends",
        note: "Freelance SaaS and marketing work — design system through to deployment.",
      },
    ],
  },
];
