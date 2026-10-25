// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Software WebGL competes for CPU; keep both browser engines responsive in CI.
  workers: 2,
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    // The game follows the browser language; scenarios pin English unless
    // they test German explicitly.
    locale: "en-US",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
          ],
        },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        // Linux CI needs a real X display for Mesa software WebGL.
        headless: !process.env.CI,
        launchOptions: {
          firefoxUserPrefs: {
            "webgl.force-enabled": true,
            "webgl.disabled": false,
            "gfx.webrender.all": true,
          },
        },
      },
    },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
