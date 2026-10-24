// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, test } from "vitest";
import {
  buildings,
  foods,
  getSpecies,
  roles,
  species,
  terrains,
} from "../src/catalog";
import {
  adopt,
  advance,
  attractiveness,
  buyFood,
  command,
  createGame,
  emergencyFood,
  expand,
  fence,
  goalIds,
  goals,
  habitat,
  hire,
  paint,
  pay,
  points,
  random,
  tick,
  tile,
  visit,
  welfare,
  build,
  addAnimal,
} from "../src/game";
import {
  distance,
  edgeKey,
  enclosure,
  equal,
  inside,
  key,
  neighbors,
  pathfind,
} from "../src/world";
import { exportGame, importGame } from "../src/storage";
const p = { x: 4, z: 2 };
function rich() {
  const g = createGame();
  g.coins = 10000;
  g.stars = 5;
  return g;
}
describe("grid and bounded pathfinding", () => {
  test("keys, adjacency, exact positions and bounds", () => {
    expect(key(p)).toBe("4,2");
    expect(neighbors(p)).toHaveLength(4);
    expect(distance(p, { x: 2, z: 1 })).toBe(3);
    expect(equal(p, p)).toBe(true);
    for (const q of [
      { x: -1, z: 0 },
      { x: 8, z: 0 },
      { x: 0, z: 8 },
      { x: 0.2, z: 0 },
    ])
      expect(inside(q, 8)).toBe(false);
  });
  test("finds shortest routes, same tile, obstacles and disconnections", () => {
    expect(
      pathfind({ x: 0, z: 0 }, { x: 2, z: 0 }, () => true, 3),
    ).toHaveLength(2);
    expect(pathfind(p, p, () => true, 8)).toEqual([]);
    expect(pathfind({ x: 0, z: 0 }, { x: 2, z: 0 }, () => false, 3)).toEqual(
      [],
    );
    expect(
      pathfind(
        { x: 0, z: 0 },
        { x: 2, z: 0 },
        () => true,
        3,
        () => true,
      ),
    ).toEqual([]);
  });
  test("recognizes a closed grid-edge enclosure and an opening", () => {
    const g = createGame();
    expect(enclosure(p, g.size, g.fences)).toHaveLength(9);
    delete g.fences[edgeKey({ x: 3, z: 1 }, { x: 2, z: 1 })];
    expect(enclosure(p, g.size, g.fences)).toEqual([]);
  });
});
describe("friendly starting economy and catalog", () => {
  test("all starters have one animal, no coins, safe paths and food", () => {
    for (const id of [
      "rabbit",
      "goat",
      "guinea",
      "pig",
      "raccoon",
      "invalid",
    ]) {
      const g = createGame(id);
      expect(g.coins).toBe(0);
      expect(g.animals).toHaveLength(1);
      expect(g.inventory.greens).toBeGreaterThan(0);
      expect(g.open).toBe(false);
    }
    expect(species).toHaveLength(20);
    expect(terrains).toHaveLength(7);
  });
  test("currency never goes negative and food purchase does not feed remotely", () => {
    const g = createGame();
    expect(pay(g, 1)).toBe(false);
    expect(buyFood(g, "greens")).toBe(false);
    g.coins = 2;
    expect(buyFood(g, "greens")).toBe(true);
    expect(g.inventory.greens).toBe(10);
    expect(g.animals[0].hunger).toBe(70);
    expect(buyFood(g, "bad" as never)).toBe(false);
    g.inventory.greens = 0;
    emergencyFood(g);
    expect(g.inventory.greens).toBe(2);
  });
  test("deterministic randomness", () => {
    expect(random(createGame())).toBe(random(createGame()));
  });
  test("welfare reflects habitat, water, tall fences and waste", () => {
    const g = rich(),
      a = g.animals[0];
    expect(habitat(g, a)).toEqual({
      space: true,
      terrain: true,
      water: true,
      fence: true,
    });
    const initial = welfare(g, a);
    tile(g, a).dirt = 5;
    expect(welfare(g, a)).toBeLessThan(initial);
    a.species = "giraffe";
    expect(habitat(g, a).fence).toBe(false);
    for (const k in g.fences) g.fences[k] = "highfence";
    expect(habitat(g, a).fence).toBe(true);
    for (const q of points(g)) {
      tile(g, q).terrain = "sand";
      tile(g, q).object = "";
    }
    expect(habitat(g, a).water).toBe(false);
    expect(habitat(g, a).terrain).toBe(true);
    g.fences = {};
    expect(habitat(g, a).space).toBe(false);
    expect(attractiveness(g)).toBeGreaterThanOrEqual(1);
  });
});
describe("keeper physically delivers food and clears droppings", () => {
  test("walks carrying purchased food, feeds only on arrival and later produces removable poop", () => {
    const g = createGame(),
      a = g.animals[0],
      h = a.hunger;
    expect(command(g, "feed", a, a.id)).toBe(true);
    expect(g.keeper.task?.carrying).toBe("greens");
    expect(g.inventory.greens).toBe(4);
    expect(a.hunger).toBe(h);
    expect(command(g, "pet", a, a.id)).toBe(false);
    advance(g, 4);
    expect(g.keeper.task).toBeNull();
    expect(a.hunger).toBeGreaterThan(95);
    advance(g, 9);
    expect(tile(g, a).dirt).toBe(1);
    expect(command(g, "clean", a)).toBe(true);
    advance(g, 2);
    expect(tile(g, a).dirt).toBe(0);
  });
  test("water, affection, weeds, rocks, stumps, litter and repairs complete", () => {
    const g = rich(),
      a = g.animals[0];
    for (const kind of ["water", "pet"] as const) {
      a.water = 1;
      a.joy = 1;
      command(g, kind, a, a.id);
      advance(g, 5);
      expect(kind === "water" ? a.water : a.joy).toBeGreaterThan(95);
    }
    for (const object of ["weed", "rock", "stump"]) {
      const q = { x: 2, z: 5 };
      tile(g, q).object = object;
      g.keeper.x = 2;
      g.keeper.z = 5;
      expect(command(g, "clear", q)).toBe(true);
      advance(g, 2);
      expect(tile(g, q).object).toBe("");
    }
    tile(g, g.keeper).object = "litter";
    command(g, "clean", g.keeper);
    advance(g, 2);
    expect(tile(g, g.keeper).object).toBe("");
    command(g, "repair", g.keeper);
    advance(g, 2);
    expect(g.counters.repaired).toBe(1);
  });
  test("rejects invalid, unreachable and foodless tasks without losing inventory", () => {
    const g = createGame(),
      a = g.animals[0];
    expect(command(g, "feed", p, 999)).toBe(false);
    expect(command(g, "clean", { x: -1, z: 0 })).toBe(false);
    g.inventory.greens = 0;
    expect(command(g, "feed", a, a.id)).toBe(false);
    expect(g.message).toBe("noFood");
    g.fences[edgeKey({ x: 4, z: 3 }, { x: 4, z: 4 })] = "fence";
    expect(command(g, "water", a, a.id)).toBe(false);
    expect(g.message).toBe("noRoute");
  });
});
describe("construction and progression", () => {
  test("builds every catalog object and rejects invalid placements and costs", () => {
    for (const b of buildings) {
      const g = rich(),
        q = { x: 2, z: 7 };
      tile(g, q).object = "";
      expect(build(g, b.id, q)).toBe(true);
      expect(tile(g, q).object).toBe(b.id);
      expect(build(g, b.id, q)).toBe(false);
    }
    const g = createGame();
    expect(build(g, "bad", p)).toBe(false);
    expect(build(g, "bench", { x: -1, z: 0 })).toBe(false);
    expect(build(g, "tower", { x: 2, z: 7 })).toBe(false);
    tile(g, { x: 2, z: 7 }).object = "";
    expect(build(g, "bench", { x: 2, z: 7 })).toBe(false);
    expect(build(g, "bench", g.animals[0])).toBe(false);
    tile(g, g.keeper).object = "";
    expect(build(g, "bench", g.keeper)).toBe(false);
    const r = rich();
    hire(r, "vendor");
    tile(r, r.workers[0]).object = "";
    expect(build(r, "bench", r.workers[0])).toBe(false);
  });
  test("paints terrain and builds boundary fences, tall fences and gates", () => {
    const g = rich();
    for (const terrain of terrains) expect(paint(g, terrain, p)).toBe(true);
    expect(paint(g, "grass", { x: -1, z: 0 })).toBe(false);
    for (const kind of ["fence", "highfence", "gate"] as const)
      expect(fence(g, p, { x: 4, z: 3 }, kind)).toBe(true);
    expect(fence(g, p, { x: 7, z: 7 }, "fence")).toBe(false);
    expect(fence(g, { x: -1, z: 0 }, { x: 0, z: 0 }, "fence")).toBe(false);
    expect(fence(g, p, { x: 4, z: 3 }, "gate")).toBe(false);
    g.coins = 0;
    expect(paint(g, "grass", p)).toBe(false);
    expect(fence(g, p, { x: 5, z: 2 }, "fence")).toBe(false);
  });
  test("adoption needs unlocked species, closed space and money", () => {
    const g = rich();
    expect(adopt(g, "goat", { x: 4, z: 1 })).toBe(true);
    expect(adopt(g, "bad", p)).toBe(false);
    expect(adopt(g, "rabbit", { x: -1, z: 0 })).toBe(false);
    expect(adopt(g, "goat", p)).toBe(false);
    expect(adopt(g, "goat", { x: 0, z: 0 })).toBe(false);
    tile(g, { x: 3, z: 1 }).object = "weed";
    expect(adopt(g, "goat", { x: 3, z: 1 })).toBe(false);
    g.coins = 0;
    expect(adopt(g, "goat", { x: 4, z: 3 })).toBe(false);
    g.stars = 1;
    expect(adopt(g, "giraffe", { x: 4, z: 3 })).toBe(false);
  });
  test("all species have valid requirements and stable animal names", () => {
    const g = rich();
    for (const s of species) {
      addAnimal(g, s.id, p);
      expect(foods).toContain(getSpecies(s.id).food);
      expect(welfare(g, g.animals.at(-1)!)).toBeGreaterThanOrEqual(0);
    }
  });
  test("expansion preserves every old tile and stops at maximum", () => {
    const g = rich(),
      t = tile(g, p);
    while (g.size < 16) expect(expand(g)).toBe(true);
    expect(tile(g, p)).toBe(t);
    expect(expand(g)).toBe(false);
    const poor = createGame();
    expect(expand(poor)).toBe(false);
  });
  test("hiring and wages stay simple and cannot cause debt", () => {
    const g = createGame();
    expect(hire(g, "keeper")).toBe(false);
    expect(hire(g, "bad" as never)).toBe(false);
    g.stars = 2;
    expect(hire(g, "keeper")).toBe(false);
    g.coins = 200;
    for (const role of roles) expect(hire(g, role)).toBe(true);
    g.coins = 0;
    g.animals[0].hunger = 5;
    g.animals[0].water = 5;
    advance(g, 75);
    expect(g.coins).toBeGreaterThanOrEqual(0);
    expect(g.animals[0].hunger).toBeGreaterThan(65);
    g.animals[0].water = 1;
    advance(g, 12);
    expect(g.animals[0].water).toBeGreaterThan(65);
  });
  test("goals award exactly once and unlock higher stars", () => {
    const g = rich();
    g.counters = {
      clear: 1,
      repaired: 1,
      feed: 1,
      bench: 1,
      happy: 3,
      popcorn: 1,
    };
    g.open = true;
    g.income.donations = 20;
    addAnimal(g, "goat", { x: 4, z: 1 });
    goals(g);
    expect(g.goals).toEqual(goalIds);
    const coins = g.coins;
    goals(g);
    expect(g.coins).toBe(coins);
    const fresh = createGame();
    goals(fresh);
    expect(fresh.goals).toEqual([]);
    g.stars = 1;
    advance(g, 1);
    expect(g.stars).toBeGreaterThan(1);
  });
});
describe("visitors and positive economic loop", () => {
  test("entry generates income; closing returns guests to entrance", () => {
    const g = createGame();
    g.open = true;
    advance(g, 30);
    expect(g.income.tickets).toBeGreaterThan(0);
    expect(g.visitors.length).toBeGreaterThan(0);
    g.open = false;
    advance(g, 60);
    expect(g.visitors).toHaveLength(0);
  });
  test("quality, benches, play, snacks and donation boxes affect families", () => {
    const g = rich();
    g.open = true;
    advance(g, 10);
    const parent = g.visitors.find((v) => v.type === "parent")!,
      child = g.visitors.find((v) => v.type === "child")!;
    for (const v of g.visitors) {
      v.route = [];
      v.x = 4;
      v.z = 4;
      v.hunger = 30;
      v.energy = 20;
      v.happiness = 90;
      v.age = 0;
    }
    for (const [id, q] of [
      ["bench", { x: 3, z: 4 }],
      ["trampoline", { x: 5, z: 4 }],
      ["popcorn", { x: 4, z: 5 }],
    ] as const)
      tile(g, q).object = id;
    const duration = parent.duration;
    g.time = 15;
    for (let i = 0; i < 30; i++) visit(g, child, 0.5);
    visit(g, parent, 0.5);
    expect(g.income.sales).toBeGreaterThan(0);
    expect(parent.duration).toBeGreaterThan(duration);
    expect(g.income.donations).toBeGreaterThan(0);
    expect(g.counters.happy).toBeGreaterThan(0);
  });
  test("needs, dirt, departure, bins, repeated visits and expensive tickets", () => {
    const g = rich();
    g.open = true;
    advance(g, 10);
    const v = g.visitors[0];
    v.route = [];
    v.x = 1;
    v.z = 4;
    v.energy = 1;
    v.hunger = 1;
    v.happiness = 1;
    g.time = 27;
    visit(g, v, 0.5);
    expect(tile(g, v).dirt).toBeGreaterThan(0);
    tile(g, { x: 2, z: 4 }).object = "bin";
    visit(g, v, 0.5);
    g.time = 28;
    visit(g, v, 0.5);
    v.route = [];
    v.age = 200;
    visit(g, v, 0.5);
    expect(v.age).toBe(999);
    g.ticket = 20;
    advance(g, 200);
    expect(g.visitors.length).toBeLessThan(41);
  });
  test("simulation is bounded, pauseable, deterministic and never kills animals", () => {
    const g = createGame();
    g.paused = true;
    tick(g, 1);
    expect(g.time).toBe(0);
    g.paused = false;
    for (const n of [0, -1, NaN, Infinity]) tick(g, n);
    expect(g.time).toBe(0);
    tick(g, 100);
    expect(g.time).toBe(0.5);
    advance(g, 900);
    expect(g.animals).toHaveLength(1);
    expect(g.animals[0].hunger).toBe(0);
    expect(g.coins).toBeGreaterThanOrEqual(0);
  });
});

describe("simulation regression safeguards", () => {
  test("keeper reaches and clears a rock or stump without teleporting or crossing other obstacles", () => {
    for (const object of ["rock", "stump"]) {
      const g = createGame(),
        target = { x: 2, z: 5 };
      tile(g, target).object = object;
      const start = { x: g.keeper.x, z: g.keeper.z };
      expect(command(g, "walk", target)).toBe(false);
      expect(command(g, "clear", target)).toBe(true);
      expect({ x: g.keeper.x, z: g.keeper.z }).toEqual(start);
      expect(g.keeper.task!.route.at(-1)).toEqual(target);
      advance(g, 2);
      expect(tile(g, target).object).toBe("");
      expect({ x: g.keeper.x, z: g.keeper.z }).toEqual(target);
    }
    const g = createGame();
    for (const q of points(g)) tile(g, q).object = "rock";
    tile(g, g.keeper).object = "path";
    expect(command(g, "clear", { x: 4, z: 5 })).toBe(false);
  });
  test("invalid prices and terrain/fence values cannot create money or corrupt the world", () => {
    const g = rich(),
      coins = g.coins;
    for (const cost of [-1, NaN, Infinity, -Infinity])
      expect(pay(g, cost)).toBe(false);
    expect(g.coins).toBe(coins);
    expect(pay(g, 0)).toBe(true);
    expect(paint(g, "lava" as never, p)).toBe(false);
    expect(fence(g, p, { x: 4.5, z: 2.5 }, "fence")).toBe(false);
    expect(fence(g, p, { x: 4, z: 3 }, "wire" as never)).toBe(false);
    expect(g.coins).toBe(coins);
    const a = g.animals[0];
    expect(command(g, "feed", { x: 1, z: 5 }, a.id)).toBe(false);
    expect(g.inventory.greens).toBe(5);
    for (const n of [-1, NaN, Infinity]) advance(g, n);
    expect(g.time).toBe(0);
  });
  test("adoption does not place animals inside existing structures", () => {
    const g = rich(),
      target = { x: 3, z: 2 };
    expect(tile(g, target).object).toBe("feeder");
    expect(adopt(g, "rabbit", target)).toBe(false);
    expect(g.animals).toHaveLength(1);
  });
  test("visitors honor existing fences and stop queued movement when a fence is built", () => {
    const g = createGame();
    g.open = true;
    advance(g, 5);
    const v = g.visitors[0];
    for (const q of points(g)) tile(g, q).object = "";
    for (const q of [
      { x: 0, z: 4 },
      { x: 1, z: 4 },
      { x: 2, z: 4 },
    ])
      tile(g, q).object = "path";
    v.x = 2;
    v.z = 4;
    v.route = [];
    v.age = 1000;
    const boundary = edgeKey({ x: 1, z: 4 }, { x: 2, z: 4 });
    g.fences[boundary] = "fence";
    visit(g, v, 0.5);
    expect(v.route).toEqual([]);
    expect(v.x).toBe(2);
    g.fences[boundary] = "gate";
    visit(g, v, 0.5);
    expect(v.route).toEqual([{ x: 1, z: 4 }]);
    g.fences[boundary] = "highfence";
    g.time = 5.5;
    visit(g, v, 0.5);
    expect(v.x).toBe(2);
    expect(v.route).toEqual([]);
    g.fences[boundary] = "gate";
    visit(g, v, 0.5);
    visit(g, v, 0.5);
    expect(v.x).toBe(1);
    v.x = 2;
    v.route = [{ x: 1, z: 4 }];
    tile(g, { x: 1, z: 4 }).object = "";
    visit(g, v, 0.5);
    expect(v.x).toBe(2);
    expect(v.route).toEqual([]);
  });
  test("a full zoo admits whole groups without ever exceeding 40 guests", () => {
    const g = createGame();
    g.open = true;
    advance(g, 5);
    const template = g.visitors[0];
    g.visitors = Array.from({ length: 39 }, (_, i) => ({
      ...template,
      id: 10 + i,
      family: 10 + i,
      route: [],
      age: 0,
      duration: 10000,
    }));
    g.nextId = 100;
    g.time = 9.75;
    const tickets = g.income.tickets;
    tick(g, 0.25);
    expect(g.visitors).toHaveLength(39);
    expect(g.income.tickets).toBe(tickets);
    g.nextId = 102;
    g.time = 14.75;
    tick(g, 0.25);
    expect(g.visitors).toHaveLength(40);
    g.time = 19.75;
    tick(g, 0.25);
    expect(g.visitors).toHaveLength(40);
  });
});

test("a carer still brings water when animal food is out of stock", () => {
  const g = rich();
  hire(g, "keeper");
  g.inventory.greens = 0;
  g.animals[0].hunger = 5;
  g.animals[0].water = 1;
  advance(g, 10);
  expect(g.animals[0].water).toBeGreaterThan(65);
  expect(g.inventory.greens).toBe(0);
  expect(g.animals[0].hunger).toBeLessThan(5);
  buyFood(g, "greens");
  advance(g, 10);
  expect(g.animals[0].hunger).toBeGreaterThan(65);
});

test("hiring stops at 16 teammates and every resulting save stays loadable", () => {
  const g = rich();
  for (let i = 0; i < 16; i++) {
    expect(hire(g, "vendor")).toBe(true);
    expect(importGame(exportGame(g))).toEqual(g);
  }
  const coins = g.coins;
  expect(hire(g, "keeper")).toBe(false);
  expect(g.workers).toHaveLength(16);
  expect(g.message).toBe("staffFull");
  expect(g.coins).toBe(coins);
  expect(importGame(exportGame(g))).toEqual(g);
});

test("free fence removal releases trapped visitors even when coins are zero", () => {
  const g = createGame();
  g.open = true;
  advance(g, 5);
  const v = g.visitors[0];
  v.x = 2;
  v.z = 4;
  v.age = 200;
  v.route = [];
  for (const q of points(g)) tile(g, q).object = "";
  tile(g, { x: 2, z: 4 }).object = "path";
  tile(g, { x: 1, z: 4 }).object = "entrance";
  const from = { x: 1, z: 4 },
    to = { x: 2, z: 4 };
  g.fences[edgeKey(from, to)] = "fence";
  g.coins = 0;
  visit(g, v, 0.5);
  expect(v.route).toEqual([]);
  const revision = g.revision;
  expect(fence(g, from, to, "remove")).toBe(true);
  expect(g.fences[edgeKey(from, to)]).toBeUndefined();
  expect(g.coins).toBe(0);
  expect(g.revision).toBe(revision + 1);
  expect(g.message).toBe("fenceRemoved");
  expect(fence(g, from, to, "remove")).toBe(false);
  expect(fence(g, from, { x: 4, z: 4 }, "remove")).toBe(false);
  visit(g, v, 0.5);
  expect(v.route).toEqual([from]);
  g.time = 5.5;
  visit(g, v, 0.5);
  visit(g, v, 0.5);
  expect(v.age).toBe(999);
});
