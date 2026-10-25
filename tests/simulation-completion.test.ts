// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, test } from "vitest";
import {
  expand,
  feederStock,
  waterStock,
  addAnimal,
  canRepair,
  canPlant,
  plantCost,
  repairPoint,
  fence,
  paint,
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

describe("care scheduling respects reachable animals and reserved deliveries", () => {
  test("an unreachable animal does not prevent caring for another animal or cleaning", () => {
    const g = wealthy(),
      blocked = g.animals[0];
    g.counters["feeder3z2.greens"] = 0;
    g.counters["water5z2"] = 0;
    blocked.hunger = blocked.water = 5;
    for (const n of [
      { x: 3, z: 2 },
      { x: 5, z: 2 },
      { x: 4, z: 1 },
      { x: 4, z: 3 },
    ])
      g.fences[edgeKey(blocked, n)] = "fence";
    addAnimal(g, "rabbit", { x: 5, z: 3 });
    const reachable = g.animals[1];
    reachable.hunger = 5;
    reachable.water = 100;
    tile(g, { x: 2, z: 5 }).dirt = 1;
    expect(hire(g, "keeper")).toBe(true);
    advance(g, 25);
    expect(reachable.hunger).toBeGreaterThan(90);
    expect(blocked.hunger).toBeLessThan(5);
    expect(tile(g, { x: 2, z: 5 }).dirt).toBe(0);
    expect(importGame(exportGame(g))).toEqual(g);
  });
  test("several carers do not carry duplicate portions to one hungry animal", () => {
    const g = wealthy(),
      a = g.animals[0];
    g.counters["feeder3z2.greens"] = 0;
    a.hunger = 5;
    expect(hire(g, "keeper")).toBe(true);
    expect(hire(g, "keeper")).toBe(true);
    advance(g, 2);
    expect(g.workers.filter((w) => w.task?.animal === a.id)).toHaveLength(1);
    expect(g.inventory.greens).toBe(4);
    advance(g, 20);
    expect(a.hunger).toBeGreaterThan(90);
    expect(g.inventory.greens).toBe(4);
  });
});

describe("active keeper and guest routes can pass safely", () => {
  test("a guest arriving in a queued keeper destination cannot deadlock the exit", () => {
    const g = createGame();
    g.open = true;
    g.time = 0.25;
    Object.assign(g.keeper, { x: 1, z: 4 });
    expect(command(g, "walk", { x: 2, z: 4 })).toBe(true);
    const v = guest(g, 3, 4);
    v.route = [
      { x: 2, z: 4 },
      { x: 1, z: 4 },
    ];
    v.age = 100;
    tick(g, 0.25);
    expect(v).toMatchObject({ x: 2, z: 4 });
    allDistinct(g);
    tick(g, 0.25);
    tick(g, 0.25);
    allDistinct(g);
    expect(g.keeper).toMatchObject({ x: 2, z: 4 });
    expect(v).toMatchObject({ x: 1, z: 4 });
    expect(importGame(exportGame(g))).toEqual(g);
    g.open = false;
    advance(g, 3);
    expect(g.visitors).toHaveLength(0);
    expect(g.keeper.task).toBeNull();
  });
  test("idle keepers yield onto a free path when every neighboring off-path tile is blocked", () => {
    const g = createGame();
    g.open = true;
    Object.assign(g.keeper, { x: 1, z: 4 });
    for (const p of [
      { x: 1, z: 3 },
      { x: 1, z: 5 },
    ])
      tile(g, p).object = "rock";
    const v = guest(g, 2, 4);
    v.age = 100;
    v.route = [{ x: 1, z: 4 }];
    advance(g, 4);
    expect(g.visitors).toHaveLength(0);
    expect(g.keeper).toMatchObject({ x: 0, z: 4 });
    allDistinct(g);
  });
});

test("care tutorial credit requires a real obstacle, dirt or damaged fence", () => {
  const g = wealthy();
  const empty = { x: 2, z: 5 };
  expect(command(g, "clear", empty)).toBe(false);
  expect(command(g, "clean", empty)).toBe(false);
  expect(command(g, "repair", empty)).toBe(false);
  advance(g, 2);
  expect(g.goals).not.toContain("clear");
  expect(g.goals).not.toContain("repair");
  expect(canRepair(g, repairPoint)).toBe(true);
  expect(command(g, "repair", repairPoint)).toBe(true);
  advance(g, 10);
  expect(g.goals).toContain("repair");
  expect(canRepair(g, repairPoint)).toBe(false);
  expect(command(g, "repair", repairPoint)).toBe(false);
  const missing = createGame();
  delete missing.fences[edgeKey(repairPoint, { x: 3, z: 4 })];
  expect(canRepair(missing, repairPoint)).toBe(false);
});

test("repeated terrain and fence clicks never spend coins for an unchanged world", () => {
  const g = wealthy(),
    p = { x: 2, z: 7 },
    next = { x: 2, z: 8 };
  const before = g.coins,
    revision = g.revision;
  expect(paint(g, "grass", p)).toBe(false);
  expect(g.coins).toBe(before);
  expect(g.revision).toBe(revision);
  expect(paint(g, "sand", p)).toBe(true);
  const afterPaint = g.coins;
  expect(paint(g, "sand", p)).toBe(false);
  expect(g.coins).toBe(afterPaint);
  expect(fence(g, p, next, "fence")).toBe(true);
  const afterFence = g.coins,
    afterRevision = g.revision;
  expect(fence(g, p, next, "fence")).toBe(false);
  expect(g.coins).toBe(afterFence);
  expect(g.revision).toBe(afterRevision);
  expect(fence(g, p, next, "highfence")).toBe(true);
  const afterUpgrade = g.coins;
  expect(fence(g, p, next, "highfence")).toBe(false);
  expect(g.coins).toBe(afterUpgrade);
  expect(fence(g, p, next, "gate")).toBe(true);
  const afterGate = g.coins;
  expect(fence(g, p, next, "gate")).toBe(false);
  expect(g.coins).toBe(afterGate);
});

describe("keeper flower planting is paid physical work", () => {
  test("walking and planting completes after travel, preserves a queued save and credits flowers once", () => {
    const g = createGame(),
      p = { x: 3, z: 6 };
    tile(g, p).object = "";
    g.coins = 10;
    expect(canPlant(g, p)).toBe(true);
    expect(command(g, "walk", p)).toBe(true);
    expect(command(g, "plant", p)).toBe(true);
    expect(g.keeper.task?.kind).toBe("plant");
    expect(g.coins).toBe(10 - plantCost);
    expect(tile(g, p).object).toBe("");
    expect(importGame(exportGame(g))).toEqual(g);
    advance(g, 0.25);
    expect(tile(g, p).object).toBe("");
    advance(g, 8);
    expect(tile(g, p).object).toBe("flowers");
    expect(g.counters.plant).toBe(1);
    expect(g.counters.flowers).toBe(1);
    expect(distance(g.keeper, p)).toBe(1);
    expect(g.coins).toBe(8);
    advance(g, 5);
    expect(g.counters.plant).toBe(1);
    expect(g.coins).toBe(8);
    expect(importGame(exportGame(g))).toEqual(g);
  });
  test("poor, busy, occupied and unreachable planting requests preserve funds and queued walks", () => {
    const g = createGame(),
      p = { x: 3, z: 6 };
    tile(g, p).object = "";
    expect(command(g, "walk", p)).toBe(true);
    const walk = g.keeper.task;
    expect(command(g, "plant", p)).toBe(false);
    expect(g.keeper.task).toBe(walk);
    expect(g.message).toBe("noCoins");
    g.keeper.task = null;
    g.coins = 10;
    expect(canPlant(g, { x: -1, z: 2 })).toBe(false);
    expect(command(g, "plant", g.animals[0])).toBe(false);
    expect(command(g, "plant", { x: 3, z: 2 })).toBe(false);
    const a = g.animals[0];
    expect(command(g, "feed", a, a.id)).toBe(true);
    expect(command(g, "plant", p)).toBe(false);
    expect(g.message).toBe("busy");
    g.keeper.task = null;
    for (const q of points(g))
      if (distance(q, p) === 1) tile(g, q).object = "rock";
    expect(command(g, "plant", p)).toBe(false);
    expect(g.message).toBe("noRoute");
    expect(g.coins).toBe(10);
  });
  test("a structure built during travel is preserved and planting money is refunded", () => {
    const g = createGame(),
      p = { x: 3, z: 6 };
    tile(g, p).object = "";
    g.coins = 10;
    expect(command(g, "plant", p)).toBe(true);
    tile(g, p).object = "bench";
    expect(importGame(exportGame(g))).toEqual(g);
    advance(g, 10);
    expect(tile(g, p).object).toBe("bench");
    expect(g.coins).toBe(10);
    expect(g.counters.plant).toBeUndefined();
    expect(g.counters.flowers).toBeUndefined();
    expect(g.message).toBe("occupied");
  });
  test("an animal occupying the planting plot is not overwritten", () => {
    const g = createGame(),
      p = { x: 3, z: 6 };
    tile(g, p).object = "";
    g.coins = 10;
    expect(command(g, "plant", p)).toBe(true);
    addAnimal(g, "rabbit", p);
    advance(g, 8);
    expect(tile(g, p).object).toBe("");
    expect(g.animals.some((a) => equal(a, p))).toBe(true);
    // Taking in a second animal completes a separate three-coin goal.
    expect(g.coins).toBe(13);
    expect(g.counters.plant).toBeUndefined();
    expect(g.counters.flowers).toBeUndefined();
  });
});

test("the keeper can plant after already walking onto the chosen plot", () => {
  const g = createGame();
  const plot = { x: 2, z: 6 };
  tile(g, plot).object = "";
  g.coins = 10;
  expect(command(g, "walk", plot)).toBe(true);
  advance(g, 8);
  expect(equal(g.keeper, plot)).toBe(true);
  expect(canPlant(g, plot)).toBe(true);
  expect(command(g, "plant", plot)).toBe(true);
  expect(g.coins).toBe(8);
  expect(tile(g, plot).object).toBe("");
  expect(g.keeper.task!.route.length).toBeGreaterThan(0);
  advance(g, 8);
  expect(distance(g.keeper, plot)).toBe(1);
  expect(tile(g, plot).object).toBe("flowers");
  expect(g.counters.plant).toBe(1);
  expect(g.coins).toBe(8);
});
