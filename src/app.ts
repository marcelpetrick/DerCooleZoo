// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import {
  buildings,
  foods,
  getSpecies,
  roles,
  species,
  terrains,
  type Food,
  type Role,
  type Terrain,
} from "./catalog";
import {
  adopt,
  advance,
  attractiveness,
  build,
  buyFood,
  command,
  createGame,
  emergencyFood,
  expand,
  fence,
  goalIds,
  habitat,
  hire,
  paint,
  points,
  tick,
  tile,
  welfare,
  type Task,
} from "./game";
import { t } from "./i18n";
import { createAudio } from "./audio";
import { createRenderer } from "./renderer";
import { exportGame, importGame, load, save } from "./storage";
import { type Point } from "./world";
import metadata from "../package.json";
export interface AppOptions {
  engine?: AbstractEngine;
  schedule?: boolean;
  storage?: Storage;
}
type Tab =
  | "inspect"
  | "build"
  | "animals"
  | "food"
  | "staff"
  | "goals"
  | "book"
  | "settings";
interface Tool {
  kind: "build" | "terrain" | "animal" | "fence";
  id: string;
}
export function mount(root: HTMLElement, options: AppOptions = {}) {
  const storage =
    options.storage ??
    ({
      getItem(key: string) {
        return globalThis.localStorage.getItem(key);
      },
      setItem(key: string, value: string) {
        globalThis.localStorage.setItem(key, value);
      },
    } as Storage);
  const audio = createAudio();
  const existing = load(storage);
  const game = existing ?? createGame();
  let started = !!existing,
    tab: Tab = "inspect",
    selected: Point | null = null,
    tool: Tool | null = null,
    fenceStart: Point | null = null,
    category = "objects",
    starter = "rabbit",
    reset = false,
    speed = 1,
    elapsed = 0,
    frame = 0,
    disposed = false;
  const tr = (id: string) => t(game.language, id);
  const button = (action: string, label: string, extra = "") =>
    `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
  root.innerHTML = `<canvas id="world" aria-label="Isometric zoo. Select a tile to move your keeper or place an object."></canvas>
    <header class="topbar"><a class="brand" href="#" aria-label="Der coole Zoo"><span class="brand-icon">🌿</span><span>${tr("app.title")}<small>${tr("app.subtitle")}</small></span></a><div class="stats" id="stats"></div><div class="top-actions">${button("pause", "Ⅱ", 'aria-label="Pause"')}${button("speed", "1×", 'aria-label="Simulation speed"')}${button("settings", "⚙", 'aria-label="Settings"')}</div></header>
    <nav class="rail" aria-label="Zoo menus"></nav>
    <aside class="panel" id="panel" aria-label="Zoo controls"></aside>
    <div class="world-label"><span class="eyebrow">${tr("app.subtitle")}</span><h1>${tr("app.title")}</h1><p id="world-hint"></p></div>
    <div class="camera" aria-label="Camera controls">${button("zoomIn", "+", 'aria-label="Zoom in"')}${button("zoomOut", "−", 'aria-label="Zoom out"')}${button("rotate", "↻", 'aria-label="Rotate view"')}</div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <footer class="bottom"><span id="keeper-status"></span><span id="save-status"></span><span>v${metadata.version}</span></footer>
    <div id="modal"></div>`;
  const canvas = root.querySelector<HTMLCanvasElement>("#world")!;
  const renderer = createRenderer(canvas, game, select, options.engine);
  function actionButton(action: string, label: string, extra = "") {
    return button(action, label, extra);
  }
  function selectedAnimal() {
    return selected
      ? game.animals.find((a) => a.x === selected!.x && a.z === selected!.z)
      : undefined;
  }
  function title(key: string, icon: string, subtitle = "") {
    return `<div class="panel-heading"><span class="eyebrow">${tr("app.subtitle")}</span><h2>${icon} ${tr(key)}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>`;
  }
  function card(
    icon: string,
    label: string,
    action: string,
    sub: string,
    disabled = false,
  ) {
    return `<button class="catalog-card" data-action="${action}" ${disabled ? "disabled" : ""}><span class="card-icon">${icon}</span><span><strong>${label}</strong><small>${sub}</small></span></button>`;
  }
  const revealed = (id: string, tier: number) =>
    tier <= game.stars || game.animals.some((a) => a.species === id);
  function renderNav() {
    root.querySelector(".rail")!.innerHTML = (
      [
        ["inspect", "🧑‍🌾"],
        ["build", "🔨"],
        ["animals", "🐾"],
        ["food", "🥕"],
        ["staff", "👥"],
        ["goals", "✨"],
        ["book", "📖"],
        ["settings", "⚙"],
      ] as const
    )
      .map(
        ([id, icon]) =>
          `<button data-action="tab:${id}" class="nav-button ${tab === id ? "active" : ""}" aria-label="${tr("ui." + id)}" title="${tr("ui." + id)}"><span>${icon}</span><small>${tr("ui." + id)}</small></button>`,
      )
      .join("");
  }
  function renderPanel() {
    renderNav();
    const panel = root.querySelector("#panel")!;
    if (tab === "inspect") {
      const a = selectedAnimal();
      panel.innerHTML = title("ui.keeper", "🧑‍🌾", tr("ui.welcome"));
      panel.innerHTML += `<div class="keeper-card"><span>🧑‍🌾</span><div><strong>${tr("ui.keeper")}</strong><small>${tr(game.keeper.task ? "ui.working" : "ui.ready")}</small></div></div>`;
      if (a) {
        const s = getSpecies(a.species),
          h = habitat(game, a);
        panel.innerHTML += `<div class="animal-profile"><span>${s.emoji}</span><h3>${tr("name." + a.name)}</h3><p>${tr("animal." + s.id)} · ${tr("personality." + a.personality)}</p><label>${tr("ui.welfare")} <meter min="0" max="100" value="${welfare(game, a)}"></meter></label><div class="needs">${Object.entries(
          h,
        )
          .map(
            ([id, ok]) =>
              `<span class="${ok ? "ok" : "warn"}">${ok ? "✓" : "○"} ${tr("ui." + id)}</span>`,
          )
          .join(
            "",
          )}</div></div><div class="action-grid">${actionButton("care:feed", `🥕 ${tr("ui.feed")}`)}${actionButton("care:water", `💧 ${tr("ui.water")}`)}${actionButton("care:pet", `💗 ${tr("ui.pet")}`)}${actionButton("care:clean", `🧹 ${tr("ui.clean")}`)}</div>`;
      } else if (selected) {
        const object = tile(game, selected).object;
        panel.innerHTML += `<div class="selection"><h3>${object ? tr("building." + object) : tr("terrain." + tile(game, selected).terrain)}</h3><p>${selected.x + 1} · ${selected.z + 1}</p><div class="action-grid">${actionButton("care:walk", `👣 ${tr("ui.walk")}`)}${actionButton("care:clear", `🌱 ${tr("ui.clear")}`)}${actionButton("care:clean", `🧹 ${tr("ui.clean")}`)}${actionButton("care:repair", `🔧 ${tr("ui.repair")}`)}</div></div>`;
      } else
        panel.innerHTML += `<div class="intro-steps"><h3>${tr("ui.start")}</h3><p>1. ${tr("goal.clear")}</p><p>2. ${tr("goal.repair")}</p><p>3. ${tr("goal.feed")}</p><p>4. ${tr("goal.open")}</p></div><div class="action-grid">${actionButton("findAnimal", `🐰 ${tr("ui.animals")}`)}${actionButton("findWeed", `🌱 ${tr("ui.clear")}`)}${actionButton("repairStarter", `🔧 ${tr("ui.repair")}`)}</div>`;
      panel.innerHTML += `<button class="primary gate-button" data-action="gate">${game.open ? "🚪 " + tr("ui.close") : "🎟️ " + tr("ui.open")}</button><div class="ticket"><label for="ticket">${tr("ui.ticket")} <strong>${game.ticket} 🪙</strong></label><input id="ticket" data-input="ticket" type="range" min="1" max="20" value="${game.ticket}"/><p>${game.ticket <= attractiveness(game) ? "😄" : "😟"} ${tr("ui.recommended")}: ${attractiveness(game)} 🪙</p></div>`;
    }
    if (tab === "build") {
      panel.innerHTML =
        title("ui.build", "🔨", tr("ui.chooseTile")) +
        `<div class="chips">${["objects", "paths", "shops", "playground", "habitat", "fences"].map((id) => actionButton("category:" + id, tr("menu." + id), `class="${category === id ? "chosen" : ""}"`)).join("")}</div><div class="catalog">`;
      if (category === "habitat")
        panel.innerHTML += terrains
          .map((id) =>
            card("🟩", tr("terrain." + id), "tool:terrain:" + id, "1 🪙"),
          )
          .join("");
      else if (category === "fences")
        panel.innerHTML += ["fence", "highfence", "gate"]
          .map((id) =>
            card(
              id === "gate" ? "🚪" : "🪵",
              tr("tool." + id),
              "tool:fence:" + id,
              `${id === "highfence" ? 3 : 1} 🪙`,
            ),
          )
          .join("");
      else
        panel.innerHTML += buildings
          .filter((b) =>
            category === "paths"
              ? b.kind === "path"
              : category === "shops"
                ? b.kind === "shop"
                : category === "playground"
                  ? b.kind === "play"
                  : ["rest", "decor", "care"].includes(b.kind),
          )
          .map((b) =>
            card(
              b.emoji,
              tr("building." + b.id),
              "tool:build:" + b.id,
              `${b.cost} 🪙${b.tier > game.stars ? " · 🔒 " + b.tier + " ★" : ""}`,
              b.tier > game.stars,
            ),
          )
          .join("");
      panel.innerHTML += `</div>${actionButton("expand", `🌿 ${tr("ui.expand")} · ${(game.size - 6) * 10} 🪙`, 'class="wide"')}`;
    }
    if (tab === "animals")
      panel.innerHTML =
        title("ui.animals", "🐾", tr("ui.enclosure")) +
        `<div class="catalog">${species.map((s) => card(s.emoji, tr("animal." + s.id), "tool:animal:" + s.id, `${s.cost} 🪙 · ${s.tier} ★`, s.tier > game.stars)).join("")}</div>`;
    if (tab === "food")
      panel.innerHTML =
        title("ui.food", "🥕", tr("ui.foodHint")) +
        `<div class="catalog">${foods.map((id) => card({ greens: "🥬", grain: "🌾", fruit: "🍎", fish: "🐟", meat: "🥩" }[id], tr("food." + id), "food:" + id, `${game.inventory[id]} ${tr("ui.inventory")} · +5 / 2 🪙`)).join("")}</div><div class="note">${tr("ui.foodSupply")}</div>${actionButton("emergency", `💚 ${tr("ui.emergencyFood")}`, 'class="wide"')}`;
    if (tab === "staff")
      panel.innerHTML =
        title("ui.staff", "👥") +
        `<div class="note">${tr("ui.staffHint")}</div><div class="catalog">${roles.map((role) => card("🧑‍🌾", tr("role." + role), "hire:" + role, `15 🪙 · 2 🪙 / ${tr("ui.day")}`, game.stars < 2)).join("")}</div><p>${game.workers.length} ${tr("ui.staff")}</p>`;
    if (tab === "goals")
      panel.innerHTML =
        title("ui.goals", "✨") +
        `<div class="goal-list">${goalIds.map((id) => `<div class="goal ${game.goals.includes(id) ? "complete" : ""}"><span>${game.goals.includes(id) ? "✓" : "○"}</span><span>${tr("goal." + id)}</span></div>`).join("")}</div><div class="income"><p>🎟️ ${tr("ui.tickets")}: ${game.income.tickets}</p><p>💝 ${tr("ui.donations")}: ${game.income.donations}</p><p>🍿 ${tr("ui.sales")}: ${game.income.sales}</p></div>`;
    if (tab === "book")
      panel.innerHTML =
        title("ui.book", "📖") +
        `<div class="book-grid">${species.map((s) => `<article class="book-entry ${!revealed(s.id, s.tier) ? "locked" : ""}"><span>${!revealed(s.id, s.tier) ? "❔" : s.emoji}</span><h3>${!revealed(s.id, s.tier) ? "🔒 " + s.tier + " ★" : tr("animal." + s.id)}</h3>${revealed(s.id, s.tier) ? `<small>${tr("terrain." + s.terrain)} · ${tr("food." + s.food)}</small><p>${tr("fact." + s.id + ".1")}</p><p>${tr("fact." + s.id + ".2")}</p>` : ""}</article>`).join("")}</div>`;
    if (tab === "settings")
      panel.innerHTML =
        title("ui.settings", "⚙") +
        `<label class="setting">${tr("ui.sound")}<input data-input="sound" aria-label="Sound volume" type="range" min="0" max="1" step="0.1" value="${game.sound}"/></label><label class="setting">${tr("ui.music")}<input data-input="music" aria-label="Music volume" type="range" min="0" max="1" step="0.1" value="${game.music}"/></label><div class="action-grid">${actionButton("save", "💾 " + tr("ui.save"))}${actionButton("export", "↗ " + tr("ui.export"))}${actionButton("import", "↙ " + tr("ui.import"))}${actionButton("reset", "🌱 " + tr("ui.newGame"))}</div><label class="setting">${tr("ui.saveData")}<textarea id="save-data" rows="5" spellcheck="false" aria-label="Save data"></textarea></label><p class="note">${tr("ui.resetHint")}</p>`;
  }
  function update() {
    const avg = Math.round(
      game.animals.reduce((sum, a) => sum + welfare(game, a), 0) /
        game.animals.length,
    );
    root.querySelector("#stats")!.innerHTML =
      `<div class="stat coins"><span>🪙</span><strong data-testid="coins">${Math.floor(game.coins)}</strong><small>${tr("ui.coins")}</small></div><div class="stat"><span>★</span><strong>${"★".repeat(game.stars)}${"☆".repeat(5 - game.stars)}</strong><small>${tr("ui.stars")}</small></div><div class="stat"><span>👋</span><strong data-testid="visitors">${game.visitors.length}</strong><small>${tr("ui.visitors")}</small></div><div class="stat"><span>💚</span><strong>${avg}%</strong><small>${tr("ui.welfare")}</small></div>`;
    root.querySelector("#world-hint")!.textContent = tool
      ? `${tr("ui.chooseTile")} · ${tr((tool.kind === "animal" ? "animal." : tool.kind === "terrain" ? "terrain." : tool.kind === "fence" ? "tool." : "building.") + tool.id)}`
      : tr(game.open ? "ui.gateOpen" : "ui.gateClosed");
    root.querySelector("#keeper-status")!.textContent =
      `🧑‍🌾 ${tr("ui.keeper")} · ${game.keeper.task ? tr("message." + game.keeper.task.kind) : tr("ui.ready")}${game.keeper.task?.carrying ? " 🥕" : ""}`;
    root.querySelector("#toast")!.textContent = tr("message." + game.message);
    root.querySelector('[data-action="pause"]')!.textContent = game.paused
      ? "▶"
      : "Ⅱ";
    root.querySelector('[data-action="speed"]')!.textContent = `${speed}×`;
  }
  function showStarter() {
    root.querySelector("#modal")!.innerHTML =
      `<div class="modal-shade"><section class="starter-dialog" role="dialog" aria-modal="true" aria-label="Choose your first animal"><span class="eyebrow">${tr("app.subtitle")}</span><h1>${tr("ui.chooseStarter")}</h1><p>${tr("ui.startHint")}</p><div class="starters">${species
        .filter((s) =>
          ["rabbit", "guinea", "goat", "pig", "raccoon"].includes(s.id),
        )
        .map(
          (s) =>
            `<button data-action="starter:${s.id}" class="starter ${starter === s.id ? "chosen" : ""}" aria-pressed="${starter === s.id}"><span>${s.emoji}</span><strong>${tr("animal." + s.id)}</strong></button>`,
        )
        .join(
          "",
        )}</div><button data-action="start" class="primary">${tr("ui.start")} →</button><small>${tr("ui.noPressure")}</small></section></div>`;
  }
  function persist() {
    const ok = save(game, storage);
    root.querySelector("#save-status")!.textContent = tr(
      ok ? "ui.saved" : "ui.saveFailed",
    );
    return ok;
  }
  function select(p: Point) {
    if (!started) return;
    selected = p;
    if (tool) {
      if (tool.kind === "build") build(game, tool.id, p);
      if (tool.kind === "terrain") paint(game, tool.id as Terrain, p);
      if (tool.kind === "animal") adopt(game, tool.id, p);
      if (tool.kind === "fence") {
        if (fenceStart) {
          fence(game, fenceStart, p, tool.id as "fence" | "highfence" | "gate");
          fenceStart = null;
        } else {
          fenceStart = p;
          game.message = "chooseNeighbor";
        }
      }
    } else {
      tab = "inspect";
      if (!selectedAnimal() && !tile(game, p).object && !tile(game, p).dirt)
        command(game, "walk", p);
    }
    update();
    renderPanel();
    persist();
  }
  function handleAction(action: string) {
    const [kind, id, toolId] = action.split(":");
    if (kind === "tab" || kind === "tool") fenceStart = null;
    if (kind === "tab") {
      tab = id as Tab;
      tool = null;
    } else if (kind === "category") category = id;
    else if (kind === "tool") {
      tool = { kind: id as Tool["kind"], id: toolId };
    } else if (kind === "care" && selected)
      command(game, id as Task["kind"], selected, selectedAnimal()?.id ?? 0);
    else if (kind === "food") buyFood(game, id as Food);
    else if (kind === "hire") hire(game, id as Role);
    else if (kind === "starter") {
      starter = id;
      showStarter();
    } else if (kind === "start") {
      Object.assign(game, createGame(starter));
      started = true;
      root.querySelector("#modal")!.innerHTML = "";
      renderer.rebuild();
      persist();
    } else if (kind === "gate") {
      game.open = !game.open;
      game.message = game.open ? "gateOpen" : "gateClosed";
    } else if (kind === "findAnimal") {
      selected = { x: game.animals[0].x, z: game.animals[0].z };
    } else if (kind === "findWeed") {
      selected =
        points(game).find((p) => tile(game, p).object === "weed") ?? null;
    } else if (kind === "repairStarter") {
      selected = { x: 4, z: 3 };
      command(game, "repair", selected);
    } else if (kind === "expand") expand(game);
    else if (kind === "emergency") emergencyFood(game);
    else if (kind === "pause") game.paused = !game.paused;
    else if (kind === "speed") speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    else if (kind === "zoomIn") renderer.zoom(-1);
    else if (kind === "zoomOut") renderer.zoom(1);
    else if (kind === "rotate") renderer.rotate(Math.PI / 2);
    else if (kind === "settings") {
      tab = "settings";
      tool = null;
    } else if (kind === "save") persist();
    else if (kind === "export") {
      root.querySelector<HTMLTextAreaElement>("#save-data")!.value =
        exportGame(game);
      return;
    } else if (kind === "import") {
      const imported = importGame(
        root.querySelector<HTMLTextAreaElement>("#save-data")!.value,
      );
      if (imported) {
        Object.assign(game, imported);
        selected = null;
        tool = null;
        renderer.rebuild();
        persist();
        game.message = "imported";
      } else game.message = "importFailed";
    } else if (kind === "reset") {
      reset = true;
      root.querySelector("#modal")!.innerHTML =
        `<div class="modal-shade"><section class="starter-dialog" role="dialog" aria-modal="true" aria-label="Start a new zoo"><h2>${tr("ui.confirmReset")}</h2>${actionButton("confirmReset", tr("ui.newGame"), 'class="primary"')}${actionButton("cancelReset", tr("ui.cancel"))}</section></div>`;
    } else if (kind === "confirmReset" && reset) {
      started = false;
      reset = false;
      selected = null;
      tool = null;
      starter = "rabbit";
      showStarter();
    } else if (kind === "cancelReset") {
      reset = false;
      root.querySelector("#modal")!.innerHTML = "";
    }
    update();
    renderPanel();
  }
  function onClick(event: Event) {
    audio.unlock();
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    )?.dataset.action;
    if (action) handleAction(action);
  }
  function onInput(event: Event) {
    const el = event.target as HTMLInputElement;
    const id = el.dataset.input;
    if (id === "ticket") {
      game.ticket = Number(el.value);
      update();
    }
    if (id === "sound") game.sound = Number(el.value);
    if (id === "music") game.music = Number(el.value);
  }
  function onContext(event: Event) {
    event.preventDefault();
    tool = null;
    update();
  }
  function onKey(event: KeyboardEvent) {
    if ((event.target as HTMLElement).matches("input, textarea")) return;
    if (event.key === "Escape") {
      tool = null;
      update();
    }
    if (event.key.toLowerCase() === "q") renderer.rotate(-Math.PI / 2);
    if (event.key.toLowerCase() === "e") renderer.rotate(Math.PI / 2);
  }
  function step(seconds: number) {
    if (started) {
      advance(game, Math.min(seconds, 1) * speed);
      elapsed += seconds;
      if (elapsed >= 10) {
        persist();
        elapsed = 0;
      }
    }
    renderer.render();
    audio.update(game.sound, game.music, game.event);
    update();
  }
  let last = performance.now();
  function animate(now: number) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (started) tick(game, dt * speed);
    renderer.render();
    audio.update(game.sound, game.music, game.event);
    update();
    frame = requestAnimationFrame(animate);
  }
  function onHide() {
    if (started) persist();
  }
  const autosaveTimer =
    options.schedule !== false ? window.setInterval(onHide, 10_000) : null;
  window.addEventListener("pagehide", onHide);
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  canvas.addEventListener("contextmenu", onContext);
  root.addEventListener("keydown", onKey);
  renderPanel();
  update();
  if (!started) showStarter();
  if (options.schedule !== false) frame = requestAnimationFrame(animate);
  return {
    game,
    renderer,
    select,
    step,
    action: handleAction,
    persist,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      if (autosaveTimer !== null) window.clearInterval(autosaveTimer);
      window.removeEventListener("pagehide", onHide);
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      canvas.removeEventListener("contextmenu", onContext);
      root.removeEventListener("keydown", onKey);
      audio.dispose();
      renderer.dispose();
    },
  };
}
