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
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents.js";
// Scene.pick is registered separately when using granular Babylon imports.
import "@babylonjs/core/Culling/ray.js";
import { getSpecies, buildings } from "./catalog";
import {
  penMates,
  points,
  tile,
  type Game,
  type Animal,
  type Task,
} from "./game";
import { edgeKey, type Point } from "./world";

export interface ZooRenderer {
  scene: Scene;
  render: () => void;
  rebuild: () => void;
  zoom: (delta: number) => void;
  rotate: (delta: number) => void;
  setPlacementMode: (enabled: boolean) => void;
  dispose: () => void;
}
interface Figure {
  node: TransformNode;
  head: Mesh;
  carry: Mesh;
  bubble: TransformNode;
  bubbleKind: string;
  bubbleHeight: number;
  signature: string;
  limbs: Mesh[];
  walkBlend: number;
  logical: Point;
  lane: Point;
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
  let previousRenderTime = performance.now() - 1000 / 60;
  let frameDelta = 1 / 60;
  let visualTime = 0;
  let adopted = game.counters.adopted ?? 0;
  let eventIndex = game.counters.eventIndex ?? 0;
  let celebration: TransformNode | null = null;
  let celebrationStarted = 0;
  let celebrationKind = "";
  let observedAnimals = new Set(game.animals.map((animal) => animal.id));
  let animalCollection = game.animals;
  let placementMode = false;
  let arrivingAnimal: number | null = null;
  let celebrationFocus: Point = { x: 1, z: 4 };
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
  function rugged(
    parent: TransformNode,
    name: string,
    color: string,
    pos: number[],
    scale: number[],
    at: Point,
  ): Mesh {
    const mesh = MeshBuilder.CreateIcoSphere(
      name,
      { radius: 0.5, subdivisions: 1, flat: true },
      scene,
    );
    mesh.parent = parent;
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.scaling.set(scale[0], scale[1], scale[2]);
    mesh.rotation.set(0.12 * (at.x % 3), at.z * 0.47, 0.13 * (at.z % 2));
    mesh.material = material(color);
    mesh.metadata = { tile: { x: at.x, z: at.z } };
    return mesh;
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
    rugged(
      parent,
      "tree-crown",
      "#76a878",
      [at.x, 1.1 * s, at.z],
      [0.85 * s, 1.05 * s, 0.85 * s],
      at,
    );
    rugged(
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
      for (let i = 0; i < 5; i++) {
        const blade = box(
          parent,
          "weed-leaf",
          i % 2 ? "#74945e" : "#8daa68",
          [
            x + ((i % 3) - 1) * 0.14,
            0.2 + (i % 2) * 0.08,
            z + (Math.floor(i / 3) - 0.5) * 0.24,
          ],
          [0.065, 0.42 + (i % 2) * 0.13, 0.1],
          at,
        );
        blade.rotation.z = (i - 2) * 0.2;
        blade.rotation.y = i * 0.8;
      }
      if ((x + z) % 3 === 0)
        rugged(
          parent,
          "wild-bush",
          "#7d9c69",
          [x + 0.12, 0.17, z],
          [0.6, 0.38, 0.5],
          at,
        );
      return;
    }
    if (id === "rock") {
      const rock = rugged(
        parent,
        "rock",
        "#9fa79c",
        [x, 0.2, z],
        [0.58, 0.47, 0.46],
        at,
      );
      rock.rotation.z += 0.25;
      rugged(
        parent,
        "rock-chip",
        "#b8bba9",
        [x + 0.24, 0.11, z - 0.13],
        [0.2, 0.19, 0.21],
        at,
      );
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
      for (const dx of [-0.13, 0.12]) {
        const splinter = box(
          parent,
          "stump-splinter",
          "#c5a174",
          [x + dx, 0.47, z + 0.05],
          [0.08, 0.19 + dx * 0.3, 0.11],
          at,
        );
        splinter.rotation.z = dx * 1.6;
      }
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
        id === "trough" ? "#88cbd2" : "#e5d0a0",
        [x, 0.25, z],
        [0.48, 0.045, 0.31],
        at,
      );
      if (id === "feeder") {
        // Show what the residents eat, so children see whose bowl it is.
        const portions = [
          ...new Set(penMates(game, at).map((a) => getSpecies(a.species).food)),
        ];
        for (const [index, food] of portions.entries()) {
          const serving = new TransformNode("feeder-serving", scene);
          serving.parent = parent;
          serving.position.set(
            x + (index - (portions.length - 1) / 2) * 0.12,
            0.36,
            z,
          );
          serving.scaling.setAll(0.55);
          needIcon(serving, food === "greens" ? "food" : "food-" + food, at);
          for (const mesh of serving.getChildMeshes())
            mesh.name = "feeder-" + mesh.name;
        }
      }
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
  function thoughtBubble(id: string, at: Point): TransformNode {
    const node = new TransformNode(`bubble-${id}`, scene);
    ball(
      node,
      "need-bubble-cloud",
      "#fff9ed",
      [0, 0, 0],
      [0.78, 0.66, 0.12],
      at,
    );
    ball(
      node,
      "need-bubble-tail",
      "#fff9ed",
      [-0.18, -0.33, 0],
      [0.16, 0.15, 0.1],
      at,
    );
    ball(
      node,
      "need-bubble-dot",
      "#fff9ed",
      [-0.25, -0.48, 0],
      [0.09, 0.09, 0.08],
      at,
    );
    node.scaling.setAll(
      id.startsWith("visitor-") ? 0.5 : id.startsWith("animal-") ? 0.7 : 0.6,
    );
    node.setEnabled(false);
    return node;
  }
  function needIcon(parent: TransformNode, kind: string, at: Point): void {
    if (kind === "food") {
      const carrot = ball(
        parent,
        "need-food",
        "#e29448",
        [0, -0.03, -0.12],
        [0.18, 0.37, 0.08],
        at,
      );
      carrot.rotation.z = -0.4;
      for (const dx of [-0.06, 0.06]) {
        const leaf = box(
          parent,
          "carrot-leaf",
          "#70a36a",
          [dx, 0.19, -0.12],
          [0.07, 0.17, 0.04],
          at,
        );
        leaf.rotation.z = dx * 7;
      }
    } else if (kind === "snack") {
      box(
        parent,
        "need-snack",
        "#eaa3a0",
        [0, -0.07, -0.12],
        [0.3, 0.3, 0.08],
        at,
      );
      for (const dx of [-0.1, 0, 0.1]) {
        box(
          parent,
          "popcorn-stripe",
          "#fff1d9",
          [dx, -0.08, -0.17],
          [0.035, 0.25, 0.025],
          at,
        );
        ball(
          parent,
          "popcorn-kernel",
          "#fff0ba",
          [dx, 0.11 + Math.abs(dx) * 0.3, -0.12],
          [0.16, 0.15, 0.09],
          at,
        );
      }
    } else if (kind === "food-fruit") {
      ball(
        parent,
        "need-fruit",
        "#e3937f",
        [0, -0.03, -0.12],
        [0.32, 0.3, 0.08],
        at,
      );
      const leaf = ball(
        parent,
        "fruit-leaf",
        "#78a56b",
        [0.08, 0.17, -0.12],
        [0.16, 0.08, 0.05],
        at,
      );
      leaf.rotation.z = 0.4;
    } else if (kind === "food-fish") {
      ball(
        parent,
        "need-fish",
        "#7eb9c8",
        [0.04, 0, -0.12],
        [0.31, 0.2, 0.08],
        at,
      );
      const tail = box(
        parent,
        "fish-tail",
        "#7eb9c8",
        [-0.15, 0, -0.12],
        [0.14, 0.14, 0.06],
        at,
      );
      tail.rotation.z = Math.PI / 4;
      ball(
        parent,
        "fish-eye",
        "#405e61",
        [0.12, 0.035, -0.17],
        [0.035, 0.035, 0.02],
        at,
      );
    } else if (kind === "food-grain") {
      box(
        parent,
        "need-grain",
        "#b49654",
        [0, 0, -0.12],
        [0.035, 0.4, 0.04],
        at,
      );
      for (const y of [-0.1, 0, 0.1])
        for (const dx of [-0.065, 0.065]) {
          const seed = ball(
            parent,
            "grain-seed",
            "#e3bf70",
            [dx, y, -0.12],
            [0.12, 0.08, 0.05],
            at,
          );
          seed.rotation.z = dx < 0 ? -0.5 : 0.5;
        }
    } else if (kind === "food-meat") {
      ball(
        parent,
        "need-meat",
        "#ce8d88",
        [0, 0, -0.12],
        [0.36, 0.28, 0.08],
        at,
      );
      ball(
        parent,
        "meat-bone",
        "#fff0d6",
        [0.065, 0, -0.17],
        [0.1, 0.1, 0.025],
        at,
      );
    } else if (kind === "water") {
      ball(
        parent,
        "need-water",
        "#66b8d6",
        [0, -0.06, -0.12],
        [0.29, 0.28, 0.08],
        at,
      );
      ball(
        parent,
        "water-drop-tip",
        "#66b8d6",
        [0, 0.08, -0.12],
        [0.16, 0.29, 0.08],
        at,
      );
      ball(
        parent,
        "water-sparkle",
        "#e9f5f0",
        [-0.06, -0.05, -0.17],
        [0.045, 0.1, 0.02],
        at,
      );
    } else if (kind === "heart") {
      // A single flat silhouette keeps the notch and pointed tip readable at
      // bubble size; overlapping ellipsoids looked like two rounded cheeks.
      const heart = new Mesh("need-heart", scene);
      heart.parent = parent;
      heart.position.z = -0.12;
      heart.metadata = { tile: { ...at } };
      const positions = [0, 0, 0];
      const normals = [0, 0, -1];
      const indices: number[] = [];
      const segments = 64;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        positions.push(
          16 * Math.sin(angle) ** 3 * 0.014,
          (13 * Math.cos(angle) -
            5 * Math.cos(2 * angle) -
            2 * Math.cos(3 * angle) -
            Math.cos(4 * angle)) *
            0.014,
          0,
        );
        normals.push(0, 0, -1);
        indices.push(0, i + 1, ((i + 1) % segments) + 1);
      }
      const geometry = new VertexData();
      geometry.positions = positions;
      geometry.normals = normals;
      geometry.indices = indices;
      geometry.applyToMesh(heart);
      const pink = material("#e76c91");
      pink.backFaceCulling = false;
      heart.material = pink;
    } else if (kind === "rest") {
      for (const y of [-0.14, 0.14])
        box(
          parent,
          "need-rest",
          "#7294aa",
          [0, y, -0.12],
          [0.3, 0.055, 0.05],
          at,
        );
      const slash = box(
        parent,
        "sleepy-z",
        "#7294aa",
        [0, 0, -0.12],
        [0.06, 0.34, 0.05],
        at,
      );
      slash.rotation.z = -0.65;
    } else if (kind === "play") {
      ball(
        parent,
        "need-play",
        "#e6b863",
        [0, 0, -0.12],
        [0.35, 0.35, 0.07],
        at,
      );
      for (const dx of [-0.07, 0.07])
        ball(
          parent,
          "play-eye",
          "#617a65",
          [dx, 0.045, -0.17],
          [0.035, 0.05, 0.02],
          at,
        );
      ball(
        parent,
        "play-smile",
        "#617a65",
        [0, -0.07, -0.17],
        [0.14, 0.05, 0.02],
        at,
      );
    } else if (kind === "plant") {
      box(
        parent,
        "need-plant",
        "#709968",
        [0, -0.04, -0.12],
        [0.04, 0.32, 0.04],
        at,
      );
      for (const dx of [-0.1, 0.1]) {
        const leaf = ball(
          parent,
          "plant-leaf",
          "#8db76d",
          [dx, 0.07, -0.12],
          [0.22, 0.1, 0.05],
          at,
        );
        leaf.rotation.z = dx < 0 ? -0.45 : 0.45;
      }
      ball(
        parent,
        "plant-soil",
        "#ad855f",
        [0, -0.2, -0.12],
        [0.3, 0.1, 0.07],
        at,
      );
    } else if (kind === "clean") {
      const handle = box(
        parent,
        "need-clean",
        "#aa825b",
        [0.04, 0.04, -0.12],
        [0.06, 0.34, 0.05],
        at,
      );
      handle.rotation.z = -0.4;
      box(
        parent,
        "cleaning-brush",
        "#6fa493",
        [-0.04, -0.15, -0.12],
        [0.28, 0.14, 0.06],
        at,
      );
    } else {
      const handle = box(
        parent,
        "need-work",
        "#aa825b",
        [0, -0.05, -0.12],
        [0.07, 0.35, 0.05],
        at,
      );
      handle.rotation.z = -0.3;
      box(
        parent,
        "repair-hammer",
        "#829b98",
        [0.04, 0.13, -0.12],
        [0.3, 0.13, 0.06],
        at,
      );
    }
  }
  function updateBubble(f: Figure, kind: string): void {
    f.bubble.setEnabled(kind !== "");
    if (kind !== f.bubbleKind) {
      f.bubble
        .getChildTransformNodes(
          true,
          (node) => node.name === `bubble-icon-${f.node.name}`,
        )
        .forEach((node) => node.dispose());
      if (kind) {
        const icon = new TransformNode(`bubble-icon-${f.node.name}`, scene);
        icon.parent = f.bubble;
        needIcon(icon, kind, {
          x: Math.round(f.node.position.x),
          z: Math.round(f.node.position.z),
        });
      }
      f.bubbleKind = kind;
    }
    const icon = scene.getTransformNodeByName(`bubble-icon-${f.node.name}`);
    if (icon)
      icon.scaling.setAll(
        kind === "heart" ? 1 + Math.sin(game.time * 4) * 0.06 : 1,
      );
    f.bubble.position.set(
      f.node.position.x,
      f.node.position.y + f.bubbleHeight + Math.sin(game.time * 2) * 0.035,
      f.node.position.z,
    );
    f.bubble.rotation.set(
      Math.PI / 2 - camera.beta,
      -camera.alpha - Math.PI / 2,
      0,
    );
    for (const mesh of f.bubble.getChildMeshes())
      mesh.metadata.tile = {
        x: Math.round(f.node.position.x),
        z: Math.round(f.node.position.z),
      };
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
    // Round cream muzzles, rosy cheeks and sparkling eyes share our toy-like style.
    ball(
      node,
      "animal-muzzle",
      "#fff0d8",
      [0, headY - 0.07, -0.46],
      [0.32, 0.22, 0.2],
      at,
    );
    for (const dx of [-0.19, 0.19])
      ball(
        node,
        "animal-cheek",
        "#eeb4b0",
        [dx, headY - 0.02, -0.48],
        [0.095, 0.055, 0.045],
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
    if (a.species === "rabbit")
      for (const dx of [-0.17, 0.17])
        ball(
          node,
          "rabbit-inner-ear",
          "#efbfbc",
          [dx, headY + 0.4, -0.275],
          [0.065, 0.32, 0.045],
          at,
        );
    if (a.species === "pig")
      ball(
        node,
        "pig-snout",
        "#dd8f9e",
        [0, headY - 0.03, -0.59],
        [0.24, 0.15, 0.09],
        at,
      );
    if (a.species === "raccoon")
      for (const dx of [-0.14, 0.14])
        ball(
          node,
          "raccoon-mask",
          "#48554d",
          [dx, headY + 0.05, -0.49],
          [0.2, 0.17, 0.035],
          at,
        );
    if (a.species === "iguana" || a.species === "crocodile")
      for (let i = 0; i < 5; i++)
        ball(
          node,
          "reptile-crest",
          "#b0ca6d",
          [0, 0.59, -0.1 + i * 0.12],
          [0.1, 0.17, 0.1],
          at,
        );
    if (a.species === "camel")
      ball(node, "camel-hump", s.color, [0, 0.58, 0.12], [0.4, 0.4, 0.4], at);
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
    return {
      node,
      head,
      carry,
      bubble: thoughtBubble(node.name, at),
      bubbleKind: "",
      bubbleHeight: tall ? 1.95 : 1.5,
      signature: "",
      limbs: node
        .getChildMeshes()
        .filter((mesh) => mesh.name === "animal-leg") as Mesh[],
      walkBlend: 0,
      logical: { ...at },
      lane: { x: 0, z: 0 },
    };
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
    const player = id === "keeper";
    const height = player ? 0.95 : child ? 0.62 : 0.75;
    ball(node, "person-body", color, [0, 0.35, 0], [0.29, 0.4, 0.24], at);
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
      ball(node, "person-arm", color, [dx, 0.37, 0], [0.1, 0.27, 0.12], at);
    if (hat) {
      pole(
        node,
        "keeper-hat",
        player ? "#efb447" : "#d3ba83",
        [0, 0.86, 0],
        [0.46, 0.07, 0.46],
        at,
      );
      pole(
        node,
        "keeper-hat-top",
        player ? "#efb447" : "#d3ba83",
        [0, 0.91, 0],
        [0.3, 0.13, 0.3],
        at,
      );
    }
    for (const dx of [-0.12, 0.12])
      ball(
        node,
        "person-cheek",
        "#df9b91",
        [dx, 0.65, -0.145],
        [0.07, 0.035, 0.025],
        at,
      );
    ball(
      node,
      "person-smile",
      "#9b6659",
      [0, 0.62, -0.155],
      [0.055, 0.02, 0.02],
      at,
    );
    const tool = new TransformNode(`tool-${id}`, scene);
    tool.parent = node;
    box(
      tool,
      "work-tool-handle",
      "#a37a50",
      [0.25, 0.34, -0.2],
      [0.045, 0.5, 0.045],
      at,
    );
    box(
      tool,
      "work-tool-spade",
      "#91b0ab",
      [0.25, 0.1, -0.2],
      [0.17, 0.18, 0.045],
      at,
    );
    tool.setEnabled(false);
    const carry = box(
      node,
      "carried-food",
      "#d9b378",
      [0, 0.35, -0.3],
      [0.34, 0.2, 0.25],
      at,
    );
    carry.setEnabled(false);
    for (let i = 0; i < 3; i++)
      ball(
        carry,
        "snack-popcorn",
        "#fff2c9",
        [(i - 1) * 0.24, 0.5, 0],
        [0.35, 0.4, 0.4],
        at,
      );
    node.scaling.setAll(height);
    if (player) {
      box(
        node,
        "player-scarf",
        "#e9a162",
        [0, 0.51, -0.1],
        [0.32, 0.12, 0.08],
        at,
      );
      const ring = MeshBuilder.CreateTorus(
        "player-ring",
        { diameter: 0.78, thickness: 0.055, tessellation: 24 },
        scene,
      );
      ring.parent = node;
      ring.position.y = 0.06;
      ring.material = material("#efbb4d");
      ring.metadata = { tile: { x: at.x, z: at.z } };
      const marker = MeshBuilder.CreatePolyhedron(
        "player-marker",
        { type: 1, size: 0.12 },
        scene,
      );
      marker.parent = node;
      marker.position.y = 1.23;
      marker.scaling.y = 1.35;
      marker.material = material("#efbb4d");
      marker.metadata = { tile: { x: at.x, z: at.z } };
    }
    return {
      node,
      head,
      carry,
      bubble: thoughtBubble(node.name, at),
      bubbleKind: "",
      bubbleHeight: height * (player ? 1.8 : 1.35),
      signature: "",
      limbs: node
        .getChildMeshes()
        .filter(
          (mesh) => mesh.name === "person-leg" || mesh.name === "person-arm",
        ) as Mesh[],
      walkBlend: 0,
      logical: { ...at },
      lane: { x: 0, z: 0 },
    };
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
      if (
        t.terrain === "grass" &&
        !path &&
        !t.object &&
        (p.x * 7 + p.z * 3) % 5 === 0
      ) {
        for (const direction of [-1, 1]) {
          const grass = box(
            world,
            "wild-grass-tuft",
            "#86a76d",
            [p.x + 0.27, 0.13, p.z - 0.26],
            [0.035, 0.17, 0.16],
            p,
          );
          grass.rotation.z = direction * 0.35;
          grass.rotation.y = direction * 0.6;
        }
      }
      for (let i = 0; i < Math.min(t.dirt, 4); i++) {
        if (t.object === "bin" || path || t.object === "litter") {
          const paper = box(
            world,
            t.object === "bin" ? "bin-paper" : "dropped-paper",
            i % 2 ? "#e7ba9a" : "#f4e6c7",
            [
              p.x - 0.11 + i * 0.07,
              t.object === "bin" ? 0.5 + i * 0.04 : 0.09,
              p.z + 0.06,
            ],
            [0.13, 0.035, 0.16],
            p,
          );
          paper.rotation.set(0.2, i * 0.9, 0.15);
        } else {
          ball(
            world,
            "cartoon-dropping",
            "#977655",
            [p.x - 0.22 + i * 0.15, 0.15, p.z + 0.25],
            [0.16, 0.15, 0.18],
            p,
          );
        }
      }
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
    reconcileFigures();
    if (size === -1) {
      const focus = Math.min(center, 4.5);
      camera.setTarget(new Vector3(focus, 0, focus), false, false, true);
      extent = 6.4;
    }
    revision = game.revision;
    size = game.size;
    updateCamera();
  }
  function reconcileFigures(): void {
    const alive = new Set<string>();
    function keep(id: string, signature: string, create: () => Figure): void {
      alive.add(id);
      const old = figures.get(id);
      if (old && old.signature !== signature) {
        old.node.dispose();
        old.bubble.dispose();
        figures.delete(id);
      }
      if (!figures.has(id)) {
        const figure = create();
        figure.signature = signature;
        figures.set(id, figure);
      }
    }
    keep("keeper", "player", () =>
      person("keeper", game.keeper, "#4e9daf", false, true),
    );
    for (const a of game.animals)
      keep(`animal-${a.id}`, a.species, () => animal(a));
    for (const w of game.workers)
      keep(`worker-${w.id}`, w.role, () =>
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
      keep(`visitor-${v.id}`, v.type, () =>
        person(
          `visitor-${v.id}`,
          v,
          shopColors[v.id % shopColors.length],
          v.type === "child",
          false,
        ),
      );
    for (const [id, figure] of figures) {
      if (!alive.has(id)) {
        figure.node.dispose();
        figure.bubble.dispose();
        figures.delete(id);
      }
    }
  }
  function moveFigure(f: Figure, at: Point): void {
    if (
      f.node.name.startsWith("visitor-") &&
      (at.x !== f.logical.x || at.z !== f.logical.z)
    ) {
      const stepX = at.x - f.logical.x;
      const stepZ = at.z - f.logical.z;
      const length = Math.hypot(stepX, stepZ);
      f.lane = { x: (-stepZ / length) * 0.17, z: (stepX / length) * 0.17 };
    }
    f.logical = { x: at.x, z: at.z };
    const dx = at.x + f.lane.x - f.node.position.x,
      dz = at.z + f.lane.z - f.node.position.z;
    const moving = Math.hypot(dx, dz) > 0.025;
    const easing = 1 - Math.exp(-12 * frameDelta);
    f.node.position.x += dx * easing;
    f.node.position.z += dz * easing;
    f.walkBlend +=
      ((moving ? 1 : 0) - f.walkBlend) * (1 - Math.exp(-10 * frameDelta));
    if (moving) {
      const target = Math.atan2(dx, dz) + Math.PI;
      const angle = Math.atan2(
        Math.sin(target - f.node.rotation.y),
        Math.cos(target - f.node.rotation.y),
      );
      f.node.rotation.y += angle * (1 - Math.exp(-9 * frameDelta));
    }
    for (const [index, limb] of f.limbs.entries())
      limb.rotation.x =
        Math.sin(
          visualTime * 10 +
            (index % 2) * Math.PI +
            (limb.name === "person-arm" ? Math.PI : 0),
        ) *
        0.45 *
        f.walkBlend;
  }
  function animatePerson(
    id: string,
    at: Point,
    activity: string,
    task: Task | null,
  ): void {
    const f = figures.get(id)!;
    moveFigure(f, at);
    f.node.position.y =
      activity === "jump"
        ? Math.abs(Math.sin(visualTime * 7)) * 0.3
        : Math.abs(Math.sin(visualTime * 10)) * 0.045 * f.walkBlend;
    f.head.rotation.z =
      task && !task.route.length ? Math.sin(game.time * 10) * 0.15 : 0;
    f.carry.setEnabled(!!task?.carrying || activity === "snack");
    const working = !!task && !task.route.length && task.kind !== "walk";
    const tool = scene.getTransformNodeByName(`tool-${id}`)!;
    tool.setEnabled(
      working && ["clean", "clear", "repair", "plant"].includes(task!.kind),
    );
    tool.rotation.x = working ? Math.sin(visualTime * 9) * 0.65 : 0;
    const arms = f.limbs.filter((limb) => limb.name === "person-arm");
    const cheering =
      activity === "wave" || activity === "cheer" || activity === "jump";
    for (const [index, arm] of arms.entries()) {
      arm.rotation.z = cheering
        ? (index ? -1 : 1) * (2.2 + Math.sin(visualTime * 7) * 0.3)
        : 0;
      if (working || activity === "snack")
        arm.rotation.x = -0.8 + Math.sin(visualTime * 8) * 0.35;
    }
    f.carry.rotation.x =
      activity === "snack" ? Math.sin(visualTime * 5) * 0.15 : 0;
    f.node.scaling.y = (activity === "sit" ? 0.75 : 1) * f.node.scaling.x;
    const need = task
      ? task.kind === "feed"
        ? task.carrying && task.carrying !== "greens"
          ? "food-" + task.carrying
          : "food"
        : task.kind === "pet"
          ? "heart"
          : task.kind === "plant"
            ? "plant"
            : ["clean", "clear"].includes(task.kind)
              ? "clean"
              : "work"
      : "";
    updateBubble(f, need);
    for (const mesh of f.node.getChildMeshes())
      mesh.metadata.tile = { x: at.x, z: at.z };
  }
  function startCelebration(
    kind: string,
    animalId: number | null = null,
  ): void {
    celebration?.dispose();
    arrivingAnimal = animalId;
    const arriving = game.animals.find((animal) => animal.id === animalId);
    celebrationFocus = arriving
      ? { x: arriving.x, z: arriving.z }
      : { x: 1, z: 4 };
    celebration = new TransformNode("celebration", scene);
    celebrationStarted = visualTime;
    celebrationKind = kind;
    const at = { x: 1, z: 4 };
    if (kind === "arrival") {
      const van = new TransformNode("arrival-transporter", scene);
      van.parent = celebration;
      box(
        van,
        "transporter-body",
        "#80b6ad",
        [0, 0.4, 0],
        [1.5, 0.7, 0.75],
        at,
      );
      box(
        van,
        "transporter-cabin",
        "#efc779",
        [-0.6, 0.75, 0],
        [0.5, 0.55, 0.75],
        at,
      );
      box(
        van,
        "transporter-window",
        "#d9f0ed",
        [-0.64, 0.8, -0.39],
        [0.3, 0.24, 0.025],
        at,
      );
      for (const x of [-0.5, 0.5])
        for (const z of [-0.4, 0.4])
          ball(
            van,
            "transporter-wheel",
            "#4f655c",
            [x, 0.14, z],
            [0.3, 0.3, 0.12],
            at,
          );
      box(
        celebration,
        "arrival-crate",
        "#d8b180",
        [1.5, 0.3, 4],
        [0.55, 0.55, 0.55],
        at,
      );
    } else if (kind === "balloon") {
      ball(
        celebration,
        "lost-balloon",
        "#e7a0b4",
        [2, 1.8, 4],
        [0.4, 0.52, 0.4],
        at,
      );
      box(
        celebration,
        "balloon-string",
        "#fff4de",
        [2, 1.1, 4],
        [0.015, 0.9, 0.015],
        at,
      );
    } else if (kind === "photo") {
      box(
        celebration,
        "photo-camera",
        "#607e79",
        [1.8, 0.8, 4],
        [0.45, 0.3, 0.22],
        at,
      );
      ball(
        celebration,
        "photo-lens",
        "#e4f5ee",
        [1.8, 0.8, 3.85],
        [0.2, 0.2, 0.1],
        at,
      );
    } else if (kind === "sunny") {
      ball(celebration, "sunshine", "#f5d37c", [3, 3, 3], [0.6, 0.6, 0.2], at);
    } else {
      for (let i = 0; i < 5; i++)
        ball(
          celebration,
          "party-balloon",
          shopColors[i],
          [1 + i * 0.4, 1.5 + (i % 2) * 0.3, 4],
          [0.24, 0.32, 0.24],
          at,
        );
    }
    for (let i = 0; i < 24; i++)
      box(
        celebration,
        "celebration-confetti",
        shopColors[i % shopColors.length],
        [0, 0, 0],
        [0.055, 0.13, 0.035],
        at,
      );
    for (const mesh of celebration.getChildMeshes()) mesh.isPickable = false;
  }
  function animateCelebration(): void {
    if (animalCollection !== game.animals) {
      celebration?.dispose();
      celebration = null;
      arrivingAnimal = null;
      adopted = game.counters.adopted ?? 0;
      eventIndex = game.counters.eventIndex ?? 0;
      observedAnimals = new Set(game.animals.map((animal) => animal.id));
      animalCollection = game.animals;
    }
    const nextAdopted = game.counters.adopted ?? 0;
    const nextEvent = game.counters.eventIndex ?? 0;
    if (nextAdopted > adopted)
      startCelebration(
        "arrival",
        game.animals.find((animal) => !observedAnimals.has(animal.id))?.id ??
          null,
      );
    else if (nextEvent !== eventIndex)
      startCelebration(
        ["school", "birthday", "sunny", "family", "photo", "balloon"][
          game.counters.eventType
        ] ?? game.event,
      );
    adopted = nextAdopted;
    eventIndex = nextEvent;
    observedAnimals = new Set(game.animals.map((animal) => animal.id));
    if (!celebration) return;
    const elapsed = visualTime - celebrationStarted;
    if (elapsed > 8) {
      celebration.dispose();
      celebration = null;
      arrivingAnimal = null;
      return;
    }
    const van = scene.getTransformNodeByName("arrival-transporter");
    if (van)
      van.position.set(
        -1.5 + Math.min(elapsed, 2) * 1.1 + Math.max(0, elapsed - 6) * 2,
        0,
        4,
      );
    const arriving =
      arrivingAnimal === null
        ? undefined
        : figures.get(`animal-${arrivingAnimal}`);
    if (arriving)
      celebrationFocus = {
        x: arriving.node.position.x,
        z: arriving.node.position.z,
      };
    const crate = scene.getMeshByName("arrival-crate");
    if (crate) {
      const delivery = Math.max(0, Math.min(1, elapsed - 2));
      crate.position.set(
        1.5 + (celebrationFocus.x - 1.5) * delivery,
        0.3 + Math.sin(delivery * Math.PI) * 0.4,
        4 + (celebrationFocus.z - 4) * delivery,
      );
      crate.scaling.setAll(Math.max(0, 1 - Math.max(0, elapsed - 3)));
    }
    if (arrivingAnimal !== null) {
      const animal = figures.get(`animal-${arrivingAnimal}`);
      if (animal) {
        const reveal = Math.max(0.001, Math.min(1, elapsed - 3));
        animal.node.scaling.scaleInPlace(reveal);
        animal.node.position.y += Math.sin(reveal * Math.PI) * 0.25;
        animal.bubble.setEnabled(reveal >= 1);
      }
    }
    for (const [i, mesh] of celebration
      .getChildMeshes()
      .filter((mesh) => mesh.name === "celebration-confetti")
      .entries()) {
      const phase = (elapsed * 0.5 + i * 0.13) % 1;
      mesh.position.set(
        celebrationFocus.x + Math.sin(i * 2.4) * (0.3 + phase),
        2.8 - phase * 2.5,
        celebrationFocus.z + Math.cos(i * 2.4) * (0.3 + phase),
      );
      mesh.rotation.set(elapsed + i, elapsed * 2, i);
    }
    celebration.rotation.z =
      celebrationKind === "balloon" ? Math.sin(elapsed * 2) * 0.02 : 0;
  }
  // Logical destinations stay on distinct tiles. During easing, keep their much
  // smaller silhouettes apart too, including two guests turning the same corner.
  function separateFigures(): void {
    const actors = [...figures.values()];
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < actors.length; i++) {
        for (let j = i + 1; j < actors.length; j++) {
          const a = actors[i].node.position;
          const b = actors[j].node.position;
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const distance = Math.hypot(dx, dz);
          const clearance = 0.42;
          if (distance < clearance) {
            const directionX = distance > 0.001 ? dx / distance : 1;
            const directionZ = distance > 0.001 ? dz / distance : 0;
            const push = (clearance - distance) / 2;
            a.x -= directionX * push;
            a.z -= directionZ * push;
            b.x += directionX * push;
            b.z += directionZ * push;
          }
        }
      }
    }
    for (const actor of actors) updateBubble(actor, actor.bubbleKind);
  }
  function render(): void {
    const now = performance.now();
    const elapsed = Math.max(0, (now - previousRenderTime) / 1000);
    frameDelta = Math.min(0.05, elapsed);
    previousRenderTime = now;
    // Lifecycle timers follow elapsed time even after a suspended tab or slow
    // frame; only motion smoothing needs a bounded integration step.
    visualTime += elapsed;
    if (revision !== game.revision || size !== game.size) rebuild();
    else reconcileFigures();
    for (const a of game.animals) {
      const f = figures.get(`animal-${a.id}`)!;
      moveFigure(f, a);
      const active = a.hunger > 35 && a.water > 30;
      f.node.position.y = active
        ? Math.abs(Math.sin(game.time * 2 + a.id)) * 0.035
        : 0;
      if (f.walkBlend < 0.1) {
        const idleTurn = Math.sin(game.time * 0.5 + a.id) * 0.2;
        const difference = Math.atan2(
          Math.sin(idleTurn - f.node.rotation.y),
          Math.cos(idleTurn - f.node.rotation.y),
        );
        f.node.rotation.y += difference * (1 - Math.exp(-3 * frameDelta));
      }
      const playful = a.activity === "play";
      const swimming = a.activity === "swim";
      if (playful)
        f.node.position.y += Math.abs(Math.sin(visualTime * 5 + a.id)) * 0.17;
      if (swimming)
        f.node.position.y = -0.12 + Math.sin(visualTime * 4) * 0.045;
      f.node.rotation.z = swimming
        ? Math.sin(visualTime * 3) * 0.12
        : playful
          ? Math.sin(visualTime * 5) * 0.08
          : 0;
      f.head.rotation.x =
        a.activity === "eat"
          ? Math.sin(game.time * 8) * 0.2
          : swimming
            ? -0.2
            : 0;
      f.head.rotation.z =
        a.personality === "curious"
          ? Math.sin(visualTime * 2 + a.id) * 0.12
          : 0;
      for (const mesh of f.node.getChildMeshes()) {
        if (mesh.name === "animal-eye")
          mesh.scaling.y = a.activity === "sleep" ? 0.018 : 0.1;
        if (mesh.name === "eye-sparkle")
          mesh.setEnabled(a.activity !== "sleep");
        if (mesh.name === "long-tail" || mesh.name === "tiny-tail")
          mesh.rotation.z =
            Math.sin(visualTime * (playful ? 8 : 2) + a.id) * 0.2;
      }
      f.node.scaling.set(1, a.activity === "sleep" ? 0.75 : 1, 1);
      f.carry.setEnabled(a.activity === "play");
      updateBubble(
        f,
        a.activity === "sleep"
          ? "rest"
          : a.hunger < 40
            ? getSpecies(a.species).food === "greens"
              ? "food"
              : "food-" + getSpecies(a.species).food
            : a.water < 40
              ? "water"
              : a.joy > 70
                ? "heart"
                : a.joy < 40
                  ? "play"
                  : "",
      );
    }
    animatePerson("keeper", game.keeper, "walk", game.keeper.task);
    for (const w of game.workers)
      animatePerson(`worker-${w.id}`, w, "walk", w.task);
    let visitorBubbles = 0;
    for (const v of game.visitors) {
      animatePerson(`visitor-${v.id}`, v, v.activity, null);
      const need =
        v.hunger < 35
          ? "snack"
          : v.energy < 35
            ? "rest"
            : v.fun < 35
              ? "play"
              : v.happiness > 75
                ? "heart"
                : "";
      updateBubble(
        figures.get(`visitor-${v.id}`)!,
        need && visitorBubbles++ < 3 ? need : "",
      );
    }
    separateFigures();
    animateCelebration();
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
  let pointerStart: { x: number; y: number } | null = null;
  let pointerDragged = false;
  const pointer = scene.onPointerObservable.add((info) => {
    if (
      info.type === PointerEventTypes.POINTERDOWN &&
      info.event.button === 0
    ) {
      pointerStart = { x: info.event.clientX, y: info.event.clientY };
      pointerDragged = false;
    }
    if (info.type === PointerEventTypes.POINTERMOVE && pointerStart) {
      if (
        Math.hypot(
          info.event.clientX - pointerStart.x,
          info.event.clientY - pointerStart.y,
        ) > 6
      )
        pointerDragged = true;
    }
    // POINTERPICK suppresses a rapid second click during Babylon's double-tap
    // detection. Each short left-button release is a separate grid action.
    if (info.type === PointerEventTypes.POINTERUP && info.event.button === 0) {
      const hadStart = pointerStart !== null;
      const dragged =
        pointerDragged ||
        (pointerStart !== null &&
          Math.hypot(
            info.event.clientX - pointerStart.x,
            info.event.clientY - pointerStart.y,
          ) > 6);
      pointerStart = null;
      pointerDragged = false;
      if (!hadStart || dragged) return;
      // Existing fences and tall props must not redirect a placement onto their
      // own tile when the player points at the ground behind them.
      const pick = placementMode
        ? scene.pick(
            scene.pointerX,
            scene.pointerY,
            (mesh) => mesh.name === "tile",
          )
        : info.pickInfo;
      const p = pick?.pickedMesh?.metadata?.tile as Point | undefined;
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
    setPlacementMode: (enabled) => {
      placementMode = enabled;
    },
    dispose: () => {
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("resize", resize);
      scene.onPointerObservable.remove(pointer);
      scene.dispose();
      if (!suppliedEngine) engine.dispose();
    },
  };
}
