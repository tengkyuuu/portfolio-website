import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Standalone from vite.config.ts on purpose: that config mounts the Express
 * dev API as a plugin, and the test runner has no business booting a server.
 * Only the React plugin is needed here, for JSX in component tests.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "api/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts", "src/components/**/*.tsx"],
      exclude: ["src/test/**", "**/*.test.*"],
    },
  },
});
