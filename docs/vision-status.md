# Vision status and MVP scope

Source: [Vision(1).md](<../Vision(1).md>). The current delivery target is the first
runnable **English MVP**, following the later request to prioritize playing as soon
as possible. German and the full long-term vision remain visible work rather than
being described as finished. [PLAN.md](../PLAN.md) is the active execution checklist.

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

Food transport and waste removal are explicit additional user requirements.
Purchasing food does not feed animals remotely. The initial food supply and free
emergency portions prevent a zero-coin dead end.

## Remaining full-vision work

| Area                                     | Current limit / remaining work                                                                                                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| German and live language switching (§33) | English is the first playable UI. Translation dictionaries and helper infrastructure exist; complete visible text localization and a language switch are deferred.                                    |
| Story animations (§3, §18, §29)          | Basic eating, affection, walking, carrying, sitting and jumping are represented. Species-specific swimming, sleeping schedules, mischievous behavior and personality-driven animation are incomplete. |
| Friendly events (§27)                    | Event identifiers are selected in the simulation. Actual school groups, birthday activities, balloon interactions and photo-day gameplay are deferred.                                                |
| Animal arrivals (§38)                    | Adoption adds a visible animal and status message. Transporter arrival, unloading and confetti celebrations are deferred.                                                                             |
| Detailed habitat requirements (§16)      | Current checks cover enclosure size, preferred terrain, water and fence height. Mixed land/water proportions, temperature, rocks/plants and feeding-facility requirements need richer species rules.  |
| Staff specialization (§25)               | Care, cleaning and gardening are functional. Vendors currently have no distinct shop-operation behavior. No advanced schedules are planned for version one.                                           |
| Child usability (§43)                    | Automated tests cannot prove that an eight-year-old understands the loop without instruction. Actual supervised child playtesting remains necessary.                                                  |

## Implemented presentation and feedback

Gesture-activated procedural sound effects and calm music use independent volume
controls and can be muted. Species have stylized synthesized calls; no external
audio files are required. The starter fence visibly has tilted rails that
straighten after the keeper completes the repair.

Animals, guests, the keeper and staff show procedural thought clouds. Carrot,
water, heart, sleepy-Z, play, brush and hammer symbols communicate needs and work
without long text. More elaborate visitor celebrations and species-specific
stories remain polish work.

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
Successful publication and anonymous GHCR pulls must be verified after pushing;
configuration alone is not a deployment result.
