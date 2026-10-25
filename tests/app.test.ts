// @vitest-environment happy-dom
// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { mount } from "../src/app";
import { advance, createGame, expand, startEvent, tile } from "../src/game";
import * as zooAudio from "../src/audio";
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
    advance(app.game, 12);
    app.step(0);
    expect(app.game.counters.clear).toBe(1);
    app.action("tab:inspect");
    app.select({ x: 0, z: 5 });
    app.action("repairStarter");
    advance(app.game, 10);
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
    expect(app.game.tiles.reduce((sum, cell) => sum + cell.dirt, 0)).toBe(1);
    click("findDirt");
    click("care:clean");
    advance(app.game, 8);
    click("findAnimal");
    click("care:water");
    advance(app.game, 8);
    click("findAnimal");
    click("care:pet");
    advance(app.game, 2);
    app.step(0);
    expect(app.game.tiles.every((cell) => cell.dirt === 0)).toBe(true);
    click("gate");
    advance(app.game, 20);
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
    expect(app.game.size).toBe(14);
    click("tab:animals");
    click("tool:animal:goat");
    app.select({ x: 4, z: 1 });
    expect(app.game.animals).toHaveLength(2);
    click("tab:inspect");
    tile(app.game, { x: 6, z: 6 }).object = "";
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
    expect(app.game.inventory.greens).toBe(11);
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
    expect(root.querySelector(".catalog-card small")!.textContent).toContain(
      "per minute",
    );
    click("tab:goals");
    expect(root.querySelectorAll(".goal")).toHaveLength(10);
    app.game.goals.push("feed");
    app.action("tab:goals");
    expect(root.querySelectorAll(".goal.complete")).toHaveLength(1);
    click("tab:book");
    expect(root.querySelectorAll(".book-entry")).toHaveLength(20);
    expect(root.querySelectorAll(".animal-silhouette").length).toBeGreaterThan(
      0,
    );
    expect(
      root.querySelector(".book-entry.locked .mystery-mark")!.textContent,
    ).toBe("?");
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
    expect(root.querySelector("#ticket-price")!.textContent).toContain("20");
    expect(root.querySelector("#ticket-feedback")!.textContent).toContain(
      "Too expensive",
    );
    input("#ticket", "1");
    expect(root.querySelector("#ticket-price")!.textContent).toContain("1");
    expect(root.querySelector("#ticket-feedback")!.textContent).toContain(
      "Just right",
    );
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
  expect(root.querySelector("#keeper-status")!.textContent).not.toContain(
    "Ready",
  );
  advance(app.game, 5);
  app.step(0);
  expect(root.querySelector("#keeper-status")!.textContent).toContain("Ready");
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

test("switches the whole live zoo to German, preserves state and backup text, and resumes the language", () => {
  const { app, root, click } = setup();
  app.game.coins = 42;
  app.game.animals[0].name = "keks";
  click("settings");
  const canvas = root.querySelector("canvas");
  root.querySelector<HTMLTextAreaElement>("#save-data")!.value =
    "my unsaved backup";
  click("language:de");
  expect(document.documentElement.lang).toBe("de");
  expect(document.title).toBe("Der coole Zoo");
  expect(root.querySelector("canvas")).toBe(canvas);
  expect(root.querySelector("canvas")!.getAttribute("aria-label")).toContain(
    "Zoowärter",
  );
  expect(root.querySelector<HTMLTextAreaElement>("#save-data")!.value).toBe(
    "my unsaved backup",
  );
  expect(
    root.querySelector('[data-input="sound"]')!.getAttribute("aria-label"),
  ).toBe("Geräusche");
  expect(
    root
      .querySelector('[data-action="language:de"]')!
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(root.querySelector("#save-status")!.textContent).toContain(
    "gespeichert",
  );
  expect(load(localStorage)?.language).toBe("de");
  expect(app.game.coins).toBe(42);
  click("tab:inspect");
  click("findAnimal");
  expect(root.querySelector(".animal-profile")!.textContent).toContain("Keks");
  expect(root.querySelector(".animal-profile")!.textContent).toContain(
    "Kaninchen",
  );
  click("pause");
  expect(
    root.querySelector('[data-action="pause"]')!.getAttribute("aria-label"),
  ).toBe("Weiter");
  for (const tab of ["build", "animals", "food", "staff", "goals", "book"]) {
    click("tab:" + tab);
    expect(root.querySelector("#panel")!.textContent).not.toMatch(
      /(?:ui|fact|building|animal|bonus)\./,
    );
  }
  expect(root.querySelector(".book-entry")!.textContent).toContain(
    "Kaninchen fressen Pflanzen.",
  );
  const resumed = setup(false);
  expect(resumed.app.game.language).toBe("de");
  expect(resumed.root.querySelector("#stats")!.textContent).toContain("Münzen");
  resumed.app.action("settings");
  resumed.click("language:en");
  expect(document.documentElement.lang).toBe("en");
  expect(resumed.root.querySelector("#stats")!.textContent).toContain("Coins");
});

test("starter language preference survives reopening and new zoos without prematurely saving a zoo", () => {
  const { root, app, click } = setup(false);
  click("language:de");
  expect(root.querySelector("[role=dialog]")!.getAttribute("aria-label")).toBe(
    "Wer zieht zuerst ein?",
  );
  expect(load(localStorage)).toBeNull();
  const reopened = setup(false);
  expect(reopened.app.game.language).toBe("de");
  reopened.click("starter:raccoon");
  reopened.click("start");
  expect(reopened.app.game.language).toBe("de");
  expect(reopened.app.game.animals[0].species).toBe("raccoon");
  reopened.click("settings");
  reopened.click("reset");
  expect(
    reopened.root.querySelector("[role=dialog]")!.getAttribute("aria-label"),
  ).toBe("Neuer Zoo");
  reopened.click("confirmReset");
  reopened.click("start");
  expect(reopened.app.game.language).toBe("de");
  app.action("language:invalid");
});

test("language controls remain usable with unavailable storage and imports translate static chrome", () => {
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  } as unknown as Storage;
  const { app, root, click } = setup(false, blocked);
  click("language:de");
  click("start");
  click("settings");
  click("language:en");
  expect(root.querySelector("#save-status")!.textContent).toContain(
    "Could not save",
  );
  const imported = createGame();
  imported.language = "de";
  root.querySelector<HTMLTextAreaElement>("#save-data")!.value =
    exportGame(imported);
  click("import");
  expect(app.game.language).toBe("de");
  expect(root.querySelector(".brand")!.textContent).toContain("Der coole Zoo");
  expect(
    root.querySelector('[data-action="zoomIn"]')!.getAttribute("aria-label"),
  ).toBe("Näher");
});

test("ticket price faces communicate cheap, fair, high and excessive prices", () => {
  const { root, app } = setup();
  app.game.ticket = 0;
  app.action("tab:inspect");
  expect(root.querySelector(".ticket p")!.textContent).toContain("Cheap");
  app.game.ticket = 1;
  app.action("tab:inspect");
  expect(root.querySelector(".ticket p")!.textContent).toContain("Just right");
  app.game.ticket = 1.5;
  app.action("tab:inspect");
  expect(root.querySelector(".ticket p")!.textContent).toContain("pricey");
  app.game.ticket = 20;
  app.action("tab:inspect");
  expect(root.querySelector(".ticket p")!.textContent).toContain(
    "Too expensive",
  );
});

test("discoverable help explains booths, connected paths, fence edges, gates, care and backups in both languages", () => {
  const { app, root, click } = setup();
  click("help");
  expect(root.querySelectorAll(".help-topic")).toHaveLength(6);
  const instructions = root.querySelector("#panel")!.textContent!;
  for (const phrase of [
    "buy automatically",
    "connected path",
    "two neighbouring tiles",
    "shared edge",
    "Gate",
    "keeper walks",
    "10 seconds",
    "copy a backup",
  ])
    expect(instructions).toContain(phrase);
  click("settings");
  click("language:de");
  click("tab:help");
  const german = root.querySelector("#panel")!.textContent!;
  for (const phrase of [
    "Stände",
    "Zäune",
    "Tor",
    "benachbarten Feldern",
    "von selbst",
    "10 Sekunden",
  ])
    expect(german).toContain(phrase);
  expect(
    root.querySelector('[data-action="help"]')!.getAttribute("aria-label"),
  ).toBe("So spielst du");
  expect(app.game.language).toBe("de");
});

test("keeps an animal selected after it moves and sends care to its current tile", () => {
  const { app, root, click } = setup();
  click("findAnimal");
  const animal = app.game.animals[0];
  const old = { x: animal.x, z: animal.z };
  animal.x = 3;
  animal.z = 2;
  app.step(0);
  expect(root.querySelector(".animal-profile")!.textContent).toContain(
    "Rabbit",
  );
  click("care:feed");
  expect(app.game.keeper.task?.animal).toBe(animal.id);
  expect(app.game.keeper.task?.target).toEqual({ x: 3, z: 2 });
  expect(app.game.keeper.task?.target).not.toEqual(old);
});

test("finds reachable waste or litter and gracefully handles a clean zoo", () => {
  const { app, root, click } = setup();
  click("findDirt");
  expect(root.querySelector(".intro-steps")).toBeTruthy();
  tile(app.game, { x: 2, z: 4 }).dirt = 1;
  click("findAnimal");
  click("findDirt");
  expect(root.querySelector(".animal-profile")).toBeNull();
  click("care:clean");
  expect(app.game.keeper.task?.target).toEqual({ x: 2, z: 4 });
  advance(app.game, 10);
  app.step(0);
  expect(tile(app.game, { x: 2, z: 4 }).dirt).toBe(0);
  tile(app.game, { x: 2, z: 4 }).object = "litter";
  click("findDirt");
  click("care:clean");
  advance(app.game, 10);
  expect(tile(app.game, { x: 2, z: 4 }).object).toBe("");
});

test("simulation celebrations play once and child laughter is throttled", () => {
  const emitted: string[] = [];
  let lastCue = "";
  const update = vi.fn((_sound: number, _music: number, event: string) => {
    if (event !== lastCue) emitted.push(event);
    lastCue = event;
  });
  vi.spyOn(zooAudio, "createAudio").mockReturnValue({
    unlock: vi.fn(),
    update,
    dispose: vi.fn(),
  });
  const { app } = setup();
  const played = () => emitted.map((event) => event.split(":")[0]);
  emitted.length = 0;
  app.game.goals.push("feed");
  app.game.counters.adopted = 1;
  app.game.coins = 200;
  expand(app.game);
  app.game.stars = 2;
  startEvent(app.game, "birthday");
  app.game.event = "coin";
  app.step(0);
  for (const cue of ["goal", "arrival", "expansion", "unlock", "birthday"])
    expect(played()).toContain(cue);
  emitted.length = 0;
  app.step(0);
  expect(
    played().filter((cue) =>
      ["goal", "arrival", "expansion", "unlock", "birthday"].includes(cue),
    ),
  ).toHaveLength(0);
  app.game.time = 20;
  app.game.visitors.push({
    x: 0,
    z: 4,
    id: 999,
    type: "child",
    family: 999,
    happiness: 80,
    hunger: 80,
    energy: 80,
    fun: 80,
    age: 0,
    duration: 50,
    route: [],
    activity: "jump",
  });
  emitted.length = 0;
  app.step(0);
  expect(played().filter((cue) => cue === "laugh")).toHaveLength(1);
  app.game.time += 5;
  app.step(0);
  expect(played().filter((cue) => cue === "laugh")).toHaveLength(1);
  app.game.time += 5;
  app.step(0);
  expect(played().filter((cue) => cue === "laugh")).toHaveLength(2);
  app.game.time = 0;
  app.game.counters.eventStarted = 100;
  app.game.counters.eventIndex!++;
  app.step(0);
  expect(played().filter((cue) => cue === "birthday")).toHaveLength(0);
});

test("hungry raccoon hints name fruit, guide buying and delivery, and expose feeder and trough controls", () => {
  const { app, root, click } = setup(false);
  click("starter:raccoon");
  click("start");
  const animal = app.game.animals[0];
  animal.hunger = 25;
  animal.water = 25;
  app.game.inventory.fruit = 0;
  click("findAnimal");
  expect(root.querySelector(".care-hint")!.textContent).toContain("Fruit");
  expect(root.querySelector(".care-hint")!.textContent).toContain(
    "First get food",
  );
  expect(root.querySelector(".care-hint")!.textContent).toContain("Thirsty");
  expect(root.querySelector('[data-action="food:fruit"]')).toBeTruthy();
  click("emergency");
  expect(
    root.querySelector('[data-action="care:feed"]')!.textContent,
  ).toContain("🍎");
  expect(
    root.querySelector('[data-action="care:feed"]')!.getAttribute("title"),
  ).toContain("keeper");
  click("findFeeder");
  expect(root.querySelector(".care-hint")!.textContent).toContain(
    "Stored portions",
  );
  expect(root.querySelector('[data-action="care:refill"]')).toBeTruthy();
  click("care:refill");
  expect(app.game.keeper.task?.kind).toBe("refill");
  advance(app.game, 10);
  app.step(0);
  click("findWater");
  expect(root.querySelector('[data-action="care:refillWater"]')).toBeTruthy();
  click("care:refillWater");
  expect(app.game.keeper.task?.kind).toBe("refillWater");
  advance(app.game, 10);
  app.step(0);
  click("findAnimal");
  click("refillAnimal");
  expect(app.game.keeper.task?.kind).toBe("refill");
  click("help");
  expect(root.querySelectorAll("details")).toHaveLength(6);
  const details = root.querySelector("details")!;
  expect(details.open).toBe(false);
  details.querySelector("summary")!.click();
  expect(details.open).toBe(true);
  expect(details.textContent).toContain("Refill feeder");
});

test("all UI actions expose informative localized tooltips including catalog effects and food", () => {
  const { app, root, click } = setup();
  const checkButtons = () => {
    for (const button of root.querySelectorAll<HTMLElement>("[data-action]")) {
      expect(button.title, button.dataset.action).toHaveLength(
        button.title.length,
      );
      expect(button.title.length, button.dataset.action).toBeGreaterThan(20);
      expect(button.title, button.dataset.action).not.toMatch(
        /\b(?:tip|ui|steps)\./,
      );
      expect(
        button.getAttribute("aria-description"),
        button.dataset.action,
      ).toBe(button.title);
    }
  };
  for (const language of ["en", "de"]) {
    app.action("language:" + language);
    for (const tab of [
      "inspect",
      "build",
      "animals",
      "food",
      "staff",
      "goals",
      "book",
      "settings",
      "help",
    ]) {
      app.action("tab:" + tab);
      checkButtons();
      if (tab === "build") {
        for (const category of [
          "objects",
          "paths",
          "shops",
          "playground",
          "habitat",
          "fences",
        ]) {
          click("category:" + category);
          checkButtons();
        }
      }
    }
  }
  app.action("language:en");
  app.action("tab:inspect");
  click("findAnimal");
  expect(
    root.querySelector('[data-action="care:feed"]')!.getAttribute("title"),
  ).toContain("Greens");
  expect(
    root.querySelector('[data-action="care:feed"]')!.getAttribute("title"),
  ).toContain("delivery");
});

test("visible next task and expandable goals give detailed steps as progress advances", () => {
  const { app, root, click } = setup();
  expect(root.querySelector("#next-task")!.textContent).toContain("0/10");
  expect(root.querySelector("#next-task")!.textContent).toContain(
    "Clear some weeds",
  );
  expect(root.querySelector("#next-task")!.getAttribute("title")).toContain(
    "1.",
  );
  click("goals");
  expect(root.querySelectorAll(".goal details")).toHaveLength(10);
  for (const goal of root.querySelectorAll<HTMLElement>(".goal")) {
    expect(goal.title).toContain("1.");
    expect(goal.getAttribute("aria-description")).toBe(goal.title);
  }
  app.game.goals.push("clear");
  app.step(0);
  expect(root.querySelector("#next-task")!.textContent).toContain(
    "Repair the fence",
  );
  app.action("language:de");
  expect(root.querySelector("#next-task")!.textContent).toContain(
    "Nächste Aufgabe",
  );
  app.game.goals = [
    "clear",
    "repair",
    "feed",
    "open",
    "bench",
    "happy",
    "donations",
    "popcorn",
    "secondAnimal",
    "stars",
  ];
  app.step(0);
  expect(root.querySelector("#next-task")!.textContent).toContain(
    "Alle Aufgaben geschafft",
  );
});

test("next song immediately cycles through five tracks and preserves selection on other actions and reopen", () => {
  const update = vi.fn();
  vi.spyOn(zooAudio, "createAudio").mockReturnValue({
    unlock: vi.fn(),
    update,
    dispose: vi.fn(),
  });
  const { app, root, click } = setup();
  click("settings");
  click("nextSong");
  expect(app.game.counters.musicTrack).toBe(1);
  expect(root.querySelector(".song-picker")!.textContent).toContain("2 / 5");
  expect(update.mock.calls.at(-1)?.[3]).toBe(1);
  click("save");
  expect(update.mock.calls.at(-1)?.[3]).toBe(1);
  expect(load(localStorage)?.counters.musicTrack).toBe(1);
  for (let i = 0; i < 4; i++) click("nextSong");
  expect(app.game.counters.musicTrack).toBe(0);
  expect(root.querySelector(".song-picker")!.textContent).toContain("1 / 5");
});

test("care hints update when thirst crosses its threshold and animals consume feeder stock", () => {
  const { app, root, click } = setup();
  app.game.animals[0].water = 71;
  app.game.counters["feeder3z2.greens"] = 3;
  click("findAnimal");
  expect(root.querySelector(".care-hint")!.textContent).not.toContain(
    "Thirsty",
  );
  expect(
    root.querySelector('[data-action="refillAnimal"]')!.textContent,
  ).toContain("3");
  app.game.animals[0].water = 69;
  app.game.counters["feeder3z2.greens"] = 2;
  app.step(0);
  expect(root.querySelector(".care-hint")!.textContent).toContain("Thirsty");
  expect(
    root.querySelector('[data-action="refillAnimal"]')!.textContent,
  ).toContain("2");
  app.game.animals[0].water = 90;
  app.step(0);
  expect(root.querySelector(".care-hint")!.textContent).not.toContain(
    "Thirsty",
  );
});

test("open tutorial details survive completed goals and background work updates", () => {
  const { app, root, click } = setup();
  click("goals");
  const first = root.querySelector<HTMLDetailsElement>(
    '[data-help="goal:clear"]',
  )!;
  first.open = true;
  app.game.goals.push("clear");
  app.step(0);
  expect(root.querySelector(".goal")!.classList.contains("complete")).toBe(
    true,
  );
  expect(
    root.querySelector<HTMLDetailsElement>('[data-help="goal:clear"]')!.open,
  ).toBe(true);
  click("help");
  root.querySelector<HTMLDetailsElement>('[data-help="help:care"]')!.open =
    true;
  app.game.keeper.task = {
    kind: "walk",
    target: { x: 2, z: 4 },
    route: [],
    animal: 0,
    progress: 0,
    carrying: "",
  };
  app.step(0);
  expect(
    root.querySelector<HTMLDetailsElement>('[data-help="help:care"]')!.open,
  ).toBe(true);
});

test("save data survives settings actions and unrelated controls", () => {
  const { root, click } = setup();
  click("settings");
  const backup = '{"my":"backup text to copy"}';
  root.querySelector<HTMLTextAreaElement>("#save-data")!.value = backup;
  for (const action of [
    "save",
    "nextSong",
    "pause",
    "speed",
    "language:de",
    "language:en",
  ]) {
    click(action);
    expect(
      root.querySelector<HTMLTextAreaElement>("#save-data")!.value,
      action,
    ).toBe(backup);
  }
});

test("friendly event announcements remain visible while tickets and donations arrive", () => {
  const { app, root } = setup();
  startEvent(app.game, "birthday");
  app.game.event = "coin";
  app.step(0);
  expect(root.querySelector("#zoo-event")!.textContent).toContain("birthday");
  app.game.time += 21;
  app.step(0);
  expect(root.querySelector("#zoo-event")!.textContent).toContain("coin");
});

test("earned coins fly to the actual counter and animations clean up on expiry and disposal", () => {
  vi.useFakeTimers();
  const { app, root } = setup();
  vi.spyOn(
    root.querySelector("canvas")!,
    "getBoundingClientRect",
  ).mockReturnValue({ left: 400, top: 0, width: 800, height: 600 } as DOMRect);
  vi.spyOn(
    root.querySelector('[data-testid="coins"]')!,
    "getBoundingClientRect",
  ).mockReturnValue({ left: 420, top: 30, width: 40, height: 20 } as DOMRect);
  app.game.income.tickets = 1;
  app.step(0);
  const flight = root.querySelector<HTMLElement>(".income-flight")!;
  expect(flight.style.getPropertyValue("--coin-to-x")).toBe("440px");
  expect(flight.style.getPropertyValue("--coin-to-y")).toBe("40px");
  expect(flight.style.getPropertyValue("--coin-from-x")).toBe("840px");
  app.game.income.tickets = 2;
  app.step(0);
  expect(flight.isConnected).toBe(false);
  expect(root.querySelectorAll(".income-flight")).toHaveLength(1);
  vi.advanceTimersByTime(700);
  expect(root.querySelector(".income-flight")).toBeNull();
  app.game.income.tickets = 0;
  app.step(0);
  expect(root.querySelector(".income-flight")).toBeNull();
  app.game.income.tickets = 1;
  app.step(0);
  expect(root.querySelector(".income-flight")).toBeTruthy();
  app.dispose();
  resources.pop();
  expect(root.querySelector(".income-flight")).toBeNull();
  vi.advanceTimersByTime(700);
  vi.useRealTimers();
});

test("repair targets the damaged rail and empty care actions are not offered", () => {
  const { app, root } = setup();
  tile(app.game, { x: 2, z: 7 }).object = "bench";
  app.select({ x: 2, z: 7 });
  for (const action of ["care:clear", "care:clean", "care:repair"])
    expect(root.querySelector(`[data-action="${action}"]`)).toBeNull();
  app.action("repairStarter");
  expect(app.game.keeper.task?.target).toEqual({ x: 3, z: 3 });
  advance(app.game, 12);
  app.step(0);
  expect(app.game.counters.repaired).toBe(1);
  app.select({ x: 3, z: 3 });
  expect(root.querySelector('[data-action="care:repair"]')).toBeNull();
  app.action("repairStarter");
  expect(app.game.keeper.task?.kind).not.toBe("repair");
});

test("animal cleaning follows enclosure waste after the animal has walked away", () => {
  const { app, root, click } = setup();
  app.game.counters["feeder3z2.greens"] = 0;
  app.game.animals[0].hunger = 100;
  app.game.animals[0].x = 3;
  app.game.animals[0].z = 1;
  click("findAnimal");
  expect(
    root.querySelector<HTMLButtonElement>('[data-action="care:clean"]')!
      .disabled,
  ).toBe(true);
  tile(app.game, { x: 4, z: 2 }).dirt = 1;
  app.step(0);
  expect(
    root.querySelector<HTMLButtonElement>('[data-action="care:clean"]')!
      .disabled,
  ).toBe(false);
  click("care:clean");
  expect(app.game.keeper.task?.target).toEqual({ x: 4, z: 2 });
  advance(app.game, 12);
  app.step(0);
  expect(tile(app.game, { x: 4, z: 2 }).dirt).toBe(0);
  expect(
    root.querySelector<HTMLButtonElement>('[data-action="care:clean"]')!
      .disabled,
  ).toBe(true);
});

test("selected tile actions and tutorial income refresh after autonomous changes", () => {
  const { app, root, click } = setup();
  tile(app.game, { x: 2, z: 7 }).object = "litter";
  app.select({ x: 2, z: 7 });
  expect(root.querySelector('[data-action="care:clean"]')).toBeTruthy();
  tile(app.game, { x: 2, z: 7 }).object = "";
  app.step(0);
  expect(root.querySelector('[data-action="care:clean"]')).toBeNull();
  click("goals");
  app.game.income.sales = 17;
  app.step(0);
  expect(root.querySelector(".income")!.textContent).toContain("Sales: 17");
  startEvent(app.game, "birthday");
  app.game.time += 21;
  app.step(0);
  expect(root.querySelector("#zoo-event")!.textContent).not.toContain(
    "birthday",
  );
});

test("placement uses ground picking while inspect and cancellation restore object picking", () => {
  const { app, root, click } = setup();
  const placement = vi.spyOn(app.renderer, "setPlacementMode");
  click("tab:build");
  click("category:objects");
  click("tool:build:bench");
  expect(placement).toHaveBeenLastCalledWith(true);
  root
    .querySelector("canvas")!
    .dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
  expect(placement).toHaveBeenLastCalledWith(false);
  click("category:fences");
  click("tool:fence:fence");
  expect(placement).toHaveBeenLastCalledWith(true);
  click("tab:inspect");
  expect(placement).toHaveBeenLastCalledWith(false);
  click("tab:build");
  click("category:objects");
  click("tool:build:bench");
  root.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(placement).toHaveBeenLastCalledWith(false);
});

test("planting replaces an empty-tile walk, charges once and shows flowers only after keeper work", () => {
  const { app, root, click } = setup();
  const target = { x: 2, z: 6 };
  tile(app.game, target).object = "";
  app.select(target);
  expect(
    root.querySelector<HTMLButtonElement>('[data-action="care:plant"]')!
      .disabled,
  ).toBe(true);
  app.game.coins = 2;
  app.step(0);
  expect(
    root.querySelector<HTMLButtonElement>('[data-action="care:plant"]')!
      .disabled,
  ).toBe(false);
  expect(
    root.querySelector('[data-action="care:plant"]')!.getAttribute("title"),
  ).toContain("2 coins");
  click("care:plant");
  expect(app.game.keeper.task?.kind).toBe("plant");
  expect(app.game.coins).toBe(0);
  expect(tile(app.game, target).object).toBe("");
  advance(app.game, 12);
  app.step(0);
  expect(tile(app.game, target).object).toBe("flowers");
  expect(app.game.counters.plant).toBe(1);
  expect(root.querySelector('[data-action="care:plant"]')).toBeNull();
  app.action("language:de");
  tile(app.game, { x: 2, z: 7 }).object = "";
  app.select({ x: 2, z: 7 });
  expect(
    root.querySelector('[data-action="care:plant"]')!.textContent,
  ).toContain("Blumen pflanzen");
});
