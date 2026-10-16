## The Underdark overhauled (claude/underdark-2; the owner's ask: "We need to overhaul and polish the Underdark")

Changes the HISTORY.md sections "The Underdark" (most of it), "The news bubble" (a line from below gets a way to look
below) and "Sounds that match" (a rumble for a cave-in, a rush for a flood). New state is optional (`Underdark.depth`,
`deeps`, `descend`, `marks`, `search`, `tally`; `GameState.watchingUnderDepth`); a town that already has an Underdark
carries on. New randomness is on the `${seed}:under:...` side streams. The save version is unchanged.

### What was weak (played before any change: the late fixture given a mine, and a dwarves town)

- **A diagram, not a place.** The view painted every open cell with the same square dungeon-brick floor tile and every
  rock cell with one rock tile, so the caves read as a grid of boxes. The unseen was not black: the crystal-cave
  backdrop showed through it at full size, so the "fog" was a picture of a different cave. A label at the top edge was
  cut off. Nothing moved: no miners, no cave folk, no creatures; the only life was a breathing glow.
- **The camera fitted itself.** It zoomed to the box of what was seen, so a dwarf hold opened on a few huge tiles; no
  pinch, no wheel, no tap. The places had names but no card: nothing said what a place gives or what lives there.
- **The dwarves found nothing.** The hold's hallway cut straight to the *nearest* open cave, which was often a shore
  walled off from the rest by the lake: in the save above the dwarves were "through" on day 2 and had found 0 places by
  day 12. Any mine could break into such a pocket too (the breakthrough was any open cell).
- **No bite.** A 40-day soak (below) had 0 cave deaths for every origin. "Taken" and floods only struck at night, when
  nobody is down the mines; the dwarves have nobody working the hallway at all; cave-ins come only from cutting.
- **What the sim did that nobody could see:** the trains of goods (a news line only), the envoys, the feuds between cave
  towns (a line in the bar), a cave town falling, the floods (the digging stopped, but the miners went on "working"
  the mine above), the night raids (they simply appeared at the shaft).
- **Nothing deeper.** Once the upper caves were scouted (a few days) the Underdark was finished: a fixed daily trickle
  of mushrooms, fish and a gem, and trades.

### The fix for the stuck dwarves (sim/underdark.ts)

`caveNetwork(u)`: the open ground joined to the places. The breakthrough (`checkThrough`), the cutting's goal and a
hallway's passage (`nearestNatural`) now aim at the network, never a pocket off it. A town saved stuck in a pocket gets
its passage cut on to the network the next hour (`reconnect`, told once).

### The deeper depths (data/underdark.ts `UNDER_DEPTHS`, sim/underdark.ts)

Three depths below the upper caves, each its own 48 x 48 map made from the seed (`depthMap(seed, n)`, side stream
`${seed}:under:depth:<n>`, never stored: only what's seen and found is, in `u.deeps[n - 1]`):

1. **The Deep Roads**: straight two-wide roads between square halls. The Hall of Echoes and the Waystation (`hall`:
   90 coins, 300 study and 4 iron once, salvage trips), the Cold Forges (`forge`: 3 iron ore, 2 coal a dawn), the
   Silver Seep (`grotto`: a gem and 2 silver ore a dawn). Dweller: the Warden of the Deep Roads (`ud_road_warden`, a
   living statue). Comes up at night: `under_roads` (cave and crypt creatures, tiers 3 to 6).
2. **The Sunless Sea**: a great black water with pale shores. The Pale Strand and the Drowned Quay (`shore`: 4 fish and
   a pearl a dawn), the Pearl Grotto. Dweller: the Thing in the Sunless Sea (`ud_sea_thing`, a kraken). `under_sea`.
3. **The Magma Deep**, the bottom: rivers of fire. The Gold Vein and the Ember Seam (`vein`: 2 gold, a rare mineral a
   dawn) and **the Lost Hold** of the First Delvers (`hold`: 400 coins, 900 study, 25 gold, 12 gems, 6 rare minerals
   once). Dweller: the Sleeping Wyrm (`ud_sleeping_wyrm`, a copper dragon tinted red); slain, its hoard and **the
   Heartvein** (`HEARTVEIN`: 3 gold, 2 gems, a rare mineral every dawn after). `under_magma` (fire creatures, 3 to 7).

The stair down to the Deep Roads is under the upper caves' ruins: once they're found and reached the scouts search
them `DESCEND_HOURS` (72) and open depth 1 (`openDepth`, told). Each depth's scouts see `explore` cells an hour (4, 3,
2.5) and lose one of the town's people at `lost` an hour (0.004, 0.006, 0.008) while there's still dark to scout. A depth
has a lair (`l` cells) and, but the bottom, a stair (`x`). The next depth opens only when the dweller is slain **and**
the stair found. Nothing below the upper caves is sought by a town of fewer than `DEEP_PEOPLE` (8).

The dwellers are slain the usual hands-off way: a found place below is a trip (`under:d<n>:<site>`, `parseDeepDest`,
`deepDestination`), and the lair's trip is a `clear` with the dweller itself among the foes (`recommendedParty` 6). A
party home from it cleared (`underHome`, called from expeditions.ts beside `portalHome`) slays it, brings up its
`hoard`, and the lair stops being a trip. Until it's slain, each night hour `stir` (0.0012, 0.0012, 0.0008) it comes up
the shaft itself at the head of its depth's creatures (`startRaid` with `leader` the dweller). The night's "things from
the dark" come from the deepest depth open (its `rise` kind, `riseShare` 0.6 to 0.8 of a raid's budget), worse the
deeper the town has gone. The bosses are in `DWELLERS` (merged into `ENEMIES`), the raids in `DEPTH_RAIDS` (merged
into `RAID_KINDS`, weight 0), the trips in `DEEP_TRIPS`.

A fallen cave town is left as ruins a party can pick over (`fallenTownDestination`: salvage, 1.5x its goods, ghouls
and rats).

### Danger that bites (sim/underdark.ts `dangers`)

- "Taken", floods and lost scouts strike every hour (by day `DAY_DANGER` 0.4 of the night's odds), not only at night;
  `TAKEN` 0.004 to 0.006. A scout can be lost in the upper caves while they're still being scouted (`UPPER_LOST`
  0.003 an hour). All gated as before (`DANGER_DAY`, `DANGER_PEOPLE`).
- Someone taken: the thing (`TAKERS`: a giant spider, rock worm, dire rat, basilisk or bugbear) is marked dragging them
  off to a dark cell, and a search party goes down after them (`u.search`); `SEARCH_HOURS` (3) later it comes back
  (`searchHome`) with a boot and tracks, or (`SEARCH_DEN` 0.35) the thing's den: `DEN_GOODS` and the cells round it seen.
- A flood drives the miners out: `underFlooded(s, b)` keeps a flooded way down off the work list (farming.ts
  `mineToWork`, people.ts `ownWork`) and ends a miner's shift there (`workMine`), until it drains.
- Everyone the Underdark kills is counted (`lostBelow`), with the cave-ins, floods, raids up the shaft and dwellers, in
  `u.tally` (`tallyOf`), beside the goods and coins it gave and the trades.

### Seen (renderer/underdark/underdarkView.ts, rewritten)

- **The cave**: the undead tileset's cave floor (cobbled where the town or a cave town worked it), the Mine Tileset's
  stony rock edges chosen by which sides face open ground (`rockPiece`), black deep rock, the undead tileset's jagged
  cliffs hanging where rock overhangs the floor, cracks and stalagmites strewn about (`art/under/rock_edges.png`,
  `ground.png`, `cliff.png`, `details.png`; credited). The water runs and glints, the magma bubbles.
- **Dark with light**: a light map (a pixel a cell, smoothed, multiplied over it all: `paintLight`), each light's reach
  by `falloff` from sim/lightField.ts and stopped by rock (`clear`): the ways down, torches along the town's cuttings and
  down a hold's hallway, the glowmoss, the crystals, the magma, the cave towns' lamps, the under-village's fire, the
  deeper places' own (a forge's embers, the Lost Hold's gold, a lair's dull red). By day the main shaft lets daylight
  down. The glows breathe and flicker on top; the crystals sparkle; glowmoss motes drift.
- **The unexplored**: black, with the open ground beyond drawn as a faint outline (`,` cells in `underView`).
- **Life**: the miners walking a load from the rock face to the shaft and swinging their picks (dust), the scouts with
  their lamps at the edge of the dark, the under-village's houses round its fire and its folk about them, each cave
  town's folk on patrol (the deep gnomes, the Umbral Court and Greyhold as Himeko paper dolls of their own looks, the
  Sporemoot as sporelings), two towns at feud fighting at the border halfway between them (sparks), a fallen town's
  houses burnt black and smoking, creatures prowling the unlit tunnels (more at night), and the marks (`u.marks`, kept
  `MARK_HOURS` 6): a train of goods or an envoy walking up from its town to the shaft, a creature dragging someone off
  and the search party's torches going after them, a cave-in's dust (the screen shakes), a flood over the town's
  cuttings, a dweller walking up to the shaft, a horde streaming up to the shaft's mouth while a raid from below is on.
- **Camera**: starts on the town's workings (or a depth's stair foot); drag, pinch (main.ts `underTouches`) and the
  wheel zoom about the fingers (`zoom`); a tap (`tap`) shows the place's card in the view (`.uh-card`): what it is, how
  it stands, what it gives, what lives there, and "Trips below…".
- **The bar**: ▲ ▼ between the depths opened (command `watchUnder` takes `depth`, checked 0 to 3; `watchingUnderDepth`),
  a depth's scouting and dweller, the stair search, a search party out, and the tally.
- **The Trips tab** (`panel/underSection.ts`, called from expeditionsPanel.ts in the "Below the town" place, with its
  key `underKey`): each place and depth with its goods' pack icons (`stockIcon`), the cave towns, the under-village, the
  tally, the news, "Look below", and the trips below.
- **The news bubble** (mobile/notices.ts `BELOW`): a line from below gets a ⛰ (☠ for a death) and a "Look below" action.
- **Sound** (sfx.ts `globalPart`): a rumble when the tally's cave-ins go up, a rush for a flood.

### Tools

- `tools/under-soak.mjs [days] [seeds] [origins]` (`MINE=<day>` gives a town with no way down a mine; `fixture` as an
  origin runs the late fixture): people, deaths, cave deaths, finds, goods up, trades, raids up, the depth reached.
- `tools/under-saves.mjs <dir>`: saves with the Underdark open for the browser (the fixture with a mine, a dwarves
  town).

Tests: `test/underdark.test.ts` (eleven new).

The three dwellers each carry a unique (data/uniques.ts, as the cave lords do): the Warden's Fist (a mace), the Sunless
Tine (a spear), Wyrmheart (a greatsword).

### Balance: 40-day soaks, 3 seeds (`tools/under-soak.mjs`; before = main, after = this branch)

Averages. "Cave deaths" are the town's people killed below (cave-ins, the taken, the drowned, lost scouts). "Goods" before
is an estimate from each dawn's yields (main kept no tally; it leaves out the cave towns' trades), after the tally.

| Town | People | Deaths | Cave deaths | Raids up the shaft | Goods up | Trades | Depth reached |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dwarves, before | 5.7 | 5.3 | 0 | 1.0 | ~437 | 18 | upper |
| Dwarves, after | 4.3 | 7.0 | 0 | 1.0 | 631 | 18 | Deep Roads in 1 of 3 |
| Knights + a mine on day 6, before | 8.0 | 3.7 | 0.3 | 1.0 | ~368 | 9.7 | upper |
| Knights + a mine on day 6, after | 7.3 | 4.7 | 0.7 | 1.7 | 499 | 9.3 | Deep Roads in 2 of 3 |
| Settlers + a mine on day 6 | 9.7 | 8.0 | 0 | 0 | 111 | 2.3 | (2 of 3 never broke through: identical before and after) |
| Late fixture + a mine, 20 days, 2 seeds, before | 48 | 23 | 0.5 | 0.5 | ~228 | 2.5 | upper |
| Late fixture + a mine, 20 days, 2 seeds, after | 44 | 22 | 2.0 | 1.5 | 235 | 3 | Deep Roads in both |

Most 40-day towns are hamlets (1 to 10 people), under `DANGER_PEOPLE`, so the caves seldom bite them; a town of a size
(the fixture) loses two or three below in 20 days and sees the river flood twice. No dweller was slain in 40 days: the
deeper depths are a long game (the first opens some 3 days after the ruins are found, in a town of 8 or more). The
dwarves' seed 1 ended 6 people to main's 10 with no cave deaths: the town's own play diverged (more goods, the Deep
Roads opened), not a death below.

### Sim hashes (`tools/sim-hash.mjs`)

Only the dwarves' changes (`9c9150e6581b` to `9c099d5be6b2`): their hallway now opens onto the caves' network. The
fixture, settlers, knights and vampire hashes are unchanged (no Underdark within six days); main at 0.133.0 hashes as
main at 0.129.0.

### Speed (`tools/perf-sim.mjs`, now with `SAVE=` and `UNDER=1`)

The fixture: step 1.03 ms, snapshot 4.68 ms (main 1.05 / 4.85). A fixture town with all three depths open and the view
watched: step 1.81 ms, snapshot 4.85 ms, against 1.75 / 4.20 for the same town with neither; `underdarkHourly` 1.1 ms an
hour, `underSummary` 0.16 ms and `underView` 0.24 ms a snapshot. A dwarves town with the view open: 0.41 / 2.61 ms.
