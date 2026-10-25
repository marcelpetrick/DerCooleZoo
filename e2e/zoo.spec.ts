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

// The fixed orthographic camera projects tile centres into the actual canvas.
// This drives real pointer picking without exposing a test-only application API.
async function clickWorldTile(
  page: import("@playwright/test").Page,
  x: number,
  z: number,
) {
  const canvas = await page.locator("#world").boundingBox();
  if (!canvas) throw new Error("The zoo canvas is unavailable");
  const pixels = canvas.height / 12.8;
  await page.mouse.click(
    canvas.x + canvas.width / 2 + ((x + z - 9) / Math.SQRT2) * pixels,
    canvas.y +
      canvas.height / 2 +
      ((x - z) / Math.sqrt(6) - 0.06 * Math.sqrt(2 / 3)) * pixels,
  );
}

test("grow the zoo by fencing a new enclosure, adding a gate and adopting a second animal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="export"]').click();
  const setup = JSON.parse(
    await page.getByRole("textbox", { name: "Save data" }).inputValue(),
  );
  // Start from a prepared clearing and earned budget; every construction action
  // below still uses the public build tools and real world-tile pointer picking.
  setup.coins = 300;
  setup.paused = true;
  setup.tiles[6 * setup.size + 2].object = "";
  for (let z = 0; z <= 6; z++) {
    for (let x = 6; x <= 10; x++) {
      const cell = setup.tiles[z * setup.size + x];
      if (!["path", "entrance"].includes(cell.object)) cell.object = "";
    }
  }
  await page
    .getByRole("textbox", { name: "Save data" })
    .fill(JSON.stringify(setup));
  await page.locator('[data-action="import"]').click();
  await page.locator('[data-action="tab:build"]').click();
  await page.locator('[data-action="category:fences"]').click();
  await page.locator('[data-action="tool:fence:fence"]').click();
  let coins = 300;
  const placeEdge = async (ax: number, az: number, bx: number, bz: number) => {
    await clickWorldTile(page, ax, az);
    await expect(page.getByRole("status")).toContainText(/neighbor/i);
    await clickWorldTile(page, bx, bz);
    await expect(page.getByTestId("coins")).toHaveText(String(--coins));
  };
  for (let x = 7; x <= 9; x++) {
    await placeEdge(x, 1, x, 0);
    await placeEdge(x, 3, x, 4);
  }
  for (let z = 1; z <= 3; z++) {
    await placeEdge(7, z, 6, z);
    await placeEdge(9, z, 10, z);
  }
  await page.locator('[data-action="tool:fence:gate"]').click();
  await placeEdge(8, 3, 8, 4);
  await page.locator('[data-action="tab:animals"]').click();
  await page.locator('[data-action="tool:animal:goat"]').click();
  await clickWorldTile(page, 8, 2);
  await expect(page.getByRole("status")).toContainText(/arriv/i);
  await page.locator('[data-action="tab:build"]').click();
  await page.locator('[data-action="category:objects"]').click();
  await page.locator('[data-action="tool:build:feeder"]').click();
  await clickWorldTile(page, 7, 2);
  await page.locator('[data-action="tool:build:trough"]').click();
  await clickWorldTile(page, 9, 2);
  await page.locator('[data-action="tool:build:bench"]').click();
  await clickWorldTile(page, 8, 5);
  await page.locator('[data-action="category:paths"]').click();
  await page.locator('[data-action="tool:build:path"]').click();
  await clickWorldTile(page, 8, 4);
  await page.locator('[data-action="category:shops"]').click();
  await page.locator('[data-action="tool:build:popcorn"]').click();
  await clickWorldTile(page, 9, 4);
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="save"]').click();
  const built = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dercoolezoo.save.v1")!),
  );
  expect(built.animals).toHaveLength(2);
  expect(built.animals[1]).toMatchObject({ species: "goat", x: 8, z: 2 });
  for (const [x, z, object] of [
    [7, 2, "feeder"],
    [9, 2, "trough"],
    [8, 5, "bench"],
    [8, 4, "path"],
    [9, 4, "popcorn"],
  ] as const) {
    expect(built.tiles[z * built.size + x].object).toBe(object);
  }
  expect(built.fences["8,3|8,4"]).toBe("gate");
  expect(built.coins).toBeLessThan(300);
  await page.locator('[data-action="tab:inspect"]').click();
  await clickWorldTile(page, 2, 6);
  await page.locator('[data-action="care:plant"]').click();
  await expect(page.locator("#keeper-status")).toContainText(/plant/i);
  await page.locator('[data-action="pause"]').click();
  await expect(page.locator("#keeper-status")).toContainText("Ready", {
    timeout: 15000,
  });
  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="save"]').click();
  const planted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dercoolezoo.save.v1")!),
  );
  expect(planted.tiles[6 * planted.size + 2].object).toBe("flowers");
  expect(planted.counters.plant).toBe(1);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
