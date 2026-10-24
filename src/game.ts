// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import {
  animalNames,
  buildings,
  foods,
  getSpecies,
  personalities,
  roles,
  species,
  terrains,
  type Food,
  type Role,
  type Terrain,
} from "./catalog";
import {
  distance,
  edgeKey,
  enclosure,
  equal,
  inside,
  neighbors,
  pathfind,
  type Point,
} from "./world";
export interface Tile {
  terrain: Terrain;
  object: string;
  dirt: number;
}
export interface Animal extends Point {
  id: number;
  species: string;
  name: string;
  personality: string;
  hunger: number;
  water: number;
  joy: number;
  digestion: number;
  activity: string;
}
export interface Task {
  kind: "feed" | "water" | "pet" | "clean" | "clear" | "repair" | "walk";
  target: Point;
  animal: number;
  route: Point[];
  progress: number;
  carrying: Food | "";
}
export interface Worker extends Point {
  id: number;
  role: Role;
  task: Task | null;
}
export interface Visitor extends Point {
  id: number;
  type: "child" | "parent" | "fan";
  family: number;
  happiness: number;
  hunger: number;
  energy: number;
  fun: number;
  age: number;
  duration: number;
  route: Point[];
  activity: string;
}
export interface Game {
  schema: 1;
  language: "de" | "en";
  size: number;
  coins: number;
  stars: number;
  ticket: number;
  open: boolean;
  time: number;
  nextId: number;
  tiles: Tile[];
  fences: Record<string, "fence" | "highfence" | "gate">;
  animals: Animal[];
  visitors: Visitor[];
  workers: Worker[];
  keeper: Point & { task: Task | null };
  inventory: Record<Food, number>;
  income: { tickets: number; donations: number; sales: number };
  goals: string[];
  counters: Record<string, number>;
  event: string;
  message: string;
  revision: number;
  sound: number;
  music: number;
  paused: boolean;
  seed: number;
}
export const entrance: Point = { x: 1, z: 4 };
export const clamp = (n: number, lo = 0, hi = 100): number =>
  Math.max(lo, Math.min(hi, n));
export function random(g: Game): number {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
export const tile = (g: Game, p: Point): Tile => g.tiles[p.z * g.size + p.x];
export const points = (g: Game): Point[] =>
  g.tiles.map((_, i) => ({ x: i % g.size, z: Math.floor(i / g.size) }));
export const isPath = (g: Game, p: Point): boolean =>
  inside(p, g.size) &&
  ["path", "stonepath", "woodpath", "familypath", "entrance"].includes(
    tile(g, p).object,
  );
export function createGame(starter = "rabbit"): Game {
  if (!["rabbit", "guinea", "goat", "pig", "raccoon"].includes(starter))
    starter = "rabbit";
  const g: Game = {
    schema: 1,
    language: "en",
    size: 8,
    coins: 0,
    stars: 1,
    ticket: 1,
    open: false,
    time: 0,
    nextId: 2,
    tiles: Array.from({ length: 64 }, (_, i) => ({
      terrain: "grass",
      object:
        i % 11 === 0
          ? "stump"
          : i % 7 === 0
            ? "rock"
            : i % 5 === 0
              ? "weed"
              : "",
      dirt: 0,
    })),
    fences: {},
    animals: [],
    visitors: [],
    workers: [],
    keeper: { x: 1, z: 5, task: null },
    inventory: { greens: 5, grain: 5, fruit: 5, fish: 3, meat: 3 },
    income: { tickets: 0, donations: 0, sales: 0 },
    goals: [],
    counters: {},
    event: "welcome",
    message: "welcome",
    revision: 0,
    sound: 0.4,
    music: 0,
    paused: false,
    seed: 42,
  };
  for (let x = 0; x < 8; x++)
    for (const z of [4, 5]) tile(g, { x, z }).object = "path";
  tile(g, entrance).object = "entrance";
  for (let x = 3; x <= 5; x++)
    for (let z = 1; z <= 3; z++) {
      tile(g, { x, z }).object = "";
      for (const n of neighbors({ x, z }))
        if (n.x < 3 || n.x > 5 || n.z < 1 || n.z > 3)
          g.fences[edgeKey({ x, z }, n)] = "fence";
    }
  g.fences[edgeKey({ x: 4, z: 3 }, { x: 4, z: 4 })] = "gate";
  tile(g, { x: 3, z: 2 }).object = "feeder";
  tile(g, { x: 5, z: 2 }).object = "trough";
  tile(g, { x: 5, z: 3 }).object = "donation";
  tile(g, { x: 2, z: 6 }).object = "weed";
  addAnimal(g, starter, { x: 4, z: 2 });
  g.message = "welcome";
  g.event = "welcome";
  g.coins = 0;
  return g;
}
export function addAnimal(g: Game, id: string, p: Point): void {
  const n = g.animals.length;
  g.animals.push({
    ...p,
    id: g.nextId++,
    species: id,
    name: animalNames[n % 4],
    personality: personalities[n % 4],
    hunger: 70,
    water: 80,
    joy: 75,
    digestion: 0,
    activity: "idle",
  });
  g.event = "arrival";
  g.revision++;
}
export function habitat(
  g: Game,
  a: Animal,
): { space: boolean; terrain: boolean; water: boolean; fence: boolean } {
  const s = getSpecies(a.species),
    area = enclosure(a, g.size, g.fences);
  const terrain = area.some((p) => tile(g, p).terrain === s.terrain);
  const water = area.some(
    (p) => tile(g, p).object === "trough" || tile(g, p).terrain === "water",
  );
  const high =
    s.tier < 4 ||
    area.every((p) =>
      neighbors(p).every(
        (n) => !g.fences[edgeKey(p, n)] || g.fences[edgeKey(p, n)] !== "fence",
      ),
    );
  return {
    space: area.length >= s.space,
    terrain,
    water,
    fence: area.length > 0 && high,
  };
}
export function welfare(g: Game, a: Animal): number {
  const h = habitat(g, a);
  const quality = Object.values(h).filter(Boolean).length / 4;
  const dirt = enclosure(a, g.size, g.fences).reduce(
    (sum, p) => sum + tile(g, p).dirt,
    0,
  );
  return clamp(
    ((a.hunger + a.water + a.joy) / 3) * (0.5 + quality * 0.5) - dirt * 3,
  );
}
export function attractiveness(g: Game): number {
  const diversity = new Set(g.animals.map((a) => a.species)).size;
  const happy =
    g.animals.reduce((sum, a) => sum + welfare(g, a), 0) /
    g.animals.length /
    100;
  const amenities = g.tiles.filter((t) =>
    buildings.some(
      (b) =>
        b.id === t.object && ["rest", "play", "shop", "decor"].includes(b.kind),
    ),
  ).length;
  return Math.max(
    1,
    Math.min(20, Math.round(diversity * happy + Math.sqrt(amenities) * 0.65)),
  );
}
export function pay(g: Game, cost: number): boolean {
  if (!Number.isFinite(cost) || cost < 0 || g.coins < cost) {
    g.message = "noCoins";
    return false;
  }
  g.coins -= cost;
  return true;
}
export function buyFood(g: Game, food: Food): boolean {
  if (!foods.includes(food)) return false;
  if (!pay(g, 2)) return false;
  g.inventory[food] += 5;
  g.message = "foodBought";
  return true;
}
export function emergencyFood(g: Game): void {
  for (const f of foods) g.inventory[f] = Math.max(g.inventory[f], 2);
  g.message = "emergencyFood";
}
export function build(g: Game, id: string, p: Point): boolean {
  const b = buildings.find((b) => b.id === id);
  if (!b || !inside(p, g.size)) return false;
  if (b.tier > g.stars) {
    g.message = "locked";
    return false;
  }
  if (
    tile(g, p).object ||
    g.animals.some((a) => equal(a, p)) ||
    g.workers.some((w) => equal(w, p)) ||
    equal(g.keeper, p)
  ) {
    g.message = "occupied";
    return false;
  }
  if (!pay(g, b.cost)) return false;
  tile(g, p).object = id;
  g.revision++;
  g.message = "built";
  g.counters[id] = (g.counters[id] ?? 0) + 1;
  return true;
}
export function paint(g: Game, terrain: Terrain, p: Point): boolean {
  if (!terrains.includes(terrain) || !inside(p, g.size) || !pay(g, 1))
    return false;
  tile(g, p).terrain = terrain;
  g.revision++;
  return true;
}
export function fence(
  g: Game,
  a: Point,
  b: Point,
  kind: "fence" | "highfence" | "gate" | "remove",
): boolean {
  if (
    !["fence", "highfence", "gate", "remove"].includes(kind) ||
    !inside(a, g.size) ||
    !Number.isInteger(b.x) ||
    !Number.isInteger(b.z) ||
    distance(a, b) !== 1
  )
    return false;
  if (kind === "remove") {
    const edge = edgeKey(a, b);
    if (!g.fences[edge]) return false;
    delete g.fences[edge];
    g.revision++;
    g.message = "fenceRemoved";
    return true;
  }
  if (
    g.animals.some((an) => equal(an, a)) &&
    g.fences[edgeKey(a, b)] === kind
  ) {
    g.message = "occupied";
    return false;
  }
  if (!pay(g, kind === "highfence" ? 3 : 1)) return false;
  g.fences[edgeKey(a, b)] = kind;
  g.revision++;
  return true;
}
export function adopt(g: Game, id: string, p: Point): boolean {
  const s = species.find((s) => s.id === id);
  if (!s || !inside(p, g.size)) return false;
  if (s.tier > g.stars) {
    g.message = "locked";
    return false;
  }
  const area = enclosure(p, g.size, g.fences);
  if (
    area.length < s.space ||
    g.animals.some((a) => equal(a, p)) ||
    tile(g, p).object !== ""
  ) {
    g.message = "needEnclosure";
    return false;
  }
  if (!pay(g, s.cost)) return false;
  addAnimal(g, id, p);
  g.message = "arrival";
  return true;
}
export function hire(g: Game, role: Role): boolean {
  if (!roles.includes(role)) return false;
  if (g.workers.length >= 16) {
    g.message = "staffFull";
    return false;
  }
  if (g.stars < 2) {
    g.message = "locked";
    return false;
  }
  if (!pay(g, 15)) return false;
  g.workers.push({ ...entrance, id: g.nextId++, role, task: null });
  g.message = "hired";
  return true;
}
export function expand(g: Game): boolean {
  if (g.size >= 16) {
    g.message = "maxLand";
    return false;
  }
  if (!pay(g, (g.size - 6) * 10)) return false;
  const old = g.size,
    tiles = g.tiles;
  g.size += 2;
  g.tiles = Array.from({ length: g.size * g.size }, (_, i) => {
    const x = i % g.size,
      z = Math.floor(i / g.size);
    return x < old && z < old
      ? tiles[z * old + x]
      : { terrain: "grass", object: (x + z) % 3 === 0 ? "weed" : "", dirt: 0 };
  });
  g.revision++;
  g.event = "expansion";
  g.message = "expanded";
  return true;
}
export function command(
  g: Game,
  kind: Task["kind"],
  p: Point,
  animal = 0,
  actor: Game["keeper"] | Worker = g.keeper,
): boolean {
  if (!inside(p, g.size) || actor.task) {
    g.message = "busy";
    return false;
  }
  const a = g.animals.find((a) => a.id === animal);
  if (["feed", "water", "pet"].includes(kind) && (!a || !equal(a, p)))
    return false;
  const route = pathfind(
    actor,
    p,
    (n) =>
      (kind === "clear" && equal(n, p)) ||
      !["rock", "stump"].includes(tile(g, n).object),
    g.size,
    (a, b) => blockedByFence(g, a, b),
  );
  if (!equal(actor, p) && !route.length) {
    g.message = "noRoute";
    return false;
  }
  const carrying = kind === "feed" ? getSpecies(a!.species).food : "";
  if (carrying) {
    if (g.inventory[carrying] < 1) {
      g.message = "noFood";
      return false;
    }
    g.inventory[carrying]--;
  }
  actor.task = { kind, target: { ...p }, animal, route, progress: 0, carrying };
  g.message = kind;
  return true;
}
function finishTask(g: Game, actor: Game["keeper"] | Worker): void {
  const task = actor.task!,
    a = g.animals.find((a) => a.id === task.animal),
    t = tile(g, task.target);
  if (a) {
    if (task.kind === "feed") {
      a.hunger = 100;
      a.digestion = 8;
      a.activity = "eat";
    }
    if (task.kind === "water") a.water = 100;
    if (task.kind === "pet") {
      a.joy = 100;
      a.activity = "play";
    }
  }
  if (task.kind === "clean") {
    t.dirt = 0;
    if (t.object === "litter") t.object = "";
  }
  if (task.kind === "clear" && ["weed", "rock", "stump"].includes(t.object)) {
    t.object = "";
    g.coins++;
  }
  if (task.kind === "repair") g.counters.repaired = 1;
  g.counters[task.kind] = (g.counters[task.kind] ?? 0) + 1;
  g.message = "done";
  g.revision++;
  actor.task = null;
}
function moveActor(g: Game, actor: Game["keeper"] | Worker, dt: number): void {
  const task = actor.task;
  if (!task) return;
  task.progress += dt;
  while (task.progress >= 0.3 && task.route.length) {
    Object.assign(actor, task.route.shift()!);
    task.progress -= 0.3;
  }
  if (!task.route.length && task.progress >= 0.7) finishTask(g, actor);
}
export const goalIds = [
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
export function goals(g: Game): void {
  const conditions = [
    (g.counters.clear ?? 0) > 0,
    !!g.counters.repaired,
    (g.counters.feed ?? 0) > 0,
    g.open,
    (g.counters.bench ?? 0) > 0,
    (g.counters.happy ?? 0) >= 3,
    g.income.donations >= 20,
    (g.counters.popcorn ?? 0) > 0,
    g.animals.length >= 2,
    g.stars >= 2,
  ];
  goalIds.forEach((id, i) => {
    if (conditions[i] && !g.goals.includes(id)) {
      g.goals.push(id);
      g.coins += i < 4 ? 3 : 8;
      g.event = "goal";
    }
  });
}
function staff(g: Game): void {
  for (const w of g.workers) {
    if (w.task || w.role === "vendor") continue;
    if (w.role === "keeper") {
      const a = g.animals.find(
        (a) =>
          (a.hunger < 65 && g.inventory[getSpecies(a.species).food] > 0) ||
          a.water < 65,
      );
      if (a) {
        const kind =
          a.hunger < 65 && g.inventory[getSpecies(a.species).food] > 0
            ? "feed"
            : "water";
        command(g, kind, a, a.id, w);
        continue;
      }
    }
    const p = points(g).find((p) =>
      w.role === "gardener"
        ? ["weed", "stump", "rock"].includes(tile(g, p).object)
        : tile(g, p).dirt > 0 || tile(g, p).object === "litter",
    );
    if (p) command(g, w.role === "gardener" ? "clear" : "clean", p, 0, w);
  }
}
function earn(g: Game, kind: keyof Game["income"], amount: number): void {
  g.coins += amount;
  g.income[kind] += amount;
  g.event = "coin";
}
function blockedByFence(g: Game, a: Point, b: Point): boolean {
  const kind = g.fences[edgeKey(a, b)];
  return kind === "fence" || kind === "highfence";
}
function visitorRoute(g: Game, start: Point, target: Point): Point[] {
  return pathfind(
    start,
    target,
    (p) => isPath(g, p),
    g.size,
    (a, b) => blockedByFence(g, a, b),
  );
}
export function visit(g: Game, v: Visitor, dt: number): void {
  v.age += dt;
  v.hunger = clamp(v.hunger - dt * 0.8);
  v.energy = clamp(v.energy - dt * 0.6);
  v.fun = clamp(v.fun - dt * 0.4);
  if (v.route.length) {
    const next = v.route[0];
    if (!isPath(g, next) || blockedByFence(g, v, next)) {
      v.route = [];
      v.activity = "watch";
      return;
    }
    if (Math.floor(g.time * 3) !== Math.floor((g.time - dt) * 3))
      Object.assign(v, v.route.shift()!);
    v.activity = "walk";
    return;
  }
  if (v.age > v.duration || !g.open) {
    v.route = visitorRoute(g, v, entrance);
    v.activity = "leave";
    if (equal(v, entrance)) v.age = 999;
    return;
  }
  const around = points(g).filter((p) => distance(p, v) <= 2);
  const amenity = around.map((p) => tile(g, p).object);
  const rest = amenity.some((id) =>
    buildings.some((b) => b.id === id && b.kind === "rest"),
  );
  const play = amenity.some((id) =>
    buildings.some((b) => b.id === id && b.kind === "play"),
  );
  const shop = amenity.some((id) =>
    buildings.some((b) => b.id === id && b.kind === "shop"),
  );
  const animal = g.animals.find((a) => distance(a, v) <= 4);
  v.activity = "watch";
  if (rest && v.energy < 80) {
    v.energy = clamp(v.energy + dt * 5);
    v.duration += dt * 0.4;
    v.activity = "sit";
  }
  if (play && v.type === "child") {
    v.fun = clamp(v.fun + dt * 8);
    v.duration += dt * 0.3;
    v.activity = "jump";
    const parent = g.visitors.find(
      (p) => p.family === v.family && p.type === "parent",
    );
    if (parent) {
      parent.happiness = clamp(parent.happiness + dt * 2);
      parent.duration += dt * 0.3;
    }
  }
  if (shop && v.hunger < 70) {
    v.hunger = 100;
    v.happiness = clamp(v.happiness + 10);
    earn(g, "sales", 2);
    v.activity = "snack";
  }
  const joy = animal ? welfare(g, animal) / 100 : 0;
  const dirty = around.reduce((sum, p) => sum + tile(g, p).dirt, 0);
  v.happiness = clamp(
    v.happiness +
      dt *
        (joy * 2 +
          (rest ? 0.3 : 0) +
          (play ? 0.3 : 0) -
          (v.hunger < 25 ? 1 : 0) -
          (v.energy < 25 ? 1 : 0) -
          dirty * 0.2),
  );
  if (
    animal &&
    v.happiness > 60 &&
    Math.floor(g.time / 5) !== Math.floor((g.time - dt) / 5)
  ) {
    const box = points(g).some(
      (p) => distance(p, animal) <= 3 && tile(g, p).object === "donation",
    );
    if (
      random(g) <
      0.25 * getSpecies(animal.species).bonus +
        (box ? 0.25 : 0) +
        (rest ? 0.15 : 0)
    )
      earn(g, "donations", 1);
  }
  if (v.happiness > 80 && !g.counters[`happy${v.id}`]) {
    g.counters[`happy${v.id}`] = 1;
    g.counters.happy = (g.counters.happy ?? 0) + 1;
  }
  if (Math.floor(g.time / 4) !== Math.floor((g.time - dt) / 4)) {
    const targets = points(g).filter((p) => isPath(g, p) && distance(p, v) > 0);
    const target = targets[Math.floor(random(g) * targets.length)];
    if (target) v.route = visitorRoute(g, v, target);
  }
  if (
    Math.floor(g.time / 27) !== Math.floor((g.time - dt) / 27) &&
    !amenity.includes("bin")
  ) {
    const t = tile(g, v);
    t.dirt = Math.min(3, t.dirt + 1);
    g.revision++;
  }
}
export function tick(g: Game, seconds: number): void {
  if (g.paused || seconds <= 0 || !Number.isFinite(seconds)) return;
  const dt = Math.min(seconds, 0.5),
    prev = g.time;
  g.time += dt;
  moveActor(g, g.keeper, dt);
  for (const w of g.workers) moveActor(g, w, dt);
  for (const a of g.animals) {
    a.hunger = clamp(a.hunger - dt * 0.15);
    a.water = clamp(a.water - dt * 0.12);
    a.joy = clamp(a.joy - dt * 0.07);
    if (a.digestion > 0) {
      a.digestion -= dt;
      if (a.digestion <= 0) {
        tile(g, a).dirt = Math.min(5, tile(g, a).dirt + 1);
        g.revision++;
        a.activity = "idle";
      }
    }
  }
  if (Math.floor(g.time / 2) !== Math.floor(prev / 2)) staff(g);
  if (Math.floor(g.time / 60) !== Math.floor(prev / 60)) {
    g.coins = Math.max(0, g.coins - g.workers.length * 2);
    g.event = ["school", "birthday", "sunny", "family", "photo", "balloon"][
      Math.floor(random(g) * 6)
    ];
  }
  const attraction = attractiveness(g),
    rate = 5 + Math.max(0, g.ticket - attraction) * 5;
  if (
    g.open &&
    g.visitors.length < 40 &&
    Math.floor(g.time / rate) !== Math.floor(prev / rate)
  ) {
    const family = g.nextId;
    const arrivals = (
      family % 3 === 0 ? ["fan"] : ["parent", "child"]
    ) as Visitor["type"][];
    for (const type of g.visitors.length + arrivals.length <= 40
      ? arrivals
      : []) {
      g.visitors.push({
        ...entrance,
        id: g.nextId++,
        type,
        family,
        happiness: 55,
        hunger: 75,
        energy: 80,
        fun: 65,
        age: 0,
        duration: 35 + attraction * 5,
        route: [],
        activity: "wave",
      });
      earn(g, "tickets", g.ticket);
    }
  }
  for (const v of g.visitors) visit(g, v, dt);
  g.visitors = g.visitors.filter((v) => v.age < 999);
  const diversity = new Set(g.animals.map((a) => a.species)).size;
  const progress =
    1 +
    Math.floor(
      (g.goals.length +
        diversity -
        1 +
        g.tiles.filter((t) =>
          buildings.some((b) => b.id === t.object && b.kind !== "path"),
        ).length /
          3) /
        4,
    );
  g.stars = Math.max(g.stars, Math.min(5, progress));
  goals(g);
}
export function advance(g: Game, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  for (let t = 0; t < seconds; t += 0.25) tick(g, Math.min(0.25, seconds - t));
}
