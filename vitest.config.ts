import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    // Use jsdom automatically for TSX tests to reduce per-file pragmas
    environmentMatchGlobs: [["**/*.spec.tsx", "jsdom"]],
    // Exclude Playwright e2e tests (they run via `bun run test:e2e`)
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "html", "lcov", "json"],
      exclude: [
        "dist/**",
        "node_modules/**",
        "tests/**",
        "**/*.spec.{ts,tsx}",
        "**/*.test.{ts,tsx}",
        "**/types/**",
        // Exclude viewer shell and heavy preview panel from global coverage gates
        "src/viewer.tsx",
        "src/components/PreviewPanel.tsx",
        "eslint.config.js",
        "vitest.config.ts",
        "build.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 43,
        branches: 55,
        functions: 45,
        statements: 43,
      },
      all: true,
      clean: true,
    },
  },
});
