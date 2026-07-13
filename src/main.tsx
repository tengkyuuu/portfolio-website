import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initLanguage } from "./lib/i18n";
import { initPwa } from "./lib/pwa";
import { applyTheme, getStoredTheme } from "./lib/theme";

// Apply the stored theme + language BEFORE React mounts so the first paint
// is already themed — no flash of the default palette.
applyTheme(getStoredTheme());
initLanguage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker + install-prompt capture. Guarded internally — no-ops in
// dev, in unsupported browsers, and inside StrictMode's second render.
initPwa();
