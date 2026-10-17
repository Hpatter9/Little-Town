## The road to the daughter village (changes "Daughter villages" and "Streets are built")

The owner: "A sister village should build a road to the main town for easier travel."

- **The road** (`src/shared/sim/villageRoad.ts`, `Village.road?: VillageRoad`): `planVillageRoad` runs when a village is
  founded (`foundVillage`, replacing the bare `layStreet` call) and, for a village from an older save with no `road`,
  at `VILLAGE_ROAD_HOUR` (10) on load. It plans a street with the existing `layStreet` (so it keeps off rock, water but
  for a bridge, buildings and fields, and prefers streets already there), then `trace`s the cells from the village's fire
  (`v.y + 2`) to the town's front over roads and planned streets, and keeps them in `road.cells`. No way found:
  `road.failed`, tried again after `ROAD_RETRY_DAYS` (3). If a cell is later cut off, the road is planned again.
  No random draws; autopilot only.
- **Built from both ends:** the town's pavers lay it as any planned street, out from the streets already down
  (`paveOrder`, the normal paving priority and `PAVERS_SHARE`), so it never starves the town's own streets. Once a day at
  `VILLAGE_ROAD_HOUR` a villager's hour (`VILLAGE_ROAD_SEC` 60 seconds of paving work) lays the road from the village's
  end (`layFromVillage`, using streets.ts `pave` and `paveSeconds`; a bridge waits for its wood). A broken-away village
  lays none. Done when every cell is road (`road.done`): a journal and news line "The road to X is open."
  (`notify`), and "X sets about a road to the town." when it starts. No change to streets.ts.
- **Seen:** `VillageView.road` (0 to 100, null with none planned; `roadShare`): the Villages tab card says "Road: 40%
  paved" / "Road: open" (in the panel's redraw key); the "While you were away" card lists a road finished meanwhile
  (`AwayBefore.roads`).
- **Travel:** `findPath` already costs a road cell 0.55, so people, carts and visitors path along it once laid. Walking
  speed was the same on any ground, so `walk.ts` gets `ROAD_SPEED` 1.2: a walker standing on a road cell steps 20%
  further. **This applies to every road and street in every town** (so every sim hash changed), not only the village's.
  Raiders (`raids.ts` moves them itself) are not sped up, but they can walk the road: that is the price of a road. Raid
  odds are unchanged.
- **Tests:** `test/villageRoad.test.ts` (planned at founding and reaches the town, keeps off rock and water but for
  bridges, built from both ends, a walker's trip is shorter once open, an older village is planned on load).
