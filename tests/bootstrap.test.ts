// @vitest-environment happy-dom
// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, expect, test, vi } from "vitest";
const { mount } = vi.hoisted(() => ({ mount: vi.fn() }));
vi.mock("../src/app", () => ({ mount }));
afterEach(() => {
  document.body.replaceChildren();
  mount.mockClear();
  vi.resetModules();
});
test("boots the actual application root and publishes the package version", async () => {
  const root = document.createElement("div");
  root.id = "app";
  document.body.append(root);
  const bootstrap = await import("../src/main");
  expect(mount).toHaveBeenCalledExactlyOnceWith(root);
  expect(bootstrap.version).toMatch(/^\d+\.\d+\.\d+$/);
});
test("leaves pages without an application root alone", async () => {
  await import("../src/main");
  expect(mount).not.toHaveBeenCalled();
});
