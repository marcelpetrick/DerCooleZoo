// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
export interface Point {
  x: number;
  z: number;
}
export const key = (p: Point): string => `${p.x},${p.z}`;
export const equal = (a: Point, b: Point): boolean =>
  a.x === b.x && a.z === b.z;
export const distance = (a: Point, b: Point): number =>
  Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
export const neighbors = (p: Point): Point[] => [
  { x: p.x - 1, z: p.z },
  { x: p.x + 1, z: p.z },
  { x: p.x, z: p.z - 1 },
  { x: p.x, z: p.z + 1 },
];
export const inside = (p: Point, size: number): boolean =>
  Number.isInteger(p.x) &&
  Number.isInteger(p.z) &&
  p.x >= 0 &&
  p.z >= 0 &&
  p.x < size &&
  p.z < size;
export const edgeKey = (a: Point, b: Point): string =>
  [key(a), key(b)].sort().join("|");
export function pathfind(
  start: Point,
  target: Point,
  canWalk: (p: Point) => boolean,
  size: number,
  blocked: (a: Point, b: Point) => boolean = () => false,
): Point[] {
  const queue = [start];
  const previous = new Map<string, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (equal(p, target)) {
      const path: Point[] = [];
      let node: Point | null = p;
      while (node) {
        path.unshift(node);
        node = previous.get(key(node))!;
      }
      return path.slice(1);
    }
    for (const n of neighbors(p)) {
      if (
        inside(n, size) &&
        canWalk(n) &&
        !blocked(p, n) &&
        !previous.has(key(n))
      ) {
        previous.set(key(n), p);
        queue.push(n);
      }
    }
  }
  return [];
}
export function enclosure(
  at: Point,
  size: number,
  fences: Record<string, "fence" | "highfence" | "gate">,
): Point[] {
  const visited = new Set([key(at)]);
  const region = [at];
  for (let i = 0; i < region.length; i++) {
    for (const n of neighbors(region[i])) {
      if (fences[edgeKey(region[i], n)]) continue;
      if (!inside(n, size)) return [];
      if (!visited.has(key(n))) {
        visited.add(key(n));
        region.push(n);
      }
    }
  }
  return region;
}
