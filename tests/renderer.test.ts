// @vitest-environment happy-dom
// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, test, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import {
  PointerEventTypes,
  PointerInfo,
} from "@babylonjs/core/Events/pointerEvents.js";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { PickingInfo } from "@babylonjs/core/Collisions/pickingInfo.js";
import { buildings, species, terrains, roles } from "../src/catalog";
import {
  addAnimal,
  command,
  advance,
  createGame,
  expand,
  tile,
  type Visitor,
  type Worker,
} from "../src/game";
import { createRenderer, type ZooRenderer } from "../src/renderer";
const resources: { renderer: ZooRenderer; engine: NullEngine }[] = [];
function setup() {
  const game = createGame(),
    canvas = document.createElement("canvas"),
    engine = new NullEngine({
      renderWidth: 1200,
      renderHeight: 800,
      textureSize: 512,
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
    }),
    select = vi.fn();
  const renderer = createRenderer(canvas, game, select, engine);
  resources.push({ renderer, engine });
  return { game, canvas, engine, select, renderer };
}
afterEach(() => {
  for (const r of resources) {
    r.renderer.dispose();
    r.engine.dispose();
  }
  resources.length = 0;
});
describe("original isometric procedural zoo", () => {
  test("renders a complete initial diorama with keeper, animal, paths, fencing, booth and care supplies", () => {
    const { renderer, game } = setup();
    renderer.render();
    expect(renderer.scene.getMeshByName("animal-head")).toBeTruthy();
    expect(renderer.scene.getMeshByName("keeper-hat")).toBeTruthy();
    expect(renderer.scene.getMeshByName("fence-rail")).toBeTruthy();
    expect(renderer.scene.getMeshByName("gate")).toBeTruthy();
    expect(renderer.scene.getMeshByName("ticket-booth")).toBeTruthy();
    expect(renderer.scene.getMeshByName("feeding-content")).toBeTruthy();
    expect(renderer.scene.meshes.filter((m) => m.name === "tile")).toHaveLength(
      game.size * game.size,
    );
  });
  test("shows every terrain and building, original species silhouettes, staff and families", () => {
    const { game, renderer } = setup();
    game.coins = 1000;
    expand(game);
    expand(game);
    expand(game);
    expand(game);
    game.tiles.forEach((t, i) => {
      t.object = "";
      t.terrain = terrains[i % terrains.length];
      t.dirt = i % 5;
    });
    buildings.forEach((b, i) => {
      game.tiles[i].object = b.id;
    });
    ["weed", "rock", "stump", "litter", "entrance", "unknown"].forEach(
      (id, i) => {
        game.tiles[buildings.length + i].object = id;
      },
    );
    species
      .slice(1)
      .forEach((s, i) =>
        addAnimal(game, s.id, { x: i % 8, z: Math.floor(i / 8) }),
      );
    game.workers = roles.map((role, i) => ({
      id: i + 100,
      x: 1,
      z: 5,
      role,
      task: null,
    }));
    game.visitors = Array.from(
      { length: 3 },
      (_, i) =>
        ({
          id: 200 + i,
          x: 1,
          z: 4,
          type: i === 0 ? "child" : i === 1 ? "parent" : "fan",
          family: 200,
          happiness: 70,
          hunger: 70,
          energy: 70,
          fun: 70,
          age: 1,
          duration: 60,
          route: [],
          activity: "watch",
        }) as Visitor,
    );
    game.revision++;
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("animal-21")).toBeTruthy();
    expect(renderer.scene.getMeshByName("elephant-trunk")).toBeTruthy();
    expect(renderer.scene.getMeshByName("tortoise-shell")).toBeTruthy();
    expect(renderer.scene.getMeshByName("penguin-belly")).toBeTruthy();
    expect(renderer.scene.getMeshByName("striped-awning")).toBeTruthy();
    expect(renderer.scene.getMeshByName("tree-crown")).toBeTruthy();
    expect(renderer.scene.getMeshByName("flower")).toBeTruthy();
    expect(renderer.scene.getMeshByName("sand-bucket")).toBeTruthy();
    expect(renderer.scene.getMeshByName("trampoline-mat")).toBeTruthy();
    expect(renderer.scene.getMeshByName("tower-platform")).toBeTruthy();
    expect(renderer.scene.getMeshByName("cartoon-dropping")).toBeTruthy();
    expect(renderer.scene.meshes.filter((m) => m.name === "tile")).toHaveLength(
      256,
    );
  });
  test("the damaged starter fence visibly straightens after the keeper repairs it", () => {
    const { game, renderer } = setup();
    const damaged = renderer.scene.getMeshByName("damaged-fence")!;
    expect(damaged.rotation.z).not.toBe(0);
    expect(command(game, "repair", { x: 3, z: 3 })).toBe(true);
    advance(game, 5);
    renderer.render();
    expect(game.counters.repaired).toBe(1);
    expect(renderer.scene.getMeshByName("damaged-fence")).toBeNull();
    expect(renderer.scene.getMeshByName("fence-rail")!.rotation.z).toBe(0);
  });
  test("picks objects and floor tiles without consuming camera or right clicks", () => {
    const { renderer, select } = setup();
    const mesh = renderer.scene.getMeshByName("animal-head")!;
    const pick = new PickingInfo();
    pick.hit = true;
    pick.pickedMesh = mesh;
    const event = new PointerEvent("pointerup", { button: 0 });
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(PointerEventTypes.POINTERDOWN, event, pick),
    );
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(PointerEventTypes.POINTERUP, event, pick),
    );
    expect(select).toHaveBeenCalledWith({ x: 4, z: 2 });
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(PointerEventTypes.POINTERMOVE, event, pick),
    );
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(
        PointerEventTypes.POINTERUP,
        new PointerEvent("pointerup", { button: 2 }),
        pick,
      ),
    );
    const empty = new PickingInfo();
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(PointerEventTypes.POINTERUP, event, empty),
    );
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(PointerEventTypes.POINTERUP, event, null),
    );
    expect(select).toHaveBeenCalledTimes(1);
  });
  test("real screen-space rays pick the rendered animal and trigger tile selection", () => {
    const { renderer, engine, select } = setup();
    renderer.render();
    const scene = renderer.scene;
    const head = scene.getMeshByName("animal-head")!;
    const screen = Vector3.Project(
      head.getAbsolutePosition(),
      Matrix.Identity(),
      scene.getTransformMatrix(),
      scene.activeCamera!.viewport.toGlobal(
        engine.getRenderWidth(),
        engine.getRenderHeight(),
      ),
    );
    const pick = scene.pick(screen.x, screen.y);
    expect(pick?.hit).toBe(true);
    expect(pick?.pickedMesh?.metadata.tile).toEqual({ x: 4, z: 2 });
    scene.onPointerObservable.notifyObservers(
      new PointerInfo(
        PointerEventTypes.POINTERDOWN,
        new PointerEvent("pointerdown", { button: 0 }),
        pick,
      ),
    );
    scene.onPointerObservable.notifyObservers(
      new PointerInfo(
        PointerEventTypes.POINTERUP,
        new PointerEvent("pointerup", { button: 0 }),
        pick,
      ),
    );
    expect(select).toHaveBeenCalledWith({ x: 4, z: 2 });
  });
  test("camera zoom, rotation, wheel and bounded orthographic framing", () => {
    const { renderer, canvas, engine } = setup();
    const resized = vi.spyOn(engine, "resize");
    window.dispatchEvent(new Event("resize"));
    expect(resized).toHaveBeenCalledOnce();
    const c = renderer.scene.activeCamera as ArcRotateCamera;
    renderer.zoom(-100);
    expect(c.orthoTop).toBe(2);
    renderer.zoom(100);
    expect(c.orthoTop).toBe(18);
    const alpha = c.alpha;
    renderer.rotate(0.5);
    expect(c.alpha).toBe(alpha + 0.5);
    const wheel = new WheelEvent("wheel", { deltaY: -100, cancelable: true });
    canvas.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(c.orthoTop).toBe(17.5);
    renderer.render();
  });
  test("refreshes changed land and entities without leaking old meshes", () => {
    const { renderer, game } = setup();
    const before = renderer.scene.meshes.length;
    renderer.rebuild();
    expect(renderer.scene.meshes).toHaveLength(before);
    tile(game, { x: 4, z: 2 }).dirt = 1;
    game.revision++;
    renderer.render();
    expect(renderer.scene.getMeshByName("cartoon-dropping")).toBeTruthy();
    game.visitors.push({
      id: 100,
      x: 1,
      z: 4,
      type: "child",
      family: 100,
      happiness: 70,
      hunger: 70,
      energy: 70,
      fun: 70,
      age: 1,
      duration: 60,
      route: [],
      activity: "wave",
    });
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("visitor-100")).toBeTruthy();
    game.visitors[0].id = 101;
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("visitor-101")).toBeTruthy();
    game.workers.push({ id: 30, x: 1, z: 4, role: "keeper", task: null });
    renderer.render();
    game.workers[0].id = 31;
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("worker-31")).toBeTruthy();
    game.animals[0].id = 50;
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("animal-50")).toBeTruthy();
    game.visitors = [];
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("visitor-100")).toBeNull();
  });
  test("animates eating, sleeping, affection, carrying food, working, jumping, sitting and snacks", () => {
    const { renderer, game } = setup();
    const a = game.animals[0];
    const worker: Worker = { id: 20, role: "keeper", x: 1, z: 4, task: null };
    game.workers.push(worker);
    const visitor: Visitor = {
      id: 40,
      x: 1,
      z: 4,
      type: "parent",
      family: 40,
      happiness: 70,
      hunger: 70,
      energy: 70,
      fun: 70,
      age: 1,
      duration: 60,
      route: [],
      activity: "jump",
    };
    game.visitors.push(visitor);
    renderer.render();
    game.time = 1;
    a.activity = "eat";
    renderer.render();
    expect(renderer.scene.getMeshByName("animal-head")!.rotation.x).not.toBe(0);
    a.activity = "sleep";
    a.hunger = 0;
    a.water = 0;
    visitor.activity = "sit";
    renderer.render();
    expect(
      renderer.scene.getTransformNodeByName(`animal-${a.id}`)!.scaling.y,
    ).toBe(0.75);
    a.activity = "play";
    a.hunger = 100;
    a.water = 100;
    visitor.activity = "snack";
    game.keeper.task = {
      kind: "feed",
      target: a,
      animal: a.id,
      route: [{ x: 2, z: 5 }],
      progress: 0,
      carrying: "greens",
    };
    renderer.render();
    expect(renderer.scene.getMeshByName("animal-heart")!.isEnabled()).toBe(
      true,
    );
    game.keeper.task.route = [];
    game.keeper.x = 2;
    game.keeper.z = 5;
    worker.x = 2;
    game.time = 2;
    renderer.render();
    expect(
      renderer.scene.getTransformNodeByName("keeper")!.position.x,
    ).toBeGreaterThan(1);
  });
});

test("animals express hunger, thirst, affection and play through recognizable floating icons", () => {
  const { game, renderer } = setup();
  const a = game.animals[0];
  const bubble = renderer.scene.getTransformNodeByName(
    `bubble-animal-${a.id}`,
  )!;
  a.hunger = 10;
  renderer.render();
  expect(bubble.isEnabled()).toBe(true);
  expect(renderer.scene.getMeshByName("need-food")!.isEnabled()).toBe(true);
  a.hunger = 80;
  a.water = 10;
  renderer.render();
  expect(renderer.scene.getMeshByName("need-food")).toBeNull();
  expect(renderer.scene.getMeshByName("need-water")!.isEnabled()).toBe(true);
  a.water = 80;
  a.joy = 90;
  renderer.render();
  const heart = renderer.scene.getMeshByName("need-heart")!;
  expect(heart.isEnabled()).toBe(true);
  const vertices = heart.getVerticesData("position")!;
  const outline = Array.from({ length: vertices.length / 3 - 1 }, (_, i) => ({
    x: vertices[(i + 1) * 3],
    y: vertices[(i + 1) * 3 + 1],
  }));
  const bottom = outline.reduce((a, b) => (a.y < b.y ? a : b));
  expect(Math.abs(bottom.x)).toBeLessThan(0.001);
  expect(bottom.y).toBeLessThan(-0.2);
  const notch = outline[0];
  expect(notch.x).toBe(0);
  expect(notch.y).toBeGreaterThan(0);
  expect(outline.some((p) => p.x < -0.1 && p.y > notch.y + 0.05)).toBe(true);
  expect(outline.some((p) => p.x > 0.1 && p.y > notch.y + 0.05)).toBe(true);
  const icon = renderer.scene.getTransformNodeByName(
    `bubble-icon-animal-${a.id}`,
  )!;
  game.time += 0.4;
  renderer.render();
  expect(icon.scaling.x).toBeGreaterThan(1);
  expect(icon.scaling.x).toBeLessThanOrEqual(1.06);
  a.joy = 10;
  renderer.render();
  expect(renderer.scene.getMeshByName("need-play")!.isEnabled()).toBe(true);
  a.joy = 50;
  renderer.render();
  expect(bubble.isEnabled()).toBe(false);
  expect(
    bubble.getChildMeshes().some((mesh) => mesh.name === "need-bubble-cloud"),
  ).toBe(true);
});

test("visitors show food, sleepy Z, play and happiness bubbles; keepers display their current job", () => {
  const { game, renderer } = setup();
  const v: Visitor = {
    id: 100,
    x: 1,
    z: 4,
    type: "child",
    family: 100,
    happiness: 50,
    hunger: 10,
    energy: 80,
    fun: 80,
    age: 0,
    duration: 60,
    route: [],
    activity: "watch",
  };
  game.animals[0].joy = 50;
  game.visitors.push(v);
  renderer.render();
  expect(renderer.scene.getMeshByName("need-snack")!.isEnabled()).toBe(true);
  expect(renderer.scene.getMeshByName("need-food")).toBeNull();
  v.hunger = 80;
  v.energy = 10;
  renderer.render();
  expect(renderer.scene.getMeshByName("need-rest")!.isEnabled()).toBe(true);
  v.energy = 80;
  v.fun = 10;
  renderer.render();
  expect(renderer.scene.getMeshByName("need-play")!.isEnabled()).toBe(true);
  v.fun = 80;
  v.happiness = 90;
  renderer.render();
  expect(renderer.scene.getMeshByName("need-heart")!.isEnabled()).toBe(true);
  v.happiness = 50;
  renderer.render();
  expect(
    renderer.scene.getTransformNodeByName("bubble-visitor-100")!.isEnabled(),
  ).toBe(false);
  for (const kind of [
    "feed",
    "pet",
    "clean",
    "clear",
    "repair",
    "walk",
  ] as const) {
    game.keeper.task = {
      kind,
      target: game.animals[0],
      animal: game.animals[0].id,
      route: [],
      progress: 0,
      carrying: kind === "feed" ? "greens" : "",
    };
    renderer.render();
    expect(
      renderer.scene.getTransformNodeByName("bubble-keeper")!.isEnabled(),
    ).toBe(true);
  }
  expect(renderer.scene.getMeshByName("need-work")!.isEnabled()).toBe(true);
  game.keeper.task = null;
  renderer.render();
  expect(
    renderer.scene.getTransformNodeByName("bubble-keeper")!.isEnabled(),
  ).toBe(false);
});

test("actor transforms and walking progress survive new guests and rebuilt terrain", () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    const { game, renderer } = setup();
    renderer.render();
    const keeper = renderer.scene.getTransformNodeByName("keeper")!;
    const rabbit = renderer.scene.getTransformNodeByName(
      `animal-${game.animals[0].id}`,
    )!;
    game.keeper.x = 2;
    now += 1000 / 60;
    renderer.render();
    const progress = keeper.position.x;
    expect(progress).toBeGreaterThan(1);
    expect(progress).toBeLessThan(2);
    game.visitors.push({
      id: 100,
      x: 1,
      z: 4,
      type: "child",
      family: 100,
      happiness: 70,
      hunger: 80,
      energy: 80,
      fun: 80,
      age: 0,
      duration: 60,
      route: [],
      activity: "watch",
    });
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("keeper")).toBe(keeper);
    expect(keeper.position.x).toBe(progress);
    expect(
      renderer.scene.getTransformNodeByName(`animal-${game.animals[0].id}`),
    ).toBe(rabbit);
    const child = renderer.scene.getTransformNodeByName("visitor-100")!;
    game.revision++;
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("keeper")).toBe(keeper);
    expect(keeper.position.x).toBe(progress);
    expect(renderer.scene.getTransformNodeByName("visitor-100")).toBe(child);
    now += 1000 / 60;
    renderer.render();
    expect(keeper.position.x).toBeGreaterThan(progress);
    expect(keeper.position.x).toBeLessThan(2);
    game.visitors[0].type = "parent";
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("visitor-100")).not.toBe(
      child,
    );
    expect(renderer.scene.getTransformNodeByName("keeper")).toBe(keeper);
    game.animals[0].species = "goat";
    renderer.render();
    expect(
      renderer.scene.getTransformNodeByName(`animal-${game.animals[0].id}`),
    ).not.toBe(rabbit);
    game.workers.push({ id: 200, role: "keeper", x: 2, z: 4, task: null });
    renderer.render();
    const staff = renderer.scene.getTransformNodeByName("worker-200")!;
    game.workers[0].role = "cleaner";
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("worker-200")).not.toBe(staff);
  } finally {
    clock.mockRestore();
  }
});

test("walking uses elapsed time, swings limbs gently and eases to a standstill", () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    const fast = setup(),
      slow = setup();
    fast.renderer.render();
    slow.renderer.render();
    fast.game.keeper.x = 2;
    slow.game.keeper.x = 2;
    for (let frame = 1; frame <= 6; frame++) {
      now = (frame * 1000) / 60;
      fast.renderer.render();
      if (frame % 2 === 0) slow.renderer.render();
    }
    const a = fast.renderer.scene.getTransformNodeByName("keeper")!;
    const b = slow.renderer.scene.getTransformNodeByName("keeper")!;
    expect(a.position.x).toBeCloseTo(b.position.x, 8);
    const leg = a.getChildMeshes().find((mesh) => mesh.name === "person-leg")!;
    expect(Math.abs(leg.rotation.x)).toBeGreaterThan(0.01);
    const swing = Math.abs(leg.rotation.x);
    for (let frame = 7; frame < 120; frame++) {
      now = (frame * 1000) / 60;
      fast.renderer.render();
    }
    expect(a.position.x).toBeCloseTo(2, 6);
    expect(Math.abs(leg.rotation.x)).toBeLessThan(swing / 10);
    expect(a.position.y).toBeLessThan(0.002);
  } finally {
    clock.mockRestore();
  }
});

test("the player is clearly marked and roughland uses angular, varied geometry", () => {
  const { game, renderer } = setup();
  renderer.render();
  const keeper = renderer.scene.getTransformNodeByName("keeper")!;
  expect(keeper.scaling.x).toBe(0.95);
  expect(renderer.scene.getMeshByName("player-ring")!.parent).toBe(keeper);
  expect(renderer.scene.getMeshByName("player-marker")!.parent).toBe(keeper);
  expect(renderer.scene.getMeshByName("player-scarf")).toBeTruthy();
  expect(renderer.scene.getMeshByName("rock-chip")).toBeTruthy();
  expect(renderer.scene.getMeshByName("stump-splinter")).toBeTruthy();
  expect(renderer.scene.getMeshByName("wild-grass-tuft")).toBeTruthy();
  tile(game, { x: 0, z: 0 }).object = "weed";
  tile(game, { x: 2, z: 2 }).object = "tree";
  game.revision++;
  renderer.render();
  expect(renderer.scene.getMeshByName("wild-bush")).toBeTruthy();
  const crown = renderer.scene.getMeshByName("tree-crown")!;
  expect(crown.getTotalVertices()).toBeLessThan(100);
  expect(renderer.scene.getMeshByName("weed-leaf")!.rotation.y).not.toBeNaN();
  const animal = renderer.scene.getTransformNodeByName(
    `animal-${game.animals[0].id}`,
  )!;
  expect(Vector3.Distance(keeper.position, animal.position)).toBeGreaterThan(1);
});

test("cute species have distinctive faces and readable sleeping, swimming and personality gestures", () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    const { game, renderer } = setup();
    const a = game.animals[0];
    a.personality = "curious";
    renderer.render();
    expect(renderer.scene.getMeshByName("rabbit-inner-ear")).toBeTruthy();
    expect(renderer.scene.getMeshByName("animal-cheek")).toBeTruthy();
    expect(renderer.scene.getMeshByName("animal-muzzle")).toBeTruthy();
    a.activity = "sleep";
    now += 50;
    renderer.render();
    expect(renderer.scene.getMeshByName("animal-eye")!.scaling.y).toBe(0.018);
    expect(renderer.scene.getMeshByName("eye-sparkle")!.isEnabled()).toBe(
      false,
    );
    expect(renderer.scene.getMeshByName("need-rest")!.isEnabled()).toBe(true);
    a.species = "otter";
    a.activity = "swim";
    now += 50;
    renderer.render();
    const animal = renderer.scene.getTransformNodeByName(`animal-${a.id}`)!;
    expect(animal.position.y).toBeLessThan(0);
    expect(animal.rotation.z).not.toBe(0);
    expect(renderer.scene.getMeshByName("animal-head")!.rotation.x).toBe(-0.2);
    expect(renderer.scene.getMeshByName("animal-head")!.rotation.z).not.toBe(0);
    expect(renderer.scene.getMeshByName("long-tail")!.rotation.z).not.toBe(0);
    for (const id of ["pig", "raccoon", "iguana", "crocodile", "camel"])
      addAnimal(game, id, { x: 5, z: 5 });
    renderer.render();
    for (const name of [
      "pig-snout",
      "raccoon-mask",
      "reptile-crest",
      "camel-hump",
    ])
      expect(renderer.scene.getMeshByName(name)).toBeTruthy();
  } finally {
    clock.mockRestore();
  }
});

test("adoptions celebrate with a moving transporter, unloading crate and falling confetti that clean up", () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    const { game, renderer } = setup();
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("celebration")).toBeNull();
    game.counters.adopted = 1;
    renderer.render();
    const van = renderer.scene.getTransformNodeByName("arrival-transporter")!;
    expect(van.position.x).toBe(-1.5);
    expect(renderer.scene.getMeshByName("arrival-crate")).toBeTruthy();
    const confetti = renderer.scene.meshes.filter(
      (m) => m.name === "celebration-confetti",
    );
    expect(confetti).toHaveLength(24);
    expect(confetti.every((mesh) => !mesh.isPickable)).toBe(true);
    const originalHeight = confetti[0].position.y;
    now += 4500;
    renderer.render();
    expect(van.position.x).toBeGreaterThan(-1.5);
    expect(renderer.scene.getMeshByName("arrival-crate")!.scaling.x).toBe(0);
    expect(confetti[0].position.y).not.toBe(originalHeight);
    // A second arrival replaces the previous effect instead of leaking props.
    game.counters.adopted++;
    renderer.render();
    expect(van.isDisposed()).toBe(true);
    expect(
      renderer.scene.meshes.filter((mesh) => mesh.name === "transporter-body"),
    ).toHaveLength(1);
    // One delayed frame must expire the effect after its actual eight seconds.
    now += 8500;
    renderer.render();
    expect(renderer.scene.getTransformNodeByName("celebration")).toBeNull();
  } finally {
    clock.mockRestore();
  }
});

test("friendly events show recognizable balloon, photo, sunshine and party props", () => {
  const { game, renderer } = setup();
  for (const [event, prop] of [
    ["balloon", "lost-balloon"],
    ["photo", "photo-camera"],
    ["sunny", "sunshine"],
    ["school", "party-balloon"],
    ["birthday", "party-balloon"],
    ["family", "party-balloon"],
  ]) {
    game.event = event;
    game.counters.eventIndex = (game.counters.eventIndex ?? 0) + 1;
    renderer.render();
    expect(renderer.scene.getMeshByName(prop)).toBeTruthy();
    expect(
      renderer.scene.meshes.filter(
        (mesh) => mesh.name === "celebration-confetti",
      ),
    ).toHaveLength(24);
  }
});

test("keeper tools appear only during work and guest cheers raise their arms", () => {
  const { game, renderer } = setup();
  game.keeper.task = {
    kind: "clean",
    target: { x: 2, z: 5 },
    animal: 0,
    route: [{ x: 2, z: 5 }],
    progress: 0,
    carrying: "",
  };
  renderer.render();
  const tool = renderer.scene.getTransformNodeByName("tool-keeper")!;
  expect(tool.isEnabled()).toBe(false);
  game.keeper.task.route = [];
  renderer.render();
  expect(tool.isEnabled()).toBe(true);
  game.keeper.task = null;
  game.visitors.push({
    id: 100,
    x: 1,
    z: 4,
    type: "child",
    family: 100,
    happiness: 90,
    hunger: 80,
    energy: 80,
    fun: 80,
    age: 0,
    duration: 60,
    route: [],
    activity: "cheer",
  });
  renderer.render();
  expect(tool.isEnabled()).toBe(false);
  const guest = renderer.scene.getTransformNodeByName("visitor-100")!;
  expect(
    guest
      .getChildMeshes()
      .filter((mesh) => mesh.name === "person-arm")
      .every((mesh) => Math.abs(mesh.rotation.z) > 1),
  ).toBe(true);
});

test("incoming and outgoing guests pass in opposite lanes with space between their small silhouettes", () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    const { game, renderer } = setup();
    const guest = (id: number, x: number): Visitor => ({
      id,
      x,
      z: 4,
      type: "parent",
      family: id,
      happiness: 60,
      hunger: 80,
      energy: 80,
      fun: 80,
      age: 0,
      duration: 60,
      route: [],
      activity: "walk",
    });
    game.visitors = [guest(100, 3), guest(101, 4)];
    renderer.render();
    const incoming = renderer.scene.getTransformNodeByName("visitor-100")!;
    const outgoing = renderer.scene.getTransformNodeByName("visitor-101")!;
    expect(incoming.scaling.x).toBe(0.75);
    game.visitors[0].x = 4;
    game.visitors[1].x = 3;
    for (let frame = 0; frame < 30; frame++) {
      now += 1000 / 60;
      renderer.render();
      expect(
        Vector3.Distance(incoming.position, outgoing.position),
      ).toBeGreaterThanOrEqual(0.419);
    }
    expect(incoming.position.x).toBeGreaterThan(outgoing.position.x);
    expect(incoming.position.z).toBeGreaterThan(4);
    expect(outgoing.position.z).toBeLessThan(4);
    // Bubble anchors follow the final separated positions, rather than the tile centers.
    expect(
      renderer.scene.getTransformNodeByName("bubble-visitor-100")!.position.x,
    ).toBe(incoming.position.x);
  } finally {
    clock.mockRestore();
  }
});

test("hungry animals ask for their actual food while hungry guests ask for popcorn in smaller bubbles", () => {
  const { game, renderer } = setup();
  const animal = game.animals[0];
  animal.hunger = 10;
  for (const [species, icon] of [
    ["raccoon", "need-fruit"],
    ["otter", "need-fish"],
    ["pig", "need-grain"],
    ["fox", "need-meat"],
    ["rabbit", "need-food"],
  ]) {
    animal.species = species;
    renderer.render();
    const mesh = renderer.scene.getMeshByName(icon)!;
    expect(mesh.isEnabled()).toBe(true);
    expect(mesh.metadata.tile).toEqual({ x: animal.x, z: animal.z });
    expect(
      renderer.scene.getTransformNodeByName(`bubble-animal-${animal.id}`)!
        .scaling.x,
    ).toBe(0.7);
  }
  animal.hunger = 80;
  animal.joy = 50;
  game.visitors = Array.from({ length: 6 }, (_, i): Visitor => ({
    id: 100 + i,
    x: i,
    z: 4,
    type: "parent",
    family: 100 + i,
    happiness: 50,
    hunger: 10,
    energy: 80,
    fun: 80,
    age: 0,
    duration: 60,
    route: [],
    activity: "watch",
  }));
  renderer.render();
  const clouds = game.visitors.map((v) =>
    renderer.scene.getTransformNodeByName(`bubble-visitor-${v.id}`)!,
  );
  expect(clouds.filter((bubble) => bubble.isEnabled())).toHaveLength(3);
  expect(clouds.every((bubble) => bubble.scaling.x === 0.5)).toBe(true);
  expect(renderer.scene.getMeshByName("need-food")).toBeNull();
  expect(
    renderer.scene.meshes.filter((mesh) => mesh.name === "need-snack"),
  ).toHaveLength(3);
  game.keeper.task = {
    kind: "feed",
    target: animal,
    animal: animal.id,
    route: [],
    progress: 0,
    carrying: "fruit",
  };
  renderer.render();
  expect(renderer.scene.getMeshByName("need-fruit")!.isEnabled()).toBe(true);
});

test("food bowls show what their residents eat and troughs always hold water", () => {
  const { game, renderer } = setup();
  renderer.render();
  expect(renderer.scene.getTransformNodeByName("feeder-serving")).toBeTruthy();
  expect(renderer.scene.getMeshByName("feeding-content")).toBeTruthy();
  expect(
    renderer.scene.getMeshByName("feeder-need-food")!.metadata.tile,
  ).toEqual({ x: 3, z: 2 });
  game.animals[0].species = "raccoon";
  renderer.rebuild();
  expect(renderer.scene.getMeshByName("feeder-need-fruit")).toBeTruthy();
  game.animals = [];
  renderer.rebuild();
  expect(renderer.scene.getTransformNodeByName("feeder-serving")).toBeNull();
});

test("an adopted animal emerges where its delivery crate unloads without shrinking existing animals", () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    const { game, renderer } = setup();
    renderer.render();
    const starter = renderer.scene.getTransformNodeByName(
      `animal-${game.animals[0].id}`,
    )!;
    addAnimal(game, "goat", { x: 7, z: 7 });
    const newcomer = game.animals.at(-1)!;
    game.counters.adopted = 1;
    renderer.render();
    const figure = renderer.scene.getTransformNodeByName(
      `animal-${newcomer.id}`,
    )!;
    expect(figure.scaling.x).toBe(0.001);
    expect(starter.scaling.x).toBe(1);
    expect(
      renderer.scene
        .getTransformNodeByName(`bubble-animal-${newcomer.id}`)!
        .isEnabled(),
    ).toBe(false);
    now += 3500;
    renderer.render();
    const crate = renderer.scene.getMeshByName("arrival-crate")!;
    expect(crate.position.x).toBe(newcomer.x);
    expect(crate.position.z).toBe(newcomer.z);
    expect(figure.scaling.x).toBeCloseTo(0.5, 5);
    expect(figure.position.y).toBeGreaterThan(0.1);
    now += 1250;
    renderer.render();
    expect(figure.scaling.x).toBe(1);
    expect(starter.scaling.x).toBe(1);
    expect(
      figure
        .getChildMeshes()
        .every(
          (mesh) =>
            mesh.metadata.tile.x === newcomer.x &&
            mesh.metadata.tile.z === newcomer.z,
        ),
    ).toBe(true);
    expect(
      renderer.scene
        .getTransformNodeByName(`bubble-animal-${newcomer.id}`)!
        .isEnabled(),
    ).toBe(true);
    // A friendly event can replace the celebration without leaving a hidden animal.
    game.counters.eventIndex = 1;
    game.counters.eventType = 0;
    renderer.render();
    expect(figure.scaling.x).toBe(1);
  } finally {
    clock.mockRestore();
  }
});

test("bins and paths show discarded paper while enclosure waste remains cartoon droppings", () => {
  const { game, renderer } = setup();
  tile(game, { x: 0, z: 0 }).object = "bin";
  tile(game, { x: 0, z: 0 }).dirt = 3;
  tile(game, { x: 2, z: 4 }).dirt = 2;
  tile(game, { x: 4, z: 2 }).dirt = 1;
  game.revision++;
  renderer.render();
  const papers = renderer.scene.meshes.filter(
    (mesh) => mesh.name === "bin-paper",
  );
  expect(papers).toHaveLength(3);
  expect(papers.every((mesh) => mesh.position.y >= 0.5)).toBe(true);
  expect(
    renderer.scene.meshes.filter((mesh) => mesh.name === "dropped-paper"),
  ).toHaveLength(2);
  const waste = renderer.scene.meshes.filter(
    (mesh) => mesh.name === "cartoon-dropping",
  );
  expect(waste).toHaveLength(1);
  expect(waste[0].metadata.tile).toEqual({ x: 4, z: 2 });
  tile(game, { x: 0, z: 0 }).dirt = 0;
  tile(game, { x: 2, z: 4 }).dirt = 0;
  tile(game, { x: 4, z: 2 }).dirt = 0;
  game.revision++;
  renderer.render();
  expect(renderer.scene.getMeshByName("bin-paper")).toBeNull();
  expect(renderer.scene.getMeshByName("dropped-paper")).toBeNull();
  expect(renderer.scene.getMeshByName("cartoon-dropping")).toBeNull();
});

test("rapid grid clicks each select a tile even when Babylon classifies the second as a double tap", () => {
  const { renderer, select } = setup();
  const tiles = renderer.scene.meshes.filter((mesh) => mesh.name === "tile");
  for (const [index, mesh] of tiles.slice(0, 3).entries()) {
    const pick = new PickingInfo();
    pick.hit = true;
    pick.pickedMesh = mesh;
    renderer.scene.simulatePointerDown(pick, {
      button: 0,
      clientX: 10 + index,
      clientY: 20,
    });
    renderer.scene.simulatePointerUp(
      pick,
      { button: 0, clientX: 10 + index, clientY: 20 },
      index === 1,
    );
  }
  expect(select.mock.calls.map(([point]) => point)).toEqual([
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0 },
  ]);
});

test("dragging the camera never places an object even if released over a pickable tile", () => {
  const { renderer, select } = setup();
  const pick = new PickingInfo();
  pick.hit = true;
  pick.pickedMesh = renderer.scene.getMeshByName("animal-head");
  renderer.scene.simulatePointerDown(pick, {
    button: 0,
    clientX: 10,
    clientY: 20,
  });
  renderer.scene.simulatePointerMove(pick, {
    button: 0,
    clientX: 80,
    clientY: 20,
  });
  // Returning to the original point still counts as a drag.
  renderer.scene.simulatePointerUp(pick, {
    button: 0,
    clientX: 10,
    clientY: 20,
  });
  expect(select).not.toHaveBeenCalled();
  renderer.scene.simulatePointerDown(pick, {
    button: 0,
    clientX: 10,
    clientY: 20,
  });
  renderer.scene.simulatePointerUp(pick, {
    button: 0,
    clientX: 20,
    clientY: 20,
  });
  expect(select).not.toHaveBeenCalled();
  renderer.scene.simulatePointerDown(pick, {
    button: 0,
    clientX: 10,
    clientY: 20,
  });
  renderer.scene.simulatePointerUp(pick, {
    button: 0,
    clientX: 12,
    clientY: 20,
  });
  expect(select).toHaveBeenCalledOnce();
});

test("a release over the zoo without a preceding canvas press never selects or builds", () => {
  const { renderer, select } = setup();
  const pick = new PickingInfo();
  pick.hit = true;
  pick.pickedMesh = renderer.scene.getMeshByName("animal-head");
  renderer.scene.simulatePointerUp(pick, {
    button: 0,
    clientX: 10,
    clientY: 20,
  });
  expect(select).not.toHaveBeenCalled();
});

test("placement picks the real ground behind fence rails while inspection still selects the visible object", () => {
  const { renderer, engine, select } = setup();
  renderer.render();
  const scene = renderer.scene;
  const viewport = scene.activeCamera!.viewport.toGlobal(
    engine.getRenderWidth(),
    engine.getRenderHeight(),
  );
  const obstruction = scene.meshes
    .filter((mesh) => mesh.name === "fence-rail")
    .map((mesh) => {
      const screen = Vector3.Project(
        mesh.getAbsolutePosition(),
        Matrix.Identity(),
        scene.getTransformMatrix(),
        viewport,
      );
      const normal = scene.pick(screen.x, screen.y);
      const floor = scene.pick(
        screen.x,
        screen.y,
        (candidate) => candidate.name === "tile",
      );
      return { screen, normal, floor };
    })
    .find(
      ({ normal, floor }) =>
        normal?.pickedMesh &&
        floor?.pickedMesh &&
        JSON.stringify(normal.pickedMesh.metadata.tile) !==
          JSON.stringify(floor.pickedMesh.metadata.tile),
    )!;
  expect(obstruction).toBeDefined();
  scene.pointerX = obstruction.screen.x;
  scene.pointerY = obstruction.screen.y;
  scene.simulatePointerDown(obstruction.normal!, { button: 0 });
  scene.simulatePointerUp(obstruction.normal!, { button: 0 });
  expect(select).toHaveBeenLastCalledWith(
    obstruction.normal!.pickedMesh!.metadata.tile,
  );
  renderer.setPlacementMode(true);
  scene.simulatePointerDown(obstruction.normal!, { button: 0 });
  scene.simulatePointerUp(obstruction.normal!, { button: 0 }, true);
  expect(select).toHaveBeenLastCalledWith(
    obstruction.floor!.pickedMesh!.metadata.tile,
  );
  renderer.setPlacementMode(false);
  scene.simulatePointerDown(obstruction.normal!, { button: 0 });
  scene.simulatePointerUp(obstruction.normal!, { button: 0 });
  expect(select).toHaveBeenLastCalledWith(
    obstruction.normal!.pickedMesh!.metadata.tile,
  );
});

test("importing another zoo cancels a pending reveal and restores reused animal IDs", () => {
  const { game, renderer } = setup();
  renderer.render();
  addAnimal(game, "goat", { x: 7, z: 7 });
  game.counters.adopted = 1;
  renderer.render();
  const id = game.animals.at(-1)!.id;
  expect(renderer.scene.getTransformNodeByName(`animal-${id}`)!.scaling.x).toBe(
    0.001,
  );
  // Imports replace the animal collection even if the counters and IDs match.
  game.animals = game.animals.map((animal) => ({
    ...animal,
    species: "rabbit",
  }));
  renderer.rebuild();
  renderer.render();
  expect(renderer.scene.getTransformNodeByName(`animal-${id}`)!.scaling.x).toBe(
    1,
  );
  expect(renderer.scene.getTransformNodeByName("celebration")).toBeNull();
});

test("an unloading crate follows a newcomer that moves before its reveal", () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    const { game, renderer } = setup();
    renderer.render();
    addAnimal(game, "goat", { x: 7, z: 7 });
    game.counters.adopted = 1;
    renderer.render();
    const newcomer = game.animals.at(-1)!;
    newcomer.x = 8;
    now += 3500;
    renderer.render();
    const figure = renderer.scene.getTransformNodeByName(
      `animal-${newcomer.id}`,
    )!;
    const crate = renderer.scene.getMeshByName("arrival-crate")!;
    expect(crate.position.x).toBeCloseTo(figure.position.x, 6);
    expect(crate.position.z).toBeCloseTo(figure.position.z, 6);
    // Position smoothing remains bounded on the delayed frame, while the crate
    // stays aligned with the newcomer's displayed position.
    expect(crate.position.x).toBeGreaterThan(7);
  } finally {
    clock.mockRestore();
  }
});

test("planting shows the keeper's spade and sapling thought before real flowers appear", () => {
  const { game, renderer } = setup();
  game.coins = 2;
  const garden = { x: 2, z: 6 };
  tile(game, garden).object = "";
  expect(command(game, "plant", garden)).toBe(true);
  advance(game, 0.75);
  renderer.render();
  expect(game.keeper.task?.kind).toBe("plant");
  expect(
    renderer.scene.getTransformNodeByName("tool-keeper")!.isEnabled(),
  ).toBe(true);
  expect(renderer.scene.getMeshByName("need-plant")!.isEnabled()).toBe(true);
  expect(renderer.scene.getMeshByName("flower")).toBeNull();
  advance(game, 3);
  renderer.render();
  expect(tile(game, garden).object).toBe("flowers");
  expect(renderer.scene.getMeshByName("flower")!.metadata.tile).toEqual(garden);
  expect(
    renderer.scene.getTransformNodeByName("tool-keeper")!.isEnabled(),
  ).toBe(false);
  expect(renderer.scene.getMeshByName("need-plant")).toBeNull();
});

test("initial framing preserves the fixed isometric angles and radius while centering the zoo", () => {
  const { renderer } = setup();
  renderer.render();
  const camera = renderer.scene.activeCamera as ArcRotateCamera;
  expect(camera.alpha).toBe(-Math.PI / 4);
  expect(camera.beta).toBe(Math.atan(Math.sqrt(2)));
  expect(camera.radius).toBe(18);
  expect(camera.target.asArray()).toEqual([4.5, 0, 4.5]);
  renderer.rebuild();
  renderer.render();
  expect(camera.alpha).toBe(-Math.PI / 4);
});
