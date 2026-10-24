// @vitest-environment happy-dom
// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { mount } from "../src/app";
import { advance, createGame, tile } from "../src/game";
import { exportGame, load, save } from "../src/storage";
import { buildings, species } from "../src/catalog";
import { edgeKey } from "../src/world";
const resources: ReturnType<typeof mount>[] = [];
const engines: NullEngine[] = [];
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  for (const a of resources) a.dispose();
  resources.length = 0;
  for (const e of engines) e.dispose();
  engines.length = 0;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(start = true, storage?: Storage, schedule = false) {
  const root = document.createElement("div");
  document.body.append(root);
  const engine = new NullEngine({
    renderWidth: 1200,
    renderHeight: 800,
    textureSize: 512,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  engines.push(engine);
  const app = mount(root, { engine, storage, schedule });
  resources.push(app);
  if (start) app.action("start");
  const click = (action: string) => {
    const el = root.querySelector<HTMLButtonElement>(
      `[data-action="${action}"]`,
    );
    expect(el, action).not.toBeNull();
    el!.click();
  };
  return { root, app, click };
}
describe("playable interface wired to real simulation and renderer", () => {
  test("chooses a starter, guides first actions, delivers food and cleans droppings", () => {
    const { root, app, click } = setup(false);
    app.select({ x: 1, z: 1 });
    app.step(1);
    expect(root.querySelector("[role=dialog]")).toBeTruthy();
    click("starter:goat");
    click("start");
    expect(app.game.animals[0].species).toBe("goat");
    expect(root.querySelector("[role=dialog]")).toBeNull();
    click("findWeed");
    click("care:clear");
    advance(app.game, 6);
    app.step(0);
    expect(app.game.counters.clear).toBe(1);
    app.action("tab:inspect");
    app.select({ x: 0, z: 5 });
    app.action("repairStarter");
    advance(app.game, 4);
    app.step(0);
    app.action("findAnimal");
    expect(root.querySelector(".animal-profile")!.textContent).toContain(
      "goat",
    );
    click("care:feed");
    expect(app.game.keeper.task?.carrying).toBe("greens");
    app.step(0.2);
    advance(app.game, 14);
    app.step(0);
    expect(tile(app.game, app.game.animals[0]).dirt).toBe(1);
    click("care:clean");
    advance(app.game, 2);
    click("care:water");
    advance(app.game, 2);
    click("care:pet");
    advance(app.game, 2);
    app.step(0);
    expect(tile(app.game, app.game.animals[0]).dirt).toBe(0);
    click("gate");
    advance(app.game, 12);
    app.step(0);
    expect(app.game.visitors.length).toBeGreaterThan(0);
    click("gate");
    expect(app.game.open).toBe(false);
  });
  test("constructs all categories, terrain, edges in both orientations and adopts animals", () => {
    const { root, app, click } = setup();
    app.game.coins = 10000;
    app.game.stars = 5;
    click("tab:build");
    for (const category of [
      "objects",
      "paths",
      "shops",
      "playground",
      "habitat",
      "fences",
    ]) {
      click("category:" + category);
      expect(root.querySelectorAll(".catalog-card").length).toBeGreaterThan(0);
    }
    click("category:objects");
    click("tool:build:bench");
    tile(app.game, { x: 2, z: 7 }).object = "";
    app.select({ x: 2, z: 7 });
    expect(tile(app.game, { x: 2, z: 7 }).object).toBe("bench");
    click("category:habitat");
    click("tool:terrain:sand");
    app.select({ x: 3, z: 1 });
    expect(tile(app.game, { x: 3, z: 1 }).terrain).toBe("sand");
    click("category:fences");
    click("tool:fence:fence");
    app.select({ x: 1, z: 1 });
    app.select({ x: 2, z: 1 });
    expect(app.game.fences[edgeKey({ x: 1, z: 1 }, { x: 2, z: 1 })]).toBe(
      "fence",
    );
    app.select({ x: 1, z: 1 });
    app.select({ x: 1, z: 2 });
    expect(app.game.fences[edgeKey({ x: 1, z: 1 }, { x: 1, z: 2 })]).toBe(
      "fence",
    );
    click("tool:fence:removefence");
    app.game.coins = 0;
    app.select({ x: 1, z: 1 });
    app.select({ x: 2, z: 1 });
    expect(
      app.game.fences[edgeKey({ x: 1, z: 1 }, { x: 2, z: 1 })],
    ).toBeUndefined();
    app.game.coins = 10000;
    click("expand");
    expect(app.game.size).toBe(10);
    click("tab:animals");
    click("tool:animal:goat");
    app.select({ x: 4, z: 1 });
    expect(app.game.animals).toHaveLength(2);
    click("tab:inspect");
    app.select({ x: 6, z: 6 });
    app.step(0);
    expect(app.game.keeper.task?.kind).toBe("walk");
    app.select({ x: 4, z: 2 });
    expect(root.querySelector(".animal-profile")).toBeTruthy();
  });
  test("buys food, emergency supplies, staff, goals, book and revealed owned starter", () => {
    const { root, app, click } = setup();
    app.game.coins = 200;
    click("tab:food");
    click("food:greens");
    expect(app.game.inventory.greens).toBe(10);
    app.game.inventory.greens = 0;
    click("emergency");
    expect(app.game.inventory.greens).toBe(2);
    click("tab:staff");
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="hire:keeper"]')!
        .disabled,
    ).toBe(true);
    app.game.stars = 2;
    app.action("tab:staff");
    click("hire:keeper");
    expect(app.game.workers).toHaveLength(1);
    click("tab:goals");
    expect(root.querySelectorAll(".goal")).toHaveLength(10);
    app.game.goals.push("feed");
    app.action("tab:goals");
    expect(root.querySelectorAll(".goal.complete")).toHaveLength(1);
    click("tab:book");
    expect(root.querySelectorAll(".book-entry")).toHaveLength(20);
    app.game.stars = 1;
    app.game.animals[0].species = "raccoon";
    app.action("tab:book");
    const raccoon = [...root.querySelectorAll(".book-entry")][4];
    expect(raccoon.classList.contains("locked")).toBe(false);
  });
  test("actual inputs control tickets and separate sound/music; save and backup round-trip", () => {
    const { root, app, click } = setup();
    const input = (selector: string, value: string) => {
      const el = root.querySelector<HTMLInputElement>(selector)!;
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    input("#ticket", "20");
    expect(app.game.ticket).toBe(20);
    input("#ticket", "1");
    click("settings");
    input('[data-input="sound"]', "0");
    input('[data-input="music"]', "0.4");
    expect(app.game.sound).toBe(0);
    expect(app.game.music).toBe(0.4);
    click("save");
    expect(load(localStorage)?.music).toBe(0.4);
    click("export");
    const backup = root.querySelector<HTMLTextAreaElement>("#save-data")!.value;
    expect(JSON.parse(backup).schema).toBe(1);
    root.querySelector<HTMLTextAreaElement>("#save-data")!.value = "broken";
    click("import");
    expect(app.game.message).toBe("importFailed");
    root.querySelector<HTMLTextAreaElement>("#save-data")!.value = backup;
    click("import");
    expect(app.game.message).toBe("imported");
    root
      .querySelector<HTMLTextAreaElement>("#save-data")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
    root
      .querySelector<HTMLTextAreaElement>("#save-data")!
      .dispatchEvent(new Event("input", { bubbles: true }));
    click("reset");
    click("cancelReset");
    expect(root.querySelector("[role=dialog]")).toBeNull();
    click("reset");
    click("confirmReset");
    expect(root.querySelector("[role=dialog]")).toBeTruthy();
    click("start");
    expect(app.game.animals).toHaveLength(1);
  });
  test("camera, pause, speed, keyboard, context cancellation and autosave", () => {
    const { root, app, click } = setup();
    for (const a of [
      "pause",
      "pause",
      "speed",
      "speed",
      "speed",
      "zoomIn",
      "zoomOut",
      "rotate",
    ])
      click(a);
    click("tab:build");
    click("tool:build:bench");
    const context = new MouseEvent("contextmenu", { cancelable: true });
    root.querySelector("canvas")!.dispatchEvent(context);
    expect(context.defaultPrevented).toBe(true);
    for (const key of ["q", "e", "Escape", "x"])
      root.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    root.querySelector("h1")!.click();
    app.step(11);
    expect(root.querySelector("#save-status")!.textContent).toContain("saved");
    window.dispatchEvent(new Event("resize"));
    expect(app.renderer.scene.meshes.length).toBeGreaterThan(1);
  });
  test("save recovery, unavailable storage, no weeds, rich menus and empty controls remain usable", () => {
    const g = createGame("raccoon");
    save(g, localStorage);
    const { app, root, click } = setup(false);
    expect(root.querySelector("[role=dialog]")).toBeNull();
    app.game.tiles.forEach((t) => {
      if (t.object === "weed") t.object = "";
    });
    app.action("findWeed");
    app.action("care:clean");
    app.game.coins = 10000;
    app.game.stars = 5;
    for (const b of buildings) app.game.counters[b.id] = 1;
    for (const s of species) app.game.animals[0].species = s.id;
    click("tab:book");
    const blocked = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("full");
      },
    } as unknown as Storage;
    const second = setup(true, blocked);
    expect(second.app.persist()).toBe(false);
    second.app.action("unknown");
    expect(exportGame(app.game)).toContain("hippo");
  });
  test("animation scheduling advances, saves and safely stops after disposal", () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        callbacks.push(cb);
        return callbacks.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const root = document.createElement("div");
    document.body.append(root);
    const engine = new NullEngine();
    engines.push(engine);
    const app = mount(root, { engine });
    resources.push(app);
    callbacks.shift()!(performance.now() + 100);
    app.action("start");
    for (let i = 1; i <= 110; i++)
      callbacks.shift()!(performance.now() + i * 100);
    expect(app.game.time).toBeGreaterThan(0);
    window.dispatchEvent(new Event("pagehide"));
    expect(root.querySelector("#save-status")!.textContent).toContain("saved");
    app.dispose();
    callbacks.shift()!(performance.now() + 10000);
    resources.pop();
  });
});

test("autosaves browser state at ten wall-clock seconds and resumes after remount", () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const root = document.createElement("div");
  document.body.append(root);
  const engine = new NullEngine();
  engines.push(engine);
  const app = mount(root, { engine });
  resources.push(app);
  window.dispatchEvent(new Event("pagehide"));
  app.action("start");
  app.game.coins = 17;
  vi.advanceTimersByTime(9999);
  expect(load(localStorage)?.coins).toBe(0);
  vi.advanceTimersByTime(1);
  expect(load(localStorage)?.coins).toBe(17);
  app.dispose();
  resources.pop();
  root.remove();
  const reopened = setup(false);
  expect(reopened.app.game.coins).toBe(17);
  expect(reopened.root.querySelector("[role=dialog]")).toBeNull();
  vi.useRealTimers();
});

test("refreshes care status and unlocks without destroying settings backup text", () => {
  const { app, root, click } = setup();
  click("findAnimal");
  click("care:feed");
  expect(root.querySelector(".keeper-card small")!.textContent).not.toContain(
    "Ready",
  );
  advance(app.game, 5);
  app.step(0);
  expect(root.querySelector(".keeper-card small")!.textContent).toContain(
    "Ready",
  );
  app.action("tab:animals");
  expect(
    root.querySelector<HTMLButtonElement>(
      '[data-action="tool:animal:giraffe"]',
    )!.disabled,
  ).toBe(true);
  app.game.stars = 5;
  app.step(0);
  expect(
    root.querySelector<HTMLButtonElement>(
      '[data-action="tool:animal:giraffe"]',
    )!.disabled,
  ).toBe(false);
  click("settings");
  root.querySelector<HTMLTextAreaElement>("#save-data")!.value = "my backup";
  app.game.stars = 4;
  app.step(0);
  expect(root.querySelector<HTMLTextAreaElement>("#save-data")!.value).toBe(
    "my backup",
  );
});
