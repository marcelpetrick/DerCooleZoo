// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
export const terrains = [
  "grass",
  "earth",
  "sand",
  "water",
  "rock",
  "snow",
  "tropical",
] as const;
export type Terrain = (typeof terrains)[number];
export const foods = ["greens", "grain", "fruit", "fish", "meat"] as const;
export type Food = (typeof foods)[number];
export interface Species {
  id: string;
  emoji: string;
  tier: number;
  cost: number;
  food: Food;
  terrain: Terrain;
  space: number;
  color: string;
  bonus: number;
}
export const species: Species[] = [
  ["rabbit", "🐰", 1, 18, "greens", "grass", 3, "#eee7db", 1],
  ["guinea", "🐹", 1, 20, "grain", "grass", 3, "#b98d61", 1],
  ["goat", "🐐", 1, 25, "greens", "grass", 4, "#dfc2a0", 1.1],
  ["pig", "🐷", 1, 25, "grain", "earth", 4, "#efa7b4", 1.1],
  ["raccoon", "🦝", 2, 32, "fruit", "grass", 4, "#8b999a", 1.15],
  ["fox", "🦊", 2, 38, "meat", "grass", 4, "#e5954e", 1],
  ["otter", "🦦", 2, 42, "fish", "water", 5, "#986c4c", 1],
  ["flamingo", "🦩", 2, 45, "fish", "water", 5, "#ef9ead", 1],
  ["iguana", "🦎", 3, 55, "greens", "tropical", 5, "#82ba5c", 1],
  ["tortoise", "🐢", 3, 50, "greens", "sand", 5, "#639669", 1],
  ["meerkat", "🐾", 3, 55, "grain", "sand", 5, "#c5a173", 1],
  ["parrot", "🦜", 3, 58, "fruit", "tropical", 5, "#54b49f", 1],
  ["zebra", "🦓", 4, 75, "greens", "grass", 7, "#e0e1de", 1],
  ["giraffe", "🦒", 4, 85, "greens", "sand", 7, "#ebbd63", 1],
  ["camel", "🐪", 4, 80, "greens", "sand", 7, "#ccaa76", 1],
  ["kangaroo", "🦘", 4, 80, "greens", "sand", 7, "#b58c69", 1],
  ["crocodile", "🐊", 5, 110, "meat", "water", 9, "#619873", 1],
  ["penguin", "🐧", 5, 100, "fish", "snow", 7, "#456575", 1],
  ["elephant", "🐘", 5, 130, "greens", "grass", 10, "#97a9b3", 1],
  ["hippo", "🦛", 5, 120, "greens", "water", 10, "#ad93b4", 1],
].map(([id, emoji, tier, cost, food, terrain, space, color, bonus]) => ({
  id,
  emoji,
  tier,
  cost,
  food,
  terrain,
  space,
  color,
  bonus,
})) as Species[];
export interface Building {
  id: string;
  emoji: string;
  cost: number;
  tier: number;
  kind: "rest" | "shop" | "play" | "decor" | "care" | "path";
}
export const buildings: Building[] = [
  ["path", "🟫", 1, 1, "path"],
  ["stonepath", "⬜", 2, 2, "path"],
  ["woodpath", "🪵", 2, 2, "path"],
  ["familypath", "🌈", 3, 3, "path"],
  ["bench", "🪑", 5, 1, "rest"],
  ["bin", "🗑️", 3, 1, "care"],
  ["donation", "💝", 4, 1, "care"],
  ["feeder", "🥕", 3, 1, "care"],
  ["trough", "💧", 3, 1, "care"],
  ["shelter", "🏠", 8, 1, "care"],
  ["tree", "🌳", 4, 1, "decor"],
  ["flowers", "🌼", 2, 1, "decor"],
  ["popcorn", "🍿", 12, 1, "shop"],
  ["candyfloss", "🍭", 15, 1, "shop"],
  ["candy", "🍬", 18, 2, "shop"],
  ["drinks", "🧃", 15, 1, "shop"],
  ["icecream", "🍦", 22, 2, "shop"],
  ["pretzel", "🥨", 22, 2, "shop"],
  ["snacks", "🥪", 28, 3, "shop"],
  ["souvenir", "🎁", 30, 3, "shop"],
  ["plush", "🧸", 35, 4, "shop"],
  ["trampoline", "🤸", 18, 1, "play"],
  ["slide", "🛝", 22, 2, "play"],
  ["swing", "🎠", 22, 2, "play"],
  ["sandbox", "🏖️", 15, 1, "play"],
  ["climbing", "🪜", 25, 3, "play"],
  ["carousel", "🎠", 35, 4, "play"],
  ["picnic", "🧺", 12, 2, "rest"],
  ["tower", "🗼", 40, 4, "rest"],
].map(([id, emoji, cost, tier, kind]) => ({
  id,
  emoji,
  cost,
  tier,
  kind,
})) as Building[];
export const roles = ["keeper", "cleaner", "gardener", "vendor"] as const;
export type Role = (typeof roles)[number];
export const personalities = [
  "curious",
  "hungry",
  "sleepy",
  "playful",
] as const;
export const animalNames = ["momo", "keks", "poldi", "flocke"];
export const getSpecies = (id: string): Species =>
  species.find((s) => s.id === id)!;
