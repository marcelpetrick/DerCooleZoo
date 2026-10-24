#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
/* global document */
/** Verify the real deployed WebGL application, using a fresh browser profile. */
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const url = process.argv[2];
if (!url)
  throw new Error("Usage: node scripts/check-site.mjs <site-url> [version]");
const metadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const version = process.argv[3] ?? metadata.version;
const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(url, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.locator('[data-action="start"]').click();
  await page
    .locator(".bottom")
    .filter({ hasText: `v${version}` })
    .waitFor();
  await page.locator('[data-action="help"]').click();
  assert.match(await page.locator("#panel").innerText(), /fence/i);
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="language:de"]').click();
  assert.equal(await page.locator("html").getAttribute("lang"), "de");
  await page.locator('[data-action="language:en"]').click();
  await page.locator('[data-action="tab:inspect"]').click();
  await page.locator('[data-action="gate"]').click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[data-testid="visitors"]').textContent) >
      0,
    undefined,
    { timeout: 35000 },
  );
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="save"]').click();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    `Site check passed: ${url} v${version}; WebGL startup, help, languages, visitors, save/reopen, no page errors.`,
  );
} finally {
  await browser.close();
}
