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
    const { renderer } = setup();
    renderer.render();
    expect(renderer.scene.getMeshByName("animal-head")).toBeTruthy();
    expect(renderer.scene.getMeshByName("keeper-hat")).toBeTruthy();
    expect(renderer.scene.getMeshByName("fence-rail")).toBeTruthy();
    expect(renderer.scene.getMeshByName("gate")).toBeTruthy();
    expect(renderer.scene.getMeshByName("ticket-booth")).toBeTruthy();
    expect(renderer.scene.getMeshByName("feeding-content")).toBeTruthy();
    expect(renderer.scene.meshes.filter((m) => m.name === "tile")).toHaveLength(
      64,
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
    expect(command(game, "repair", { x: 3, z: 4 })).toBe(true);
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
      new PointerInfo(PointerEventTypes.POINTERPICK, event, pick),
    );
    expect(select).toHaveBeenCalledWith({ x: 4, z: 2 });
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(PointerEventTypes.POINTERMOVE, event, pick),
    );
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(
        PointerEventTypes.POINTERPICK,
        new PointerEvent("pointerup", { button: 2 }),
        pick,
      ),
    );
    const empty = new PickingInfo();
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(PointerEventTypes.POINTERPICK, event, empty),
    );
    renderer.scene.onPointerObservable.notifyObservers(
      new PointerInfo(PointerEventTypes.POINTERPICK, event, null),
    );
    expect(select).toHaveBeenCalledTimes(1);
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
