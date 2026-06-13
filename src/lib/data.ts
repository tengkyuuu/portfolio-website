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
      "Sample text — a CRM dashboard for creators and small teams to track accounts, engagement, and outreach in one place.",
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
    figCaption: "FIG 3.1: FameCRM dashboard — sample placeholder.",
    challenge:
      "Sample text — describe the problem FameCRM set out to solve (scattered accounts, no single view of engagement, manual outreach).",
    solution:
      "Sample text — describe what you built: a dashboard with account tracking, engagement analytics, and a clean, fast UI.",
    gallery: [],
    links: [{ label: "Repo", href: "#" }],
  },
  {
    id: "shm",
    index: "04",
    title: "SHM",
    blurb:
      "Sample text — an IoT structural/health monitoring system that streams sensor data to the cloud for real-time dashboards and alerts.",
    tags: ["ESP32", "IoT", "Sensors"],
    stack: ["ESP32", "C / C++", "MQTT", "Firebase", "Sensors"],
    kind: "embedded",
    ref: "REF: JVC-2026-04",
    year: "2026",
    page: "05",
    figCaption: "FIG 4.1: SHM sensor + dashboard — sample placeholder.",
    challenge:
      "Sample text — describe the monitoring problem (continuous sensing, remote sites, timely alerts on a low-power budget).",
    solution:
      "Sample text — describe the build: ESP32 nodes sampling sensors, publishing over MQTT, and a dashboard for live readings and alerts.",
    gallery: [],
    links: [{ label: "Repo", href: "#" }],
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
      "Branding",
      "Typography",
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
    range: "2021 — Present",
    title: "BS Computer Engineering — 1.76 GWA",
    org: "Jose Rizal Memorial State University, Dapitan",
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
