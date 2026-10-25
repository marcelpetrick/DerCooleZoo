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
  key,
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
  kind:
    | "feed"
    | "water"
    | "pet"
    | "clean"
    | "clear"
    | "repair"
    | "walk"
    | "refill"
    | "refillWater"
    | "plant";
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
export const repairPoint: Point = { x: 3, z: 3 };
const damagedEdge = edgeKey(repairPoint, { x: 3, z: 4 });
export const canRepair = (g: Game, p: Point): boolean =>
  equal(p, repairPoint) && !g.counters.repaired && !!g.fences[damagedEdge];
export const clamp = (n: number, lo = 0, hi = 100): number =>
  Math.max(lo, Math.min(hi, n));
export function random(g: Game): number {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
export const tile = (g: Game, p: Point): Tile => g.tiles[p.z * g.size + p.x];
const foodStockKey = (p: Point, food: Food): string =>
  `feeder${p.x}z${p.z}.${food}`;
const waterStockKey = (p: Point): string => `water${p.x}z${p.z}`;
export function feederStock(g: Game, p: Point, food?: Food): number {
  return food
    ? (g.counters[foodStockKey(p, food)] ?? 0)
    : foods.reduce((sum, f) => sum + (g.counters[foodStockKey(p, f)] ?? 0), 0);
}
export function waterStock(g: Game, p: Point): number {
  return g.counters[waterStockKey(p)] ?? 0;
}
export const points = (g: Game): Point[] =>
  g.tiles.map((_, i) => ({ x: i % g.size, z: Math.floor(i / g.size) }));
export const isPath = (g: Game, p: Point): boolean =>
  inside(p, g.size) &&
  ["path", "stonepath", "woodpath", "familypath", "entrance"].includes(
    tile(g, p).object,
  );
export const plantCost = 2;
const clearable = ["weed", "rock", "stump", "tree"];
export const figures = (g: Game): Point[] => [
  g.keeper,
  ...g.animals,
  ...g.workers,
  ...g.visitors,
];
export const occupied = (g: Game, p: Point, except?: Point): boolean =>
  figures(g).some((figure) => figure !== except && equal(figure, p));
export const canPlant = (g: Game, p: Point, actor: Point = g.keeper): boolean =>
  inside(p, g.size) && tile(g, p).object === "" && !occupied(g, p, actor);
export const passable = (g: Game, p: Point): boolean =>
  inside(p, g.size) &&
  [
    "",
    "weed",
    "flowers",
    "litter",
    "path",
    "stonepath",
    "woodpath",
    "familypath",
    "entrance",
  ].includes(tile(g, p).object);
export function naturalTile(x: number, z: number): Tile {
  const patch =
    Math.sin(x * 0.63) + Math.cos(z * 0.81) + Math.sin((x + z) * 0.47);
  const value = ((x * 73 + z * 131 + x * z * 17) % 101) / 101;
  return {
    terrain: "grass",
    object:
      value < 0.055
        ? "stump"
        : value < 0.13
          ? "rock"
          : value < 0.24 && patch > 0
            ? "tree"
            : value < 0.42 + patch * 0.08
              ? "weed"
              : "",
    dirt: 0,
  };
}
export function createGame(starter = "rabbit"): Game {
  if (!["rabbit", "guinea", "goat", "pig", "raccoon"].includes(starter))
    starter = "rabbit";
  const g: Game = {
    schema: 1,
    language: "en",
    size: 12,
    coins: 0,
    stars: 1,
    ticket: 1,
    open: false,
    time: 0,
    nextId: 2,
    tiles: Array.from({ length: 144 }, (_, i) =>
      naturalTile(i % 12, Math.floor(i / 12)),
    ),
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
  tile(g, { x: 6, z: 3 }).object = "donation";
  tile(g, { x: 2, z: 6 }).object = "weed";
  addAnimal(g, starter, { x: 4, z: 2 });
  g.counters[foodStockKey({ x: 3, z: 2 }, getSpecies(starter).food)] = 1;
  g.counters[waterStockKey({ x: 5, z: 2 })] = 1;
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
): Record<
  | "space"
  | "terrain"
  | "water"
  | "fence"
  | "feeder"
  | "shelter"
  | "plants"
  | "rocks",
  boolean
> {
  const s = getSpecies(a.species),
    area = enclosure(a, g.size, g.fences);
  const cells = area.map((p) => tile(g, p));
  const preferred = cells.filter(
    (t) =>
      t.terrain === s.terrain || (s.id === "giraffe" && t.terrain === "grass"),
  ).length;
  const terrain = preferred >= Math.max(1, Math.ceil(area.length * 0.4));
  const aquatic = [
    "otter",
    "flamingo",
    "crocodile",
    "penguin",
    "hippo",
  ].includes(s.id);
  const pool = cells.filter((t) => t.terrain === "water").length;
  const water = aquatic
    ? pool >= Math.max(1, Math.ceil(area.length * 0.2)) &&
      pool <= Math.floor(area.length * 0.65)
    : cells.some((t) => t.object === "trough" || t.terrain === "water");
  const region = new Set(area.map(key));
  const requiredSpace = g.animals
    .filter((animal) => region.has(key(animal)))
    .reduce((total, animal) => total + getSpecies(animal.species).space, 0);
  const high =
    s.tier < 4 ||
    area.every((p) =>
      neighbors(p).every(
        (n) => !g.fences[edgeKey(p, n)] || g.fences[edgeKey(p, n)] !== "fence",
      ),
    );
  return {
    space: area.length >= Math.max(s.space, requiredSpace),
    terrain,
    water,
    fence: area.length > 0 && high,
    feeder: cells.some((t) => t.object === "feeder"),
    shelter: s.tier < 3 || cells.some((t) => t.object === "shelter"),
    plants:
      !["iguana", "parrot"].includes(s.id) ||
      cells.some((t) => ["tree", "flowers"].includes(t.object)),
    rocks:
      !["iguana", "penguin"].includes(s.id) ||
      cells.some((t) => t.terrain === "rock"),
  };
}
export function welfare(g: Game, a: Animal): number {
  const h = habitat(g, a);
  const quality =
    Object.values(h).filter(Boolean).length / Object.keys(h).length;
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
  const naturalTrees = Math.max(
    0,
    g.tiles.filter((t) => t.object === "tree").length - (g.counters.tree ?? 0),
  );
  const amenities = g.tiles.filter((t) =>
    buildings.some(
      (b) =>
        b.id === t.object && ["rest", "play", "shop", "decor"].includes(b.kind),
    ),
  ).length;
  return Math.max(
    1,
    Math.min(
      20,
      Math.round(
        diversity * happy + Math.sqrt(amenities - naturalTrees) * 0.65,
      ),
    ),
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
  g.inventory[food] +=
    food === "greens" && g.animals.some((a) => a.species === "rabbit") ? 6 : 5;
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
  if (tile(g, p).object || occupied(g, p)) {
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
  if (!terrains.includes(terrain) || !inside(p, g.size)) return false;
  if (tile(g, p).terrain === terrain || !pay(g, 1)) return false;
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
  if (g.fences[edgeKey(a, b)] === kind) {
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
  const region = new Set(area.map(key));
  const usedSpace = g.animals
    .filter((a) => region.has(key(a)))
    .reduce((total, a) => total + getSpecies(a.species).space, 0);
  if (
    area.length < s.space + usedSpace ||
    occupied(g, p) ||
    tile(g, p).object !== ""
  ) {
    g.message = "needEnclosure";
    return false;
  }
  if (!pay(g, s.cost)) return false;
  addAnimal(g, id, p);
  g.counters.adopted = (g.counters.adopted ?? 0) + 1;
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
  const spawn = points(g)
    .filter((p) => passable(g, p) && !isPath(g, p) && !occupied(g, p))
    .filter((p) =>
      [g.keeper, ...g.workers].every(
        (actor) =>
          equal(actor, entrance) ||
          pathfind(
            actor,
            entrance,
            (n) =>
              passable(g, n) &&
              !equal(n, p) &&
              (equal(n, entrance) || !occupied(g, n, actor)),
            g.size,
            (a, b) => blockedByFence(g, a, b),
          ).length > 0,
      ),
    )
    .sort(
      (a, b) =>
        distance(a, entrance) +
        (isPath(g, a) ? 3 : 0) -
        distance(b, entrance) -
        (isPath(g, b) ? 3 : 0),
    )
    .find(
      (p) =>
        equal(p, entrance) ||
        pathfind(
          entrance,
          p,
          (n) => passable(g, n) && !occupied(g, n),
          g.size,
          (a, b) => blockedByFence(g, a, b),
        ).length > 0,
    );
  if (!spawn) {
    g.message = "occupied";
    return false;
  }
  if (!pay(g, 15)) return false;
  g.workers.push({ ...spawn, id: g.nextId++, role, task: null });
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
    return x < old && z < old ? tiles[z * old + x] : naturalTile(x, z);
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
  if (
    !inside(p, g.size) ||
    (actor.task && !(kind === "plant" && actor.task.kind === "walk"))
  ) {
    g.message = "busy";
    return false;
  }
  if (
    (kind === "repair" && !canRepair(g, p)) ||
    (kind === "clear" && !clearable.includes(tile(g, p).object)) ||
    (kind === "clean" &&
      tile(g, p).dirt === 0 &&
      tile(g, p).object !== "litter")
  )
    return false;
  if (kind === "plant" && !canPlant(g, p, actor)) {
    g.message = "occupied";
    return false;
  }
  let a = g.animals.find((a) => a.id === animal);
  if (kind === "refill") {
    const area = new Set(enclosure(p, g.size, g.fences).map(key));
    a = g.animals.find(
      (candidate) =>
        area.has(key(candidate)) && (!animal || candidate.id === animal),
    );
    if (tile(g, p).object !== "feeder" || !a) {
      g.message = "needEnclosure";
      return false;
    }
  }
  if (kind === "refillWater" && tile(g, p).object !== "trough") return false;
  if (["feed", "water", "pet"].includes(kind) && (!a || !equal(a, p)))
    return false;
  const route = taskRoute(g, actor, kind, p);
  if (route === null) {
    g.message = "noRoute";
    return false;
  }
  const carrying =
    kind === "feed" || kind === "refill" ? getSpecies(a!.species).food : "";
  if (carrying) {
    if (g.inventory[carrying] < 1) {
      g.message = "noFood";
      return false;
    }
    g.inventory[carrying]--;
  }
  if (kind === "plant" && !pay(g, plantCost)) return false;
  actor.task = {
    kind,
    target: { x: p.x, z: p.z },
    animal:
      kind === "refill" || kind === "refillWater" || kind === "plant"
        ? 0
        : animal,
    route,
    progress: 0,
    carrying,
  };
  g.message = kind;
  return true;
}
function finishTask(g: Game, actor: Game["keeper"] | Worker): void {
  const task = actor.task!,
    a = g.animals.find((a) => a.id === task.animal),
    t = tile(g, task.target);
  let completed = true;
  if (task.kind === "plant") {
    if (canPlant(g, task.target, actor)) {
      t.object = "flowers";
      g.counters.flowers = (g.counters.flowers ?? 0) + 1;
    } else {
      g.coins += plantCost;
      completed = false;
    }
  }
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
  if (task.kind === "refill" && task.carrying) {
    const stock = foodStockKey(task.target, task.carrying);
    g.counters[stock] = (g.counters[stock] ?? 0) + 1;
  }
  if (task.kind === "refillWater") {
    const stock = waterStockKey(task.target);
    g.counters[stock] = (g.counters[stock] ?? 0) + 1;
  }
  if (task.kind === "clean") {
    t.dirt = 0;
    if (t.object === "litter") t.object = "";
  }
  if (task.kind === "clear" && clearable.includes(t.object)) t.object = "";
  if (task.kind === "repair") g.counters.repaired = 1;
  if (completed) g.counters[task.kind] = (g.counters[task.kind] ?? 0) + 1;
  g.message = completed ? "done" : "occupied";
  g.revision++;
  actor.task = null;
  if (
    task.kind !== "walk" &&
    neighbors(actor).some((p) => g.fences[edgeKey(actor, p)] === "gate")
  ) {
    const aside = neighbors(actor)
      .filter(
        (p) =>
          passable(g, p) &&
          !occupied(g, p) &&
          !blockedByFence(g, actor, p) &&
          distance(p, task.target) > distance(actor, task.target),
      )
      .sort((a, b) => Number(isPath(g, b)) - Number(isPath(g, a)))[0];
    if (aside)
      actor.task = {
        kind: "walk",
        target: aside,
        animal: 0,
        route: [aside],
        progress: 0,
        carrying: "",
      };
  }
}
/** Release a job's undelivered supplies exactly once. */
export function cancelTask(
  g: Game,
  actor: Game["keeper"] | Worker = g.keeper,
): boolean {
  const task = actor.task;
  if (!task) return false;
  if (task.carrying) g.inventory[task.carrying]++;
  if (task.kind === "plant") g.coins += plantCost;
  actor.task = null;
  g.message = "cancelled";
  return true;
}
export function taskRoute(
  g: Game,
  actor: Point,
  kind: Task["kind"],
  target: Point,
  ignoreFigures = false,
): Point[] | null {
  const busy = new Set(
    ignoreFigures
      ? []
      : figures(g)
          .filter((figure) => figure !== actor)
          .map(key),
  );
  const canWalk = (p: Point) => passable(g, p) && !busy.has(key(p));
  const candidates = (kind === "walk" ? [target] : neighbors(target))
    .filter(
      (p) => canWalk(p) && (kind === "walk" || !blockedByFence(g, p, target)),
    )
    .sort((a, b) => distance(actor, a) - distance(actor, b));
  for (const end of candidates) {
    if (equal(actor, end)) return [];
    const route = pathfind(actor, end, canWalk, g.size, (a, b) =>
      blockedByFence(g, a, b),
    );
    if (route.length) return route;
  }
  return null;
}
function moveActor(
  g: Game,
  actor: Game["keeper"] | Worker,
  dt: number,
  movedGuests: Set<Visitor>,
): void {
  const task = actor.task;
  if (!task) return;
  task.progress += dt;
  while (task.progress >= 0.55 && task.route.length) {
    const next = task.route[0];
    const guest = g.visitors.find(
      (v) => equal(v, next) && v.route.length > 0 && equal(v.route[0], actor),
    );
    if (
      guest &&
      !movedGuests.has(guest) &&
      isPath(g, actor) &&
      isPath(g, next) &&
      !blockedByFence(g, actor, next)
    ) {
      const previous = { x: actor.x, z: actor.z };
      Object.assign(actor, task.route.shift()!);
      Object.assign(guest, previous);
      guest.route.shift();
      guest.activity = "walk";
      movedGuests.add(guest);
      task.progress -= 0.55;
      continue;
    }
    if (
      !passable(g, next) ||
      occupied(g, next, actor) ||
      blockedByFence(g, actor, next)
    ) {
      const route = taskRoute(g, actor, task.kind, task.target);
      task.progress = Math.min(task.progress, 0.55);
      if (route === null) {
        // People can move aside; changed buildings or fences cannot. Release
        // impossible jobs rather than trapping the keeper in a permanent wait.
        if (taskRoute(g, actor, task.kind, task.target, true) === null) {
          cancelTask(g, actor);
          g.message = "noRoute";
        }
        return;
      }
      task.route = route;
      if (!route.length) break;
    }
    Object.assign(actor, task.route.shift()!);
    task.progress -= 0.55;
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
      g.coins += i < 4 ? 1 : 3;
      g.event = "goal";
    }
  });
}
function staff(g: Game): void {
  for (const w of g.workers) {
    if (w.task) continue;
    if (w.role === "vendor") {
      const shops = points(g).filter((p) =>
        buildings.some((b) => b.id === tile(g, p).object && b.kind === "shop"),
      );
      if (shops.some((shop) => distance(shop, w) === 1)) continue;
      const station = shops
        .flatMap(neighbors)
        .find(
          (p) =>
            passable(g, p) &&
            !occupied(g, p) &&
            taskRoute(g, w, "walk", p) !== null,
        );
      if (station) command(g, "walk", station, 0, w);
      continue;
    }
    if (w.role === "keeper") {
      const assigned = new Set(
        [g.keeper, ...g.workers].map((actor) => actor.task?.animal),
      );
      const care = g.animals.flatMap((a) => {
        if (assigned.has(a.id)) return [];
        const kinds: Task["kind"][] = [];
        if (a.hunger < 65 && g.inventory[getSpecies(a.species).food] > 0)
          kinds.push("feed");
        if (a.water < 65) kinds.push("water");
        return kinds
          .filter((kind) => taskRoute(g, w, kind, a) !== null)
          .map((kind) => ({ animal: a, kind }));
      })[0];
      if (care) {
        command(g, care.kind, care.animal, care.animal.id, w);
        continue;
      }
    }
    const p = points(g).find(
      (p) =>
        (w.role === "gardener"
          ? ["weed", "rock", "stump"].includes(tile(g, p).object)
          : tile(g, p).dirt > 0 || tile(g, p).object === "litter") &&
        taskRoute(g, w, w.role === "gardener" ? "clear" : "clean", p) !== null,
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
    (p) =>
      isPath(g, p) &&
      !g.animals.some((actor) => equal(actor, p) && actor !== start),
    g.size,
    (a, b) => blockedByFence(g, a, b),
  );
}
function rotateVisitors(g: Game, first: Visitor, moved: Set<Visitor>): boolean {
  const cycle: Visitor[] = [];
  let current = first;
  while (!cycle.includes(current)) {
    if (moved.has(current)) return false;
    cycle.push(current);
    const next = current.route[0];
    if (!next || !isPath(g, next) || blockedByFence(g, current, next))
      return false;
    const occupant = g.visitors.find((other) => equal(other, next));
    if (!occupant) return false;
    current = occupant;
  }
  if (current !== first) return false;
  for (const visitor of cycle) {
    Object.assign(visitor, visitor.route.shift()!);
    visitor.activity = "walk";
    moved.add(visitor);
  }
  return true;
}
export function visit(
  g: Game,
  v: Visitor,
  dt: number,
  moved = new Set<Visitor>(),
): void {
  v.age += dt;
  v.hunger = clamp(v.hunger - dt * 0.8);
  v.energy = clamp(v.energy - dt * 0.6);
  v.fun = clamp(v.fun - dt * 0.4);
  if (v.age > v.duration || !g.open) {
    if (equal(v, entrance)) {
      v.age = 999;
      return;
    }
    if (!v.route.length || !equal(v.route[v.route.length - 1], entrance)) {
      v.route = visitorRoute(g, v, entrance);
      v.activity = "leave";
      return;
    }
  }
  if (v.route.length) {
    if (moved.has(v)) return;
    const next = v.route[0];
    const step = Math.floor(g.time * 2) !== Math.floor((g.time - dt) * 2);
    if (step && rotateVisitors(g, v, moved)) return;
    const blocker = [g.keeper, ...g.workers].find(
      (actor) => equal(actor, next) && !actor.task,
    );
    if (blocker) {
      const aside = neighbors(blocker)
        .filter(
          (p) =>
            passable(g, p) && !occupied(g, p) && !blockedByFence(g, blocker, p),
        )
        .sort((a, b) => Number(isPath(g, a)) - Number(isPath(g, b)))[0];
      if (aside) command(g, "walk", aside, 0, blocker);
    }
    if (
      !isPath(g, next) ||
      occupied(g, next, v) ||
      blockedByFence(g, v, next)
    ) {
      const target = v.route[v.route.length - 1];
      v.route = visitorRoute(g, v, target);
      v.activity = "watch";
      return;
    }
    if (step) {
      Object.assign(v, v.route.shift()!);
      moved.add(v);
    }
    v.activity = "walk";
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
    const staffed = around.some(
      (p) =>
        buildings.some(
          (b) => b.id === tile(g, p).object && b.kind === "shop",
        ) &&
        g.workers.some(
          (w) => w.role === "vendor" && !w.task && distance(w, p) === 1,
        ),
    );
    earn(g, "sales", staffed ? 3 : 2);
    if (staffed) v.happiness = clamp(v.happiness + 5);
    v.activity = "snack";
  }
  const joy = animal ? welfare(g, animal) / 100 : 0;
  if (animal?.species === "pig" && v.type === "child")
    v.fun = clamp(v.fun + dt * 0.5);
  const dirty = around.reduce((sum, p) => sum + tile(g, p).dirt, 0);
  v.happiness = clamp(
    v.happiness +
      dt *
        (joy * 2 +
          (rest ? 0.3 : 0) +
          (play ? 0.3 : 0) +
          (activeEvent(g) === "photo" && animal ? 0.5 : 0) -
          (v.hunger < 25 ? 1 : 0) -
          (v.energy < 25 ? 1 : 0) -
          dirty * 0.2),
  );
  if (
    animal &&
    v.happiness > 60 &&
    Math.floor(g.time / 12) !== Math.floor((g.time - dt) / 12)
  ) {
    const box = points(g).some(
      (p) => distance(p, animal) <= 3 && tile(g, p).object === "donation",
    );
    if (
      random(g) <
      0.1 * getSpecies(animal.species).bonus +
        (box ? 0.15 : 0) +
        (rest ? 0.08 : 0) +
        (activeEvent(g) === "photo" ? 0.15 : 0)
    )
      earn(g, "donations", 1);
  }
  if (v.happiness > 80 && !g.counters[`happy${v.id}`]) {
    g.counters[`happy${v.id}`] = 1;
    g.counters.happy = (g.counters.happy ?? 0) + 1;
  }
  if (Math.floor(g.time / 4) !== Math.floor((g.time - dt) / 4)) {
    const targets = points(g).filter(
      (p) => isPath(g, p) && !occupied(g, p, v) && distance(p, v) > 0,
    );
    const target = targets[Math.floor(random(g) * targets.length)];
    if (target) v.route = visitorRoute(g, v, target);
  }
  if (Math.floor(g.time / 27) !== Math.floor((g.time - dt) / 27)) {
    const bin = around.find(
      (p) => tile(g, p).object === "bin" && tile(g, p).dirt < 3,
    );
    const t = tile(g, bin ?? v);
    t.dirt = Math.min(3, t.dirt + 1);
    g.revision++;
  }
}
export const friendlyEvents = [
  "school",
  "birthday",
  "sunny",
  "family",
  "photo",
  "balloon",
] as const;
export type FriendlyEvent = (typeof friendlyEvents)[number];
export function activeEvent(g: Game): FriendlyEvent | "" {
  return g.counters.eventStarted !== undefined &&
    g.time >= g.counters.eventStarted &&
    g.time - g.counters.eventStarted < 20
    ? (friendlyEvents[g.counters.eventType] ?? "")
    : "";
}
export function startEvent(g: Game, event: FriendlyEvent): void {
  g.counters.eventStarted = g.time;
  g.counters.eventType = friendlyEvents.indexOf(event);
  g.counters.eventIndex = (g.counters.eventIndex ?? 0) + 1;
  g.event = event;
  if (event === "birthday") {
    const animal = g.animals[Math.floor(random(g) * g.animals.length)];
    animal.joy = 100;
    animal.activity = "play";
  }
  for (const visitor of g.visitors) {
    visitor.happiness = clamp(
      visitor.happiness + (event === "balloon" ? 12 : 5),
    );
    if (event === "birthday" || event === "balloon") visitor.activity = "wave";
    if (event === "family") visitor.duration += 10;
  }
}
export function animalRoutine(g: Game, a: Animal, previous: number): void {
  // Care targets stay put until the keeper has completed the delivery.
  if ([g.keeper, ...g.workers].some((actor) => actor.task?.animal === a.id))
    return;
  const cells = enclosure(a, g.size, g.fences);
  const food = getSpecies(a.species).food;
  const feeding = a.hunger < 60;
  const thirsty = a.water < 60;
  const foodSources = feeding
    ? cells.filter(
        (p) => tile(g, p).object === "feeder" && feederStock(g, p, food) > 0,
      )
    : [];
  const waterSources = thirsty
    ? cells.filter(
        (p) =>
          (tile(g, p).object === "trough" && waterStock(g, p) > 0) ||
          tile(g, p).terrain === "water",
      )
    : [];
  const foodNear = foodSources.find((p) => distance(p, a) <= 2);
  const waterNear = waterSources.find((p) => distance(p, a) <= 2);
  if (foodNear) {
    g.counters[foodStockKey(foodNear, food)]--;
    g.counters.feed = (g.counters.feed ?? 0) + 1;
    a.hunger = 100;
    a.digestion = 8;
    a.activity = "eat";
    g.revision++;
  }
  if (waterNear) {
    if (tile(g, waterNear).terrain !== "water")
      g.counters[waterStockKey(waterNear)]--;
    a.water = 100;
    g.revision++;
  }
  if (a.digestion > 0) return;
  const needs = [...foodSources, ...waterSources].sort(
    (p, q) => distance(p, a) - distance(q, a),
  );
  const phase = (g.time + a.id * 7) % 60;
  const sleepy = phase >= (a.personality === "sleepy" ? 36 : 43) && phase < 50;
  if (sleepy && !needs.length) {
    a.activity = "sleep";
    return;
  }
  a.activity =
    tile(g, a).terrain === "water"
      ? "swim"
      : a.joy > 60 && (a.personality === "playful" || phase < 12)
        ? "play"
        : "idle";
  if (
    (g.time < 30 && !needs.length) ||
    Math.floor(g.time / 4) === Math.floor(previous / 4)
  )
    return;
  const area = new Set(cells.map(key));
  const canWalk = (p: Point) =>
    area.has(key(p)) && passable(g, p) && !occupied(g, p);
  if (needs.length) {
    for (const source of needs) {
      const targets = cells
        .filter((p) => distance(p, source) <= 2 && canWalk(p))
        .sort((p, q) => distance(a, p) - distance(a, q));
      for (const target of targets) {
        const route = pathfind(a, target, canWalk, g.size);
        if (route.length) {
          Object.assign(a, route[0]);
          return;
        }
      }
    }
    return;
  }
  const destinations = neighbors(a).filter(canWalk);
  const next = destinations[Math.floor(random(g) * destinations.length)];
  if (next) {
    Object.assign(a, next);
    if (tile(g, a).terrain === "water") a.activity = "swim";
  }
}
export function tick(g: Game, seconds: number): void {
  if (g.paused || seconds <= 0 || !Number.isFinite(seconds)) return;
  const dt = Math.min(seconds, 0.5),
    prev = g.time;
  g.time += dt;
  const moved = new Set<Visitor>();
  moveActor(g, g.keeper, dt, moved);
  for (const w of g.workers) moveActor(g, w, dt, moved);
  for (const a of g.animals) {
    const upkeep = a.species === "guinea" ? 0.9 : 1;
    a.hunger = clamp(a.hunger - dt * 0.15 * upkeep);
    a.water = clamp(a.water - dt * 0.12 * upkeep);
    a.joy = clamp(a.joy - dt * 0.07 * upkeep);
    animalRoutine(g, a, prev);
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
    startEvent(
      g,
      friendlyEvents[Math.floor(random(g) * friendlyEvents.length)],
    );
  }
  const attraction = attractiveness(g),
    rate =
      Math.max(
        10,
        18 -
          Math.max(0, attraction - g.ticket) * 0.5 -
          (activeEvent(g) === "sunny" ? 3 : 0) -
          (g.visitors.some((v) => v.happiness > 80) ? 1 : 0),
      ) +
      Math.max(0, g.ticket - attraction) * 12;
  if (
    g.open &&
    g.visitors.length < 40 &&
    Math.floor(g.time / rate) !== Math.floor(prev / rate)
  ) {
    const family = g.nextId;
    const arrivals = (
      activeEvent(g) === "school"
        ? ["parent", "child", "child"]
        : activeEvent(g) === "family"
          ? ["parent", "child"]
          : family % 3 === 0
            ? ["fan"]
            : ["parent", "child"]
    ) as Visitor["type"][];
    const spawn = [entrance, ...neighbors(entrance)].filter(
      (p) =>
        isPath(g, p) &&
        !occupied(g, p) &&
        (equal(p, entrance) || !blockedByFence(g, entrance, p)),
    );
    for (const [index, type] of (g.visitors.length + arrivals.length <= 40 &&
    spawn.length >= arrivals.length
      ? arrivals
      : []
    ).entries()) {
      g.visitors.push({
        ...spawn[index],
        id: g.nextId++,
        type,
        family,
        happiness: 55,
        hunger: 75,
        energy: 80,
        fun: 65,
        age: 0,
        duration: 35 + attraction * 5 + (activeEvent(g) === "family" ? 15 : 0),
        route: [],
        activity: "wave",
      });
      earn(g, "tickets", g.ticket);
    }
  }
  for (const v of g.visitors) visit(g, v, dt, moved);
  g.visitors = g.visitors.filter((v) => {
    if (v.age < 999) return true;
    delete g.counters[`happy${v.id}`];
    return false;
  });
  const diversity = new Set(g.animals.map((a) => a.species)).size;
  const progress =
    1 +
    Math.floor(
      (g.goals.length +
        diversity -
        1 +
        (g.animals.every((a) => welfare(g, a) >= 85) ? 0.75 : 0) +
        (g.counters.clean && !g.tiles.some((t) => t.dirt > 0) ? 0.5 : 0) +
        (g.visitors.some((v) => v.happiness > 80) ? 0.75 : 0) +
        (g.size - 12) / 2 +
        g.tiles.filter((t) =>
          buildings.some((b) => b.id === t.object && b.kind !== "path"),
        ).length /
          3 -
        Math.max(
          0,
          g.tiles.filter((t) => t.object === "tree").length -
            (g.counters.tree ?? 0),
        ) /
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
