import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["allure-vitest/setup"],
    reporters: [
      "default",
      ["allure-vitest/reporter", { resultsDir: "allure-results" }],
    ],
    coverage: {
      provider: "v8",
      include: ["lib/organizer/**/*.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
