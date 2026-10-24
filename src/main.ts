// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import { mount } from "./app";
import metadata from "../package.json";
import "./style.css";
export const version = metadata.version;
if (typeof document !== "undefined") {
  const root = document.getElementById("app");
  if (root) mount(root);
}
