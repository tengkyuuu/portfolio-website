/**
 * Metadata catalog for individual skills — logos, experience level, why
 * you reach for it, and a short code snippet. Keyed by the skill name as
 * it appears in `skillGroups` (case-insensitive at lookup time).
 *
 * Logos are Devicon slugs; the resolved URL uses jsDelivr's CDN so we
 * don't add anything to our bundle:
 *
 *   https://cdn.jsdelivr.net/gh/devicons/devicon/icons/{slug}.svg
 *
 * A skill without a catalog entry still renders — it just shows the
 * generic material icon that the Skills component already used.
 *
 * Edit this file to add / adjust; consider it living data.
 */

export type SkillLevel = "daily" | "weekly" | "explored";

export type SkillMeta = {
  /** Devicon slug e.g. "react/react-original" or full URL. */
  logo?: string;
  level?: SkillLevel;
  /** One-paragraph "why I chose it". Kept short — the panel is small. */
  why?: string;
  /** Short, real code snippet. Lang used as an aria label + heading. */
  snippet?: { lang: string; code: string };
};

/** Case-insensitive lookup key. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

const RAW: Record<string, SkillMeta> = {
  // Frontend
  "React": {
    logo: "react/react-original",
    level: "daily",
    why: "Batteries-not-included in the best way. Composition + hooks give me one primitive (a function that returns markup) and I build up from there. Every project on this list uses it.",
    snippet: {
      lang: "tsx",
      code: `function useTabReady(active: TabId) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    Promise.all([getFontsReady(), ...imagesFor(active).map(preload)])
      .then(() => setReady(true));
  }, [active]);
  return ready;
}`,
    },
  },
  "TypeScript": {
    logo: "typescript/typescript-original",
    level: "daily",
    why: "Refactor confidently, autocomplete like it's autocomplete-plus, catch API-shape drift at edit time. Every ambient error is one less production incident.",
    snippet: {
      lang: "ts",
      code: `type SubmitResult =
  | { ok: true }
  | { ok: false; kind: "validation"; errors: FieldError[] }
  | { ok: false; kind: "rate_limit"; message: string }
  | { ok: false; kind: "server"; message: string }
  | { ok: false; kind: "offline" };`,
    },
  },
  "Tailwind CSS": {
    logo: "tailwindcss/tailwindcss-original",
    level: "daily",
    why: "Design system without a design system. Utility classes keep decisions local; the whole styling is grep-able. Extended with CSS variables for theme swapping.",
    snippet: {
      lang: "tsx",
      code: `<button className="inline-flex items-center gap-1.5 bg-word-blue
  hover:bg-word-blue-dark text-white font-ui text-[13px] font-semibold
  px-4 py-2 rounded-sm transition-colors">
  Post comment
</button>`,
    },
  },
  "Flutter": {
    logo: "flutter/flutter-original",
    level: "weekly",
    why: "Same widget tree on Android and iOS with pixel-perfect control. Hot reload closes the design-to-code loop faster than any web toolchain I've used.",
  },
  "HTML / CSS / JS": {
    logo: "html5/html5-original",
    level: "daily",
    why: "The bedrock. Everything else compiles down to these. Never skip understanding them.",
  },
  "Responsive Design": {
    level: "daily",
    why: "Content-first: layout is derived from what the content wants at that width, not from a phone / tablet / desktop three-way switch.",
  },
  "Web APIs": {
    level: "daily",
    why: "View Transitions, Web Crypto, Speech Synthesis, MediaSession — the platform ships a lot for free. This portfolio uses all four.",
  },
  "Three.js": {
    logo: "threejs/threejs-original",
    level: "explored",
    why: "Rendered a live 3D model in an earlier version of this site. Removed it here because the Word document metaphor calls for restraint.",
  },

  // Embedded
  "ESP32": {
    logo: "espressif/espressif-original",
    level: "daily",
    why: "The right ratio of price, power, and RF for a hardware-frontend engineer. Two cores, Wi-Fi, BLE, and enough flash to run an Arduino sketch or a proper FreeRTOS app.",
    snippet: {
      lang: "cpp",
      code: `void loop() {
  float g = gsr.read();
  float p = ppg.read();
  float t = temp.readC();
  auto label = classifier.predict({g, p, t, accel.magnitude()});
  bleNotify(label);
  delay(200);
}`,
    },
  },
  "Arduino": {
    logo: "arduino/arduino-original",
    level: "daily",
    why: "The world's friendliest embedded IDE. Great for prototyping. I usually graduate to PlatformIO once a project has more than one .ino file.",
  },
  "PIC MCU": {
    level: "explored",
    why: "First microcontroller I wrote firmware for. Still respect the discipline it forces — every byte of RAM counts.",
  },
  "FPGA / Verilog": {
    level: "explored",
    why: "Turned Verilog assignments into working combinational logic on an FPGA board. Different mental model from software — everything runs in parallel.",
  },
  "PCB Design": {
    level: "weekly",
    why: "KiCad for the schematic-to-board flow. I don't route BGA yet, but I've shipped 2-layer boards for sensor fusion work.",
  },
  "Firmware": {
    level: "daily",
    why: "Where the wearable projects actually live. Balancing sample rate, radio duty cycle, and battery life is my favourite kind of engineering trade-off.",
  },
  "I2C / SPI / UART": {
    level: "daily",
    why: "The buses that keep every sensor project talking. I2C for slower stuff (GSR, temperature), SPI for higher-throughput (accelerometer streams), UART for debug + BLE modules.",
  },
  "Sensor Integration": {
    level: "daily",
    why: "GSR + PPG + accelerometer + temperature all in one device is a signal-processing problem before it's a firmware one. The value is in the fused feature vector, not the raw stream.",
  },

  // Design
  "Figma": {
    logo: "figma/figma-original",
    level: "daily",
    why: "The whole design surface. Auto Layout + variants are the closest a design tool has come to actual component code. This portfolio was mocked here first.",
  },
  "Canva": {
    logo: "canva/canva-original",
    level: "weekly",
    why: "For quick client-side collateral where Figma is overkill. The design team I lead uses it, so I keep templates fresh there.",
  },
  "Google Stitch": {
    level: "explored",
    why: "Used it to sketch out the Word-document look you're reading right now — a great way to convert an idea into a working layout in minutes.",
  },
  "Adobe Photoshop": {
    logo: "photoshop/photoshop-plain",
    level: "weekly",
    why: "Raster editing, retouching, and export automation. Not my daily driver but I know it well.",
  },
  "Illustrator": {
    logo: "illustrator/illustrator-plain",
    level: "weekly",
    why: "Vector work for logos and marks. Pathfinder + Shape Builder are the shortest path to a clean icon.",
  },
  "UI / UX": {
    level: "daily",
    why: "The design side of building. Wireframe → prototype → hand-off → build → ship. I do the whole loop, not just one stage.",
  },
  "Branding": {
    level: "weekly",
    why: "Delivered full brand systems for university orgs — mark, palette, type stack, template library.",
  },
  "Typography": {
    level: "daily",
    why: "Bad type is the single fastest way to make a portfolio look amateur. This site leans on Source Serif 4 + Inter for a reason.",
  },

  // Tools & Backend
  "Python": {
    logo: "python/python-original",
    level: "weekly",
    why: "Data crunching, quick ML prototypes, and PyQt6 desktop tools (see the Court Queue Manager project).",
  },
  "C / C++": {
    logo: "cplusplus/cplusplus-original",
    level: "daily",
    why: "Embedded work. Manual memory + strict types = a good discipline check. I write more C++ in a week than most people expect.",
  },
  "Git": {
    logo: "git/git-original",
    level: "daily",
    why: "Not a preference — a professional baseline. Rebase-then-merge, small commits, meaningful subjects.",
  },
  "Firebase": {
    logo: "firebase/firebase-plain",
    level: "weekly",
    why: "Auth + Firestore + Cloud Functions gets me from zero to a working app in an afternoon. Used it for the Physiopaño admin portal.",
  },
  "SQL": {
    logo: "postgresql/postgresql-original",
    level: "daily",
    why: "This portfolio's content lives in a Supabase JSONB row queried through a Vercel Function. SQL is the closest we've come to a portable data language.",
  },
  "Node.js": {
    logo: "nodejs/nodejs-original",
    level: "daily",
    why: "Vite dev server + Vercel Functions runtime + build scripts. My server-side is Node unless there's a reason it can't be.",
  },
  "Linux": {
    logo: "linux/linux-original",
    level: "weekly",
    why: "For the servers I don't own and the ones I do. Ubuntu on a Pi is my go-to for anything long-running at home.",
  },
  "VS Code": {
    logo: "vscode/vscode-original",
    level: "daily",
    why: "The default editor. Rich extension surface + integrated terminal + Copilot make it the fastest way to move.",
  },

  // AI & Data
  "Claude": {
    logo: "anthropic/anthropic-original",
    level: "daily",
    why: "Pair-programming assistant. Excellent at refactors and design critique when you write the prompt like you're pair-programming.",
  },
  "ChatGPT": {
    level: "weekly",
    why: "Complementary to Claude — different strengths, different failure modes. Compare answers when the stakes are high.",
  },
  "Jupyter": {
    logo: "jupyter/jupyter-original",
    level: "weekly",
    why: "Notebook flow for the wearable-signal work — quick plots, model training, exploration before it moves to production Python.",
  },
};

/** Normalize keys once so every lookup is O(1). */
const CATALOG: Record<string, SkillMeta> = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [key(k), v])
);

export function getSkillMeta(name: string): SkillMeta | undefined {
  return CATALOG[key(name)];
}

export function skillLogoUrl(slug: string): string {
  if (/^https?:/.test(slug)) return slug;
  return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}.svg`;
}

export const LEVEL_LABEL: Record<SkillLevel, string> = {
  daily: "Daily",
  weekly: "Weekly",
  explored: "Explored",
};

export const LEVEL_HINT: Record<SkillLevel, string> = {
  daily: "Reach for it most days",
  weekly: "Regular but not constant",
  explored: "Worked with, still learning",
};
