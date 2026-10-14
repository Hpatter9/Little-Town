## Catch-up speed, round two (the coordinator's ask: two days away was still a long wait)

The fixture's two days away (`node tools/perf-sim.mjs` on `test/fixtures/late-town.json.gz`) take 26.5 s where main
takes 54.1 s on the same machine (the cloud box, about 1.4 times slower than the desktop the last pass measured on: so
about 38 → 19 s there). Nothing about how a town plays changed: `node tools/sim-hash.mjs [days] [fixture|hash-a..d]`
hashes the saved end state of the fixture's catch-up and of four new towns run six days (settlers, knights, vampires,
dwarves); all five match main's to the byte. Every speed-up is a cache or a cheaper way to the same answer:

- **Paths.** `sim/walk.ts`: the cells built on (`solidCells`) are kept while the buildings stand as they were (a
  9-field signature a building), not gathered for every search. Ways found are remembered (`foundBefore`/`noteFound`)
  with the box of cells their search looked at (`PathOpts.reach`, filled by `findPath`); when the land, roads or
  buildings change, only the ways whose box holds a changed cell are forgotten (`foundNow` diffs the cells and roads
  strings and the built-on sets; a castle change forgets all; more than `CHANGED_MOST` cells, all). A goal on ground
  the walker can't reach without fording isn't searched for over every cell first: `mayReach` in `sim/land.ts` labels
  the passable cells four ways (the same as eight ways with no corner-cutting) and joins the cells of `through`
  (`landPieces`, kept per cells, roads and built-on set); a way then found by fording rests on the whole land. The A*
  loop asks each side's cost once and has its heuristic inline: the same pushes and pops.
- **The planner.** `sourceable` answers are kept within a planning pass (`sourced`: the tick, land version, open land,
  research known, age, buildings count and the shop); the open cells nearest first are worked out once for the camp
  and the open land (`nearestOrder`), so `scanWild` no longer sorts every pass (the coordinator's `scanWild` lead,
  without caching across ticks: pools change without a version bump in places, so the per-tick list stays, only
  cheaper); `wildHolds` gathers the materials in one pass; `missingPieces` (the ring) indexes the cells built on once.
- **The townsfolk.** `buildingById` (state.ts: an index of the buildings list, checked on every use); `assignBeds`
  looks for homes only when someone has no bed; the sites are gathered once a tick for everyone choosing work
  (`blueprintsNow` in people.ts) and the builders at each site once a look (`buildersAt`, `buildSpot` without the
  strings); `maxHp` is kept per person while what it rests on is the same; `capacities` (injuries.ts) reads the
  wounds and lasting harm once, not once a body part; `lessonPlace` in one look.
- **Mood.** What's alike for everyone (`TownMood`: the fire, the circle, the school, the best comfort, a vampire or the
  dead in town, who has a child, who owns a venue) is worked out once a tick for all the townsfolk's moods.
- **The rest.** The shop's arrivals ask whether anyone is due before looking for the venue and its keeper, and the
  venues are found in one look (`venueKey`); roaming bands look how far before whether under cover, and step on the
  cells built on through `builtOnNow` (buildings.ts); `craftSlots` counts stations through a set; the tactics board
  reads its units' ids once (`idOfKey`) and passes over units with no statuses.
- **The phone starts it sooner.** `mobile/boot.ts` (built to `out/web/boot.js`, loaded in the page's head) starts the
  sim worker and sends it the saved town before the page's 2 MB script has loaded, keeping what it says meanwhile;
  `startGame` in mobileBridge.ts takes the worker over (`window.__simBoot`). The host tidies the alert settings itself
  (`cleanAlerts` in simHost.ts's `init`). Without workers, or with `?inpage`, the page starts the game as before.

## The war engines and the boats from the packs

The packs were searched for every painted piece. Two had a fit: the **cannon** is the Pixel Dungeon Props pack's cannon
on its carriage (`art/packs/dp_cannon.png`), the machines' **sentry bot** the Robot Warfare pack's Scarab
(`art/packs/rw_scarab.png`), both `PICKS` in packBuildings.ts (credited in CREDITS.md; `test/packCoverage.test.ts`'s
`PAINTED` lists them no more). Still painted, since no pack has them: the ballista, catapult, flame turret, mortar
pit, launch site, tide-pool trap and acid sprayer, and the boats (`art/boatArt.ts`: the only boats in the packs are the
Seabed pack's wrecks; the tropical city pack's log trough could pass for a dugout but is smooth vector art, not pixels).
