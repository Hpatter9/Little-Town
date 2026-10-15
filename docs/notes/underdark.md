## The Underdark (a living world beneath the map)

A second map under the town's land: a cave layer of solid rock threaded with what was always down there (winding
tunnels, two fungus forests, an underground river and its lake, a crystal cavern, a magma vent, lost ruins) and two or
three towns of other peoples. It is reached from below the town's own ground, explored and dug the way the hold is,
traded with, feuded over, and raided up the town's own shaft at night.

**The map** (`sim/underdark.ts` `makeUnderdark`, numbers in `data/underdark.ts`): `UD_W` x `UD_H` (48 x 48) cells, one
character a cell (`UnderCell`: `#` rock, `.` tunnel, `d` the town's own cuttings, `e` the foot of a way down, `g`
fungus forest, `~` water, `c` crystal cavern, `v` magma, `r` ruins, `t` a cave town). Made from the seed on its own
side stream (`${seed}:under`) the first time a way down stands (`underdarkOf`), with every place joined to the nearest
by winding tunnels (fording the river) and the rock within `SITE_CLEAR` of the cell under the camp kept solid, so the
town has rock to cut first. Each cell lies under `land.w / UD_W` land cells (`underCellOf`). `seen` is a string of '1's
for what the town has seen; `reached(u)` is the open ground walkable from the ways down.

**The ways down** (`UNDER_ENTRIES`: the Deep's shaft, `mine`, `coal_mine`, `deep_mine`, and a dwarf hold's
`hold_hallway`): each, once finished, opens a 3x3 chamber below itself (`openEntry`; never under water or fire). A
hallway opens straight into the nearest cave (a passage cut at once): the dwarves' home ground. Everyone else cuts
through: each load dug at an open way down (farming.ts `workMine`, the shaft's `workDeep` too) cuts `DIG_PER_LOAD`
(0.25) of a cell (`underDug`), from the open side toward the nearest cave (`nextCut`), each cell giving stone and, one
in `DEEP_ORE_ODDS`, two of a deep ore (`DEEP_ORES`: iron, silver, gold, coal, rare minerals) at the building. After the
breakthrough (`u.through`, told once) the cutting goes on as galleries, up to `GALLERY_MOST` (70) cells. The town digs
down only under the Growth or Knowledge direction (`digsDown`); the dwarves always. A cut can bring the roof down on
the digger (`UD_CAVE_IN` 0.035 a cell; `UD_CAVE_IN_KILLS` 0.55 of those kill, else a fracture: `caveIn`).

**Exploring** (`underdarkHourly`, after `deepHourly` in sim.ts): once through, the scouts see `EXPLORE_PER_HOUR` (10)
more cells of the reached caves each hour, outward from the ways down. A place seen is found (`foundSite`, told in the
news): the ruins give `RUIN_COINS` and `RUIN_STUDY` once; each dawn the found and reached places give up the main way
down (`SITE_YIELD`: a fungus forest 3 vegetables and 1 herbs (mushrooms and glowmoss), the lake 3 fish (cave fish), the
crystal cavern a gem). Each found place is a trip (`under:<site>`, `underDestination`: the destination type, loot and
foes in `SITE_TRIPS`), on the board through the usual picker (expeditions.ts `destinationOf`/`destinationUnlocked`,
parties.ts `boardDestinations`, snapshot `destinations`), so the town's own parties go below too.

**The cave towns** (`CAVE_PEOPLES`, two or three a layer, `CaveTown` in `u.towns`): the Glimmerdeep (deep gnomes,
crystals and deep ore), the Umbral Court (a court of the dark, silver and spider-silk), the Sporemoot (mushroom folk,
cave mushrooms and glowmoss), Clan Greyhold (dwarves of another line, deep ore, gold and cave fish). Each a power: its
goodwill (`attitude`, drifting toward `CAVE_REST` by temper), troops, stance (`peace`, `friend` at `CAVE_FRIEND`, `war`
at `CAVE_WAR`, `fallen`). Met when the scouts find its town (the dwarves know them all from the first, and they're
warmer: `dwarves` on each people). Each dawn (`caveDay`): a friend reached by the tunnels trades its goods up the
shaft every `CAVE_TRADE_DAYS` for `price` coins; every `CAVE_ENVOY_DAYS` an envoy (a `ways` prompt, system
`underdark`, answered by `answerUnder` through heritage.ts `answerWays`): a greeting, help in its feud, terms at war,
or a gift for trade. They feud among themselves (`feuds`: `FEUD_CHANCE`, troops worn down, a town may fall). At war,
each night hour `CAVE_RAID` of a raid up the main way down (startRaid inside the town at the shaft), its budget
`CAVE_RAID_SHARE` of a raid's plus `CAVE_RAID_PER_TROOP` a troop, led by its lord.

**The night** (`night`, hours `NIGHT_FROM`..`NIGHT_TO`, from paced day `DANGER_DAY` 3 and a town of `DANGER_PEOPLE` 8):
things from the dark come up the shaft (`DARK_RISE`, the `under_dark` raid, never two within `RISE_GAP_HOURS`); one at
work at a way down is taken (`TAKEN`, killed); the river or the lake, once the tunnels touch it, floods them (`FLOOD`:
up to two at work drowned (`FLOOD_KILLS`) or hurt, the digging stopped `FLOOD_HOURS`).

**The under-village** (`underVillage`): once the fungus and the lake are found, from day `UNDER_VILLAGE_DAY`, a town of
`UNDER_VILLAGE_PEOPLE` (the dwarves `UNDER_VILLAGE_PEOPLE_DWARVES`) founds a daughter village below
(villages.ts `foundVillage`, then `below: true`: `layPlots` lays nothing on the land and `makesOf` gives `UNDER_MAKES`;
its carts come from beside the main way down). Changes to "Daughter villages": the `Village.below` field and those two
lines.

**The foes and raids** (`UNDERDARK_ENEMIES` in `ENEMIES`, `UNDERDARK_RAIDS` in `RAID_KINDS`, weight 0, never rolled):
each people's warriors and lord, from the menagerie's cave creatures (kobolds, moles, giant spiders, spore clouds)
tinted for their folk, or LPC people (the Umbral Court, Greyhold); and `under_dark`, the menagerie's cave and crypt
creatures of tiers 2 to 6.

**Seen**: the Underdark view (`renderer/underdark/underdarkView.ts` `UnderScene`, command `watchUnder`, state
`watchingUnder`, snapshot `underView` while watched): the caves from above, painted from the packs' tiles (the Mine
Tileset's rock, the dungeon pack's floor and water, the water burning orange for magma) with the cave pack's things
(mushrooms, crystals, ruins, cave dwellings, boulders, a ladder and fire at each way down), dark but for what glows,
names over the places found (coloured by the cave town's stance), the unseen left black over the crystal cave backdrop.
Its bar (`#under-hud`, the Deep's styles) lists the diggers, what's found, the cave towns and the news. Opened from a
way down's tap card ("Into the Underdark") or the Deep's bar ("Caves"). The world map marks the cave towns round home
(`worldMapView` `caves`, `.map-hold.cave`), the Trips tab has a "Below the town" section of the trips below
(`underSummary.dests`), and the news bubble carries what comes up (`notify(..., true)`).

Tests: `test/underdark.test.ts`.
