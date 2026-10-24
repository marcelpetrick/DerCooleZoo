// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "vitest";
import { dictionaries, t } from "../src/i18n";
import {
  animalNames,
  buildings,
  foods,
  personalities,
  roles,
  species,
  terrains,
} from "../src/catalog";
import { goalIds } from "../src/game";
test("complete matching dictionaries cover all catalog content and zoo book facts", () => {
  expect(Object.keys(dictionaries.de).sort()).toEqual(
    Object.keys(dictionaries.en).sort(),
  );
  const keys = [
    ...animalNames.map((id) => `name.${id}`),
    ...personalities.map((id) => `personality.${id}`),
    ...buildings.map((b) => `building.${b.id}`),
    ...species.flatMap((s) => [
      `animal.${s.id}`,
      `fact.${s.id}.1`,
      `fact.${s.id}.2`,
    ]),
    ...foods.map((id) => `food.${id}`),
    ...roles.map((id) => `role.${id}`),
    ...terrains.map((id) => `terrain.${id}`),
    ...goalIds.map((id) => `goal.${id}`),
  ];
  for (const lang of ["de", "en"] as const)
    for (const key of keys) {
      expect(t(lang, key)).not.toBe(key);
      expect(t(lang, key).length).toBeGreaterThan(0);
    }
  expect(t("en", "ui.feed")).toBe("Feed");
  expect(t("de", "ui.feed")).toBe("Füttern");
});
test("missing translations fall back to English and then to the key", () => {
  dictionaries.en["test.onlyEnglish"] = "English fallback";
  expect(t("de", "test.onlyEnglish")).toBe("English fallback");
  expect(t("en", "test.missing")).toBe("test.missing");
  expect(t("en", "constructor")).toBe("constructor");
  expect(t("en", "__proto__")).toBe("__proto__");
  delete dictionaries.en["test.onlyEnglish"];
});
