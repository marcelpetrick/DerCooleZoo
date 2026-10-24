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
  await page.mouse.click(735, 389);
  await expect(page.locator(".selection, .animal-profile")).toBeVisible();
  await expect(page.locator("#keeper-status")).toContainText("Ready", {
    timeout: 35000,
  });
  await page.locator('[data-action="tab:inspect"]').click();
  await page.locator('[data-action="findAnimal"]').first().click();
  await expect(page.locator(".animal-profile")).toContainText("goat");
  await page.locator('[data-action="care:feed"]').click();
  await expect(page.locator("#keeper-status")).toContainText(/food/i);
  await expect(page.locator("#keeper-status")).toContainText("Ready", {
    timeout: 12000,
  });
  await page.locator('[data-action="gate"]').click();
  await expect(page.getByTestId("visitors")).not.toHaveText("0", {
    timeout: 35000,
  });
  await page.locator('[data-action="tab:goals"]').click();
  await expect(page.locator(".goal.complete")).not.toHaveCount(0);
  await page.locator('[data-action="tab:inspect"]').click();
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem("dercoolezoo.save.v1");
      if (!raw) return false;
      const state = JSON.parse(raw);
      return state.tiles.some((tile: { dirt: number }) => tile.dirt > 0);
    },
    undefined,
    { timeout: 30000 },
  );
  await page.locator('[data-action="findDirt"]').click();
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
  expect(saved.counters.clean).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator('[data-action="findAnimal"]').click();
  await expect(page.locator(".animal-profile")).toContainText("goat");
  if (
    testInfo.project.name === "chromium" &&
    process.env.CAPTURE_SCREENSHOT === "1"
  )
    await page.screenshot({ path: "docs/screenshot.png", fullPage: true });
  await page.locator('[data-action="gate"]').click();
  await expect(page.getByTestId("visitors")).toHaveText("0", {
    timeout: 15000,
  });
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

test("language switches immediately and autosaves across reopening", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="language:de"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="settings"]').click();
  await expect(page.locator('[data-action="save"]')).toContainText("Speichern");
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem("dercoolezoo.save.v1");
      return raw !== null && JSON.parse(raw).language === "de";
    },
    undefined,
    { timeout: 15000 },
  );
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="language:en"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('[data-action="save"]')).toContainText("Save");
  await page.locator('[data-action="tab:book"]').click();
  await expect(page.locator(".book-entry").first()).toContainText("Rabbit");
});

test("short help explains booths and making an enclosure in either language", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="help"]').click();
  await expect(page.locator("#panel")).toContainText(/booth|stall/i);
  await expect(page.locator("#panel")).toContainText(/fence/i);
  await expect(page.locator("#panel")).toContainText(/gate/i);
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="language:de"]').click();
  await page.locator('[data-action="help"]').click();
  await expect(page.locator("#panel")).toContainText(/Zaun|Zäune/);
  await expect(page.locator("#panel")).toContainText(/Tor/);
});

test("a hungry animal eats real feeder stock after the keeper delivers a refill", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="starter:raccoon"]').click();
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="export"]').click();
  const backup = JSON.parse(
    await page.getByRole("textbox", { name: "Save data" }).inputValue(),
  );
  backup.animals[0].hunger = 20;
  backup.animals[0].water = 20;
  for (const key of Object.keys(backup.counters)) {
    if (/^(feeder|water)/.test(key)) delete backup.counters[key];
  }
  await page
    .getByRole("textbox", { name: "Save data" })
    .fill(JSON.stringify(backup));
  await page.locator('[data-action="import"]').click();
  await page.locator('[data-action="tab:inspect"]').click();
  await page.locator('[data-action="findAnimal"]').first().click();
  await expect(page.locator("#panel")).toContainText(/fruit/i);
  await page.locator('[data-action="findFeeder"]').first().click();
  await page.locator('[data-action="care:refill"]').click();
  await expect(page.locator("#keeper-status")).toContainText(/refill|food/i);
  await expect(page.locator("#keeper-status")).toContainText("Ready", {
    timeout: 15000,
  });
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="save"]').click();
  const fed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dercoolezoo.save.v1")!),
  );
  expect(fed.animals[0].hunger).toBeGreaterThan(85);
  expect(fed.inventory.fruit).toBe(backup.inventory.fruit - 1);
  expect(fed.counters.refill).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the tutorial explains growth tasks and songs can be skipped and saved", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-action="start"]').click();
  const task = page.locator("#next-task");
  await expect(task).toBeVisible();
  await expect(task).toContainText(/Next task/i);
  await expect(task).toHaveAttribute("title", /1\./);
  await task.hover();
  await task.click();
  const goal = page.locator(".goal").first();
  await expect(goal).toHaveAttribute("aria-description", /1\./);
  await goal.locator("summary").click();
  await expect(goal.locator("details")).toHaveAttribute("open", "");
  await page.locator('[data-action="settings"]').click();
  await expect(page.locator(".song-picker")).toContainText("1 / 5");
  await page.locator('[data-action="nextSong"]').click();
  await expect(page.locator(".song-picker")).toContainText("2 / 5");
  await expect(page.locator('[data-action="nextSong"]')).toHaveAttribute(
    "title",
    /skip/i,
  );
  await page.locator('[data-action="save"]').click();
  await page.reload();
  await page.locator('[data-action="settings"]').click();
  await expect(page.locator(".song-picker")).toContainText("2 / 5");
});
