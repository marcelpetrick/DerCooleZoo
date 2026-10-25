// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, test } from "vitest";
import { species } from "../src/catalog";
import {
  adopt,
  advance,
  buildEnclosure,
  cancelTask,
  command,
  createGame,
  feedCost,
  goalIds,
  habitat,
  homeCells,
  homeCost,
  homeFor,
  homeSizes,
  homeThemes,
  messAt,
  pens,
  tile,
  type Game,
  type HomeTheme,
} from "../src/game";
import { enclosure, equal } from "../src/world";

/** A rich, fully unlocked zoo with free land above the main path. */
function richZoo(): Game {
  const g = createGame();
  g.coins = 10_000;
  g.stars = 5;
  return g;
}
const finish = (g: Game) => {
  for (let i = 0; i < 400 && g.keeper.task; i++) advance(g, 0.25);
  expect(g.keeper.task).toBeNull();
};

describe("ready-made enclosures", () => {
  test.each(
    homeThemes.flatMap((theme) => homeSizes.map((size) => [theme, size])),
  )(
    "%s home of size %i satisfies every species that likes it",
    (theme, size) => {
      const g = richZoo();
      const spot = { x: 9, z: 7 };
      expect(buildEnclosure(g, theme as HomeTheme, size as number, spot)).toBe(
        true,
      );
      expect(g.message).toBe("enclosureBuilt");
      expect(g.coins).toBe(10_000 - homeCost(size as number));
      const area = enclosure(spot, g.size, g.fences);
      expect(area).toHaveLength((size as number) ** 2);
      const objects = area.map((p) => tile(g, p).object);
      for (const item of ["feeder", "trough", "shelter"])
        expect(objects).toContain(item);
      expect(Object.values(g.fences)).toContain("gate");
      for (const s of species.filter(
        (s) => s.terrain === theme && s.space <= (size as number) ** 2,
      )) {
        const zoo = structuredClone(g);
        expect(adopt(zoo, s.id)).toBe(true);
        const friend = zoo.animals[zoo.animals.length - 1];
        expect(area.some((p) => equal(p, friend))).toBe(true);
        expect(Object.values(habitat(zoo, friend)).every(Boolean)).toBe(true);
      }
    },
  );

  test("the keeper can walk in through the gate and feed a new resident", () => {
    const g = richZoo();
    expect(buildEnclosure(g, "sand", 4, { x: 9, z: 8 })).toBe(true);
    expect(adopt(g, "giraffe")).toBe(true);
    const giraffe = g.animals[1];
    giraffe.hunger = 10;
    expect(command(g, "feed", giraffe, giraffe.id)).toBe(true);
    finish(g);
    expect(giraffe.hunger).toBeGreaterThan(90);
  });

  test("refuses blocked or invalid places without charging", () => {
    const g = richZoo();
    expect(buildEnclosure(g, "grass", 3, { x: 4, z: 2 })).toBe(false);
    expect(g.message).toBe("noSpace");
    expect(buildEnclosure(g, "grass", 3, { x: 3, z: 5 })).toBe(false);
    expect(buildEnclosure(g, "grass", 3, { x: 0, z: 0 })).toBe(false);
    expect(buildEnclosure(g, "lava" as HomeTheme, 3, { x: 9, z: 8 })).toBe(
      false,
    );
    expect(buildEnclosure(g, "grass", 5, { x: 9, z: 8 })).toBe(false);
    expect(buildEnclosure(g, "grass", 3, { x: 99, z: 8 })).toBe(false);
    expect(g.coins).toBe(10_000);
    g.coins = 1;
    expect(buildEnclosure(g, "grass", 3, { x: 9, z: 8 })).toBe(false);
    expect(g.message).toBe("noCoins");
  });

  test("needs a doorway to somewhere the keeper can stand", () => {
    const g = richZoo();
    // homeCells starts one tile up-left of the click, so this ring surrounds it.
    for (const p of homeCells({ x: 8, z: 8 }, 5)) tile(g, p).object = "rock";
    for (const p of homeCells({ x: 9, z: 9 }, 3)) tile(g, p).object = "";
    expect(buildEnclosure(g, "grass", 3, { x: 9, z: 9 })).toBe(false);
    expect(g.message).toBe("noSpace");
  });
});

describe("adopting", () => {
  test("moves an animal into a matching home or asks for one", () => {
    const g = richZoo();
    expect(homeFor(g, "otter")).toBeUndefined();
    expect(adopt(g, "otter")).toBe(false);
    expect(g.message).toBe("needEnclosure");
    expect(pens(g)).toHaveLength(1);
    expect(buildEnclosure(g, "water", 3, { x: 9, z: 8 })).toBe(true);
    expect(pens(g)).toHaveLength(2);
    expect(adopt(g, "otter")).toBe(true);
    // The small pond is now full, so a second otter needs another home.
    expect(adopt(g, "otter")).toBe(false);
  });

  test("still accepts an explicit tile and respects locks", () => {
    const g = createGame();
    g.coins = 100;
    expect(adopt(g, "zebra")).toBe(false);
    expect(g.message).toBe("locked");
    expect(adopt(g, "unknown")).toBe(false);
    expect(adopt(g, "rabbit", { x: 99, z: 0 })).toBe(false);
  });
});

describe("direct keeper jobs", () => {
  test("one feeding round feeds and waters everyone in the pen", () => {
    const g = richZoo();
    g.goals = [...goalIds];
    expect(adopt(g, "guinea", { x: 3, z: 3 })).toBe(true);
    for (const a of g.animals) Object.assign(a, { hunger: 5, water: 5 });
    const [rabbit, guinea] = g.animals;
    expect(command(g, "feed", rabbit, rabbit.id)).toBe(true);
    expect(g.keeper.task?.carrying).toBe("greens");
    finish(g);
    for (const a of [rabbit, guinea]) {
      expect(a.hunger).toBeGreaterThan(90);
      expect(a.water).toBeGreaterThan(90);
    }
    expect(g.coins).toBe(10_000 - 20 - feedCost);
  });

  test("feeding is free when the zoo has no coins", () => {
    const g = createGame();
    g.goals.push("feed");
    const [a] = g.animals;
    a.hunger = 5;
    expect(command(g, "feed", a, a.id)).toBe(true);
    finish(g);
    expect(a.hunger).toBeGreaterThan(90);
    expect(g.coins).toBe(0);
  });

  test("cleaning tidies the whole enclosure in one job", () => {
    const g = createGame();
    tile(g, { x: 3, z: 1 }).dirt = 2;
    tile(g, { x: 5, z: 3 }).dirt = 1;
    expect(messAt(g, { x: 4, z: 2 })).toHaveLength(2);
    expect(command(g, "clean", { x: 3, z: 1 })).toBe(true);
    finish(g);
    expect(messAt(g, { x: 4, z: 2 })).toHaveLength(0);
  });

  test("outside a pen cleaning covers the spot and its neighbours", () => {
    const g = createGame();
    tile(g, { x: 6, z: 5 }).object = "litter";
    tile(g, { x: 7, z: 5 }).dirt = 1;
    expect(command(g, "clean", { x: 6, z: 5 })).toBe(true);
    finish(g);
    expect(tile(g, { x: 6, z: 5 }).object).toBe("");
    expect(tile(g, { x: 7, z: 5 }).dirt).toBe(0);
    expect(command(g, "clean", { x: 6, z: 5 })).toBe(false);
  });

  test("a new order replaces the current one instead of saying busy", () => {
    const g = createGame();
    g.coins = 10;
    tile(g, { x: 0, z: 7 }).object = "";
    expect(command(g, "plant", { x: 0, z: 7 })).toBe(true);
    expect(g.coins).toBe(8);
    expect(command(g, "clear", { x: 2, z: 6 })).toBe(true);
    expect(g.keeper.task?.kind).toBe("clear");
    expect(g.coins).toBe(10);
    // An unreachable order keeps the current job.
    tile(g, { x: 11, z: 11 }).object = "weed";
    for (const p of [
      { x: 10, z: 11 },
      { x: 11, z: 10 },
    ])
      tile(g, p).object = "rock";
    expect(command(g, "clear", { x: 11, z: 11 })).toBe(false);
    expect(g.message).toBe("noRoute");
    expect(g.keeper.task?.kind).toBe("clear");
    expect(cancelTask(g)).toBe(true);
    expect(cancelTask(g)).toBe(false);
  });

  test("hired keepers finish their own job first", () => {
    const g = createGame();
    g.workers.push({ x: 1, z: 6, id: 99, role: "keeper", task: null });
    const [helper] = g.workers;
    expect(command(g, "walk", { x: 2, z: 7 }, 0, helper)).toBe(true);
    expect(command(g, "walk", { x: 0, z: 7 }, 0, helper)).toBe(false);
    expect(g.message).toBe("busy");
  });

  test("two hired keepers never feed the same pen twice", () => {
    const g = richZoo();
    expect(adopt(g, "guinea", { x: 3, z: 3 })).toBe(true);
    for (const a of g.animals) a.hunger = 10;
    g.workers.push(
      { x: 1, z: 6, id: 98, role: "keeper", task: null },
      { x: 2, z: 7, id: 99, role: "keeper", task: null },
    );
    // Staff pick new jobs every two seconds of game time.
    g.time = 1.95;
    advance(g, 0.1);
    const feeding = g.workers.filter((w) => w.task?.kind === "feed");
    expect(feeding).toHaveLength(1);
  });

  test("animals drink from a trough by themselves", () => {
    const g = createGame();
    const [a] = g.animals;
    a.water = 10;
    advance(g, 40);
    expect(a.water).toBeGreaterThan(50);
  });
});
