// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import {
  animalNames,
  buildings,
  foods,
  personalities,
  roles,
  species,
  terrains,
} from "./catalog";
import { goalIds, type Game } from "./game";
import { distance, equal, inside, type Point } from "./world";
export const saveKey = "dercoolezoo.save.v1";
type Check = (value: unknown) => boolean;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const number =
  (min: number, max: number, integer = false): Check =>
  (value) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value));
const choice =
  (values: readonly unknown[]): Check =>
  (value) =>
    values.includes(value);
const list =
  (check: Check, max: number): Check =>
  (value) =>
    Array.isArray(value) && value.length <= max && value.every(check);
const shape =
  (checks: Record<string, Check>): Check =>
  (value) =>
    record(value) &&
    Object.entries(checks).every(
      ([key, check]) => Object.hasOwn(value, key) && check(value[key]),
    );
const smallId = number(1, 1e9, true);
const meter = number(0, 100);
const counter = number(0, 1e12);
const token: Check = (value) =>
  typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9.]{0,79}$/.test(value);
const map =
  (keyCheck: Check, check: Check, max: number): Check =>
  (value) =>
    record(value) &&
    Object.keys(value).length <= max &&
    Object.entries(value).every(
      ([key, value]) => keyCheck(key) && check(value),
    );

function valid(value: unknown): value is Game {
  if (
    !record(value) ||
    !number(8, 16, true)(value.size) ||
    (value.size as number) % 2 !== 0
  )
    return false;
  const size = value.size as number;
  const point: Check = (p) =>
    shape({ x: number(0, size - 1, true), z: number(0, size - 1, true) })(p);
  const route = list(point, size * size);
  const task: Check = (task) =>
    task === null ||
    shape({
      kind: choice([
        "feed",
        "water",
        "pet",
        "clean",
        "clear",
        "repair",
        "walk",
      ]),
      target: point,
      animal: number(0, 1e9, true),
      route,
      progress: number(0, 1),
      carrying: choice(["", ...foods]),
    })(task);
  const actor = {
    x: number(0, size - 1, true),
    z: number(0, size - 1, true),
    task,
  };
  const animal = shape({
    x: number(0, size - 1, true),
    z: number(0, size - 1, true),
    id: smallId,
    species: choice(species.map((s) => s.id)),
    name: choice(animalNames),
    personality: choice(personalities),
    hunger: meter,
    water: meter,
    joy: meter,
    digestion: number(-0.5, 10),
    activity: choice(["idle", "eat", "play", "sleep", "swim"]),
  });
  const visitor = shape({
    x: number(0, size - 1, true),
    z: number(0, size - 1, true),
    id: smallId,
    type: choice(["child", "parent", "fan"]),
    family: smallId,
    happiness: meter,
    hunger: meter,
    energy: meter,
    fun: meter,
    age: number(0, 1000),
    duration: number(0, 1e9),
    route,
    activity: choice([
      "wave",
      "walk",
      "leave",
      "watch",
      "sit",
      "jump",
      "snack",
    ]),
  });
  const fenceKey: Check = (key) => {
    if (typeof key !== "string" || !/^-?\d+,-?\d+\|-?\d+,-?\d+$/.test(key))
      return false;
    const [a, b] = key.split("|").map((part) => {
      const [x, z] = part.split(",").map(Number);
      return { x, z };
    });
    return distance(a, b) === 1 && (inside(a, size) || inside(b, size));
  };
  const validShape = shape({
    schema: choice([1]),
    language: choice(["de", "en"]),
    size: number(8, 16, true),
    coins: number(0, 1e12),
    stars: number(1, 5, true),
    ticket: number(0, 100, true),
    open: choice([true, false]),
    time: number(0, 1e12),
    nextId: smallId,
    tiles: list(
      shape({
        terrain: choice(terrains),
        object: choice([
          "",
          "weed",
          "rock",
          "stump",
          "litter",
          "entrance",
          ...buildings.map((b) => b.id),
        ]),
        dirt: number(0, 5, true),
      }),
      size * size,
    ),
    fences: map(
      fenceKey,
      choice(["fence", "highfence", "gate"]),
      size * size * 4,
    ),
    animals: list(animal, size * size),
    visitors: list(visitor, 40),
    workers: list(
      shape({ ...actor, id: smallId, role: choice(roles) }),
      size * size,
    ),
    keeper: shape(actor),
    inventory: shape(
      Object.fromEntries(foods.map((food) => [food, number(0, 1e12, true)])),
    ),
    income: shape({ tickets: counter, donations: counter, sales: counter }),
    goals: list(choice(goalIds), goalIds.length),
    counters: map(token, counter, 100000),
    event: token,
    message: token,
    revision: number(0, 1e12, true),
    sound: number(0, 1),
    music: number(0, 1),
    paused: choice([true, false]),
    seed: number(0, 4294967295, true),
  })(value);
  if (!validShape) return false;
  const game = value as unknown as Game;
  if (
    game.tiles.length !== size * size ||
    game.animals.length === 0 ||
    new Set(game.goals).size !== game.goals.length
  )
    return false;
  const ids = [...game.animals, ...game.visitors, ...game.workers].map(
    (entity) => entity.id,
  );
  if (new Set(ids).size !== ids.length || ids.some((id) => id >= game.nextId))
    return false;
  const connectedRoute = (start: Point, route: Point[]): boolean =>
    route.every((p, i) => distance(i === 0 ? start : route[i - 1], p) === 1);
  for (const actor of [game.keeper, ...game.workers]) {
    const task = actor.task;
    if (!task) continue;
    if (!connectedRoute(actor, task.route)) return false;
    const end = task.route.length ? task.route[task.route.length - 1] : actor;
    if (!equal(end, task.target)) return false;
    const animal = game.animals.find((a) => a.id === task.animal);
    if (["feed", "water", "pet"].includes(task.kind) && !animal) return false;
    if (
      task.kind === "feed"
        ? !foods.includes(task.carrying as never)
        : task.carrying !== ""
    )
      return false;
  }
  return game.visitors.every(
    (visitor) =>
      visitor.family < game.nextId && connectedRoute(visitor, visitor.route),
  );
}
export function importGame(text: string): Game | null {
  try {
    if (text.length > 5_000_000) return null;
    const parsed: unknown = JSON.parse(text);
    return valid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
export function exportGame(game: Game): string {
  return JSON.stringify(game);
}
export function save(game: Game, storage: Storage): boolean {
  try {
    storage.setItem(saveKey, exportGame(game));
    return true;
  } catch {
    return false;
  }
}
export function load(storage: Storage): Game | null {
  try {
    return importGame(storage.getItem(saveKey) ?? "");
  } catch {
    return null;
  }
}
