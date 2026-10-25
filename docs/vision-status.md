# Vision implementation and validation

Source: [Vision(1).md](<../Vision(1).md>). The current delivery target is the
complete version-one vision, including live German/English switching, cute
figures, practical in-game help, and visitors who can pass in both directions.
The earlier English-only MVP deferrals have been superseded by the latest user
instructions. [PLAN.md](../PLAN.md) is updated in every implementation commit.

This audit records implemented code, not proof of successful child playtesting.
Browser, Docker, and remote-deployment results must be read from their actual test
reports and GitHub Actions runs.

## Playable core

| Vision sections  | Implemented behavior                                                                                                                              | Evidence                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1–6, 37, 43      | One chosen starter, zero coins, untidy small plot, visible keeper and short care/build/open goals                                                 | `src/game.ts:createGame`, `src/app.ts`, `tests/game.test.ts`                      |
| 7–8, 41          | One currency, tickets, donations, sales, quality-based recommended admission, star unlocks and coin rewards                                       | `src/game.ts:attractiveness`, `visit`, `goals`, `tick`                            |
| 9–13, 23         | Child/parent/fan visitors, family happiness, path movement, hunger/energy/fun, benches, nearby snacks and play                                    | `src/game.ts:visit`, `src/catalog.ts`, `tests/game.test.ts`                       |
| 14, 17, 21, 24   | Keeper travels to care/clean/clear tasks; purchases enter inventory; carried food is consumed on delivery; digestion produces removable droppings | `src/game.ts:command`, `finishTask`, `tick`, `src/renderer.ts`, integration tests |
| 15–16, 19–20, 22 | Tiered animal catalog, grid terrain, fences/gates, closed-area detection, habitat/water/space checks, pathfinding, land expansion                 | `src/catalog.ts`, `src/world.ts`, `src/game.ts`                                   |
| 18               | Named animals and personality labels                                                                                                              | `src/catalog.ts`, animal profile UI                                               |
| 25               | Visible employees, automatic feeding/water/cleanup/gardening and wages without debt                                                               | `src/game.ts:staff`, `hire`, `tick`, renderer                                     |
| 26               | Short goals with one-time coin rewards                                                                                                            | `src/game.ts:goals`, goal panel, tests                                            |
| 28–31            | Original procedural isometric diorama, big-headed figures, animal/keeper activity animation, mouse selection/building and camera controls         | `src/renderer.ts`, `src/app.ts`, renderer tests                                   |
| 32               | Static browser application, local autosave, validated import/export data, Firefox/Chromium browser test targets                                   | `src/storage.ts`, storage tests, Playwright setup                                 |
| 35–36            | Zoo book with species names, habitat, food and two brief animal facts                                                                             | locale data and zoo-book panel                                                    |
| 39               | Catalog and simulation include all five named MVP species and the listed basic buildings, care actions and core systems                           | `src/catalog.ts`, `src/game.ts`, `src/app.ts`                                     |
| 3, 40, 42        | No animal death, debt, premium currency, gambling, real-money purchases, multiplayer or violent events                                            | Simulation model and dependency/application design                                |

New zoos begin on 12 × 12 tiles with an organically scattered rough outer area;
older smaller saves gain the same starting space while preserving existing tiles. The admission interval is slower,
and donation chances and goal rewards are smaller. Movement respects occupied
tiles, care completes from beside the animal, and workers/families spawn on
separate free cells. Player-facing speeds are 0.5×, 1× and 2×, with pause available.

Food transport and waste removal are explicit additional user requirements.
Purchasing food does not feed animals remotely. The initial food supply and free
emergency portions prevent a zero-coin dead end.

## Version-one completion audit

| Section | Implementation and validation                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Desktop isometric zoo, English/German, one starter and zero coins; creation, UI and browser tests.                                                                    |
| 2       | Visible keeper walks to care and cleanup; command, delivery and renderer tests.                                                                                       |
| 3       | Thought clouds and positive, recoverable economy; welfare and renderer tests.                                                                                         |
| 4       | Care, visitors, income, buildings, unlocks and staff; simulation integration tests.                                                                                   |
| 5       | Choice of five starters, rough land, gate, feeder and trough; starter UI and save tests.                                                                              |
| 6       | Short clear/repair/feed/open/build goals; one-time goal reward tests.                                                                                                 |
| 7       | Coins are spendable, stars unlock five catalog tiers; economy/progression tests.                                                                                      |
| 8       | Bounded quality-based recommendation, price faces and price-dependent arrivals; simulation/UI tests.                                                                  |
| 9       | Children, parents, fans, needs and family play effects; visitor tests.                                                                                                |
| 10      | Happiness affects stays, donations, shopping and arrivals; simulation and expression tests.                                                                           |
| 11      | Donations respond to animal care, boxes and viewing seats; donation tests.                                                                                            |
| 12      | Nine recognizable stalls with automatic nearby sales and vendor assistance; shop/renderer tests.                                                                      |
| 13      | Eight play/rest attractions with family benefits; catalog and visitor tests.                                                                                          |
| 14      | Keeper context actions, routes, tools and food carrying; unit/browser tests.                                                                                          |
| 15      | Twenty species across five tiers, including all MVP species; catalog and adoption tests.                                                                              |
| 16      | Space shared by occupants, terrain ratios, mixed water/land, fences, feeders, shelters, plants and rocks; habitat tests. Tropical/snow ground represents warmth/cold. |
| 17      | Hunger, water, affection and digestion; physical delivery, waste removal, real feeder/trough stock and truthful empty visuals; stock/consumption/save tests.          |
| 18      | Localized names and personalities with curious/playful/sleepy animation; UI/renderer tests.                                                                           |
| 19      | Edge fences/gates, automatic closed-region detection, terrain brush and habitat objects; world/build tests.                                                           |
| 20      | Four path types and connected grid routing; route and opposing-traffic tests.                                                                                         |
| 21      | Weeds, rocks, trees and stumps; short keeper/gardener cleanup tasks tested.                                                                                           |
| 22      | Coin-funded rough-land expansion to 16 × 16; expansion and save tests.                                                                                                |
| 23      | Seats restore energy, extend visits and improve viewing donations; visitor tests.                                                                                     |
| 24      | Cartoon droppings/litter, dirt effects, bins, manual and staff cleaning; cleanup tests.                                                                               |
| 25      | Visible carers, cleaners, gardeners and shop vendors with debt-free wages; staff tests.                                                                               |
| 26      | Ten concise rewarded goals, a visible next-task tutorial and detailed hover steps guide the loop; goal idempotence/UI tests.                                          |
| 27      | School, birthday, sunny, family, photo and balloon events affect visits/mood/care and have visible props; event tests.                                                |
| 28      | Original colorful procedural diorama, rounded figures and readable silhouettes; actual WebGL browser tests.                                                           |
| 29      | Eating, sleeping, playing, swimming, petting, work, snacks, sitting, jumping, cheering and income coins flying to the HUD; animation tests.                           |
| 30      | Icon-based economy, building, animals, staff, goals and settings; UI tests and short localized help.                                                                  |
| 31      | Mouse selection/building, cancel, wheel zoom and camera buttons; browser/renderer tests.                                                                              |
| 32      | Firefox and Chromium, static production build, ten-second autosave and validated recovery; browser/save tests.                                                        |
| 33      | Complete paired DE/EN dictionaries, immediate switching, localized accessible labels and persisted choice; UI/browser tests.                                          |
| 34      | Locally synthesized gentle effects, species calls and music with independent mute/volume controls, five original tunes and next-song control; audio tests.            |
| 35      | Habitat/care planning and concise animal facts provide incidental learning; book UI tests.                                                                            |
| 36      | Zoo book shows silhouettes/locks, names, habitats, foods and facts; book/reveal tests.                                                                                |
| 37      | Starts small; goals, diversity, quality, amenities and expansion advance stars; progression tests.                                                                    |
| 38      | Adoption triggers transporter, crate delivery to the new animal, timed animal reveal and confetti with bounded lifetime; arrival/render tests.                        |
| 39      | Five named MVP species, four MVP terrains, guest types, listed objects and core systems are present; catalog/UI/simulation tests.                                     |
| 40      | No breeding, genetics, complex illness, death, debt, real purchases, multiplayer or complex schedules.                                                                |
| 41      | Ticket, donation and snack income are tracked separately; shorter early visits and gentle arrivals; economy tests. Values remain playtest hypotheses.                 |
| 42      | No real purchases, gambling, violent outcomes or permanent failure; simulation scope and dependency audit.                                                            |
| 43      | Automated browser tests demonstrate the loop; actual supervised child usability testing remains unverified.                                                           |
| 44      | Care affects welfare, visitor happiness and income; simulation integration coverage.                                                                                  |
| 45      | Progressive unlocks, short tasks, price faces, staff delegation, capped guest count and original models address listed risks.                                         |
| 46      | The complete vertical slice connects visible care, guests, income, building and second-animal progression; integration/browser tests.                                 |

Examples and later ideas in the vision are represented by the version-one systems;
complex breeding, genetics, disease, supply chains and multiplayer remain excluded
as §40 specifies. No actual child playtesting or final balancing is claimed.

## Implemented presentation and feedback

Gesture-activated procedural sound effects and calm music use independent volume
controls and can be muted. Species have stylized synthesized calls; no external
audio files are required. The starter fence visibly has tilted rails that
straighten after the keeper completes the repair.

Animals, guests, the keeper and staff show procedural thought clouds. Carrot,
water, heart, sleepy-Z, play, brush and hammer symbols communicate needs and work
without long text. The player is visibly distinct from employees: a larger blue outfit, gold hat
marker, scarf, and ground ring identify your keeper. Persistent actor models and
time-based easing prevent figures from snapping when visitors arrive or terrain
changes. Rough ground uses irregular weeds, bushes, chipped stones and splintered
stumps, with sparse grass on open land. Animals now have species-specific details and sleep, swim, play and curiosity
gestures. Adoption and friendly events have temporary celebrations.

## Production and validation

The repository includes the GPLv3 license, strict TypeScript, ESLint/Prettier, unit
and integration tests, a 95% coverage gate, a production build and a local pipeline.
Renderer tests use Babylon.js's real scene system with NullEngine; browser tests
are still required to verify actual WebGL rendering and interaction.

Docker packaging uses digest-pinned Node and unprivileged nginx images. The image
smoke test builds and runs the container read-only, requests its health endpoint,
loads the real JavaScript asset, checks the distributed license and confirms the
runtime user. GitHub Actions mirrors the local pipeline and gates Pages/GHCR
publication on verification. GitHub Pages is configured for workflow deployment.
The first complete release (`0.3.1`) passed all three jobs in
[Actions run 40130232116](https://github.com/marcelpetrick/DerCooleZoo/actions/runs/40130232116).
Public Pages HTML and its actual production JavaScript were fetched and checked
for that version. A real Chromium/WebGL session started the published game,
selected a starter and welcomed a visitor without page errors. The versioned GHCR
image was pulled using an empty Docker configuration, confirming anonymous access;
the workflow also pulled and smoke-tested its published commit tag. Later changes
must repeat the same release gate.

## Completion verification

The complete version-one implementation was pushed as `ba519c5` (`0.4.0`).
[Actions run 40132364867](https://github.com/marcelpetrick/DerCooleZoo/actions/runs/40132364867)
passed verification, Pages deployment and GHCR publication. The documentation and
verification patch `0.4.1` repeats the same release gate.

Final local results: 129 unit/integration tests, 12 Firefox/Chromium browser tests,
99.56% statements, 97.99% branches, 99.07% functions and 99.78% lines, production
build, and Docker smoke test passed. A fresh Chromium session also played the real
Docker-served `0.4.1` application: startup, help, live languages, visitors and
save/reopen worked without page errors. `scripts/check-site.mjs` repeats that check
for any deployed URL.

All version-one software requirements and the user's added feeding, traffic,
guidance, tooltips, tutorial and music requests have implementation and regression
evidence. Actual child usability and balancing with human participants remain
unverified.

## Follow-through audit (0.4.3)

A fresh code and real-browser audit found gaps that the earlier acceptance flows
had not covered. This patch adds a physical two-coin keeper planting action and fixes carer scheduling around unreachable/reserved
animals, opposing keeper/guest traffic, stale care and goal panels, unsent backup
text lost during settings updates, and tutorial credit awarded for empty actions.
Identical terrain/fence operations no longer spend coins. Income now visibly
flies into the HUD, newly adopted animals emerge as the crate opens, and bins/path
litter use paper rather than animal-dropping shapes.

The new growth browser scenario prepares only a clearing and earned coin budget,
then uses actual world clicks and public build menus to place every fence edge,
a gate, a new animal, feeder, trough, path, bench and popcorn stall, and reloads
the resulting save. It exposed rapid-click suppression and fence models redirecting
placement clicks, which are addressed by independent click handling and ground
picking while a build tool is selected.

The vision's illustrative scenes such as a goat nibbling decorations and a visitor crowd gathering around an arrival are not
individually implemented. Their associated building/care, personality and arrival
systems are present; these examples should not be claimed as observed behavior.
Animal XP is an optional idea, not an unfinished version-one requirement. Actual
child usability and balancing still need human participants.

The `0.4.3` local completion gate passed: 161 unit/integration tests, 14
Firefox/Chromium browser scenarios, production build and Docker smoke check.
Coverage is 99.59% statements, 98.05% branches, 99.13% functions and 99.75% lines.
The refreshed screenshot comes from the actual running WebGL application.
