# Der coole Zoo

[![Pipeline](https://github.com/marcelpetrick/DerCooleZoo/actions/workflows/pipeline.yml/badge.svg?branch=main)](https://github.com/marcelpetrick/DerCooleZoo/actions/workflows/pipeline.yml)
[![Play on GitHub Pages](https://img.shields.io/badge/play-GitHub%20Pages-508565)](https://marcelpetrick.github.io/DerCooleZoo/)
[![License: GPL v3 or later](https://img.shields.io/badge/license-GPLv3%20or%20later-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.json)
[![Coverage gate](https://img.shields.io/badge/coverage%20gate-%E2%89%A595%25-brightgreen.svg)](vite.config.ts)
[![Container](https://img.shields.io/badge/container-GHCR-2496ed.svg)](https://github.com/marcelpetrick/DerCooleZoo/pkgs/container/dercoolezoo)

An isometric zoo-building browser game for children aged eight and up. Start with
one animal, a small untidy plot, your own keeper, and no coins. Care for the animal,
welcome visitors, and turn their tickets and donations into a growing little zoo.

**Author:** Marcel Petrick · **License:** GPLv3 or later · **AI-assisted project**

[Play in your browser](https://marcelpetrick.github.io/DerCooleZoo/).
The first playable version uses English. German localization is deferred; the full
product vision and remaining work are tracked in [PLAN.md](PLAN.md).

![The running zoo game](docs/screenshot.png)

## Play

Use a desktop browser with WebGL support. Firefox is the primary target;
Chromium is also covered by browser tests. No account or installation is needed.

1. Choose your starter animal and explore the little enclosure.
2. Select the animal to send your keeper to feed, water, or pet it.
3. Clear weeds and repair the enclosure, then open the zoo to visitors.
4. Buy food into your inventory. Your keeper carries it to the animal; buying
   food alone does not feed it. A little starter supply and free emergency food
   prevent getting stuck without coins.
5. After eating, animals leave cartoon droppings. Select the dirty tile to send
   the keeper to clean it up.
6. Build paths, benches, snack stalls, and play equipment. Happy visitors stay
   longer, buy snacks, and donate. Expand the land and adopt more animals.
7. Later, hire staff to help with care and cleaning. Their wages use coins.

Use the mouse to select objects and place buildings. Camera buttons provide zoom
and rotation. Follow the short goals for the first steps. Animals never die from
management mistakes, and there are no purchases with real money or game-over debts.

The zoo autosaves every ten seconds in this browser's local storage and restores
your progress when you reopen it. Clearing browser data removes those
saves. Export a save from Settings to keep a backup or move it to another browser;
import validates the pasted data before replacing the current zoo.

## Run locally

Requirements: Node.js 24, npm, and a desktop browser. Docker is only required for
the full production-container verification stage.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

The production files are in `dist/`. Asset paths are relative, so the same build
works at the GitHub Pages repository URL and at the root of a Docker server.

## Tests and pipeline

Install the test browsers once, then run the authoritative gate:

```sh
npm ci
npx playwright install --with-deps chromium firefox
./localPipeline.sh
```

The pipeline checks formatting, ESLint, strict TypeScript, unit and integration
tests, coverage, the production build, browser end-to-end tests, and the production
Docker image. Coverage must reach **95% statements, branches, functions, and lines**
across application TypeScript. Reports are written to `coverage/`,
`playwright-report/`, and `test-results/`.

Useful commands:

| Command                     | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `npm run dev`               | Start the Vite development server               |
| `npm run build`             | Build the static production application         |
| `npm run preview`           | Serve `dist/` on port 4173                      |
| `npm run lint`              | Check ESLint and Prettier                       |
| `npm run format`            | Apply formatting                                |
| `npm run typecheck`         | Run strict TypeScript checks                    |
| `npm test`                  | Run unit and integration tests                  |
| `npm run coverage`          | Run tests and enforce the coverage gate         |
| `npm run e2e`               | Run Playwright browser tests                    |
| `./localPipeline.sh`        | Run every release gate                          |
| `./scripts/check-docker.sh` | Build and smoke-test the container              |
| `npm run version:patch`     | Increment package and lockfile patch version    |
| `npm run version:minor`     | Increment the minor version for a major feature |

See [scripts and deployment](docs/development.md) for prerequisites, cleanup,
release behavior, and CI details.

## Docker

Build and run the game locally after verifying the local application:

```sh
docker build --tag dercoolezoo:local .
docker run --rm --publish 8080:8080 dercoolezoo:local
```

Open <http://localhost:8080>. The image serves static files using nginx as a
non-root user on port 8080 and exposes `/health`. It contains no database or user
accounts. Saves belong to the browser, so the container needs no persistent volume.

The pipeline publishes `ghcr.io/marcelpetrick/dercoolezoo:latest`, a semantic-version
tag, and an immutable `sha-<commit>` tag after verification succeeds:

```sh
docker run --rm --publish 8080:8080 ghcr.io/marcelpetrick/dercoolezoo:latest
```

See the [package page](https://github.com/marcelpetrick/DerCooleZoo/pkgs/container/dercoolezoo)
for published versions and access. For a private package, authenticate to GHCR with
an account that has package-read permission before pulling it.

## GitHub Pages and releases

Every push to `main` runs the same `localPipeline.sh` used locally. Only successful
verification permits the separate Pages deployment and GHCR publication jobs.
Pull requests verify the application without publishing. A manual workflow run can
repeat verification and publication for `main`.

The tested `dist/` artifact is deployed to
<https://marcelpetrick.github.io/DerCooleZoo/>. The Docker image rebuilds the same
commit with the committed dependency lockfile. Base images and GitHub Actions are
pinned by digest or commit for reproducibility.

Work happens directly on `main` in small Conventional Commits. Each commit changes
the semantic version: patches for fixes and maintenance, minor bumps for major
features. Commits and pushes must pass the available local gate first. See
[AGENTS.md](AGENTS.md) for repository rules.

## License

The source code, procedural artwork, and scripts are licensed under the
[GNU General Public License v3 or later](LICENSE). Source files carry SPDX license
and copyright notices where appropriate. The game uses original procedural models
rather than copied proprietary textures or artwork. Third-party dependencies keep
their own licenses.
