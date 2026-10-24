// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, test } from "vitest";
import {
  expand,
  feederStock,
  waterStock,
  activeEvent,
  adopt,
  advance,
  animalRoutine,
  buyFood,
  command,
  createGame,
  figures,
  friendlyEvents,
  habitat,
  hire,
  occupied,
  points,
  startEvent,
  tick,
  tile,
  visit,
  welfare,
  type Game,
  type Visitor,
} from "../src/game";
import { getSpecies } from "../src/catalog";
import { distance, edgeKey, enclosure, equal, key } from "../src/world";
import { exportGame, importGame } from "../src/storage";
function guest(g: Game, x = 2, z = 4): Visitor {
  const id = g.nextId++;
  const v: Visitor = {
    id,
    family: id,
    x,
    z,
    type: "parent",
    happiness: 55,
    hunger: 75,
    energy: 80,
    fun: 65,
    age: 0,
    duration: 60,
    route: [],
    activity: "watch",
  };
  g.visitors.push(v);
  return v;
}
function wealthy(): Game {
  const g = createGame();
  g.coins = 10000;
  g.stars = 5;
  return g;
}
function allDistinct(g: Game): void {
  expect(new Set(figures(g).map(key)).size).toBe(figures(g).length);
}

describe("species habitats and finite enclosure capacity", () => {
  test("an iguana needs a warm planted rocky enclosure with food and shelter", () => {
    const g = wealthy(),
      a = g.animals[0];
    a.species = "iguana";
    const base = habitat(g, a);
    expect(base).toMatchObject({
      terrain: false,
      shelter: false,
      plants: false,
      rocks: false,
      feeder: true,
    });
    for (const p of enclosure(a, g.size, g.fences))
      tile(g, p).terrain = "tropical";
    tile(g, { x: 3, z: 1 }).terrain = "rock";
    tile(g, { x: 5, z: 1 }).object = "flowers";
    tile(g, { x: 3, z: 3 }).object = "shelter";
    expect(Object.values(habitat(g, a)).every(Boolean)).toBe(true);
    tile(g, { x: 3, z: 2 }).object = "";
    expect(habitat(g, a).feeder).toBe(false);
  });
  test("crocodiles and penguins need a pool and usable land, not a single wet square or all water", () => {
    const g = wealthy(),
      a = g.animals[0];
    a.species = "crocodile";
    const cells = enclosure(a, g.size, g.fences);
    for (const k in g.fences)
      if (g.fences[k] !== "gate") g.fences[k] = "highfence";
    for (const p of cells) tile(g, p).terrain = "sand";
    tile(g, cells[0]).terrain = "water";
    expect(habitat(g, a).water).toBe(false);
    for (const p of cells.slice(0, 4)) tile(g, p).terrain = "water";
    expect(habitat(g, a).water).toBe(true);
    for (const p of cells) tile(g, p).terrain = "water";
    expect(habitat(g, a).water).toBe(false);
    a.species = "penguin";
    for (const p of cells) tile(g, p).terrain = "snow";
    for (const p of cells.slice(0, 2)) tile(g, p).terrain = "water";
    tile(g, cells[2]).terrain = "rock";
    tile(g, { x: 3, z: 3 }).object = "shelter";
    expect(Object.values(habitat(g, a)).every(Boolean)).toBe(true);
  });
  test("giraffes accept grass savanna, terrain needs a meaningful proportion, and shared space is finite", () => {
    const g = wealthy(),
      a = g.animals[0];
    a.species = "giraffe";
    expect(habitat(g, a).terrain).toBe(true);
    const cells = enclosure(a, g.size, g.fences);
    for (const p of cells) tile(g, p).terrain = "rock";
    tile(g, cells[0]).terrain = "sand";
    expect(habitat(g, a).terrain).toBe(false);
    a.species = "rabbit";
    expect(adopt(g, "goat", { x: 4, z: 1 })).toBe(true);
    expect(g.counters.adopted).toBe(1);
    expect(adopt(g, "rabbit", { x: 5, z: 1 })).toBe(false);
    expect(g.message).toBe("needEnclosure");
    expect(g.counters.adopted).toBe(1);
  });
});

describe("living animals and modest starter perks", () => {
  test("walks inside its enclosure without entering structures, figures or fences", () => {
    const g = createGame(),
      a = g.animals[0];
    const area = new Set(enclosure(a, g.size, g.fences).map(key));
    const seen = new Set([key(a)]);
    for (let i = 0; i < 320; i++) {
      tick(g, 0.25);
      seen.add(key(a));
      expect(area.has(key(a))).toBe(true);
      expect(tile(g, a).object).toBe("");
      allDistinct(g);
    }
    expect(seen.size).toBeGreaterThan(2);
    expect(importGame(exportGame(g))).toEqual(g);
  });
  test("sleeps, plays and swims, while delivery tasks hold the animal safely in place", () => {
    const g = createGame(),
      a = g.animals[0];
    g.time = 30;
    a.personality = "sleepy";
    animalRoutine(g, a, 29.75);
    expect(a.activity).toBe("sleep");
    g.time = 10;
    a.personality = "playful";
    animalRoutine(g, a, 9.75);
    expect(a.activity).toBe("play");
    tile(g, a).terrain = "water";
    animalRoutine(g, a, 9.75);
    expect(a.activity).toBe("swim");
    a.personality = "curious";
    tile(g, a).terrain = "grass";
    expect(command(g, "feed", a, a.id)).toBe(true);
    const position = key(a);
    g.time = 32;
    animalRoutine(g, a, 31.75);
    expect(key(a)).toBe(position);
    advance(g, 6);
    expect(a.hunger).toBeGreaterThan(95);
    a.digestion = 0;
    g.time = 64;
    animalRoutine(g, a, 63.75);
    expect(distance(a, g.keeper)).toBeGreaterThan(0);
    g.fences = {};
    animalRoutine(g, a, 63.75);
    expect(key(a)).toBeDefined();
  });
  test("rabbit food is thrifty, guinea care is easier, and pigs entertain children", () => {
    const rabbit = wealthy();
    buyFood(rabbit, "greens");
    expect(rabbit.inventory.greens).toBe(11);
    const goat = createGame("goat");
    goat.coins = 4;
    buyFood(goat, "greens");
    buyFood(goat, "fruit");
    expect(goat.inventory.greens).toBe(10);
    expect(goat.inventory.fruit).toBe(10);
    const guinea = createGame("guinea");
    advance(guinea, 10);
    advance(goat, 10);
    expect(guinea.animals[0].hunger).toBeGreaterThan(goat.animals[0].hunger);
    const pig = createGame("pig");
    pig.open = true;
    const child = guest(pig, 4, 4);
    child.type = "child";
    const fun = child.fun;
    visit(pig, child, 0.5);
    expect(child.fun).toBeGreaterThan(fun);
  });
});

describe("visible vendor operation and friendly events", () => {
  test("a vendor walks to a stand and makes automatic sales more rewarding", () => {
    const g = wealthy();
    tile(g, { x: 2, z: 6 }).object = "popcorn";
    expect(hire(g, "vendor")).toBe(true);
    advance(g, 15);
    const vendor = g.workers[0];
    expect(vendor.task).toBeNull();
    expect(distance(vendor, { x: 2, z: 6 })).toBe(1);
    g.open = true;
    const v = guest(g, 2, 5);
    v.hunger = 20;
    visit(g, v, 0.25);
    expect(g.income.sales).toBe(3);
    expect(v.hunger).toBe(100);
    g.workers = [];
    v.hunger = 20;
    visit(g, v, 0.25);
    expect(g.income.sales).toBe(5);
    expect(importGame(exportGame(g))).toEqual(g);
  });
  test("all six events are temporary, preserve saves and change visible activities or visitor economics", () => {
    for (const event of friendlyEvents) {
      const g = wealthy();
      g.open = true;
      const v = guest(g);
      g.time = 60;
      startEvent(g, event);
      expect(activeEvent(g)).toBe(event);
      expect(g.counters.eventIndex).toBe(1);
      expect(v.happiness).toBeGreaterThan(55);
      if (event === "birthday") {
        expect(g.animals[0].joy).toBe(100);
        expect(v.activity).toBe("wave");
      }
      if (event === "balloon") expect(v.happiness).toBe(67);
      if (event === "family") expect(v.duration).toBe(70);
      expect(importGame(exportGame(g))).toEqual(g);
      g.time = 80;
      expect(activeEvent(g)).toBe("");
    }
    expect(activeEvent(createGame())).toBe("");
  });
  test("school events admit a real small class and sunny days attract visitors sooner", () => {
    const school = wealthy();
    school.open = true;
    startEvent(school, "school");
    advance(school, 18);
    expect(school.visitors.map((v) => v.type).sort()).toEqual([
      "child",
      "child",
      "parent",
    ]);
    allDistinct(school);
    const sunny = wealthy();
    sunny.open = true;
    startEvent(sunny, "sunny");
    advance(sunny, 15);
    expect(sunny.income.tickets).toBeGreaterThan(0);
    const plain = wealthy();
    plain.open = true;
    advance(plain, 15);
    expect(plain.income.tickets).toBe(0);
  });
  test("photo days increase enjoyment near an animal and happy visitor markers disappear on departure", () => {
    const plain = createGame(),
      photo = createGame();
    plain.open = photo.open = true;
    const first = guest(plain, 4, 4),
      second = guest(photo, 4, 4);
    startEvent(photo, "photo");
    second.happiness = first.happiness;
    visit(plain, first, 0.5);
    visit(photo, second, 0.5);
    expect(second.happiness).toBeGreaterThan(first.happiness);
    plain.time = 0.5;
    first.route = [];
    first.happiness = 90;
    visit(plain, first, 0.5);
    expect(plain.counters[`happy${first.id}`]).toBe(1);
    first.x = 1;
    first.z = 4;
    first.route = [];
    first.age = 999;
    tick(plain, 0.25);
    expect(plain.counters[`happy${first.id}`]).toBeUndefined();
  });
});

describe("pedestrians pass through narrow paths without overlap or deadlock", () => {
  test("opposing guests exchange cells atomically and each moves only once per tick", () => {
    const g = createGame();
    g.open = true;
    g.time = 0.5;
    const incoming = guest(g, 2, 4),
      outgoing = guest(g, 3, 4);
    incoming.route = [
      { x: 3, z: 4 },
      { x: 4, z: 4 },
    ];
    outgoing.route = [
      { x: 2, z: 4 },
      { x: 1, z: 4 },
    ];
    const moved = new Set<Visitor>();
    visit(g, incoming, 0.25, moved);
    visit(g, outgoing, 0.25, moved);
    expect(incoming).toMatchObject({ x: 3, z: 4 });
    expect(outgoing).toMatchObject({ x: 2, z: 4 });
    expect(incoming.route).toHaveLength(1);
    expect(outgoing.route).toHaveLength(1);
    allDistinct(g);
    expect(importGame(exportGame(g))).toEqual(g);
    g.time = 1;
    visit(g, incoming, 0.25);
    visit(g, outgoing, 0.25);
    allDistinct(g);
    expect(incoming.x).toBe(4);
    expect(outgoing.x).toBe(1);
  });
  test("a new fence cancels a swap and idle keepers yield off the path", () => {
    const g = createGame();
    g.open = true;
    g.time = 0.5;
    const incoming = guest(g, 2, 4),
      outgoing = guest(g, 3, 4);
    incoming.route = [{ x: 3, z: 4 }];
    outgoing.route = [{ x: 2, z: 4 }];
    g.fences[edgeKey(incoming, outgoing)] = "fence";
    visit(g, incoming, 0.25);
    expect(incoming.x).toBe(2);
    allDistinct(g);
    g.visitors = [incoming];
    Object.assign(g.keeper, { x: 2, z: 4 });
    incoming.x = 1;
    delete g.fences[edgeKey(incoming, g.keeper)];
    tile(g, { x: 2, z: 3 }).object = "";
    incoming.route = [{ x: 2, z: 4 }];
    visit(g, incoming, 0.25);
    expect(g.keeper.task?.kind).toBe("walk");
    advance(g, 3);
    expect(equal(g.keeper, { x: 2, z: 4 })).toBe(false);
    allDistinct(g);
  });
  test("crowded mixed staff, families and moving animals remain distinct across save/reopen", () => {
    let g = wealthy();
    g.open = true;
    tile(g, { x: 2, z: 6 }).object = "popcorn";
    for (const role of ["keeper", "vendor", "gardener", "cleaner"] as const)
      expect(hire(g, role)).toBe(true);
    for (let i = 0; i < 1200; i++) {
      tick(g, 0.25);
      allDistinct(g);
      if (i % 120 === 0) {
        const loaded = importGame(exportGame(g));
        expect(loaded).toEqual(g);
        g = loaded!;
      }
      for (const a of g.animals) expect(occupied(g, a, a)).toBe(false);
    }
    expect(g.income.tickets).toBeGreaterThan(5);
    expect(g.visitors.length).toBeLessThanOrEqual(40);
    expect(welfare(g, g.animals[0])).toBeGreaterThanOrEqual(0);
    expect(getSpecies(g.animals[0].species).food).toBe("greens");
    expect(points(g)).toHaveLength(144);
  });
});

test("a four-person turning cycle advances without guests being trapped forever", () => {
  const g = createGame();
  g.open = true;
  g.time = 0.5;
  const positions = [
    { x: 2, z: 4 },
    { x: 3, z: 4 },
    { x: 3, z: 5 },
    { x: 2, z: 5 },
  ];
  const guests = positions.map((p) => guest(g, p.x, p.z));
  guests.forEach((v, index) => {
    v.route = [positions[(index + 1) % positions.length]];
  });
  const moved = new Set<Visitor>();
  for (const v of guests) visit(g, v, 0.25, moved);
  guests.forEach((v, index) => {
    expect(v).toMatchObject(positions[(index + 1) % positions.length]);
    expect(v.route).toEqual([]);
  });
  allDistinct(g);
  advance(g, 100);
  expect(g.visitors.every((v) => !guests.includes(v))).toBe(true);
});

test("a gardener preserves paid decorative trees", () => {
  const g = wealthy();
  for (const p of points(g))
    if (["weed", "rock", "stump"].includes(tile(g, p).object))
      tile(g, p).object = "";
  tile(g, { x: 2, z: 6 }).object = "tree";
  g.counters.tree = 1;
  expect(hire(g, "gardener")).toBe(true);
  advance(g, 30);
  expect(tile(g, { x: 2, z: 6 }).object).toBe("tree");
  expect(g.workers[0].task).toBeNull();
});

test("expired guests replace an endless queued tour with an exit route", () => {
  const g = createGame();
  g.open = true;
  const v = guest(g, 2, 4);
  v.age = 100;
  v.route = [{ x: 3, z: 4 }];
  visit(g, v, 0.25);
  expect(v.route.at(-1)).toEqual({ x: 1, z: 4 });
  expect(v.activity).toBe("leave");
  advance(g, 2);
  expect(g.visitors).not.toContain(v);
});

test("guests use bins, overflowing bins leave litter, and cleaners empty them", () => {
  const g = wealthy();
  g.open = true;
  const v = guest(g, 2, 4);
  const bin = { x: 2, z: 3 };
  tile(g, bin).object = "bin";
  for (let i = 0; i < 3; i++) {
    g.time = 27;
    v.route = [];
    visit(g, v, 0.25);
  }
  expect(tile(g, bin).dirt).toBe(3);
  expect(tile(g, v).dirt).toBe(0);
  v.route = [];
  visit(g, v, 0.25);
  expect(tile(g, v).dirt).toBe(1);
  g.visitors = [];
  expect(hire(g, "cleaner")).toBe(true);
  advance(g, 15);
  expect(tile(g, bin).dirt).toBe(0);
  expect(tile(g, { x: 2, z: 4 }).dirt).toBe(0);
  expect(tile(g, bin).object).toBe("bin");
});

test("workers skip sealed cleanup jobs and perform reachable ones", () => {
  const g = wealthy();
  for (const p of points(g)) tile(g, p).dirt = 0;
  const sealed = { x: 0, z: 0 },
    reachable = { x: 2, z: 5 };
  tile(g, sealed).dirt = 1;
  tile(g, reachable).dirt = 1;
  for (const n of [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
  ])
    g.fences[edgeKey(sealed, n)] = "fence";
  expect(hire(g, "cleaner")).toBe(true);
  advance(g, 20);
  expect(tile(g, sealed).dirt).toBe(1);
  expect(tile(g, reachable).dirt).toBe(0);
});

describe("stocked feeders and water troughs have real contents", () => {
  test("hungry animals consume correct delivered food, not pantry stock or another diet", () => {
    const g = createGame("raccoon"),
      a = g.animals[0],
      feeder = { x: 3, z: 2 };
    expect(feederStock(g, feeder, "fruit")).toBe(1);
    expect(feederStock(g, feeder)).toBe(1);
    a.hunger = 20;
    const pantry = g.inventory.fruit;
    tick(g, 0.25);
    expect(a.hunger).toBe(100);
    expect(a.activity).toBe("eat");
    expect(a.digestion).toBeGreaterThan(7);
    expect(feederStock(g, feeder)).toBe(0);
    expect(g.inventory.fruit).toBe(pantry);
    a.hunger = 20;
    g.counters["feeder3z2.greens"] = 1;
    tick(g, 0.25);
    expect(a.hunger).toBeLessThan(20);
    expect(feederStock(g, feeder, "greens")).toBe(1);
    g.coins = 10;
    buyFood(g, "fruit");
    tick(g, 0.25);
    expect(a.hunger).toBeLessThan(20);
    expect(feederStock(g, feeder, "fruit")).toBe(0);
  });
  test("refilling reserves actual food and the keeper must reach the feeder before it is stocked", () => {
    const g = createGame("raccoon"),
      a = g.animals[0],
      feeder = { x: 3, z: 2 };
    g.counters["feeder3z2.fruit"] = 0;
    const pantry = g.inventory.fruit;
    expect(command(g, "refill", feeder, a.id)).toBe(true);
    expect(g.keeper.task).toMatchObject({
      kind: "refill",
      carrying: "fruit",
      animal: 0,
    });
    expect(g.inventory.fruit).toBe(pantry - 1);
    expect(feederStock(g, feeder)).toBe(0);
    expect(importGame(exportGame(g))).toEqual(g);
    advance(g, 0.25);
    expect(feederStock(g, feeder)).toBe(0);
    advance(g, 10);
    expect(feederStock(g, feeder, "fruit")).toBe(1);
    a.hunger = 20;
    tick(g, 0.25);
    expect(a.hunger).toBe(100);
    expect(feederStock(g, feeder)).toBe(0);
    expect(importGame(exportGame(g))).toEqual(g);
  });
  test("empty inventory, unreachable feeder, wrong object or missing animal never creates food", () => {
    const g = createGame(),
      feeder = { x: 3, z: 2 };
    g.inventory.greens = 0;
    expect(command(g, "refill", feeder)).toBe(false);
    expect(g.message).toBe("noFood");
    expect(command(g, "refill", { x: 2, z: 5 })).toBe(false);
    expect(command(g, "refill", feeder, 999)).toBe(false);
    g.inventory.greens = 5;
    g.fences[edgeKey({ x: 4, z: 3 }, { x: 4, z: 4 })] = "fence";
    expect(command(g, "refill", feeder)).toBe(false);
    expect(g.inventory.greens).toBe(5);
    expect(feederStock(g, feeder)).toBe(1);
  });
  test("trough contents deplete and require the keeper to carry fresh water there", () => {
    const g = createGame(),
      a = g.animals[0],
      trough = { x: 5, z: 2 };
    expect(waterStock(g, trough)).toBe(1);
    a.water = 10;
    tick(g, 0.25);
    expect(a.water).toBe(100);
    expect(waterStock(g, trough)).toBe(0);
    a.water = 10;
    tick(g, 0.25);
    expect(a.water).toBeLessThan(10);
    expect(command(g, "refillWater", trough)).toBe(true);
    expect(waterStock(g, trough)).toBe(0);
    expect(importGame(exportGame(g))).toEqual(g);
    advance(g, 10);
    expect(a.water).toBeGreaterThan(95);
    expect(waterStock(g, trough)).toBe(0);
    expect(command(g, "refillWater", { x: 2, z: 5 })).toBe(false);
    expect(importGame(exportGame(g))).toEqual(g);
  });
  test("animals seek distant resources within their enclosure and never consume through an enclosure fence", () => {
    const g = createGame(),
      a = g.animals[0];
    for (const p of points(g)) tile(g, p).object = "";
    // A larger closed pen creates a genuine trip to the resources.
    g.fences = {};
    for (let x = 2; x <= 8; x++)
      for (let z = 1; z <= 3; z++) {
        const p = { x, z };
        for (const n of [
          { x: x - 1, z },
          { x: x + 1, z },
          { x, z: z - 1 },
          { x, z: z + 1 },
        ])
          if (n.x < 2 || n.x > 8 || n.z < 1 || n.z > 3)
            g.fences[edgeKey(p, n)] = "fence";
      }
    a.x = 2;
    a.z = 2;
    a.hunger = 20;
    a.water = 20;
    const food = { x: 8, z: 2 },
      water = { x: 8, z: 3 };
    tile(g, food).object = "feeder";
    g.counters["feeder8z2.greens"] = 1;
    tile(g, water).object = "trough";
    g.counters["water8z3"] = 1;
    advance(g, 36);
    expect(a.hunger).toBeGreaterThan(95);
    expect(a.water).toBeGreaterThan(95);
    expect(feederStock(g, food)).toBe(0);
    expect(waterStock(g, water)).toBe(0);
    a.hunger = 20;
    a.water = 20;
    a.digestion = 0;
    for (const n of [
      { x: a.x - 1, z: a.z },
      { x: a.x + 1, z: a.z },
      { x: a.x, z: a.z - 1 },
      { x: a.x, z: a.z + 1 },
    ])
      g.fences[edgeKey(a, n)] = "fence";
    g.counters["feeder8z2.greens"] = 1;
    g.counters["water8z3"] = 1;
    advance(g, 10);
    expect(a.hunger).toBeLessThan(20);
    expect(a.water).toBeLessThan(20);
  });
  test("natural water supplies drinking water and stock keys survive land expansion", () => {
    const g = wealthy(),
      a = g.animals[0];
    a.water = 10;
    g.counters["water5z2"] = 0;
    tile(g, { x: 5, z: 2 }).terrain = "water";
    tick(g, 0.25);
    expect(a.water).toBe(100);
    const before = feederStock(g, { x: 3, z: 2 });
    expect(expand(g)).toBe(true);
    expect(feederStock(g, { x: 3, z: 2 })).toBe(before);
    expect(before).toBe(1);
    const legacy = structuredClone(g);
    delete legacy.counters["feeder3z2.greens"];
    const restored = importGame(exportGame(legacy))!;
    expect(feederStock(restored, { x: 3, z: 2 })).toBe(0);
  });
});

test("closing a busy zoo stops admission and all reachable guests walk out", () => {
  const g = wealthy();
  g.open = true;
  tile(g, { x: 2, z: 6 }).object = "popcorn";
  for (const role of ["keeper", "vendor", "gardener", "cleaner"] as const)
    expect(hire(g, role)).toBe(true);
  advance(g, 300);
  expect(g.visitors.length).toBeGreaterThan(0);
  const tickets = g.income.tickets;
  g.open = false;
  // A keeper occupying the entrance must yield rather than imprisoning guests.
  if (!g.visitors.some((v) => equal(v, { x: 1, z: 4 }))) {
    g.keeper.task = null;
    Object.assign(g.keeper, { x: 1, z: 4 });
    tile(g, { x: 1, z: 3 }).object = "";
  }
  for (let i = 0; i < 240; i++) {
    const previous = new Map(g.visitors.map((v) => [v.id, { x: v.x, z: v.z }]));
    tick(g, 0.25);
    allDistinct(g);
    for (const v of g.visitors)
      expect(distance(v, previous.get(v.id)!)).toBeLessThanOrEqual(1);
    expect(g.income.tickets).toBe(tickets);
  }
  expect(g.visitors).toHaveLength(0);
});

test("eating real feeder food completes the feeding tutorial exactly once", () => {
  const g = createGame();
  g.animals[0].hunger = 20;
  tick(g, 0.25);
  expect(g.animals[0].hunger).toBe(100);
  expect(g.counters.feed).toBe(1);
  expect(g.goals).toContain("feed");
  const coins = g.coins;
  advance(g, 1);
  expect(g.counters.feed).toBe(1);
  expect(g.coins).toBe(coins);
});
