// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "@playwright/test";
test("a child can choose an animal, deliver food, clean up, open the zoo and save", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator('[data-action="starter:goat"]').click();
  await page.locator('[data-action="start"]').click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator('[data-action="findAnimal"]').click();
  await expect(page.locator(".animal-profile")).toContainText("goat");
  await page.locator('[data-action="care:feed"]').click();
  await expect(page.locator("#keeper-status")).toContainText(/food/i);
  await expect(page.locator("#keeper-status")).toContainText("Ready", {
    timeout: 12000,
  });
  await page.locator('[data-action="gate"]').click();
  await expect(page.getByTestId("visitors")).not.toHaveText("0", {
    timeout: 15000,
  });
  await page.locator('[data-action="tab:goals"]').click();
  await expect(page.locator(".goal.complete")).not.toHaveCount(0);
  await page.locator('[data-action="tab:inspect"]').click();
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem("dercoolezoo.save.v1");
      if (!raw) return false;
      const state = JSON.parse(raw);
      const animal = state.animals[0];
      return state.tiles[animal.z * state.size + animal.x].dirt > 0;
    },
    { timeout: 30000 },
  );
  await page.locator('[data-action="care:clean"]').click();
  await expect(page.locator("#keeper-status")).toContainText("Ready", {
    timeout: 12000,
  });
  await page.locator('[data-action="tab:food"]').click();
  await page.locator('[data-action="food:greens"]').click();
  await expect(page.getByRole("status")).toContainText(/food/i);
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="save"]').click();
  await expect(page.locator("#save-status")).toContainText(/saved/i);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dercoolezoo.save.v1")!),
  );
  expect(saved.open).toBe(true);
  expect(
    saved.tiles[saved.animals[0].z * saved.size + saved.animals[0].x].dirt,
  ).toBe(0);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator('[data-action="findAnimal"]').click();
  await expect(page.locator(".animal-profile")).toContainText("goat");
  if (
    testInfo.project.name === "chromium" &&
    process.env.CAPTURE_SCREENSHOT === "1"
  )
    await page.screenshot({ path: "docs/screenshot.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("settings, backup recovery, camera and construction menus work", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="start"]').click();
  for (const action of [
    "zoomIn",
    "zoomOut",
    "rotate",
    "pause",
    "pause",
    "speed",
    "speed",
    "speed",
  ])
    await page.locator(`[data-action="${action}"]`).click();
  await page.locator('[data-action="tab:build"]').click();
  for (const category of [
    "paths",
    "shops",
    "playground",
    "habitat",
    "fences",
    "objects",
  ]) {
    await page.locator(`[data-action="category:${category}"]`).click();
    await expect(page.locator(".catalog-card").first()).toBeVisible();
  }
  await page.locator('[data-action="tab:book"]').click();
  await expect(page.locator(".book-entry").first()).toContainText("Rabbit");
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="export"]').click();
  const backup = await page
    .getByRole("textbox", { name: "Save data" })
    .inputValue();
  expect(JSON.parse(backup).animals).toHaveLength(1);
  await page.getByRole("textbox", { name: "Save data" }).fill("broken");
  await page.locator('[data-action="import"]').click();
  await expect(page.getByRole("status")).toContainText("save");
  await page.getByRole("textbox", { name: "Save data" }).fill(backup);
  await page.locator('[data-action="import"]').click();
  await page.locator('[data-action="reset"]').click();
  await page.locator('[data-action="cancelReset"]').click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
