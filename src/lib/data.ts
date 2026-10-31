import type {
  AboutContent,
  ContactContent,
  HeroContent,
} from "./content";

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
  /** Legacy imports only. Physical page numbers are derived from layout. */
  page?: string;
  figCaption?: string;
  challenge?: string;
  solution?: string;
  /** Specific contribution and observable result for the featured case studies. */
  contribution?: string;
  result?: string;
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
    id: "shm",
    index: "01",
    title: "SHM — Structural Health Monitoring",
    blurb:
      "An IoT structural-health monitor for bridges — sensor nodes stream acceleration, velocity, and deflection to a real-time dashboard that flags unsafe movement.",
    tags: ["ESP32", "IoT", "Real-time"],
    stack: ["ESP32", "C / C++", "React", "WebSockets", "Recharts"],
    kind: "embedded",
    ref: "REF: JVC-2026-01",
    year: "2026",
    figCaption:
      "FIG 1.1: SHM — real-time monitoring landing page and the live per-node deflection dashboard.",
    challenge:
      "Bridges flex constantly, but dangerous structural movement is hard to catch by eye. Continuous, remote monitoring meant cheap sensor nodes that could sample motion reliably and surface a clear safe/unsafe signal in real time.",
    solution:
      "ESP32-based sensor nodes sample acceleration, velocity, and deflection and stream them live to a web dashboard. It classifies movement against safe limits, shows per-node readings and history, and auto-clears alerts once motion settles.",
    contribution:
      "The engineering work connects three sensor readings to a per-node dashboard and a clear safe/unsafe alert state.",
    result:
      "The linked demo shows current readings, history, and the alert behavior. The interactive example below uses invented readings so visitors can test that behavior without a bridge sensor.",
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
    index: "02",
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
    ref: "REF: JVC-2026-02",
    year: "2026",
    figCaption:
      "FIG 2.1: Stormfresh — management dashboard, marketing landing page, and the invitation-only workspace sign-in.",
    challenge:
      "A poultry business bought live birds, dressed them, and sold the output — but the money lived in spreadsheets. Flock grow-out, commission payroll, and monthly P&L each sat in a separate workbook, several carrying arithmetic defects nobody had caught. Profit was only knowable after month-end reconciliation, and approving a purchase order meant whoever happened to sign the paper.",
    solution:
      "One of four engineers on the build. I owned the management dashboard and reporting layer — gain, balance, and trend figures recomputed live from source rows rather than stored, so the numbers can't drift out of sync — and the role model, pushed down into Postgres row-level security so drafts stay private to their author and only Management approves or deletes. The interface language across the app is mine as well.",
    contribution:
      "One of four engineers. I owned the management dashboard, reporting layer, Postgres role rules, and the app's interface language.",
    result:
      "Gain, balance, and trend figures are calculated from source records; management permissions are enforced in Postgres rather than only in the interface.",
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
    index: "03",
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
    ref: "REF: JVC-2026-03",
    year: "2026",
    figCaption:
      "FIG 3.1: Flux — the pre-launch hero and the digital-card section of the marketing site.",
    challenge:
      "A bank that has not opened yet still has to collect real names, phone numbers, and emails from the public, and show an earned-wage product it cannot yet run — every screen risks implying a service already exists. The client also settled a four-colour brand mid-build whose primary teal is light enough that white text on it fails AA outright, so the palette could not simply be dropped in.",
    solution:
      "Honesty is enforced mechanically rather than by review: a contrast suite pins every shipping colour pair, with inverted guards that fail if light text lands on the brand teal or teal is used as body copy. Unbuilt products get working, fixture-driven screens that state their own blocker instead of dead-ending, and the companion Expo app swaps a five-slot tab bar for one floating menu across thirteen destinations.",
    contribution:
      "I implemented contrast checks for the brand palette, fixture-driven prelaunch screens, and the companion app's navigation system.",
    result:
      "The interface makes prelaunch states explicit, protects readable contrast, and brings a consistent navigation and type system to the companion app.",
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
    index: "04",
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
    ref: "REF: JVC-2026-04",
    year: "2026",
    figCaption:
      "FIG 4.1: Rallys Equities — homepage hero in light mode, with a live KSE-100 index card showing a price chart, sub-indices, and a five-stock ticker.",
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
    index: "05",
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
    ref: "REF: JVC-2026-05",
    year: "2026",
    figCaption:
      "FIG 5.1: MYKTECH — the WebGL gradient hero with the outlined-and-gradient headline over a pale studio backdrop.",
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
  {
    id: "physiopano-app",
    index: "06",
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
    ref: "REF: JVC-2026-06",
    year: "2026",
    figCaption:
      "FIG 6.1: Physiopaño companion app — live session view with the real-time well-being ring and sensor readouts.",
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
    index: "07",
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
    ref: "REF: JVC-2026-07",
    year: "2026",
    figCaption:
      "FIG 7.1: Admin portal — marketing landing page and Firebase-backed research sign-in.",
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
    index: "08",
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
    ref: "REF: JVC-2026-08",
    year: "2026",
    figCaption:
      "FIG 8.1: FameCRM — agency landing page, sign-in, and the per-creator analytics dashboard.",
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
    id: "aperture-journal",
    index: "09",
    title: "Aperture",
    blurb:
      "A private journaling companion where you think alongside Gemini — entries you seal are encrypted in the browser, so neither the server nor the model can read them, and every AI call is logged where you can audit it.",
    tags: ["Next.js", "TypeScript", "Firebase", "Gemini API"],
    stack: [
      "Next.js (App Router)",
      "TypeScript",
      "Firebase Auth (httpOnly session cookies)",
      "Cloud Firestore",
      "Gemini (@google/genai)",
      "Cloud Run + Secret Manager",
      "WebCrypto (AES-GCM, PBKDF2)",
      "Tailwind CSS",
    ],
    kind: "web",
    ref: "REF: JVC-2026-09",
    year: "2026",
    figCaption:
      "FIG 9.1: Aperture — the sign-in gate's privacy pitch, and the home view's mode picker and running session list.",
    challenge:
      "Handing a journal to an AI means handing over the most private writing a person does, and most products ask for that trust without offering any way to check what left the device or who could read it. Journals compound it by being write-only: people stop because what they pour in never comes back, and a search box nobody opens is not an answer.",
    solution:
      "Tenancy is the Firestore path itself, so a cross-user leak needs a bug in the path rather than a forgotten filter, and rules deny client writes outright. Sealed entries are AES-GCM encrypted in the browser under a key never persisted. Echoes closes the write-only loop, surfacing an older entry mid-draft with the mood delta — gated by consent the server enforces, and logged so the feature reading unsent text is the most auditable one in the app.",
    // These two are the sign-in gate and the home view — not the Echoes /
    // Privacy Ledger / sealed-entry / Insights shots the intake notes
    // originally suggested. Real screenshots take precedence; figCaption
    // above describes what these two actually show rather than what was
    // proposed. Swap in the remaining shots here if they're captured later.
    gallery: [
      {
        src: "/projects/aperture-signin.png",
        alt: "Aperture sign-in screen — dark UI with the pink Aperture wordmark, the headline 'A private place to think,' a Continue with Google button, and three bordered privacy callouts: Yours Alone, Sealed Means Sealed, and Nothing Hidden.",
      },
      {
        src: "/projects/aperture-home.png",
        alt: "Aperture home view — a sessions sidebar grouped by month on the left, and on the right 'Hello, James.' above four mode buttons (Reflect, Brainstorm, Untangle, Rubber Duck), a prompt composer, and a Still Open list of two follow-up questions.",
      },
    ],
    demoUrl: "https://aperture-123144439483.asia-southeast1.run.app",
    links: [
      { label: "Repo", href: "https://github.com/tengkyuuu/aperture-journal" },
      { label: "Live", href: "https://aperture-123144439483.asia-southeast1.run.app" },
    ],
  },
  {
    id: "pavetrack",
    index: "10",
    title: "PAVEtrack",
    blurb:
      "A web dashboard for civil engineers that turns a week of CCTV vehicle counts into AADT, cumulative ESAL and a recommended pavement thickness, replacing manual spreadsheet design calculations for road planning.",
    // Scoped to what the linked repo (DASHBOARD) actually contains. The
    // vehicle-detection pipeline shown in the second gallery image is real
    // and a teammate's work, but its code lives in an untracked parent
    // folder in neither DASHBOARD nor the older PAVEtrack deploy repo — so
    // it's described in prose below, not claimed as a stack dependency a
    // visitor could check out and not find.
    tags: ["Python", "Streamlit", "pandas"],
    stack: [
      "Python",
      "Streamlit",
      "pandas",
      "Custom CSS design system",
      "Folium (GIS heatmap utility)",
      "Playwright (UI smoke test)",
    ],
    kind: "web",
    ref: "REF: JVC-2026-10",
    year: "2026",
    figCaption:
      "FIG 10.1: PAVEtrack — dashboard with a sample traffic file loaded, showing AADT, ESAL, and a 160 mm recommended pavement thickness for Galas Feeder Port.",
    challenge:
      "Designing a road pavement needs a trustworthy traffic load figure, but engineers get it by hand-counting vehicles from CCTV footage and pushing the totals through separate AADT, ESAL and thickness calculations by hand. That is slow and easy to get wrong. The project began as a university thesis for Galas Feeder Port, which also had to show how well an automated vehicle-detection pipeline matched manual counts.",
    solution:
      "Each pavement-design stage became one small Python module: the CSV reader, AADT, cumulative ESAL growth series, and flexible or rigid thickness from CBR. A Streamlit shell wraps them with input validation, plain-language errors, and a sample CSV. A companion Roboflow-trained detector counts vehicles directly from CCTV footage and was validated against manual counts — that pipeline lives outside this repository, in the thesis team's video-processing scripts.",
    // Team thesis project; dashboard is this contributor's half. No
    // AGENTS.md-equivalent naming teammates exists here, so none are
    // named — only the division of work is stated.
    contribution:
      "Built this dashboard as part of a university thesis team — the CSV-to-AADT-to-ESAL calculation engine and the Streamlit interface, while a teammate built the CCTV vehicle-detection pipeline that feeds it.",
    gallery: [
      {
        src: "/projects/pavetrack-dashboard-results.png",
        alt: "PAVEtrack dashboard with a sample traffic file loaded — an input panel on the left, and on the right AADT, ESAL figures, a 160 mm pavement thickness recommendation, and a traffic composition bar chart.",
      },
      {
        src: "/projects/pavetrack-vehicle-detection.jpg",
        alt: "CCTV frame from Galas Feeder Port with automated vehicle detection: an orange box and counting line on a passing bus, and smaller detection boxes on nearby motorcycles.",
      },
    ],
    links: [{ label: "Repo", href: "https://github.com/luffela/DASHBOARD" }],
  },
  {
    id: "rallys-transfers",
    index: "11",
    title: "Rallys Transfers",
    // Held back from the intake JSON: "Australian" and the before-state are
    // inferred; the repo is a private team repo, so no link (owner's call);
    // Team project — the contribution is scoped to the admin web only. The
    // screenshots are the admin portal running on demo data.
    blurb:
      "A chauffeur and limousine transport platform that joins an admin dispatch portal, passenger and driver mobile apps, and partner portals on one Firebase backend, with Stripe payments and Twilio calling.",
    tags: ["Next.js", "Flutter", "Firebase", "TypeScript"],
    stack: [
      "Next.js App Router (React, TypeScript, Tailwind)",
      "Flutter with Riverpod and go_router (passenger, driver, crew apps)",
      "Firebase Cloud Functions (Node 22, TypeScript)",
      "Cloud Firestore with custom security rules and admin claims",
      "Stripe (flutter_stripe, @stripe/react-stripe-js)",
      "Twilio (SMS and voice) and Google Maps / Places",
      "Anthropic SDK for AI email generation",
      "Playwright, Vitest and Firebase emulator tests",
    ],
    kind: "web",
    ref: "REF: JVC-2026-11",
    year: "2026",
    figCaption:
      "FIG 11.1: Rallys Transfers — the admin portal on demo data: the operations dashboard, the dispatch board and the CRM lead pipeline.",
    challenge:
      "Chauffeur bookings arrive from hotels, airlines, corporate accounts and walk-in customers, each with different pricing, invoicing and approval rules. Dispatchers have to assign drivers, track flights, handle crew transfers and chase compliance paperwork, while passengers expect live tracking and instant confirmations. The team benchmarked against Limo Anywhere to find the gaps.",
    solution:
      "One Firebase project backs every surface: a Next.js admin portal with dispatch, CRM, pricing and payouts, role-specific portals for hotels, airlines, fleets and corporates, and Flutter apps for passengers and drivers. Business rules live in TypeScript Cloud Functions, and Firestore rules with admin claims enforce access. A Playwright, Vitest and emulator test suite guards the booking flow.",
    contribution:
      "Built the admin web portal's UI and its CRM feature, as one of several owners on a team project spanning the admin web, the Flutter apps and the Cloud Functions backend.",
    gallery: [
      {
        src: "/projects/rallys-transfers-dashboard.png",
        alt: "Rallys Transfers admin dashboard in light mode with a maroon-accented left sidebar. Needs Attention cards show mostly zeros with 4 in progress, today's bookings read 8, and a chauffeur schedule lists four chauffeurs with their vehicles and status.",
      },
      {
        src: "/projects/rallys-transfers-dispatch.png",
        alt: "Rallys Transfers dispatch board in dark mode: a table of eight upcoming rides with pickup times, status, pickup and drop-off, vehicle, chauffeur, passenger and price. Four rides are unassigned and four are assigned and on the way.",
      },
      {
        src: "/projects/rallys-transfers-crm.png",
        alt: "Rallys Transfers CRM pipeline in light mode: tabs for Overview, Contacts, Pipeline, Quotes and Campaign, a $41,000 pipeline total, and a kanban with six stage columns from New Lead to Booking Confirmed holding seven lead cards.",
      },
    ],
    links: [],
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
    title: "Google Cloud Gen AI Academy APAC 2026 — Cohort 3",
    issuer: "Google Cloud · Hack2skill",
    date: "2026",
    href: "/credentials/Hack2Skill.pdf",
  },
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
    "n": "01",
    "title": "Understand the project",
    "summary": "Opus + me: define the problem before choosing a solution.",
    "detail": "I review the existing project with Opus, clarify who it serves, and document constraints and unknowns. We agree on the scope and what evidence would show that the work is successful."
  },
  {
    "n": "02",
    "title": "Write the PRD",
    "summary": "Opus: turn the brief into requirements and acceptance criteria.",
    "detail": "I use Opus to write PRD.md with users, goals, workflows, requirements, non-goals, and acceptance criteria. I review the decisions and resolve important ambiguity before implementation begins."
  },
  {
    "n": "03",
    "title": "Set the engineering rules",
    "summary": "Opus: plan the architecture and maintain CLAUDE.md.",
    "detail": "I work with Opus on the system boundaries, data flow, repository conventions, and testing approach. CLAUDE.md records the commands, security rules, and constraints the implementation agent needs to follow.",
    "artifact": {
      "label": "CLAUDE.md",
      "path": "CLAUDE.md"
    }
  },
  {
    "n": "04",
    "title": "Define the design system",
    "summary": "Opus: document tokens, components, states, and responsive behavior.",
    "detail": "I use Opus to write DESIGN.md around the existing product direction: typography, colors, spacing, component states, accessibility, and key screen patterns. I review the design decisions before they become code."
  },
  {
    "n": "05",
    "title": "Plan and approve the implementation",
    "summary": "Opus plans the tasks; I approve the handoff.",
    "detail": "Opus writes IMPLEMENTATION_PLAN.md with dependency-ordered tasks, affected files, risks, and acceptance checks. I check it against the PRD, CLAUDE.md, and design system, then approve the plan before Sonnet starts."
  },
  {
    "n": "06",
    "title": "Build in small steps",
    "summary": "Sonnet: implement the approved plan, one verifiable task at a time.",
    "detail": "Sonnet implements each task using the planning documents, runs the relevant checks, and records progress. I inspect the changes as we go. New architectural decisions or scope changes return to Opus for a revised plan before implementation continues."
  },
  {
    "n": "07",
    "title": "Verify the product",
    "summary": "Sonnet + me: test behavior and inspect the actual experience.",
    "detail": "I check the result against the PRD with Sonnet, including important user paths, responsive layouts, keyboard access, and regressions. Passing tests support the review; I also inspect the running product and the final diff."
  },
  {
    "n": "08",
    "title": "Review and release",
    "summary": "I decide what ships and verify the deployed result.",
    "detail": "After the final review, I check the build and release status and confirm the intended version reached production. Lessons and constraints go back into the project documents so the next change starts with accurate context."
  }
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
export const nowUpdated = "October 2026";

export const nowGroups: NowGroup[] = [
  { label: "Building", icon: "construction", items: [
    { name: "My own orchestrator software", note: "An ongoing personal software project." },
  ] },
  { label: "Learning", icon: "school", items: [
    { name: "Multi-agent programming", note: "Learning how to work with multiple programming agents." },
  ] },
];

/* ─── DEFAULT HERO / ABOUT / CONTACT ──────────────────────────────────
   These live here rather than in content.ts so that api/chat.ts can
   ground the assistant on the shipped defaults. content.ts pulls in
   browser-only modules (localStorage, fetch wrappers) that a Serverless
   Function must not import; data.ts is pure data with no runtime deps.
   The types are a type-only import, so nothing is pulled in at runtime. */

export const defaultHero: HeroContent = {
    eyebrow: "Portfolio · 2026 Edition",
    name: "James Vincent Calunsag",
    role: "AI-Driven Computer Engineer · Full-Stack Development & Design",
    email: "jamescalunsag13@gmail.com",
    website: "https://jamescalunsag.online/",
    location: "Dapitan City, PH",
    available: true,
    availableText: "Available for work",
    tagline:
      "I build full-stack software and thoughtful interfaces, combining engineering, design, and AI-assisted development.",
    abstract:
      "This document is a working portfolio: a record of selected projects, credentials, and ways to get in touch. It is laid out the way I think — like a Word document: structured, hierarchical, deliberate about typography.\n\nUse the ribbon above to navigate. Each tab is its own page.",
    showContents: true,
  };

export const defaultAbout: AboutContent = {
    paragraphs:
      "I'm James, a **computer engineer** focused on full-stack development and design. I use AI throughout my workflow—from defining requirements and planning the system to implementing, testing, and refining the experience.\n\nI'm currently building my own orchestrator software and learning multi-agent programming.",
    highlights: [
      "Product planning — requirements, architecture, implementation plans",
      "Full-stack development — React, TypeScript, connected systems",
      "Interface design — design systems, responsive UI, accessibility",
      "AI-assisted workflows — Opus for planning, Sonnet for implementation",
    ],
    specs: [
      { label: "Role", value: "AI-Driven Computer Engineer" },
      { label: "Focus", value: "Full-stack development · Interface & product design" },
      { label: "Currently", value: "Building my own orchestrator software" },
      { label: "Location", value: "Dapitan City, PH" },
      { label: "Tooling", value: "React · TypeScript · Claude · Figma" },
      { label: "Open to", value: "Freelance · Internships" },
    ],
  };

export const defaultContact: ContactContent = {
    intro:
      "Have a software project in mind? Let's talk about the product, the interface, and what it needs to do. Open to freelance, internships, and collaborations. The fastest way to reach me is [email](mailto:jamescalunsag13@gmail.com).",
    channels: [
      {
        label: "Email",
        value: "jamescalunsag13@gmail.com",
        href: "mailto:jamescalunsag13@gmail.com",
        icon: "mail",
      },
      {
        label: "GitHub",
        value: "github.com/tengkyuuu",
        href: "https://github.com/tengkyuuu",
        icon: "code",
      },
      {
        label: "LinkedIn",
        value: "linkedin.com/in/james-vincent-calunsag",
        href: "https://www.linkedin.com/in/james-vincent-calunsag/",
        icon: "link",
      },
      { label: "Location", value: "Dapitan City, PH", href: "#", icon: "location_on" },
    ],
  };

/* ─── IMAGE CREDITS ────────────────────────────────────────────────────
   A handful of images on this site weren't drawn by me — Blue's reaction
   stickers and its launcher mark were found online (Pinterest), and I
   don't know who the original artist is. CTTO: credit to the original
   creator, whoever that turns out to be. Rendered on /credits, and
   data.test.ts checks every `src` here resolves to a real file, so this
   can't silently drift from what's actually shipped. */

export type ImageCredit = {
  src: string;
  alt: string;
  /** Where on the site this image actually appears. */
  usedAs: string;
  /** Where it was found. Not necessarily where it originated. */
  source: string;
  /** The original artist, if known. Null means genuinely unknown — say
   *  so rather than inventing a name or leaving the field blank. */
  artist: string | null;
};

export const imageCredits: ImageCredit[] = [
  {
    src: "/blue/coffee-blue.jpg",
    alt: "Blue holding a cup of coffee",
    usedAs: "Chat assistant — \"Coffee break\" reaction",
    source: "Pinterest",
    artist: null,
  },
  {
    src: "/blue/working-blue.jpg",
    alt: "Blue wearing glasses and working at a laptop",
    usedAs: "Chat assistant — \"Working\" reaction",
    source: "Pinterest",
    artist: null,
  },
  {
    src: "/blue/searching-blue.jpg",
    alt: "Blue studying a sheet of paper",
    usedAs: "Chat assistant — \"Investigating\" reaction",
    source: "Pinterest",
    artist: null,
  },
  {
    src: "/blue/needmoney-blue.jpg",
    alt: "Blue in ragged clothes beside an empty bowl",
    usedAs: "Chat assistant — \"Need a little funding\" reaction",
    source: "Pinterest",
    artist: null,
  },
  {
    src: "/blue/like-blue.jpg",
    alt: "Blue smiling and giving a thumbs-up",
    usedAs: "Chat assistant — \"Love that\" reaction",
    source: "Pinterest",
    artist: null,
  },
  {
    src: "/blue/cry-blue.jpg",
    alt: "Blue crying",
    usedAs: "Chat assistant — \"Feeling it\" reaction",
    source: "Pinterest",
    artist: null,
  },
  {
    src: "/blue/corporate-blue.jpg",
    alt: "Blue wearing a tie and carrying a shoulder bag",
    usedAs: "Chat assistant — \"Business mode\" reaction",
    source: "Pinterest",
    artist: null,
  },
  {
    src: "/blue-logo.png",
    alt: "A blue flower-shaped mark, used as Blue's launcher icon",
    usedAs: "Chat assistant — launcher button",
    source: "Pinterest",
    artist: null,
  },
];
