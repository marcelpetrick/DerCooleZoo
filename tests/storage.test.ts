// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "vitest";
import { advance, command, createGame, hire, type Game } from "../src/game";
import { exportGame, importGame, load, save, saveKey } from "../src/storage";
import { edgeKey } from "../src/world";
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
  g.keeper.z = g.animals[0].z;
  g.keeper.task = null;
  command(g, "water", g.animals[0], g.animals[0].id);
  expect(importGame(exportGame(g))).toEqual(g);
});
test("visitor paths and family references are validated", () => {
  const g = createGame();
  g.open = true;
  advance(g, 10);
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
