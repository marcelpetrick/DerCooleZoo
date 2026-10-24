// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import de from "./locales/de.json";
import en from "./locales/en.json";
export const dictionaries: Record<"de" | "en", Record<string, string>> = {
  de,
  en,
};
export function t(language: "de" | "en", key: string): string {
  const dictionary = dictionaries[language];
  if (Object.hasOwn(dictionary, key)) return dictionary[key];
  if (Object.hasOwn(dictionaries.en, key)) return dictionaries.en[key];
  return key;
}
