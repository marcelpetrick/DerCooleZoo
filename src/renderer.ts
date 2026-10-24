// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { Engine } from "@babylonjs/core/Engines/engine.js";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { Camera } from "@babylonjs/core/Cameras/camera.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents.js";
import { getSpecies, buildings } from "./catalog";
import { points, tile, type Game, type Animal, type Task } from "./game";
import { edgeKey, type Point } from "./world";

export interface ZooRenderer {
  scene: Scene;
  render: () => void;
  rebuild: () => void;
  zoom: (delta: number) => void;
  rotate: (delta: number) => void;
  dispose: () => void;
}
interface Figure {
  node: TransformNode;
  head: Mesh;
  carry: Mesh;
}
const terrainColors = {
  grass: "#a8c881",
  earth: "#bda17c",
  sand: "#e8d39d",
  water: "#80c7d1",
  rock: "#b2b8b3",
  snow: "#e3f0ee",
  tropical: "#87bc87",
};
const shopColors = ["#eaaa83", "#d9a3b9", "#e7c56d", "#89b8bc", "#d4b2cb"];

/** Original procedural diorama: all geometry and colors are generated locally. */
export function createRenderer(
  canvas: HTMLCanvasElement,
  game: Game,
  onSelect: (p: Point) => void,
  suppliedEngine?: AbstractEngine,
): ZooRenderer {
  const engine =
    suppliedEngine ??
    new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString("#f4f2e7ff");
  scene.ambientColor = Color3.FromHexString("#ffffff");
  const camera = new ArcRotateCamera(
    "isometric-camera",
    -Math.PI / 4,
    Math.atan(Math.sqrt(2)),
    18,
    new Vector3(3.5, 0, 3.5),
    scene,
  );
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.lowerBetaLimit = camera.upperBetaLimit = Math.atan(Math.sqrt(2));
  camera.panningSensibility = 85;
  camera.angularSensibilityX = 800;
  camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");
  if (engine.getRenderingCanvas()) camera.attachControl(true, true, 1);
  new HemisphericLight("soft-sky", new Vector3(0, 1, 0), scene).intensity = 0.8;
  const sun = new DirectionalLight(
    "afternoon-sun",
    new Vector3(-1, -2, 1),
    scene,
  );
  sun.intensity = 0.65;
  const materials = new Map<string, StandardMaterial>();
  let world = new TransformNode("world", scene);
  let revision = -1,
    size = -1,
    extent = 6.4;
  const figures = new Map<string, Figure>();
  function material(color: string): StandardMaterial {
    if (!materials.has(color)) {
      const m = new StandardMaterial(color, scene);
      m.diffuseColor = Color3.FromHexString(color);
      m.specularColor = Color3.Black();
      materials.set(color, m);
    }
    return materials.get(color)!;
  }
  function shape(
    kind: "box" | "sphere" | "cylinder",
    parent: TransformNode,
    name: string,
    color: string,
    pos: number[],
    scale: number[],
    at: Point,
  ): Mesh {
    const options = {
      size: 1,
      diameter: 1,
      height: 1,
      segments: 8,
      tessellation: 10,
    };
    const m =
      kind === "box"
        ? MeshBuilder.CreateBox(name, options, scene)
        : kind === "sphere"
          ? MeshBuilder.CreateSphere(name, options, scene)
          : MeshBuilder.CreateCylinder(name, options, scene);
    m.parent = parent;
    m.position.set(pos[0], pos[1], pos[2]);
    m.scaling.set(scale[0], scale[1], scale[2]);
    m.material = material(color);
    m.metadata = { tile: { x: at.x, z: at.z } };
    return m;
  }
  function box(
    parent: TransformNode,
    name: string,
    color: string,
    pos: number[],
    scale: number[],
    at: Point,
  ): Mesh {
    return shape("box", parent, name, color, pos, scale, at);
  }
  function ball(
    parent: TransformNode,
    name: string,
    color: string,
    pos: number[],
    scale: number[],
    at: Point,
  ): Mesh {
    return shape("sphere", parent, name, color, pos, scale, at);
  }
  function pole(
    parent: TransformNode,
    name: string,
    color: string,
    pos: number[],
    scale: number[],
    at: Point,
  ): Mesh {
    return shape("cylinder", parent, name, color, pos, scale, at);
  }
  function tree(parent: TransformNode, at: Point, small = false): void {
    const s = small ? 0.65 : 1;
    pole(
      parent,
      "tree-trunk",
      "#997454",
      [at.x, 0.45 * s, at.z],
      [0.16 * s, 0.9 * s, 0.16 * s],
      at,
    );
    ball(
      parent,
      "tree-crown",
      "#76a878",
      [at.x, 1.1 * s, at.z],
      [0.85 * s, 1.05 * s, 0.85 * s],
      at,
    );
    ball(
      parent,
      "tree-crown-light",
      "#a8c583",
      [at.x - 0.2 * s, 1.4 * s, at.z - 0.05],
      [0.65 * s, 0.65 * s, 0.65 * s],
      at,
    );
  }
  function object(id: string, at: Point): void {
    const { x, z } = at;
    const parent = world;
    const wood = "#ad815b",
      green = "#537965";
    if (id === "tree") {
      tree(parent, at);
      return;
    }
    if (id === "weed") {
      for (let i = 0; i < 4; i++)
        ball(
          parent,
          "weed-leaf",
          "#76a573",
          [
            x + ((i % 2) - 0.5) * 0.22,
            0.15 + i * 0.02,
            z + (Math.floor(i / 2) - 0.5) * 0.22,
          ],
          [0.17, 0.38, 0.17],
          at,
        );
      return;
    }
    if (id === "rock") {
      const rock = ball(
        parent,
        "rock",
        "#a4aaa0",
        [x, 0.18, z],
        [0.55, 0.43, 0.45],
        at,
      );
      rock.rotation.z = 0.25;
      return;
    }
    if (id === "stump") {
      pole(parent, "stump", "#997454", [x, 0.19, z], [0.38, 0.38, 0.38], at);
      pole(
        parent,
        "stump-rings",
        "#d0b58d",
        [x, 0.39, z],
        [0.32, 0.025, 0.32],
        at,
      );
      return;
    }
    if (id === "flowers") {
      for (let i = 0; i < 5; i++) {
        const dx = ((i % 3) - 1) * 0.23,
          dz = (Math.floor(i / 3) - 0.5) * 0.32;
        pole(
          parent,
          "flower-stem",
          green,
          [x + dx, 0.14, z + dz],
          [0.035, 0.28, 0.035],
          at,
        );
        ball(
          parent,
          "flower",
          i % 2 ? "#e9b875" : "#e7acb7",
          [x + dx, 0.3, z + dz],
          [0.19, 0.12, 0.19],
          at,
        );
      }
      return;
    }
    if (id === "entrance") {
      for (const dx of [-0.48, 0.48])
        box(
          parent,
          "entrance-post",
          green,
          [x + dx, 0.65, z],
          [0.16, 1.3, 0.17],
          at,
        );
      box(parent, "entrance-sign", green, [x, 1.3, z], [1.2, 0.4, 0.2], at);
      for (let i = 0; i < 3; i++)
        ball(
          parent,
          "entrance-flower",
          "#edc777",
          [x + (i - 1) * 0.28, 1.32, z - 0.13],
          [0.12, 0.12, 0.05],
          at,
        );
      box(
        parent,
        "ticket-booth",
        wood,
        [x - 0.65, 0.34, z + 0.35],
        [0.38, 0.68, 0.5],
        at,
      );
      box(
        parent,
        "ticket-roof",
        "#e3ae79",
        [x - 0.65, 0.73, z + 0.35],
        [0.55, 0.12, 0.65],
        at,
      );
      return;
    }
    if (id === "bench" || id === "picnic") {
      box(parent, "bench-seat", wood, [x, 0.27, z], [0.85, 0.1, 0.35], at);
      box(
        parent,
        "bench-back",
        green,
        [x, 0.49, z + 0.18],
        [0.85, 0.33, 0.08],
        at,
      );
      for (const dx of [-0.3, 0.3])
        box(
          parent,
          "bench-leg",
          green,
          [x + dx, 0.13, z],
          [0.08, 0.25, 0.28],
          at,
        );
      if (id === "picnic")
        box(
          parent,
          "picnic-table",
          "#e1c494",
          [x, 0.47, z - 0.3],
          [0.9, 0.12, 0.4],
          at,
        );
      return;
    }
    if (id === "bin" || id === "donation") {
      box(
        parent,
        id,
        id === "bin" ? green : "#d99d9b",
        [x, 0.25, z],
        [0.35, 0.5, 0.35],
        at,
      );
      box(parent, "box-slot", "#485d52", [x, 0.52, z], [0.23, 0.035, 0.06], at);
      if (id === "donation")
        ball(
          parent,
          "donation-heart",
          "#f1d7c5",
          [x, 0.31, z - 0.2],
          [0.15, 0.15, 0.05],
          at,
        );
      return;
    }
    if (id === "feeder" || id === "trough") {
      box(parent, "feeding-box", wood, [x, 0.12, z], [0.6, 0.24, 0.42], at);
      box(
        parent,
        "feeding-content",
        id === "trough" ? "#88cbd2" : "#bad383",
        [x, 0.25, z],
        [0.48, 0.045, 0.31],
        at,
      );
      if (id === "feeder")
        for (let i = 0; i < 3; i++)
          ball(
            parent,
            "carrot",
            "#e4a15e",
            [x + (i - 1) * 0.14, 0.29, z],
            [0.1, 0.12, 0.23],
            at,
          );
      return;
    }
    if (id === "shelter") {
      box(parent, "animal-shelter", wood, [x, 0.35, z], [0.8, 0.7, 0.7], at);
      box(
        parent,
        "shelter-door",
        "#6e6850",
        [x, 0.23, z - 0.36],
        [0.3, 0.44, 0.02],
        at,
      );
      box(parent, "shelter-roof", green, [x, 0.76, z], [0.95, 0.15, 0.85], at);
      return;
    }
    const b = buildings.find((b) => b.id === id);
    if (b?.kind === "shop") {
      const color = shopColors[buildings.indexOf(b) % shopColors.length];
      box(parent, "shop-counter", color, [x, 0.35, z], [0.8, 0.7, 0.65], at);
      box(
        parent,
        "shop-front",
        "#f4e6ce",
        [x, 0.45, z - 0.34],
        [0.55, 0.2, 0.025],
        at,
      );
      for (const dx of [-0.36, 0.36])
        pole(
          parent,
          "awning-pole",
          wood,
          [x + dx, 0.86, z],
          [0.05, 0.85, 0.05],
          at,
        );
      for (let i = 0; i < 5; i++)
        box(
          parent,
          "striped-awning",
          i % 2 ? "#f4e6ce" : color,
          [x + (i - 2) * 0.19, 1.22, z],
          [0.19, 0.12, 0.9],
          at,
        );
      ball(parent, "shop-sign", color, [x, 1.52, z], [0.35, 0.35, 0.22], at);
      return;
    }
    if (b?.kind === "play") {
      box(parent, "play-base", "#d3b483", [x, 0.08, z], [0.85, 0.16, 0.85], at);
      if (id === "trampoline") {
        pole(
          parent,
          "trampoline-rim",
          "#d8ac8b",
          [x, 0.3, z],
          [0.8, 0.12, 0.8],
          at,
        );
        pole(
          parent,
          "trampoline-mat",
          "#5d8991",
          [x, 0.37, z],
          [0.66, 0.03, 0.66],
          at,
        );
        return;
      }
      if (id === "sandbox") {
        box(parent, "sandpit", "#ead8a8", [x, 0.18, z], [0.75, 0.06, 0.75], at);
        ball(
          parent,
          "sand-bucket",
          "#e7a183",
          [x + 0.15, 0.29, z],
          [0.22, 0.2, 0.22],
          at,
        );
        return;
      }
      for (const dx of [-0.3, 0.3])
        box(
          parent,
          "play-post",
          green,
          [x + dx, 0.58, z],
          [0.09, 1.1, 0.09],
          at,
        );
      box(parent, "play-beam", "#dfad76", [x, 1.1, z], [0.85, 0.14, 0.14], at);
      const platform = box(
        parent,
        "play-slide",
        "#dc9e95",
        [x, 0.5, z - 0.15],
        [0.45, 0.08, 0.8],
        at,
      );
      platform.rotation.x = id === "slide" ? 0.6 : 0;
      return;
    }
    if (id === "tower") {
      for (const dx of [-0.3, 0.3])
        for (const dz of [-0.3, 0.3])
          pole(
            parent,
            "tower-post",
            wood,
            [x + dx, 0.8, z + dz],
            [0.09, 1.6, 0.09],
            at,
          );
      box(parent, "tower-platform", green, [x, 1.5, z], [0.85, 0.15, 0.85], at);
      return;
    }
    if (id === "litter")
      box(parent, "litter", "#f0e0bd", [x, 0.07, z], [0.2, 0.05, 0.15], at);
  }
  function animal(a: Animal): Figure {
    const s = getSpecies(a.species),
      at = { x: a.x, z: a.z };
    const node = new TransformNode(`animal-${a.id}`, scene);
    node.position.set(a.x, 0, a.z);
    const tall = ["giraffe", "flamingo"].includes(a.species),
      giant = ["elephant", "hippo", "giraffe", "camel"].includes(a.species);
    const body = ball(
      node,
      "animal-body",
      s.color,
      [0, 0.35, 0],
      [0.55, 0.43, 0.7],
      at,
    );
    if (giant) body.scaling.scaleInPlace(1.15);
    const headY = tall ? 1.05 : 0.65;
    const head = ball(
      node,
      "animal-head",
      s.color,
      [0, headY, -0.3],
      [0.5, 0.48, 0.48],
      at,
    );
    if (tall)
      pole(
        node,
        "long-neck",
        s.color,
        [0, 0.65, -0.22],
        [0.18, 0.75, 0.18],
        at,
      );
    for (const dx of [-0.14, 0.14]) {
      ball(
        node,
        "animal-eye",
        "#34473e",
        [dx, headY + 0.06, -0.51],
        [0.085, 0.1, 0.055],
        at,
      );
      ball(
        node,
        "eye-sparkle",
        "#fff6df",
        [dx - 0.012, headY + 0.08, -0.537],
        [0.025, 0.025, 0.015],
        at,
      );
    }
    for (const dx of [-0.17, 0.17])
      for (const dz of [-0.18, 0.18])
        pole(
          node,
          "animal-leg",
          s.color,
          [dx, 0.16, dz],
          [0.12, 0.3, 0.12],
          at,
        );
    ball(
      node,
      "animal-nose",
      "#826354",
      [0, headY - 0.04, -0.55],
      [0.12, 0.08, 0.06],
      at,
    );
    const earHeight = a.species === "rabbit" ? 0.48 : 0.17;
    for (const dx of [-0.17, 0.17])
      ball(
        node,
        "animal-ear",
        s.color,
        [dx, headY + 0.26 + earHeight * 0.25, -0.22],
        [0.14, earHeight, 0.12],
        at,
      );
    if (["rabbit", "pig", "guinea"].includes(a.species))
      ball(node, "tiny-tail", s.color, [0, 0.4, 0.4], [0.18, 0.18, 0.18], at);
    if (["goat", "giraffe", "camel"].includes(a.species))
      for (const dx of [-0.12, 0.12])
        pole(
          node,
          "horn",
          "#977757",
          [dx, headY + 0.3, -0.25],
          [0.06, 0.25, 0.06],
          at,
        );
    if (
      ["fox", "raccoon", "otter", "kangaroo", "iguana", "crocodile"].includes(
        a.species,
      )
    ) {
      const tail = ball(
        node,
        "long-tail",
        s.color,
        [0, 0.3, 0.48],
        [0.2, 0.2, 0.65],
        at,
      );
      tail.rotation.x = -0.35;
    }
    if (["raccoon", "zebra", "giraffe"].includes(a.species))
      for (let i = 0; i < 3; i++)
        box(
          node,
          "animal-marking",
          a.species === "giraffe" ? "#b58b52" : "#48554d",
          [(i - 1) * 0.17, 0.48, 0],
          [0.07, 0.2, 0.58],
          at,
        );
    if (["flamingo", "parrot", "penguin"].includes(a.species)) {
      ball(
        node,
        "bird-beak",
        "#e2aa62",
        [0, headY - 0.03, -0.59],
        [0.2, 0.12, 0.18],
        at,
      );
      for (const dx of [-0.28, 0.28])
        ball(node, "bird-wing", s.color, [dx, 0.4, 0], [0.12, 0.36, 0.4], at);
    }
    if (a.species === "penguin")
      ball(
        node,
        "penguin-belly",
        "#f4ecdb",
        [0, 0.36, -0.25],
        [0.4, 0.43, 0.13],
        at,
      );
    if (a.species === "tortoise")
      ball(
        node,
        "tortoise-shell",
        "#497a5a",
        [0, 0.48, 0.05],
        [0.64, 0.42, 0.7],
        at,
      );
    if (a.species === "elephant") {
      for (const dx of [-0.28, 0.28])
        ball(
          node,
          "elephant-ear",
          s.color,
          [dx, headY, -0.23],
          [0.32, 0.48, 0.12],
          at,
        );
      pole(
        node,
        "elephant-trunk",
        s.color,
        [0, 0.38, -0.59],
        [0.14, 0.5, 0.14],
        at,
      );
    }
    const carry = ball(
      node,
      "animal-heart",
      "#df9d9c",
      [0, headY + 0.65, 0],
      [0.14, 0.14, 0.14],
      at,
    );
    carry.setEnabled(false);
    return { node, head, carry };
  }
  function person(
    id: string,
    at: Point,
    color: string,
    child: boolean,
    hat: boolean,
  ): Figure {
    const node = new TransformNode(id, scene);
    node.position.set(at.x, 0, at.z);
    const height = child ? 0.78 : 1;
    box(node, "person-body", color, [0, 0.35, 0], [0.26, 0.36, 0.2], at);
    const head = ball(
      node,
      "person-head",
      "#e8bd96",
      [0, 0.67, 0],
      [0.35, 0.37, 0.32],
      at,
    );
    for (const dx of [-0.065, 0.065])
      ball(
        node,
        "person-eye",
        "#3e5046",
        [dx, 0.7, -0.145],
        [0.035, 0.045, 0.025],
        at,
      );
    ball(
      node,
      "person-hair",
      "#78634b",
      [0, 0.8, 0.025],
      [0.37, 0.18, 0.3],
      at,
    );
    for (const dx of [-0.08, 0.08])
      box(node, "person-leg", "#5b736f", [dx, 0.12, 0], [0.1, 0.24, 0.13], at);
    for (const dx of [-0.19, 0.19])
      box(node, "person-arm", color, [dx, 0.37, 0], [0.1, 0.27, 0.12], at);
    if (hat) {
      pole(node, "keeper-hat", "#d3ba83", [0, 0.86, 0], [0.46, 0.07, 0.46], at);
      pole(
        node,
        "keeper-hat-top",
        "#d3ba83",
        [0, 0.91, 0],
        [0.3, 0.13, 0.3],
        at,
      );
    }
    const carry = box(
      node,
      "carried-food",
      "#d9b378",
      [0, 0.35, -0.3],
      [0.34, 0.2, 0.25],
      at,
    );
    carry.setEnabled(false);
    node.scaling.setAll(height);
    return { node, head, carry };
  }
  function updateCamera(): void {
    const aspect = engine.getRenderWidth() / engine.getRenderHeight();
    camera.orthoLeft = -extent * aspect;
    camera.orthoRight = extent * aspect;
    camera.orthoTop = extent;
    camera.orthoBottom = -extent;
  }
  function rebuild(): void {
    world.dispose();
    world = new TransformNode("world", scene);
    for (const figure of figures.values()) figure.node.dispose();
    figures.clear();
    const center = (game.size - 1) / 2;
    box(
      world,
      "diorama-earth",
      "#c4ad88",
      [center, -0.34, center],
      [game.size + 0.08, 0.6, game.size + 0.08],
      { x: 0, z: 0 },
    ).isPickable = false;
    for (const p of points(game)) {
      const t = tile(game, p),
        path = [
          "path",
          "stonepath",
          "woodpath",
          "familypath",
          "entrance",
        ].includes(t.object);
      const c = path
        ? ({ stonepath: "#c7c5b3", woodpath: "#ba9b76", familypath: "#d6c1a0" }[
            t.object
          ] ?? "#dfcca4")
        : terrainColors[t.terrain];
      box(world, "tile", c, [p.x, 0, p.z], [0.985, 0.1, 0.985], p);
      if (path) {
        for (const dx of [-0.22, 0.22])
          box(
            world,
            "path-paver",
            "#e8d9b9",
            [p.x + dx, 0.058, p.z],
            [0.36, 0.012, 0.68],
            p,
          );
      }
      object(t.object, p);
      for (let i = 0; i < Math.min(t.dirt, 4); i++)
        ball(
          world,
          "cartoon-dropping",
          "#977655",
          [p.x - 0.22 + i * 0.15, 0.15, p.z + 0.25],
          [0.16, 0.15, 0.18],
          p,
        );
    }
    for (const [edge, kind] of Object.entries(game.fences)) {
      const ends = edge.split("|").map((v) => v.split(",").map(Number)),
        [a, b] = ends;
      const p = {
        x: Math.max(0, Math.min(game.size - 1, a[0])),
        z: Math.max(0, Math.min(game.size - 1, a[1])),
      };
      const x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2,
        alongZ = a[0] !== b[0],
        high = kind === "highfence",
        h = high ? 0.9 : 0.55;
      for (const offset of [-0.46, 0.46])
        box(
          world,
          "fence-post",
          "#a17d57",
          [x + (alongZ ? 0 : offset), h / 2, z + (alongZ ? offset : 0)],
          [0.08, h, 0.08],
          p,
        );
      const damaged =
        edge === edgeKey({ x: 3, z: 3 }, { x: 3, z: 4 }) &&
        !game.counters.repaired;
      for (const y of [h * 0.35, h * 0.8]) {
        const rail = box(
          world,
          damaged ? "damaged-fence" : kind === "gate" ? "gate" : "fence-rail",
          kind === "gate" ? "#6d8b70" : "#c3a47a",
          [x, y, z],
          alongZ ? [0.055, 0.09, 0.95] : [0.95, 0.09, 0.055],
          p,
        );
        if (damaged) {
          rail.rotation.z = 0.22;
          rail.position.y -= 0.08;
        }
      }
    }
    for (const a of game.animals) figures.set(`animal-${a.id}`, animal(a));
    figures.set(
      "keeper",
      person("keeper", game.keeper, "#659078", false, true),
    );
    for (const w of game.workers)
      figures.set(
        `worker-${w.id}`,
        person(
          `worker-${w.id}`,
          w,
          ["#6b9b84", "#7ca4af", "#97aa70", "#dcab81"][
            ["keeper", "cleaner", "gardener", "vendor"].indexOf(w.role)
          ],
          false,
          true,
        ),
      );
    for (const v of game.visitors)
      figures.set(
        `visitor-${v.id}`,
        person(
          `visitor-${v.id}`,
          v,
          shopColors[v.id % shopColors.length],
          v.type === "child",
          false,
        ),
      );
    if (size !== game.size) {
      camera.setTarget(new Vector3(center, 0, center));
      extent = game.size * 0.64 + 1;
    }
    revision = game.revision;
    size = game.size;
    updateCamera();
  }
  function animatePerson(
    id: string,
    at: Point,
    activity: string,
    task: Task | null,
  ): void {
    const f = figures.get(id)!;
    const previous = f.node.position.clone();
    f.node.position.x += (at.x - f.node.position.x) * 0.25;
    f.node.position.z += (at.z - f.node.position.z) * 0.25;
    const moving =
      Math.abs(previous.x - at.x) + Math.abs(previous.z - at.z) > 0.03;
    f.node.position.y =
      activity === "jump"
        ? Math.abs(Math.sin(game.time * 7)) * 0.3
        : moving
          ? Math.abs(Math.sin(game.time * 10)) * 0.04
          : 0;
    f.node.rotation.y = moving
      ? Math.atan2(at.x - previous.x, at.z - previous.z) + Math.PI
      : f.node.rotation.y;
    f.head.rotation.z =
      task && !task.route.length ? Math.sin(game.time * 10) * 0.15 : 0;
    f.carry.setEnabled(!!task?.carrying || activity === "snack");
    f.node.scaling.y = (activity === "sit" ? 0.75 : 1) * f.node.scaling.x;
    for (const mesh of f.node.getChildMeshes())
      mesh.metadata.tile = { x: at.x, z: at.z };
  }
  function render(): void {
    const ids =
      1 + game.animals.length + game.workers.length + game.visitors.length;
    if (
      revision !== game.revision ||
      size !== game.size ||
      figures.size !== ids ||
      game.visitors.some((v) => !figures.has(`visitor-${v.id}`)) ||
      game.workers.some((w) => !figures.has(`worker-${w.id}`)) ||
      game.animals.some((a) => !figures.has(`animal-${a.id}`))
    )
      rebuild();
    for (const a of game.animals) {
      const f = figures.get(`animal-${a.id}`)!;
      const active = a.hunger > 35 && a.water > 30;
      f.node.position.y = active
        ? Math.abs(Math.sin(game.time * 2 + a.id)) * 0.035
        : 0;
      f.node.rotation.y = Math.sin(game.time * 0.5 + a.id) * 0.2;
      f.head.rotation.x =
        a.activity === "eat" ? Math.sin(game.time * 8) * 0.2 : 0;
      f.node.scaling.y = a.activity === "sleep" ? 0.75 : 1;
      f.carry.setEnabled(a.activity === "play");
    }
    animatePerson("keeper", game.keeper, "walk", game.keeper.task);
    for (const w of game.workers)
      animatePerson(`worker-${w.id}`, w, "walk", w.task);
    for (const v of game.visitors)
      animatePerson(`visitor-${v.id}`, v, v.activity, null);
    updateCamera();
    scene.render();
  }
  function zoom(delta: number): void {
    extent = Math.max(2, Math.min(18, extent + delta));
    updateCamera();
  }
  function rotate(delta: number): void {
    camera.alpha += delta;
  }
  const wheel = (event: WheelEvent): void => {
    event.preventDefault();
    zoom(event.deltaY * 0.005);
  };
  canvas.addEventListener("wheel", wheel, { passive: false });
  const resize = (): void => {
    engine.resize();
    updateCamera();
  };
  window.addEventListener("resize", resize);
  const pointer = scene.onPointerObservable.add((info) => {
    if (
      info.type === PointerEventTypes.POINTERPICK &&
      info.event.button === 0
    ) {
      const p = info.pickInfo?.pickedMesh?.metadata?.tile as Point | undefined;
      if (p) onSelect({ ...p });
    }
  });
  rebuild();
  return {
    scene,
    render,
    rebuild,
    zoom,
    rotate,
    dispose: () => {
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("resize", resize);
      scene.onPointerObservable.remove(pointer);
      scene.dispose();
      if (!suppliedEngine) engine.dispose();
    },
  };
}
