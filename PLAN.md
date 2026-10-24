# Der coole Zoo — implementation plan

Source: [Vision(1).md](<Vision(1).md>). Audience: children aged eight and up.
A desktop browser game with an isometric world, a visible keeper, and a zoo
built from scratch. Original procedural artwork; no external proprietary assets.

## Current delivery scope

Complete the version-one product described in [Vision(1).md](<Vision(1).md>),
including German/English live switching and the remaining simulation and visual
feedback. The latest instructions supersede the previous English-only MVP scope.
Make the zoo cute, preserve existing saves, work on main, and update this plan in
every commit. Three subagents completed localization, simulation, and renderer polish;
the primary agent integrated them and owns browser acceptance and release.

## Active completion work

- [x] Complete and validate live DE/EN localization, including accessible labels.
- [x] Add short in-game help for booths, connected paths, fences, gates and care.
- [x] Make people smaller and cute, with passing lanes for incoming/outgoing flow.
- [x] Regression-test narrow-path opposing traffic and entrance congestion.
- [x] Closing stops arrivals and sends every reachable guest to the exit.
- [x] Add localized tooltips explaining each UI action, use and result.
- [x] Add a visible growth tutorial with next tasks and hoverable step-by-step guidance.
- [x] Add five playful music tracks with an accessible Next song button.
- [x] Complete species habitat checks and distinct vendor behavior.
- [x] Make feeders/troughs functional, with truthful stock visuals and keeper refills.
- [x] Give hungry/thirsty animals actionable next-step hints and optional detailed help.
- [x] Distinguish animal diet bubbles from visitor snack needs.
- [x] Give friendly events actual gameplay and visible feedback.
- [x] Add cute species activities and celebrated animal arrivals.
- [x] Expand browser acceptance to language switching and save persistence.
- [x] Run the 95% coverage gate without exclusions or lower thresholds.
- [x] Refresh the real UI screenshot and requirement traceability.
- [x] Run reviewBranch, address findings, then run githubAbout.
- [x] Run full pipeline including real Docker smoke verification.
- [x] Commit with version bump, push, inspect actual Actions/Pages/GHCR results.
- [x] Leave a clean working tree and report child playtesting as unverified.

Local verification for the feature release: 129 tests, 12 browser scenarios across
Firefox/Chromium, 99.56% statements / 97.99% branches / 99.07% functions / 99.78%
lines, production build and real Docker smoke check all passed. Two browser workers
keep software WebGL responsive instead of oversubscribing local/CI CPUs. Review
findings are resolved; metadata matches GitHub. Feature release `0.4.0` was committed as `ba519c5` and pushed. Its actual
[Actions run](https://github.com/marcelpetrick/DerCooleZoo/actions/runs/40132364867)
passed all three jobs (verification, Pages, GHCR). Patch `0.4.1` records the
completed audit, refreshed screenshot and reusable deployed-site smoke script; its
full local pipeline also passed, including a real browser session against the
Docker-served application. The final patch workflow is inspected after pushing.
Actual child usability/playtesting remains unverified; automated scenarios do not
substitute for participants.

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
- [x] Polish walking animations and make the player keeper unmistakable.
- [x] Slow early visitor flow and earnings; add more rough, uncleared land.
- [x] Enforce collision space for people and animals, with compatible saves.
- [x] Complete Docker, Pages and GHCR release verification.
- [x] Verify all remote checks, final pipeline, pushed commits and clean tree.

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

## Heart bubble readability patch (0.4.2)

- [x] Replace the ambiguous overlapping halves with one notched, pointed heart.
- [x] Keep affection animation to a subtle uniform pulse.
- [x] Verify silhouette/pulse, real WebGL screenshot, full pipeline and Docker.
- [x] Prepare the versioned patch for commit and publication.

Validation: 129 tests and 12 Firefox/Chromium scenarios passed; all coverage
metrics exceed 95%, and the production Docker smoke test passed. The actual UI
screenshot confirms the pointed heart. Supplemental review found no blockers;
GitHub About metadata still matches. Post-push gate: inspect the resulting
Actions/Pages/GHCR jobs before reporting the patch released.
