// SPDX-FileCopyrightText: 2026 Marcel Petrick
// SPDX-License-Identifier: GPL-3.0-or-later
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import {
  buildings,
  getSpecies,
  roles,
  species,
  terrains,
  type Role,
  type Terrain,
} from "./catalog";
import {
  adopt,
  activeEvent,
  advance,
  attractiveness,
  build,
  buildEnclosure,
  command,
  cancelTask,
  canRepair,
  canPlant,
  repairPoint,
  createGame,
  expand,
  feedCost,
  fence,
  friendlyEvents,
  goalIds,
  habitat,
  hire,
  homeCost,
  homeFor,
  homeSizes,
  homeThemes,
  messAt,
  paint,
  points,
  taskRoute,
  tile,
  welfare,
  type HomeTheme,
  type Task,
} from "./game";
import { t } from "./i18n";
import { createAudio, musicTracksCount } from "./audio";
import { createRenderer } from "./renderer";
import { exportGame, importGame, load, save } from "./storage";
import { distance, enclosure, equal, type Point } from "./world";
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
  | "staff"
  | "goals"
  | "book"
  | "settings"
  | "help";
interface Tool {
  kind: "build" | "terrain" | "fence" | "enclosure";
  id: string;
}
const homeEmoji: Record<HomeTheme, string> = {
  grass: "🌿",
  earth: "🟫",
  sand: "🏜️",
  water: "🌊",
  snow: "❄️",
  tropical: "🌴",
};
const foodEmoji = {
  greens: "🥬",
  grain: "🌾",
  fruit: "🍎",
  fish: "🐟",
  meat: "🥩",
};
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
  const languageKey = "dercoolezoo.language";
  if (!existing) {
    try {
      const preference = storage.getItem(languageKey);
      game.language =
        preference === "de" || preference === "en"
          ? preference
          : globalThis.navigator?.language?.toLowerCase().startsWith("de")
            ? "de"
            : "en";
    } catch {
      // The zoo remains playable when browser storage is unavailable.
    }
  }
  let started = !!existing,
    tab: Tab = "inspect",
    selected: Point | null = null,
    selectedAnimalId: number | null = null,
    tool: Tool | null = null,
    fenceStart: Point | null = null,
    category = "enclosures",
    starter = "rabbit",
    reset = false,
    speed = 1,
    elapsed = 0,
    frame = 0,
    disposed = false;
  let panelTask = game.keeper.task,
    panelStars = game.stars,
    panelCareStatus = "",
    panelGoals = "";
  let currentSound = "welcome",
    soundSequence = 0,
    lastAnimalSound = 0,
    lastLaugh = game.time,
    lastGoals = game.goals.length,
    lastAdopted = game.counters.adopted ?? 0,
    lastSize = game.size,
    lastStars = game.stars,
    lastFriendlyEvent = game.counters.eventIndex ?? 0,
    lastIncome =
      game.income.tickets + game.income.donations + game.income.sales;
  function cue(id: string) {
    currentSound = id + ":" + ++soundSequence;
    audio.update(
      game.sound,
      game.music,
      currentSound,
      game.counters.musicTrack ?? 0,
    );
  }
  const tr = (id: string) => t(game.language, id);
  const button = (action: string, label: string, extra = "") =>
    `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
  root.innerHTML = `<canvas id="world" aria-label="${tr("ui.worldDescription")}"></canvas>
    <header class="topbar"><a class="brand" href="#" aria-label="${tr("app.title")}"><span class="brand-icon">🌿</span><span><span data-i18n="app.title">${tr("app.title")}</span><small data-i18n="app.subtitle">${tr("app.subtitle")}</small></span></a><div class="stats" id="stats"></div><div class="top-actions">${button("pause", "Ⅱ", `aria-label="${tr("ui.pause")}"`)}${button("speed", "1×", `aria-label="${tr("ui.speed")}"`)}${button("help", "?", `aria-label="${tr("ui.help")}"`)}${button("settings", "⚙", `aria-label="${tr("ui.settings")}"`)}</div></header>
    <nav class="rail" aria-label="${tr("ui.menus")}"></nav>
    <aside class="panel" id="panel" aria-label="${tr("ui.zooControls")}"></aside>
    <div class="world-label"><span class="eyebrow" data-i18n="app.subtitle">${tr("app.subtitle")}</span><h1 data-i18n="app.title">${tr("app.title")}</h1><p id="world-hint"></p></div>
    <div class="camera" aria-label="${tr("ui.cameraControls")}">${button("zoomIn", "+", `aria-label="${tr("ui.zoomIn")}"`)}${button("zoomOut", "−", `aria-label="${tr("ui.zoomOut")}"`)}${button("rotate", "↻", `aria-label="${tr("ui.rotate")}"`)}</div>
    <button class="next-task" id="next-task" data-action="goals"></button><div class="zoo-event" id="zoo-event" aria-live="polite"></div><div class="toast" id="toast" role="status" aria-live="polite"></div>
    <footer class="bottom"><span id="keeper-status"></span><span id="save-status"></span><span>v${metadata.version}</span></footer>
    <div id="modal"></div>`;
  const canvas = root.querySelector<HTMLCanvasElement>("#world")!;
  const renderer = createRenderer(canvas, game, select, options.engine);
  function actionButton(action: string, label: string, extra = "") {
    return button(action, label, extra);
  }
  function selectedAnimal() {
    return game.animals.find((animal) => animal.id === selectedAnimalId);
  }
  let todoCache = { stamp: "", jobs: [] as [string, string][] };
  /** Chores the keeper could do right now, most urgent first. */
  function todo(): [string, string][] {
    const stamp = `${game.language}:${game.revision}:${Math.floor(game.time * 2)}`;
    if (todoCache.stamp !== stamp) todoCache = { stamp, jobs: findJobs() };
    return todoCache.jobs;
  }
  function findJobs(): [string, string][] {
    const jobs: [string, string][] = [];
    const reachable = (kind: Task["kind"], p: Point) =>
      taskRoute(game, game.keeper, kind, p, true) !== null;
    if (canRepair(game, repairPoint))
      jobs.push(["job:repair:3,3", `🔧 ${tr("todo.repair")}`]);
    const fed = new Set<number>();
    for (const a of game.animals)
      if ((a.hunger < 60 || a.water < 60) && !fed.has(a.id)) {
        for (const mate of game.animals)
          if (enclosure(mate, game.size, game.fences).some((p) => equal(p, a)))
            fed.add(mate.id);
        if (reachable("feed", a))
          jobs.push([
            `job:feed:${a.id}`,
            `${foodEmoji[getSpecies(a.species).food]} ${tr("name." + a.name)} ${tr("todo.feed")}`,
          ]);
      }
    for (const a of game.animals)
      if (a.joy < 45 && reachable("pet", a))
        jobs.push([
          `job:pet:${a.id}`,
          `💗 ${tr("name." + a.name)} ${tr("todo.pet")}`,
        ]);
    const mess = points(game)
      .filter(
        (p) => tile(game, p).dirt > 0 || tile(game, p).object === "litter",
      )
      .sort((a, b) => distance(game.keeper, a) - distance(game.keeper, b))
      .find((p) => reachable("clean", p));
    if (mess)
      jobs.push([`job:clean:${mess.x},${mess.z}`, `🧹 ${tr("todo.clean")}`]);
    const weed = points(game)
      .filter((p) => tile(game, p).object === "weed")
      .sort((a, b) => distance(game.keeper, a) - distance(game.keeper, b))
      .find((p) => reachable("clear", p));
    if (weed)
      jobs.push([`job:clear:${weed.x},${weed.z}`, `🌱 ${tr("todo.clear")}`]);
    return jobs.slice(0, 5);
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
  function describeAction(action: string): string {
    const [kind, id, toolId] = action.split(":");
    if (kind === "goals")
      return tr(
        "steps." +
          (goalIds.find((goal) => !game.goals.includes(goal)) ?? "finished"),
      );
    if (kind === "tab") return `${tr("ui." + id)}. ${tr("tip.menu")}`;
    if (kind === "category")
      return `${tr("menu." + id)}. ${tr("tip.category")}`;
    if (kind === "language")
      return `${tr("language." + id)}. ${tr("tip.language")}`;
    if (kind === "starter")
      return `${tr("animal." + id)}. ${tr("bonus." + id)}. ${tr("tip.starter")}`;
    if (kind === "hire")
      return `${tr("role." + id)}. ${tr("tip.hire")} ${tr("ui.wages")}`;
    if (kind === "tool") {
      if (id === "build") {
        const building = buildings.find((item) => item.id === toolId)!;
        return `${tr("building." + toolId)}. ${tr("tip.build." + building.kind)} ${tr("tip.place")} ${building.cost} ${tr("ui.coins")}.`;
      }
      if (id === "terrain")
        return `${tr("terrain." + toolId)}. ${tr("tip.paint")}`;
      if (id === "fence") return `${tr("tool." + toolId)}. ${tr("tip.fence")}`;
      const [theme, size] = toolId.split("-");
      return `${tr("home." + theme)} (${size}×${size}). ${tr("tip.enclosure")} ${homeCost(Number(size))} ${tr("ui.coins")}.`;
    }
    if (kind === "adopt") {
      const animal = getSpecies(id);
      return `${tr("animal." + id)}. ${tr("tip.adopt")} ${tr("home." + animal.terrain)}, ${tr("food." + animal.food)}. ${animal.cost} ${tr("ui.coins")}.`;
    }
    if (kind === "job") return tr("tip." + id);
    if (kind === "pick") return tr("tip.pick");
    if (
      (kind === "repairStarter" || (kind === "care" && id === "repair")) &&
      !canRepair(game, repairPoint)
    )
      return tr("tip.repairDone");
    if (kind === "care") {
      const friend = selectedAnimal();
      return `${tr("tip." + id)}${friend && id === "feed" ? " " + tr("food." + getSpecies(friend.species).food) + "." : ""}`;
    }
    return tr("tip." + kind);
  }
  function decorateHelp() {
    root.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => {
      const description = describeAction(element.dataset.action!);
      element.title = description;
      element.setAttribute("aria-description", description);
    });
    for (const element of root.querySelectorAll<HTMLElement>(".needs span")) {
      element.title = tr("tip.need");
      element.setAttribute("aria-description", tr("tip.need"));
    }
    for (const element of root.querySelectorAll<HTMLElement>(
      ".stat, .animal-profile, .book-entry, meter",
    )) {
      element.title = tr(element.matches(".stat") ? "tip.stats" : "tip.animal");
      element.setAttribute("aria-description", element.title);
    }
    root
      .querySelectorAll<HTMLInputElement>("input[data-input]")
      .forEach((element) => {
        const description = tr("tip.input." + element.dataset.input);
        element.title = description;
        element.setAttribute("aria-description", description);
      });
  }
  function renderNav() {
    root.querySelector(".rail")!.innerHTML = (
      [
        ["inspect", "🧑‍🌾"],
        ["build", "🔨"],
        ["animals", "🐾"],
        ["staff", "👥"],
        ["goals", "✨"],
        ["book", "📖"],
        ["settings", "⚙"],
        ["help", "❔"],
      ] as const
    )
      .map(
        ([id, icon]) =>
          `<button data-action="tab:${id}" class="nav-button ${tab === id ? "active" : ""}" aria-label="${tr("ui." + id)}" title="${tr("ui." + id)}"><span>${icon}</span><small>${tr("ui." + id)}</small></button>`,
      )
      .join("");
  }
  function languageChoices() {
    return `<div class="language-choices" role="group" aria-label="${tr("ui.language")}">${(["de", "en"] as const).map((language) => actionButton("language:" + language, tr("language." + language), `aria-pressed="${game.language === language}" class="${game.language === language ? "chosen" : ""}"`)).join("")}</div>`;
  }
  function refreshLanguage() {
    document.documentElement.lang = game.language;
    document.title = tr("app.title");
    root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
      element.textContent = tr(element.dataset.i18n!);
    });
    const labels = [
      ["#world", "ui.worldDescription"],
      [".brand", "app.title"],
      [".rail", "ui.menus"],
      ["#panel", "ui.zooControls"],
      [".camera", "ui.cameraControls"],
      ['[data-action="speed"]', "ui.speed"],
      ['[data-action="settings"]', "ui.settings"],
      ['[data-action="help"]', "ui.help"],
      ['[data-action="zoomIn"]', "ui.zoomIn"],
      ['[data-action="zoomOut"]', "ui.zoomOut"],
      ['[data-action="rotate"]', "ui.rotate"],
    ];
    for (const [selector, key] of labels)
      root.querySelector(selector)!.setAttribute("aria-label", tr(key));
    if (saveResult !== null)
      root.querySelector("#save-status")!.textContent = tr(
        saveResult ? "ui.saved" : "ui.saveFailed",
      );
  }
  let saveResult: boolean | null = null;
  function renderPanel() {
    const backup = root.querySelector<HTMLTextAreaElement>("#save-data")?.value;
    const expanded = [
      ...root.querySelectorAll<HTMLDetailsElement>("details[open][data-help]"),
    ].map((element) => element.dataset.help);
    renderNav();
    const panel = root.querySelector("#panel")!;
    if (tab === "inspect") {
      const a = selectedAnimal();
      panel.innerHTML = title("ui.keeper", "🧑‍🌾", tr("ui.welcome"));
      panel.innerHTML += `<div class="keeper-card"><span>🧑‍🌾</span><div><strong>${tr("ui.keeper")}</strong><small>${game.keeper.task ? tr("message." + game.keeper.task.kind) : tr("ui.ready")}</small></div>${game.keeper.task ? actionButton("cancelTask", `✋ ${tr("ui.cancelTask")}`) : ""}</div><div class="friends" role="group" aria-label="${tr("ui.myAnimals")}">${game.animals.map((friend) => actionButton(`pick:${friend.id}`, `<span>${getSpecies(friend.species).emoji}</span><small>${tr("name." + friend.name)}</small>`, `aria-pressed="${friend.id === selectedAnimalId}"`)).join("")}</div>`;
      if (a) {
        const s = getSpecies(a.species),
          h = habitat(game, a);
        const dirty = messAt(game, a).length > 0;
        const need = (icon: string, key: string, value: number) =>
          `<div class="need-meter ${value < 50 ? "low" : ""}"><span>${icon}</span><small>${tr(key)}</small><meter min="0" max="100" low="35" high="70" optimum="100" value="${Math.round(value)}"></meter></div>`;
        panel.innerHTML += `<div class="animal-profile"><span>${s.emoji}</span><h3>${tr("name." + a.name)}</h3><p>${tr("animal." + s.id)} · ${tr("personality." + a.personality)}</p><div class="need-meters">${need("🍽️", "ui.hunger", a.hunger)}${need("💧", "ui.thirst", a.water)}${need("💗", "ui.joy", a.joy)}${need("🧹", "ui.tidy", dirty ? 20 : 100)}</div></div><div class="care-buttons">${actionButton("care:feed", `<span>${foodEmoji[s.food]}</span>${tr("ui.feed")}<small>${game.coins >= feedCost ? feedCost + " 🪙" : tr("ui.free")}</small>`, 'class="big-care"')}${actionButton("care:pet", `<span>💗</span>${tr("ui.pet")}`, 'class="big-care"')}${actionButton("care:clean", `<span>🧹</span>${tr("ui.clean")}`, `class="big-care" ${dirty ? "" : "disabled"}`)}</div><p class="note">${tr("hint.feedAll")}</p><label class="welfare">${tr("ui.welfare")} <meter min="0" max="100" value="${welfare(game, a)}"></meter></label><div class="needs">${Object.entries(
          h,
        )
          .map(
            ([id, ok]) =>
              `<span class="${ok ? "ok" : "warn"}">${ok ? "✓" : "○"} ${tr("ui." + id)}</span>`,
          )
          .join("")}</div>`;
      } else if (selected) {
        const object = tile(game, selected).object;
        panel.innerHTML += `<div class="selection"><h3>${object ? tr("building." + object) : tr("terrain." + tile(game, selected).terrain)}</h3>${["feeder", "trough"].includes(object) ? `<p>${tr(object === "feeder" ? "hint.feeder" : "hint.trough")}</p>` : ""}<div class="action-grid">${actionButton("care:walk", `👣 ${tr("ui.walk")}`)}${canPlant(game, selected) ? actionButton("care:plant", `🌼 ${tr("ui.plant")} · 2 🪙`, game.coins < 2 ? "disabled" : "") : ""}${["weed", "rock", "stump", "tree"].includes(object) ? actionButton("care:clear", `🌱 ${tr("ui.clear")}`) : ""}${messAt(game, selected).length ? actionButton("care:clean", `🧹 ${tr("ui.clean")}`) : ""}${canRepair(game, selected) ? actionButton("care:repair", `🔧 ${tr("ui.repair")}`) : ""}</div></div>`;
      }
      const jobs = todo();
      panel.innerHTML += `<div class="todo"><h3>📋 ${tr("ui.todo")}</h3>${jobs.length ? jobs.map(([action, label]) => actionButton(action, label, 'class="todo-item"')).join("") : `<p>${tr("ui.allDone")}</p>`}</div>`;
      panel.innerHTML += `<button class="primary gate-button" data-action="gate">${game.open ? "🚪 " + tr("ui.close") : "🎟️ " + tr("ui.open")}</button><div class="ticket"><label for="ticket">${tr("ui.ticket")} <strong id="ticket-price">${game.ticket} 🪙</strong></label><input id="ticket" data-input="ticket" type="range" min="1" max="20" value="${game.ticket}"/><p id="ticket-feedback">${tr(game.ticket < attractiveness(game) ? "ui.priceCheap" : game.ticket === attractiveness(game) ? "ui.priceFair" : game.ticket <= attractiveness(game) * 1.5 ? "ui.priceHigh" : "ui.priceExpensive")} · ${tr("ui.recommended")}: ${attractiveness(game)} 🪙</p></div>`;
    }
    if (tab === "build") {
      panel.innerHTML =
        title("ui.build", "🔨", tr("ui.chooseTile")) +
        `<div class="chips">${["enclosures", "objects", "paths", "shops", "playground", "habitat", "fences"].map((id) => actionButton("category:" + id, tr("menu." + id), `class="${category === id ? "chosen" : ""}"`)).join("")}</div><div class="catalog">`;
      if (category === "enclosures")
        panel.innerHTML += homeThemes
          .flatMap((theme) =>
            homeSizes.map((size) =>
              card(
                homeEmoji[theme],
                `${tr("home." + theme)} · ${tr(size === 3 ? "ui.small" : "ui.big")}`,
                `tool:enclosure:${theme}-${size}`,
                `${size}×${size} · ${homeCost(size)} 🪙`,
              ),
            ),
          )
          .join("");
      else if (category === "habitat")
        panel.innerHTML += terrains
          .map((id) =>
            card("🟩", tr("terrain." + id), "tool:terrain:" + id, "1 🪙"),
          )
          .join("");
      else if (category === "fences")
        panel.innerHTML += ["fence", "highfence", "gate", "removefence"]
          .map((id) =>
            card(
              id === "gate" ? "🚪" : "🪵",
              tr("tool." + id),
              "tool:fence:" + id,
              `${id === "removefence" ? 0 : id === "highfence" ? 3 : 1} 🪙`,
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
        title("ui.animals", "🐾", tr("ui.adoptHint")) +
        `<div class="catalog">${species.map((s) => card(s.emoji, tr("animal." + s.id), "adopt:" + s.id, s.tier > game.stars ? `🔒 ${s.tier} ★` : `${s.cost} 🪙 · ${homeEmoji[s.terrain as HomeTheme]} ${homeFor(game, s.id) ? tr("ui.homeReady") : tr("ui.homeNeeded")}`, s.tier > game.stars)).join("")}</div>`;
    if (tab === "staff")
      panel.innerHTML =
        title("ui.staff", "👥") +
        `<div class="note">${tr("ui.staffHint")}</div><div class="catalog">${roles.map((role) => card("🧑‍🌾", tr("role." + role), "hire:" + role, `15 🪙 · ${tr("ui.wages")}`, game.stars < 2)).join("")}</div><p>${game.workers.length} ${tr("ui.staff")}</p>`;
    if (tab === "goals")
      panel.innerHTML =
        title("ui.goals", "✨") +
        `<div class="goal-list">${goalIds.map((id) => `<div class="goal ${game.goals.includes(id) ? "complete" : ""}" tabindex="0" title="${tr("steps." + id)}" aria-description="${tr("steps." + id)}"><span>${game.goals.includes(id) ? "✓" : "○"}</span><span>${tr("goal." + id)}</span><details data-help="goal:${id}"><summary>${tr("ui.moreHelp")}</summary><p>${tr("steps." + id)}</p></details></div>`).join("")}</div><div class="income"><p>🎟️ ${tr("ui.tickets")}: ${game.income.tickets}</p><p>💝 ${tr("ui.donations")}: ${game.income.donations}</p><p>🍿 ${tr("ui.sales")}: ${game.income.sales}</p></div>`;
    if (tab === "book")
      panel.innerHTML =
        title("ui.book", "📖") +
        `<div class="book-grid">${species.map((s) => `<article class="book-entry ${!revealed(s.id, s.tier) ? "locked" : ""}"><span class="book-portrait">${!revealed(s.id, s.tier) ? `<span class="animal-silhouette" aria-hidden="true">${s.emoji}</span><span class="mystery-mark">?</span>` : s.emoji}</span><h3>${!revealed(s.id, s.tier) ? "🔒 " + s.tier + " ★" : tr("animal." + s.id)}</h3>${revealed(s.id, s.tier) ? `<small>${tr("terrain." + s.terrain)} · ${tr("food." + s.food)}</small><p>${tr("fact." + s.id + ".1")}</p><p>${tr("fact." + s.id + ".2")}</p>` : ""}</article>`).join("")}</div>`;
    if (tab === "help")
      panel.innerHTML =
        title("ui.help", "🌱", tr("help.intro")) +
        `<div class="help-topics">${["care", "paths", "booths", "fences", "habitat", "saves"].map((topic, index) => `<article class="help-topic"><h3>${["🥕", "👣", "🍿", "🪵", "🐾", "💾"][index]} ${tr("help." + topic + ".title")}</h3><p>${tr("help." + topic + ".short")}</p><details data-help="help:${topic}"><summary>${tr("ui.moreHelp")}</summary><p>${tr("help." + topic + ".body")}</p></details></article>`).join("")}</div>`;
    if (tab === "settings")
      panel.innerHTML =
        title("ui.settings", "⚙") +
        languageChoices() +
        `<label class="setting">${tr("ui.sound")}<input data-input="sound" aria-label="${tr("ui.sound")}" type="range" min="0" max="1" step="0.1" value="${game.sound}"/></label><label class="setting">${tr("ui.music")}<input data-input="music" aria-label="${tr("ui.music")}" type="range" min="0" max="1" step="0.1" value="${game.music}"/></label><div class="song-picker"><span>${tr("ui.song")} ${(game.counters.musicTrack ?? 0) + 1} / ${musicTracksCount}</span>${actionButton("nextSong", `♫ ${tr("ui.nextSong")}`)}</div><div class="action-grid">${actionButton("save", "💾 " + tr("ui.save"))}${actionButton("export", "↗ " + tr("ui.export"))}${actionButton("import", "↙ " + tr("ui.import"))}${actionButton("reset", "🌱 " + tr("ui.newGame"))}</div><label class="setting">${tr("ui.saveData")}<textarea id="save-data" rows="5" spellcheck="false" aria-label="${tr("ui.saveData")}"></textarea></label><p class="note">${tr("ui.resetHint")}</p>`;
    if (tab === "settings" && backup !== undefined)
      root.querySelector<HTMLTextAreaElement>("#save-data")!.value = backup;
    root
      .querySelectorAll<HTMLDetailsElement>("details[data-help]")
      .forEach((element) => {
        element.open = expanded.includes(element.dataset.help);
      });
    decorateHelp();
  }
  let coinTimer: number | null = null;
  function showIncomeCoin() {
    root.querySelector(".income-flight")?.remove();
    if (coinTimer !== null) window.clearTimeout(coinTimer);
    const counter = root
      .querySelector('[data-testid="coins"]')!
      .getBoundingClientRect();
    const world = canvas.getBoundingClientRect();
    const coin = document.createElement("span");
    coin.className = "income-flight";
    coin.textContent = "🪙";
    coin.setAttribute("aria-hidden", "true");
    coin.style.setProperty(
      "--coin-from-x",
      `${world.left + world.width * 0.55}px`,
    );
    coin.style.setProperty(
      "--coin-from-y",
      `${world.top + world.height * 0.5}px`,
    );
    coin.style.setProperty(
      "--coin-to-x",
      `${counter.left + counter.width * 0.5}px`,
    );
    coin.style.setProperty(
      "--coin-to-y",
      `${counter.top + counter.height * 0.5}px`,
    );
    root.append(coin);
    coinTimer = window.setTimeout(() => {
      coin.remove();
      coinTimer = null;
    }, 700);
  }
  function update() {
    if (game.goals.length > lastGoals) cue("goal");
    if ((game.counters.adopted ?? 0) > lastAdopted) cue("arrival");
    if (game.size > lastSize) cue("expansion");
    if (game.stars > lastStars) cue("unlock");
    if ((game.counters.eventIndex ?? 0) !== lastFriendlyEvent) {
      const friendly = activeEvent(game);
      if (friendly) cue(friendly);
    }
    lastGoals = game.goals.length;
    lastAdopted = game.counters.adopted ?? 0;
    lastSize = game.size;
    lastStars = game.stars;
    lastFriendlyEvent = game.counters.eventIndex ?? 0;
    if (game.time < lastLaugh) lastLaugh = game.time;
    if (
      started &&
      game.time - lastLaugh >= 10 &&
      game.visitors.some(
        (visitor) => visitor.type === "child" && visitor.activity === "jump",
      )
    ) {
      cue("laugh");
      lastLaugh = game.time;
    }
    const ticketPrice = root.querySelector("#ticket-price");
    if (ticketPrice) {
      ticketPrice.textContent = `${game.ticket} 🪙`;
      root.querySelector("#ticket-feedback")!.textContent =
        `${tr(game.ticket < attractiveness(game) ? "ui.priceCheap" : game.ticket === attractiveness(game) ? "ui.priceFair" : game.ticket <= attractiveness(game) * 1.5 ? "ui.priceHigh" : "ui.priceExpensive")} · ${tr("ui.recommended")}: ${attractiveness(game)} 🪙`;
    }
    renderer.setPlacementMode(tool !== null);
    canvas.style.cursor = tool ? "crosshair" : "pointer";
    if (panelTask && !game.keeper.task) cue("done");
    const income =
      game.income.tickets + game.income.donations + game.income.sales;
    if (income > lastIncome) {
      cue("coin");
      showIncomeCoin();
    }
    lastIncome = income;
    if (started && game.time - lastAnimalSound >= 15) {
      cue(
        "animal:" +
          game.animals[Math.floor(game.time / 15) % game.animals.length]
            .species,
      );
      lastAnimalSound = game.time;
    }

    const selectedFriend = selectedAnimal();
    const level = (value: number) => Math.floor(value / 10);
    const careStatus = `${todo()
      .map(([action]) => action)
      .join()}|${
      selectedFriend
        ? `${selectedFriend.id}:${level(selectedFriend.hunger)}:${level(selectedFriend.water)}:${level(selectedFriend.joy)}:${game.coins >= feedCost}:${Object.values(habitat(game, selectedFriend)).join(",")}:${messAt(game, selectedFriend).length}`
        : selected
          ? `${tile(game, selected).object}:${tile(game, selected).dirt}:${canRepair(game, selected)}:${game.coins >= 2}:${canPlant(game, selected)}`
          : ""
    }`;
    if (tab === "inspect" && careStatus !== panelCareStatus) renderPanel();
    panelCareStatus = careStatus;
    const goalStatus = `${game.goals.join(":")}:${game.income.tickets}:${game.income.donations}:${game.income.sales}`;
    if (tab === "goals" && goalStatus !== panelGoals) renderPanel();
    panelGoals = goalStatus;
    if (panelTask !== game.keeper.task || panelStars !== game.stars) {
      if (tab !== "settings") renderPanel();
      panelTask = game.keeper.task;
      panelStars = game.stars;
    }
    const avg = Math.round(
      game.animals.reduce((sum, a) => sum + welfare(game, a), 0) /
        game.animals.length,
    );
    root.querySelector("#stats")!.innerHTML =
      `<div class="stat coins"><span>🪙</span><strong data-testid="coins">${Math.floor(game.coins)}</strong><small>${tr("ui.coins")}</small></div><div class="stat"><span>★</span><strong>${"★".repeat(game.stars)}${"☆".repeat(5 - game.stars)}</strong><small>${tr("ui.stars")}</small></div><div class="stat"><span>👋</span><strong data-testid="visitors">${game.visitors.length}</strong><small>${tr("ui.visitors")}</small></div><div class="stat"><span>💚</span><strong>${avg}%</strong><small>${tr("ui.welfare")}</small></div>`;
    root.querySelector("#world-hint")!.textContent = tool
      ? `${tr("ui.chooseTile")} · ${tr((tool.kind === "enclosure" ? "home." : tool.kind === "terrain" ? "terrain." : tool.kind === "fence" ? "tool." : "building.") + tool.id.split("-")[0])}`
      : tr(game.open ? "ui.gateOpen" : "ui.gateClosed");
    root.querySelector("#keeper-status")!.textContent =
      `🧑‍🌾 ${tr("ui.keeper")} · ${game.keeper.task ? tr("message." + game.keeper.task.kind) : tr("ui.ready")}${game.keeper.task?.carrying ? " 🥕" : ""}`;
    root.querySelector("#toast")!.textContent = tr("message." + game.message);
    const task = root.querySelector<HTMLButtonElement>("#next-task")!;
    const nextGoal = goalIds.find((goal) => !game.goals.includes(goal));
    task.hidden = !started;
    task.textContent = `✨ ${game.goals.length}/${goalIds.length} · ${nextGoal ? tr("ui.nextTask") + ": " + tr("goal." + nextGoal) : tr("ui.tasksDone")}`;
    const event = root.querySelector("#zoo-event")!;
    const visibleEvent =
      activeEvent(game) ||
      (friendlyEvents.some((event) => event === game.event)
        ? "welcome"
        : game.event);
    event.textContent = tr("event." + visibleEvent);
    event.classList.toggle(
      "celebrating",
      ["arrival", "goal", "expansion", "birthday"].includes(visibleEvent),
    );
    root.querySelector('[data-action="pause"]')!.textContent = game.paused
      ? "▶"
      : "Ⅱ";
    root
      .querySelector('[data-action="pause"]')!
      .setAttribute("aria-label", tr(game.paused ? "ui.play" : "ui.pause"));
    root.querySelector('[data-action="speed"]')!.textContent = `${speed}×`;
    decorateHelp();
  }
  function showStarter() {
    root.querySelector("#modal")!.innerHTML =
      `<div class="modal-shade"><section class="starter-dialog" role="dialog" aria-modal="true" aria-label="${tr("ui.chooseStarter")}">${languageChoices()}<span class="eyebrow">${tr("app.subtitle")}</span><h1>${tr("ui.chooseStarter")}</h1><p>${tr("ui.startHint")}</p><div class="starters">${species
        .filter((s) =>
          ["rabbit", "guinea", "goat", "pig", "raccoon"].includes(s.id),
        )
        .map(
          (s) =>
            `<button data-action="starter:${s.id}" class="starter ${starter === s.id ? "chosen" : ""}" aria-pressed="${starter === s.id}"><span>${s.emoji}</span><strong>${tr("animal." + s.id)}</strong><small>${tr("bonus." + s.id)}</small></button>`,
        )
        .join(
          "",
        )}</div><button data-action="start" class="primary">${tr("ui.start")} →</button><small>${tr("ui.noPressure")}</small></section></div>`;
    decorateHelp();
  }
  function persist() {
    const ok = save(game, storage);
    saveResult = ok;
    root.querySelector("#save-status")!.textContent = tr(
      ok ? "ui.saved" : "ui.saveFailed",
    );
    return ok;
  }
  function select(p: Point) {
    if (!started) return;
    selected = p;
    selectedAnimalId = tool
      ? null
      : (game.animals.find((animal) => animal.x === p.x && animal.z === p.z)
          ?.id ?? null);
    if (tool) {
      if (tool.kind === "build") build(game, tool.id, p);
      else if (tool.kind === "terrain") paint(game, tool.id as Terrain, p);
      else if (tool.kind === "enclosure") {
        const [theme, size] = tool.id.split("-");
        if (buildEnclosure(game, theme as HomeTheme, Number(size), p)) {
          tool = null;
          tab = "animals";
        }
      } else if (tool.kind === "fence") {
        if (fenceStart) {
          fence(
            game,
            fenceStart,
            p,
            (tool.id === "removefence" ? "remove" : tool.id) as
              "fence" | "highfence" | "gate" | "remove",
          );
          fenceStart = null;
        } else {
          fenceStart = p;
          game.message = "chooseNeighbor";
        }
      }
    } else {
      tab = "inspect";
      const object = tile(game, p).object;
      // Clicking a chore starts it at once; only animals open a choice.
      if (!selectedAnimal()) {
        if (canRepair(game, p)) command(game, "repair", p);
        else if (["weed", "rock", "stump"].includes(object))
          command(game, "clear", p);
        else if (tile(game, p).dirt > 0 || object === "litter")
          command(game, "clean", p);
        // A plain click never interrupts a chore that is already under way.
        else if (!object && !game.keeper.task) command(game, "walk", p);
      }
    }
    cue(game.message);
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
      selectedAnimalId = null;
      tool = { kind: id as Tool["kind"], id: toolId };
    } else if (kind === "care" && selected) {
      const animal = selectedAnimal();
      const dirty =
        animal && id === "clean" ? messAt(game, animal)[0] : undefined;
      command(
        game,
        id as Task["kind"],
        dirty ?? animal ?? selected,
        dirty ? 0 : (animal?.id ?? 0),
      );
    } else if (kind === "cancelTask") cancelTask(game);
    else if (kind === "adopt") {
      if (adopt(game, id)) {
        const friend = game.animals[game.animals.length - 1];
        selected = { x: friend.x, z: friend.z };
        selectedAnimalId = friend.id;
        tab = "inspect";
      } else if (game.message === "needEnclosure") {
        tab = "build";
        category = "enclosures";
        tool = { kind: "enclosure", id: getSpecies(id).terrain + "-4" };
      }
    } else if (kind === "pick") {
      const friend = game.animals.find((a) => a.id === Number(id));
      if (friend) {
        selected = { x: friend.x, z: friend.z };
        selectedAnimalId = friend.id;
      }
    } else if (kind === "job") {
      selectedAnimalId = null;
      const animal = game.animals.find((a) => a.id === Number(toolId));
      const [x, z] = toolId.split(",").map(Number);
      const at = animal ?? { x, z };
      selectedAnimalId = animal?.id ?? null;
      selected = { x: at.x, z: at.z };
      command(game, id as Task["kind"], at, animal?.id ?? 0);
    } else if (kind === "hire") hire(game, id as Role);
    else if (kind === "starter") {
      starter = id;
      showStarter();
    } else if (kind === "start") {
      Object.assign(game, createGame(starter), { language: game.language });
      started = true;
      root.querySelector("#modal")!.innerHTML = "";
      renderer.rebuild();
      persist();
    } else if (kind === "language" && (id === "de" || id === "en")) {
      game.language = id;
      try {
        storage.setItem(languageKey, id);
      } catch {
        // Saving the preference is optional when storage is blocked.
      }
      if (started) persist();
      refreshLanguage();
      if (!started) showStarter();
    } else if (kind === "gate") {
      game.open = !game.open;
      game.message = game.open ? "gateOpen" : "gateClosed";
    } else if (kind === "expand") expand(game);
    else if (kind === "pause") game.paused = !game.paused;
    else if (kind === "speed")
      speed = speed === 1 ? 0.5 : speed === 0.5 ? 2 : 1;
    else if (kind === "zoomIn") renderer.zoom(-1);
    else if (kind === "zoomOut") renderer.zoom(1);
    else if (kind === "rotate") renderer.rotate(Math.PI / 2);
    else if (kind === "settings" || kind === "help" || kind === "goals") {
      tab = kind;
      tool = null;
    } else if (kind === "nextSong") {
      game.counters.musicTrack =
        ((game.counters.musicTrack ?? 0) + 1) % musicTracksCount;
      persist();
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
        refreshLanguage();
        selected = null;
        selectedAnimalId = null;
        tool = null;
        renderer.rebuild();
        persist();
        game.message = "imported";
      } else game.message = "importFailed";
    } else if (kind === "reset") {
      reset = true;
      root.querySelector("#modal")!.innerHTML =
        `<div class="modal-shade"><section class="starter-dialog" role="dialog" aria-modal="true" aria-label="${tr("ui.newGame")}"><h2>${tr("ui.confirmReset")}</h2>${actionButton("confirmReset", tr("ui.newGame"), 'class="primary"')}${actionButton("cancelReset", tr("ui.cancel"))}</section></div>`;
    } else if (kind === "confirmReset" && reset) {
      started = false;
      reset = false;
      selected = null;
      selectedAnimalId = null;
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
    if (action) {
      handleAction(action);
      const [kind, id] = action.split(":");
      cue(
        [
          "noCoins",
          "noRoute",
          "noSpace",
          "needEnclosure",
          "locked",
          "occupied",
          "busy",
        ].includes(game.message)
          ? "error"
          : kind === "care"
            ? id
            : kind,
      );
    }
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
    audio.update(
      game.sound,
      game.music,
      currentSound,
      game.counters.musicTrack ?? 0,
    );
    update();
  }
  let last = performance.now();
  function animate(now: number) {
    if (disposed) return;
    const dt = Math.max(0, Math.min((now - last) / 1000, 1));
    last = now;
    if (started) advance(game, dt * speed);
    renderer.render();
    audio.update(
      game.sound,
      game.music,
      currentSound,
      game.counters.musicTrack ?? 0,
    );
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
  refreshLanguage();
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
      if (coinTimer !== null) window.clearTimeout(coinTimer);
      root.querySelector(".income-flight")?.remove();
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
