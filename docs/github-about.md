# GitHub About

The `githubAbout` completion review checked the live repository description and
all ten topics against the implemented game. The description and topics below
already match the public repository; no metadata change was needed.

## Recommended description

A friendly isometric zoo builder for ages eight and up: start with one animal and
no coins, carry food as the keeper, welcome families, and grow your park. Play in
the browser with automatic local saves every ten seconds.

## Alternatives

- A little animal, a big adventure: build and care for your own isometric zoo in
  the browser, with a visible keeper and a kind, coin-powered economy.
- A TypeScript and Babylon.js zoo simulation with deterministic care and visitor
  systems, validated browser saves, Firefox/Chromium E2E tests, and a 95% coverage gate.

## Ten topics

`zoo-game`, `zoo-builder`, `browser-game`, `isometric`, `family-friendly`,
`simulation-game`, `typescript`, `babylonjs`, `playwright`, `gpl-3-0`.

Swap candidates: `vite`, `vitest`, `management-game`, `educational-game`.
The latter is less precise because the vision explicitly calls this a game with
incidental learning rather than a teaching product.

## Evidence

`src/renderer.ts` implements the procedural isometric world; `src/game.ts` starts
with one animal and zero coins, then models transported food and family visitors.
`src/app.ts` autosaves to browser storage every 10,000 milliseconds, with a reopen
regression in `tests/app.test.ts`. Age eight is the intended audience specified in
the vision, not a claim of completed child usability testing. `vite.config.ts`
enforces the 95% coverage gate, and `playwright.config.ts` targets both browsers.
`LICENSE` supplies GPLv3. English and German support live switching in `src/app.ts` and paired locale files.
