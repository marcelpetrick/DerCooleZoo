// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from "vitest/config";
export default defineConfig({
  base: "./",
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "json", "html"],
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
});
