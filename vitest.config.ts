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
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json"],
      exclude: [
        "dist/**",
        "node_modules/**",
        "tests/**",
        "**/*.spec.{ts,tsx}",
        "**/*.test.{ts,tsx}",
        "**/types/**",
        "src/version.ts", // Generated file
        "eslint.config.js",
        "vitest.config.ts",
        "build.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 50,
        branches: 55,
        functions: 45,
        statements: 50,
      },
      all: true,
      clean: true,
    },
  },
});
