// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "vitest";
import { version } from "../src/main";
test("initial version uses semantic versioning", () => {
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
});
