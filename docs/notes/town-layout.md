## The town plan (the owner: "Is there any way to have more thought go into the town layout? It seems so random")

Changes HISTORY.md "Phase 1" (the planner's `findSpot`), "Streets are built" (`layStreet`, `planStreets`), "The ring
wall" / "Every gate in the first blueprint" (`gateCells`), "Places of leisure" / the pastimes (an evening on the
square), and "The castle as one body of rooms" (`roomSpot`, a fix).

**What was random (looked at before changing anything: the late fixture and 40-day towns of settlers, knights,
dwarves and orcs, seeds soak-a/b/c, as text maps from `tools/layout-soak.mjs --map` and phone pictures):** `findSpot`
took the first ring of cells out from the camp with any room and, in it, the spot nearest a road, so every kind of
building went wherever the next gap was. Homes stood between the kiln and the tannery; garden plots and open fields
lay inside the wall right beside the seat and the fire (settlers soak-a had three 8x4 fields within six cells of the
seat); workshops, stores, shrines and the graveyard were scattered through it all; there was no square, only the fire
on bare ground. Every building laid its own way to the nearest street (four ways, round whatever stood), so streets
were short spurs and staircases that wandered and doubled back, and the worn footpaths that became streets added more
of them. The ring's gates stood on the camp's row and column, which no street kept to.

**The plan** (`src/shared/sim/layout.ts`, `GameState.layout?: TownLayout`, laid by `ensureLayout` on the planner's
first pass, autopilot only; none for a tribe on the move, `nomadic`): from the seat's door (a castle's or a hold's
gate; the camp's, with no seat), `makeLayout` lays
- **the square** (`sq`, `SQUARE_W` 11 by `SQUARE_H` 5): the seat's door on its top edge, the fire on it, paved (at once
  at the founding, like the first streets; an older town's planned for its pavers);
- **the high street** along the square's bottom row (`row`), west and east, and **the road south** down its middle
  (`col`); `extendMains` keeps them straight and `STREET_AHEAD` (4) cells past the core (`coreRadius`), hourly every
  six hours (`layoutHourly` from streets.ts `streetsHourly`), never past the ring wall's line: the trees and rocks on
  the line are marked to clear `MAIN_CLEAR` (3) at a time, a river is bridged;
- **blocks**: side streets every `BLOCK` (4) rows (three rows of building between, each building's door on the street
  below it), lanes every `CROSS` (11) columns (`CROSS_TIGHT` 8 for the machines); `onPlanLine`;
- **the craft quarter's side** (`craft`, -1 west or 1 east: downwind), from a side stream (`${seed}:layout`), so no
  draw is taken from the town's own stream.

**Quarters** (`zoneOf(def)`): `square` (the well, statues, idols: beside the square), `civic` (the seat, shops and
taverns, temples and places of leisure, healers, the elder lodge and town hall: on the square), `store` (stockpiles,
granaries: at the square's edge, the craft side), `craft` (everything else that's worked: the craft quarter, past the
square's flank), `home` (the other side, and north and south of the square past its flanks), `learned` (places of
study, the tower, the library: beside the seat, the homes' side), `guard` (barracks, yards, the watch, prisons: in from
the south gate, `guardAnchor`), `edge` (the graveyard, shrines of the dead, portals, the shaft, the launch site:
behind the seat, a churchyard), `farm` (fields, pens, the windmill, stables, kennels, ranches), `defense` (traps and
turrets: at the homes' reach along the main streets), `shore`. A necropolis (the liches) has its graveyard `civic`.

**Spots** (`layoutSpot`, asked first by planner.ts `findSpot`, so every caller of it, the planner, people's own homes,
events, the ranch, the arena, follows the plan; the old search is the fallback when there's no plan, no room, or a
shore town's sea building): every top-left within `SPOT_REACH` (14; fields and the edge `FARM_REACH` 20) of the core is
checked at a glance against summed areas of the cells (`sat`): it must fit (over the wild too), its door free and dry,
clear of the square, the main streets' lines (everywhere), the ring's line, and in blocks of every lane and side
street (a building four deep may stand over the side street above it, not yet planned), with its door on a side
street. The lowest score wins: how far from where its quarter wants it; `WILD_COST` 1.5 a wild cell; `ACROSS_COST` 20
for a spot across the water from the square (`bank`: the land flooded out from the square over dry ground: the town
keeps to its own bank); 8 outside the ring's shape (but fields and the edge); 6 for a cell's sliver left beside a
neighbour, 4 behind one; less 3 beside its own quarter (homes in a row, workshops together), less 1 for a door on a
street already there. Fields want to lie just outside the box round the homes, the square and the stores (8 inside
it), as near as may be (0.8 a cell), on good soil (`fertile`, up to 3). Upgrades keep their place (`upgrade` is
unchanged).

**Streets follow the plan:** `layStreet` (buildings.ts) passes `planBias` to `findPath` (land.ts `PathOpts.extra`, a
cost added to each step): a cell off the plan's lines costs `OFF_PLAN` (0.9) more, so a building's way to the streets,
and a gate's, runs along the side street to a lane, and the lane to the high street. `planStreets` paves only worn
paths on the plan's lines in a town laid in blocks. The ring's gates stand where the high street and the road south
meet its line (`gateCells` aims at `layout.row`/`col` instead of the camp's), so the streets end at the gates.

**Each people:** `STYLE_OF`: `grid` (blocks) for most; `ring` (no blocks: the homes in a ring round the fire, at
least five out) for the pack, the orcs and the nomads once settled; `glade` (no blocks and no bias: streets go as
they will) for the druids and the fae. The machines' blocks are tighter. Castles and holds keep their rooms' rules
(`roomSpot`); only what stands outside follows the plan, round the castle's gate. `STYLE_NAMES` names each for a
Town tab line (not added: the menus are the UI chats').

**The evening square** (pastimes.ts): from `SQUARE_FROM` (18) to `SQUARE_UNTIL` (22), on a fair evening, a grown-up
with nothing to do goes to stand on the square one idle wander in `SQUARE_EVERY` (2), pastime `square`
(`squareSpot`: inside the square, never on the fire); no draws.

**An older save:** no `layout` until the planner's next pass, which fits one round what stands (`fitted`): nothing is
moved, the square's free cells and the main streets are planned for the pavers, and only new buildings follow it.

**Fixes found on the way:** `roomSpot` (planner.ts) now asks `canPlace` of each candidate rather than only of its
best one: the snuggest spot was sometimes the ground before the castle's gate, refused, and the Blood Court built no
room at all (5 rooms at day 10 on six seeds; 9 to 17 now, 6 to 12 before). `planRing` refreshes a planned piece's
`overgrown` before waiting on it: a wildfire (disasters.ts) turned its forest to grass without `cellCleared`, and the
ring stood 90% built for good (knights soak-a).

**Tests:** `test/layout.test.ts` (the square before the seat, paved, with the high street and the road south; the
gates on the main streets; homes in rows, doors on the side streets, off the craft side; workshops on the craft side,
the granary by the square; fields beyond the homes and not far; nothing on a street or the main lines or a lane; the
ring closes round the planned town; an older town fitted, nothing moved; no plan on the move or with the autopilot
off). `test/castle.test.ts` "a Blood Court builds one castle" passes again with the `roomSpot` fix.

**Tools:** `tools/layout-soak.mjs <origin|fixture> <seed> <days> [--map] [--dead] [--every=N] [--save=dir]`: the
numbers (people, deaths, buildings standing, paved and planned cells, the day the ring stood and its box), the map as
letters (`@` seat, `*` fire, `H` homes, `B` workshops and the rest, `K` stores, `V` venues, `F` fields, `P` pens, `D`
defences, `W` wall, `#` street, `+` planned; small letters for blueprints), and saves at day 10 and the end, at midday.

**Numbers** (40-day soaks, seeds soak-a/b/c, `tools/layout-soak.mjs`; main as it stood at 0.130.0 → this branch; people
alive at day 40 / deaths / the day the first ring stood):

| | before | after |
|---|---|---|
| settlers | 16, 11, 5 (32) / 7, 10, 10 / 13.5, 28.3, 24 | 12, 13, 16 (41) / 11, 10, 3 / 19, 28.1, 17.3 |
| knights | 12, 12, 12 (36) / 7, 6, 6 / 11.2, 21.1, 13.6 | 10, 11, 11 (32) / 2, 1, 6 / 11.4, 13.4, 10.2 |
| dwarves (no ring) | 9, 2, 8 (19) / 6, 1, 5 | 3, 6, 8 (17) / 8, 6, 1 |
| orcs | 11, 25, 20 (56) / 12, 6, 8 / 29, 16.1, 18.2 | 17, 17, 8 (42) / 10, 7, 8 / 18.1, 23.3, 14.9 |

All told 143 people and 84 deaths before, 132 and 73 after; the ring stood on day 19.4 on average before, 17.3 after.
The towns run chaotically apart (an earlier run of the same orc seeds with the plan ended at 29, 13 and 9), so the
people column is noise at three seeds; ten-day starts on eight settlers seeds ('lone-1'..'lone-8') averaged 3.4 people
after against 3.0 before. A planned town paves more (the square, the main streets, the side streets: 240 to 310 cells
by day 40 where 170 to 410 were before) and its ring's box is often a step wider. `tools/sim-hash.mjs` moves for every
town (the fixture and hash-a..d: buildings stand elsewhere); `tools/perf-sim.mjs` on the fixture: step 1.22 ms against
1.29, catching up two days 25.1 s against 24.8 s. `layoutSpot` costs 5 to 20 ms a call on the fixture (desktop), asked
only when something is placed.
