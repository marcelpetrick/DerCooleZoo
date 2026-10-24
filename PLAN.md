# Der coole Zoo — implementation plan

Source: [Vision(1).md](<Vision(1).md>). Audience: children aged eight and up.
A desktop browser game with an isometric world, a visible keeper, and a zoo
built from scratch. Original procedural artwork; no external proprietary assets.

## Current delivery scope (latest user instructions)

The immediate delivery is the first runnable English MVP. German/live language
switching and the broader polished vision are deferred, with the remaining work
recorded in [docs/vision-status.md](docs/vision-status.md). Code and communication
are English. Keep this checklist current; do not call the full vision complete.

## Execution checklist

- [x] Read the vision and record requirements and latest scope decisions.
- [x] Establish GPLv3, pinned TypeScript stack, strict checks and local pipeline.
- [x] Implement and test the simulation, care, food transport and waste cleanup.
- [x] Implement original isometric rendering and a visible keeper.
- [x] Connect playable UI, starter choice, building, economy and progression.
- [x] Implement validated local saves and English interface.
- [x] Verify core flows in Firefox and Chromium and capture a real screenshot.
- [x] Verify exact ten-second browser autosave and reopen behavior.
- [x] Commit and push the first playable UI with its version bump.
- [x] Run reviewBranch, resolve findings and prepare githubAbout metadata.
- [x] Verify emotion bubbles, action/animal sounds and real world-tile clicking.
- [ ] Polish walking animations and make the player keeper unmistakable.
- [ ] Slow early visitor flow and earnings; add more rough, uncleared land.
- [ ] Enforce collision space for people and animals, with compatible saves.
- [ ] Complete Docker, Pages and GHCR release verification.
- [ ] Verify all remote checks, final pipeline, pushed commits and clean tree.

## Delivery sequence

1. Establish TypeScript/Vite, strict checks, formatting, linting, GPLv3,
   deterministic simulation tests, 95% coverage gates, and `localPipeline.sh`.
2. Deliver the playable vertical slice: starter choice, rough land, keeper
   movement and care, opening the gate, visitors, tickets, donations, a bench,
   popcorn, building, local saves, and live German/English switching.
3. Extend the loop: grid-edge fences and automatically recognized enclosures,
   habitat painting, paths and pathfinding, animal requirements, welfare,
   family needs, shops, playgrounds, all five animal tiers, staff, expansion,
   goals, friendly events, a zoo book, and independent audio controls.
4. Validate actual browser interaction in Firefox and Chromium, saving/loading,
   progression, error recovery, and rendering. Capture the real running UI.
5. Package the verified local game in Docker. Mirror the complete pipeline in
   GitHub Actions; publish versioned and latest GHCR images on main.
6. Review the branch, fix findings, prepare GitHub About metadata, reconcile
   the vision, and verify local/remote checks, Docker, pushes, and clean status.

## Vision traceability

| Sections             | Acceptance evidence                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1–6, 37, 43, 45–46   | One starter, no coins, rough land, visible keeper, guided first actions, positive care/economy/build loop                 |
| 7–8, 41              | One spendable currency; stars unlock content; bounded quality-based ticket recommendation and price-dependent arrivals    |
| 9–13, 23             | Children, parents, animal fans; connected-path visits, needs, benches, family play, snack sales and donations             |
| 14, 17–18, 21, 24–25 | Keeper moves before actions; feeding, water, petting, cleaning, obstacles, repairs; named animals; salaried visible staff |
| 15–16, 19–20, 22     | Tiered species; habitat/space/fence requirements; grid-edge enclosures, gates, terrain, paths and expansion               |
| 26–27, 38            | Short rewarded goals, friendly events, visible animal arrivals and celebrations                                           |
| 28–32                | Original colorful isometric diorama, big-headed figures, visible activities, mouse camera/building, Firefox and Chromium  |
| 33–36                | Complete DE/EN strings, live switching, independent sound/music controls, local autosave, animal collection and facts     |
| 39                   | Five named MVP species, four terrains, children/parents, listed objects, keeper actions and complete core systems         |
| 3, 40, 42            | No death, debt, premium currencies, gambling, multiplayer, violent events or coercive timers                              |
| 44–46                | Care, happiness and income remain connected; short actions and progressive unlocks                                        |

## Scope decisions

The vision identifies later ideas and examples, not an obligation to add forbidden
version-one scope. The complete version-one product includes the five MVP species
and a data-driven catalog spanning the suggested tiers. Optional future breeding,
genetics, complex disease, supply chains and multiplayer remain excluded exactly
as section 40 requires. No claims of child playtesting without actual participants.

## Validation policy

Unit and integration tests exercise real simulation invariants and malformed-save
recovery. Coverage gates apply to every application TypeScript file, including the
renderer and UI, with browser coverage merged where necessary. Browser tests use
real UI controls. Docker checks run the image and request its health and assets.
Every commit has a version bump and passes the available pipeline first.

## Additional user requirements

- Food must be purchased into inventory, then physically delivered by the keeper
  or a hired animal carer. Buying alone never feeds an animal.
- Fed animals subsequently produce visible cartoon droppings. The keeper or an
  appropriate worker must travel to remove them.
- Implement and commit each coherent step atomically, after its checks pass.

- Browser-local autosave runs every ten seconds and restores progress on reopen.

## Optional next iteration

- [ ] Consider animal XP from care and admiration, with gentle level-up celebrations.
