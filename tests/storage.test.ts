// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "vitest";
import {
  advance,
  command,
  createGame,
  figures,
  hire,
  points,
  tile,
  type Game,
} from "../src/game";
import { exportGame, importGame, load, save, saveKey } from "../src/storage";
import { distance, edgeKey, key } from "../src/world";
function storage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (i) => [...data.keys()][i] ?? null,
  };
}
function mutated(change: (g: Game) => void) {
  const g = createGame();
  change(g);
  return importGame(exportGame(g));
}
test("roundtrips a new zoo and evolving simulation without losing keeper delivery", () => {
  const g = createGame();
  const store = storage();
  expect(load(store)).toBeNull();
  expect(save(g, store)).toBe(true);
  expect(store.getItem(saveKey)).toBe(exportGame(g));
  expect(load(store)).toEqual(g);
  command(g, "feed", g.animals[0], g.animals[0].id);
  expect(importGame(exportGame(g))).toEqual(g);
  advance(g, 0.25);
  expect(importGame(exportGame(g))).toEqual(g);
  advance(g, 3);
  expect(importGame(exportGame(g))).toEqual(g);
  g.open = true;
  g.coins = 100;
  g.stars = 2;
  hire(g, "keeper");
  advance(g, 120);
  expect(importGame(exportGame(g))).toEqual(g);
});
test("unavailable storage fails safely", () => {
  const blocked = {
    setItem: () => {
      throw new Error("blocked");
    },
    getItem: () => {
      throw new Error("blocked");
    },
  } as unknown as Storage;
  expect(save(createGame(), blocked)).toBe(false);
  expect(load(blocked)).toBeNull();
});
test("rejects malformed JSON, huge files, primitives and unsupported worlds", () => {
  for (const text of [
    "not json",
    "null",
    "[]",
    "true",
    "{}",
    '"text"',
    " ".repeat(5_000_001),
  ])
    expect(importGame(text)).toBeNull();
  const changes: ((g: Game) => void)[] = [
    (g) => {
      g.schema = 2 as never;
    },
    (g) => {
      g.size = 7;
    },
    (g) => {
      g.size = 9;
    },
    (g) => {
      g.language = "fr" as never;
    },
    (g) => {
      g.tiles.pop();
    },
    (g) => {
      g.coins = -1;
    },
    (g) => {
      g.coins = Infinity;
    },
    (g) => {
      g.ticket = 2.5;
    },
    (g) => {
      g.stars = 6;
    },
    (g) => {
      g.sound = 1.1;
    },
    (g) => {
      g.music = -1;
    },
    (g) => {
      g.seed = -1;
    },
    (g) => {
      g.animals = [];
    },
    (g) => {
      g.animals[0].species = "dragon";
    },
    (g) => {
      g.animals[0].name = "<script>";
    },
    (g) => {
      g.animals[0].personality = "evil";
    },
    (g) => {
      g.animals[0].hunger = -1;
    },
    (g) => {
      g.animals[0].x = g.size;
    },
    (g) => {
      g.animals[0].digestion = -1;
    },
    (g) => {
      g.animals[0].activity = "invalid";
    },
    (g) => {
      g.tiles[0].terrain = "invalid" as never;
    },
    (g) => {
      g.tiles[0].object = "invalid";
    },
    (g) => {
      g.tiles[0].dirt = 9;
    },
    (g) => {
      g.inventory.greens = -1;
    },
    (g) => {
      delete (g.inventory as Partial<Game["inventory"]>).fish;
    },
    (g) => {
      g.income.donations = -1;
    },
    (g) => {
      g.goals = ["invalid"];
    },
    (g) => {
      g.goals = ["feed", "feed"];
    },
    (g) => {
      g.counters["bad-key"] = 1;
    },
    (g) => {
      g.message = "<script>";
    },
    (g) => {
      g.event = "";
    },
    (g) => {
      g.nextId = g.animals[0].id;
    },
    (g) => {
      g.animals.push({ ...g.animals[0] });
    },
    (g) => {
      g.visitors = Array(43).fill({});
    },
    (g) => {
      g.workers = [{ x: 0, z: 0, id: 2, role: "wrong" as never, task: null }];
    },
    (g) => {
      g.keeper.x = 0.1;
    },
    (g) => {
      g.fences.bad = "fence";
    },
    (g) => {
      g.fences["0,0|2,0"] = "fence";
    },
    (g) => {
      g.fences["-9,0|-8,0"] = "fence";
    },
    (g) => {
      g.fences[edgeKey({ x: 0, z: 0 }, { x: 1, z: 0 })] = "wrong" as never;
    },
  ];
  for (const change of changes)
    expect(mutated(change), change.toString()).toBeNull();
});
test("queued jobs require valid targets, contiguous routes and inventory payloads", () => {
  const g = createGame();
  command(g, "feed", g.animals[0], g.animals[0].id);
  expect(importGame(exportGame(g))).toEqual(g);
  const changes: ((g: Game) => void)[] = [
    (g) => {
      g.keeper.task!.kind = "invalid" as never;
    },
    (g) => {
      g.keeper.task!.animal = 999;
    },
    (g) => {
      g.keeper.task!.carrying = "";
    },
    (g) => {
      g.keeper.task!.progress = 9;
    },
    (g) => {
      g.keeper.task!.route = [{ x: 7, z: 7 }];
    },
    (g) => {
      g.keeper.task!.route = [];
    },
    (g) => {
      g.keeper.task!.target = { x: -1, z: 0 };
    },
    (g) => {
      g.keeper.task!.kind = "clean";
      g.keeper.task!.carrying = "greens";
    },
  ];
  for (const change of changes) {
    const copy = structuredClone(g);
    change(copy);
    expect(importGame(exportGame(copy)), change.toString()).toBeNull();
  }
  g.keeper.x = g.animals[0].x;
  g.keeper.z = g.animals[0].z + 1;
  g.keeper.task = null;
  command(g, "water", g.animals[0], g.animals[0].id);
  expect(importGame(exportGame(g))).toEqual(g);
});
test("visitor paths and family references are validated", () => {
  const g = createGame();
  g.open = true;
  advance(g, 40);
  expect(g.visitors.length).toBeGreaterThan(0);
  expect(importGame(exportGame(g))).toEqual(g);
  const copy = structuredClone(g);
  copy.visitors[0].family = g.nextId;
  expect(importGame(exportGame(copy))).toBeNull();
  const route = structuredClone(g);
  route.visitors[0].route = [{ x: 7, z: 7 }];
  expect(importGame(exportGame(route))).toBeNull();
});
test("accepts all boundary fences and rejects deleted required fields", () => {
  const g = createGame();
  g.fences[edgeKey({ x: 0, z: 0 }, { x: -1, z: 0 })] = "fence";
  expect(importGame(exportGame(g))).toEqual(g);
  const partial: Partial<Game> = g;
  delete partial.paused;
  expect(importGame(JSON.stringify(partial))).toBeNull();
});

test("walking keeper jobs remain saveable", () => {
  const g = createGame();
  expect(command(g, "walk", { x: 2, z: 5 })).toBe(true);
  expect(importGame(exportGame(g))).toEqual(g);
});

test("upgrades old8x8 and10x10 zoos to12 for free, preserving all existing contents", () => {
  for (const size of [8, 10]) {
    const legacy = createGame();
    const original = legacy.tiles;
    legacy.size = size;
    legacy.tiles = Array.from(
      { length: size * size },
      (_, i) => original[Math.floor(i / size) * 12 + (i % size)],
    );
    tile(legacy, { x: 2, z: 7 }).object = "bench";
    legacy.counters.bench = 1;
    legacy.coins = 37;
    legacy.inventory.fruit = 19;
    const restored = importGame(exportGame(legacy))!;
    expect(restored).not.toBeNull();
    expect(restored.size).toBe(12);
    expect(restored.coins).toBe(37);
    expect(restored.inventory).toEqual(legacy.inventory);
    expect(restored.animals).toEqual(legacy.animals);
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++)
        expect(tile(restored, { x, z })).toEqual(tile(legacy, { x, z }));
    expect(
      points(restored).some(
        (p) =>
          (p.x >= size || p.z >= size) &&
          ["tree", "rock", "weed", "stump"].includes(tile(restored, p).object),
      ),
    ).toBe(true);
  }
});

test("repairs old family piles and an old keeper delivery ending on its animal", () => {
  const legacy = createGame();
  legacy.open = true;
  advance(legacy, 40);
  legacy.coins = 57;
  for (const visitor of legacy.visitors) {
    visitor.x = 1;
    visitor.z = 4;
    visitor.route = [];
  }
  legacy.keeper.x = 1;
  legacy.keeper.z = 5;
  const animal = legacy.animals[0];
  legacy.keeper.task = {
    kind: "feed",
    animal: animal.id,
    target: { x: animal.x, z: animal.z },
    carrying: "greens",
    progress: 0,
    route: [
      { x: 2, z: 5 },
      { x: 3, z: 5 },
      { x: 4, z: 5 },
      { x: 4, z: 4 },
      { x: 4, z: 3 },
      { x: 4, z: 2 },
    ],
  };
  const restored = importGame(exportGame(legacy))!;
  expect(restored).not.toBeNull();
  expect(restored.coins).toBe(57);
  expect(restored.animals).toEqual(legacy.animals);
  expect(restored.visitors).toHaveLength(legacy.visitors.length);
  expect(new Set(figures(restored).map(key)).size).toBe(
    figures(restored).length,
  );
  expect(distance(restored.keeper.task!.route.at(-1)!, animal)).toBe(1);
  advance(restored, 10);
  expect(restored.animals[0].hunger).toBeGreaterThan(95);
});

test("repairs a keeper already standing on its animal and refunds impossible legacy delivery", () => {
  const legacy = createGame(),
    animal = legacy.animals[0];
  Object.assign(legacy.keeper, { x: animal.x, z: animal.z });
  legacy.keeper.task = {
    kind: "feed",
    animal: animal.id,
    target: { x: animal.x, z: animal.z },
    route: [],
    progress: 0,
    carrying: "greens",
  };
  const fixed = importGame(exportGame(legacy))!;
  expect(fixed).not.toBeNull();
  expect(distance(fixed.keeper, animal)).toBe(1);
  expect(new Set(figures(fixed).map(key)).size).toBe(figures(fixed).length);
  const blocked = createGame(),
    a = blocked.animals[0];
  blocked.keeper.task = {
    kind: "feed",
    animal: a.id,
    target: { x: a.x, z: a.z },
    route: [
      { x: 2, z: 5 },
      { x: 3, z: 5 },
      { x: 4, z: 5 },
      { x: 4, z: 4 },
      { x: 4, z: 3 },
      { x: 4, z: 2 },
    ],
    progress: 0,
    carrying: "greens",
  };
  for (const p of points(blocked))
    if (distance(p, a) === 1) tile(blocked, p).object = "rock";
  const restored = importGame(exportGame(blocked))!;
  expect(restored).not.toBeNull();
  expect(restored.keeper.task).toBeNull();
  expect(restored.inventory.greens).toBe(blocked.inventory.greens + 1);
});

test("legacy overflow visitors leave gracefully while impossible worker placement is rejected", () => {
  const g = createGame();
  g.open = true;
  advance(g, 40);
  for (const visitor of g.visitors) {
    visitor.x = 1;
    visitor.z = 4;
    visitor.route = [];
  }
  for (const p of points(g))
    if (tile(g, p).object.includes("path")) tile(g, p).object = "";
  const restored = importGame(exportGame(g))!;
  expect(restored).not.toBeNull();
  expect(restored.visitors).toHaveLength(1);
  const blocked = createGame();
  for (const p of points(blocked)) tile(blocked, p).object = "rock";
  expect(importGame(exportGame(blocked))).toBeNull();
  const duplicate = createGame();
  duplicate.animals.push({ ...duplicate.animals[0], id: duplicate.nextId++ });
  expect(importGame(exportGame(duplicate))).toBeNull();
});

test("legacy starter donation boxes move beside a path to unblock the water trough", () => {
  const g = createGame();
  tile(g, { x: 6, z: 3 }).object = "";
  tile(g, { x: 5, z: 3 }).object = "donation";
  const restored = importGame(exportGame(g))!;
  expect(tile(restored, { x: 5, z: 3 }).object).toBe("");
  expect(restored.tiles.filter((t) => t.object === "donation")).toHaveLength(1);
  expect(command(restored, "refillWater", { x: 5, z: 2 })).toBe(true);
});

test("resource refill tasks validate their facility targets and carried food", () => {
  const g = createGame();
  expect(command(g, "refill", { x: 3, z: 2 })).toBe(true);
  expect(importGame(exportGame(g))).toEqual(g);
  const wrong = structuredClone(g);
  wrong.keeper.task!.carrying = "";
  expect(importGame(exportGame(wrong))).toBeNull();
  const noFeeder = structuredClone(g);
  tile(noFeeder, { x: 3, z: 2 }).object = "";
  expect(importGame(exportGame(noFeeder))).toBeNull();
  g.keeper.task = null;
  expect(command(g, "refillWater", { x: 5, z: 2 })).toBe(true);
  const noTrough = structuredClone(g);
  tile(noTrough, { x: 5, z: 2 }).object = "";
  expect(importGame(exportGame(noTrough))).toBeNull();
});
