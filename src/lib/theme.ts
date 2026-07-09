/**
 * MS Word-style theme system.
 *
 * Word ships five office themes:
 *   Colorful  — the default, colored ribbon on light chrome
 *   Dark Gray — muted gray dark UI
 *   Black     — full dark, high-contrast
 *   White     — very clean flat light
 *   System    — follows OS light/dark
 *
 * Each theme sets the same CSS custom properties (workspace bg, paper bg,
 * ink, accent, ribbon, etc). CSS reads them via [data-theme="…"] on <html>.
 *
 * We keep the .light / .dark classes on <html> as *palette-parents* too, so
 * every existing `dark:` selector in the codebase still works.
 */

export type Theme = "colorful" | "dark-gray" | "black" | "white" | "system";

export type ThemeMeta = {
  id: Theme;
  label: string;
  icon: string; // material symbol name
  hint: string;
  /** Which of the two palette parents (.light / .dark) this theme uses. */
  palette: "light" | "dark" | "auto";
  /** A tiny colour chip used in the theme picker preview. */
  chip: string;
};

export const THEMES: ThemeMeta[] = [
  {
    id: "colorful",
    label: "Colorful",
    icon: "palette",
    hint: "Blue accent on light chrome — the default Word look.",
    palette: "light",
    chip: "#2b579a",
  },
  {
    id: "dark-gray",
    label: "Dark Gray",
    icon: "contrast",
    hint: "Muted dark grays, easy on the eyes.",
    palette: "dark",
    chip: "#3a3d40",
  },
  {
    id: "black",
    label: "Black",
    icon: "circle",
    hint: "Full dark, high-contrast.",
    palette: "dark",
    chip: "#0a0a0a",
  },
  {
    id: "white",
    label: "White",
    icon: "circle",
    hint: "Ultra-clean, no gray tints.",
    palette: "light",
    chip: "#ffffff",
  },
  {
    id: "system",
    label: "Use system setting",
    icon: "auto_awesome",
    hint: "Follows your OS light/dark preference.",
    palette: "auto",
    chip: "linear-gradient(135deg, #ffffff 50%, #0a0a0a 50%)",
  },
];

const STORAGE_KEY = "jvc_theme_v2";

/** Read the theme choice from localStorage; default to "colorful". */
export function getStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "colorful";
  const raw = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (raw && THEMES.some((t) => t.id === raw)) return raw;
  return "colorful";
}

/** Resolve "system" to a concrete light/dark palette parent. */
export function resolvePalette(theme: Theme): "light" | "dark" {
  const meta = THEMES.find((t) => t.id === theme);
  if (!meta || meta.palette === "auto") {
    return typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return meta.palette;
}

/**
 * Apply the given theme to <html>. Sets:
 *   - data-theme="<id>"      → picks the palette override in CSS
 *   - class="light" | "dark" → keeps every existing dark: variant working
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const palette = resolvePalette(theme);
  root.classList.toggle("dark", palette === "dark");
  root.classList.toggle("light", palette === "light");
  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Swap themes with a circular reveal that grows out of `origin` (usually the
 * click position on the theme button). Uses the View Transitions API where
 * available; falls back to an instant apply otherwise.
 *
 * The `::view-transition-new(root)` pseudo is animated via clip-path from a
 * zero-radius circle to a circle that covers the viewport corners.
 */
export function switchTheme(
  theme: Theme,
  origin?: { x: number; y: number }
): void {
  const docAny = document as Document & {
    startViewTransition?: (cb: () => void) => {
      ready: Promise<void>;
    };
  };
  const supportsVT =
    typeof document !== "undefined" &&
    typeof docAny.startViewTransition === "function";

  if (!supportsVT || !origin || !docAny.startViewTransition) {
    applyTheme(theme);
    return;
  }

  const { x, y } = origin;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = docAny.startViewTransition(() => applyTheme(theme));

  void transition.ready.then(() => {
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 640,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  });
}

/** Subscribe to OS light/dark changes; re-applies "system" theme when it flips. */
export function watchSystemTheme(getCurrent: () => Theme): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getCurrent() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
