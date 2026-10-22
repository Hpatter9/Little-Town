## Hand-made maps of the special places: the pipeline

The owner's ask, after the hand-made raid boards (docs/notes/raid-boards-ldtk.md): hand-made maps for the game's special
places, made the same way (an LDtk project the owner can open and edit, a converter to the compact data the game
imports, a test that the two never drift, the generated version kept as the fallback) and dressed with real character.
Done in phases: the dungeons' floors first, then the story places, the scenarios' starting valleys and the buildings'
rooms.

**One converter for every kind.** `sim/handMaps.ts` says what a kind of map reads (`MapKindSpec`: its LDtk project and
data file, its IntGrid layers with the char each value's identifier is written as, its entities and their fields, and
its level fields) and holds the shape every kind's data has (`HandMap`: `id`, `w`, `h`, `fields`, `grids` as rows of
chars, `things` as `[u, v, entity, ...fields]` in reading order), with `gridPath` (a shortest way by the four sides).
`tools/ldtkMaps.ts` (`mapsFromLdtk`, `mapsSource`) is the one converter: it reads values by their identifiers (so they
may be reordered in the editor) and checks every enum value and level field. `node tools/ldtk-maps.mjs` remakes every
data file from every project under `maps/` (the raid boards too, through their own `tools/ldtkBoards.ts`; `node
tools/ldtk-maps.mjs delve` for one); `tools/handMapKinds.ts` lists the kinds. Nothing parses LDtk at runtime.
`tools/ldtk-boards.mjs` still works for the raid boards alone.

## The dungeons' floors, drawn by hand

A delve (sim/delves.ts, HISTORY "Dungeon delves", "Dungeon types") was a list of rooms rolled as the party set off, seen
side-on. Now nine floors are drawn in `maps/delve-floors.ldtk` (16px cells, 30 to 36 by 20 to 28; LDtk shows them in the
game's own tiles), and the watcher sees the floor as a map. This changes HISTORY "Dungeon delves" (the rooms) and
"Watching a party's fights" (the delve's map in the corner).

**The format** (`FLOOR_SPEC` in `sim/delveFloors.ts`):
- **Ground** (IntGrid): `floor`, `rough` (corridors, rubble-strewn floors), `carpet` (the red rug, laid by its
  neighbours), `water` (shallow, waded), `deep`, `chasm`, `lava` (none walked), `bridge`, `door`, `secret` (a secret
  door: drawn as wall until the party has gone through it), `ice`, `stairs`, `wall`. An empty cell is solid rock: the
  walls are drawn wherever rock meets open ground, deeper rock is black. `FLOOR_GROUNDS`.
- **Things** (Entities): `Room` (`kind`: entry, fight, trap, treasure, shrine, puzzle, camp, fork, boss; `step`: the
  order the party goes through them, 0 the way in) at each room's middle, and `Prop` (`kind`, `FLOOR_PROPS`: torches,
  braziers, candles, chests, gold, coffins, bones, skulls, statues, altars, barrels, crates, tables, chairs, shelves,
  webs, banners, pillars, crystals, mushrooms, rocks, graves, cages, a throne, spikes, darts, pressure plates, levers,
  beds, camp fires, roots, a portcullis, rubble, lanterns, a blood altar). Low props (`FLOOR_LOW`: bones, spikes, webs,
  rubble...) are walked over; the rest stand in the way.
- **Level fields:** `name`, `about`, `look` (crypt, cave, mine, temple, ice, forge, tower, fey, vault, wreck: its walls
  and floors) and `types` (the dungeon kinds it's a floor of).
- The rooms' kinds follow a delve's: a fight first, a camp before the boss, the boss last.

**The floors** (`docs/notes/hand-made-maps/floor-*.png` drawn whole by `node tools/floor-preview.mjs`, rooms numbered
and the party's way dotted):
- **The Bone Stair** (crypt; crypts and temples, 9 rooms): the hall of the dead, a trapped gallery with a secret door
  down to a vault, a chapel, the ossuary, a fork with a blind way, the sealed door, and the barrow lord's throne hall.
- **The Drowned Nave** (temple; temples and crypts, 10): a flooded nave of pillars and black pools, four chapels off
  its aisles (treasury, trapped reliquary, shrine, puzzle door), a split stair, and the undercroft.
- **The Gnawed Burrows** (cave; warrens and nests, 9): clay chambers and crooked runs, a snare run, the brood's hoard.
- **The Old Workings** (mine; mines and dens, 11): drifts between galleries, a rockfall run, a stope over a chasm
  crossed on a plank bridge, a crystal grotto, and the long bottom gallery.
- **The Rime Galleries** (ice, 10): ice floors, a frozen mere holed where it broke, crystal grottoes, the deep cold.
- **The Cinder Halls** (forge; forges and dens, 12): halls either side of a river of lava crossed by three bridges
  (one strung with dart traps), the smithies, a blood altar, and the forge-hall with its own lava pits.
- **The Root Hollow** (fey; the fey and nests, 10): green chambers walled with roots, a fairy ring, still pools, a
  thorned run, and the bower.
- **The Leaning Stair** (tower, 11): rooms round a stairwell (a chasm): the hall, the library, the warded door, the
  workroom, the vault, the trapped gallery, the chapel, and the study on a dais over the well, reached by a bridge.
- **The Merrow's Hold** (wreck, 7): the wreck's decks between bulkheads, her bilge awash with a run of planks, holes
  stove in her bottom, and the captain's cabin.
Vault Nine (the machines' vault) has no floor drawn: its delves are always laid out from their rolled rooms.

**In the sim** (`sim/delveFloors.ts`, the only sim change: picking and loading). `startDelve` asks `pickFloor(s, e, d,
count)` before rolling: a floor drawn for the dungeon's kind whose rooms are within `FLOOR_ROOM_SLACK` (2) of the
dungeon's (`floorsFor`), picked `HAND_FLOOR_SHARE` (0.75) of the time from the side stream
`new Rng(hashSeed(`${s.seed}:delveFloor:${e.id}`))`: neither the town's stream nor the delve's own dice are drawn on
(the delve's later rolls, its rival, boss and twist, still come from its own). Never with the autopilot off. A floor's
rooms are the delve's (`floorKinds`); a rival party still takes the middle room. The delve keeps the floor's id in the
new optional `Delve.floor`, and its log says which floor they went down by. Old saves and delves in progress load: no
floor, and their map is laid out from their rooms.

**The fallback.** `generatedFloor(kinds, seed, look)` lays a floor out from rolled rooms: chambers in a winding chain,
each dressed for what it is (a chest and gold in a treasure room, an altar and candles at a shrine, a camp fire and a
bedroll at the camp, bones and a brazier in the boss's), joined by corridors, nothing left standing on the way. Seeded
by the trip (`hashSeed(`delveFloor:${expedition}`)`), so the same each time; drawn in the dungeon kind's look
(`LOOK_OF_TYPE`). Every delve has a map.

**The map** (`renderer/delve/floorMap.ts`, `floorArt.ts`): in the top right of the watched delve's screen (half the
width upright, under a third sideways, never over the bottom windows), the floor round the party from above, the camera
following them. Black where they haven't been, dim where they have (a room shows whole once they reach it), their
torches lighting the cells round them, less as the torches run low (the glow is warm and flickers). They stand at the
room's thing while the side view has them stopped, then walk the way to the next; a red ring while they fight. Water
ripples and fires flicker (DawnLike's two frames). The snapshot's `delve` has new `floor`, `plan` (its rooms) and `look`.
`floorArt.ts` (pure) says what's laid: each look's DawnLike wall pieces by their neighbours (art/autotile.ts), floors,
the rug's nine pieces, liquids with a lip where the cell above isn't the same, bridges over what they cross, doors
(stone for crypts and temples, iron for the vault), stairs, props (a pillar is the look's wall post).

**The art.** `src/renderer/art/floors/tiles.png` (256x256, 247 tiles) and `tiles.json` (names to cells), cut from
DawnLike by `python3 tools/compose-floor-art.py` (its tables name each tile's source); credited in CREDITS.md. The LDtk
project points at the same sheet (`../src/renderer/art/floors/tiles.png`), so the editor shows the game's tiles.

**Previews.** `__delve('barrow_crypt', 'The_Bone_Stair')` in the phone page's console sends a party (the first four
grown, healed, their melee raised to 60) down that dungeon by that floor ('rolled' for a laid-out one), arriving at
once; `__game.command({ type: 'watch', expedition: id })` watches it. `floorPreview` (sim/delveFloors.ts) is never set
in play.

**Screenshots** (`docs/notes/hand-made-maps/`): `delve-*-tall.png` each floor in a delve at 393x852 (and
`delve-the-cinder-halls-wide.png` at 852x393), `delve-rolled-vault-tall.png` a laid-out floor in Vault Nine.

**Tests** (`test/delveFloors.test.ts`): the data is the converter's make of the project; values reordered in the editor
give the same data; the project is LDtk 1.5 JSON with the game's own lists in its enums; every floor's rooms are a
delve's, on open ground, each reached from the one before round what stands in the way; props on open ground, one a
cell; every floor fits a dungeon; every tile drawn is in the sheet, and a secret door is wall until found; laid-out
floors for sixty rolled delves are whole and the same each time; the pick is deterministic, about three in four, never
from the town's stream, never without the autopilot or for a dungeon with no floor; a delve sent down a floor takes its
rooms.

**Adding a floor in LDtk.** Open `maps/delve-floors.ldtk` in LDtk 1.5, duplicate a level (or add one in 16px cells),
paint the Ground, put a Room at each room's middle numbered by `step` (0 the way in, a fight first, a camp before the
boss, the boss last), dress it with Props, and fill in the level's fields. Save, run `node tools/ldtk-maps.mjs`, then
`npm test -- delveFloors`, and `node tools/floor-preview.mjs` to look at it.

## The story places, drawn by hand

Six places a trip comes to are drawn in `maps/story-places.ldtk`, in the dungeon floors' format (the same Ground
layer, Room and Prop things, and tiles: `STORY_SPEC` in `sim/storyPlaces.ts`), and the watch screen shows the party
going through the place in the same corner map. This changes HISTORY "Watching a party's fights" (the map), and touches
no rule: nothing is saved, and the trips play out as before.

**What's new in the format.** Out-of-doors grounds (`grass`, `dirt`, `sand`, `snow`; `FLOOR_GROUNDS`), looks seen in
daylight (`castle`, `ruin`, `camp` with DawnLike's wooden palisade for its walls, `grove` walled with hedges;
`openAir`), and props (`tree`, `pine`, `deadtree`, `snowpine`, `bush`, `flowers`, `peak`). The level fields say which
trips come to a place: `dests` (destination ids, or the start of one ending in a colon), `words` (words in the
destination's name: a saga's "The camp of Black Maud") and `kinds` (the kinds of place on the land, data/places.ts).
Its Rooms are the spots the party makes for, numbered from the way in (0), one of them the boss's spot.

**The places** (`docs/notes/hand-made-maps/place-*.png` drawn whole by `node tools/floor-preview.mjs`):
- **The Dragon's Lair** (`dragon:lair`, or "dragon" in the name; underground): the goat path up through the pines, the
  scorched mouth and ledge, a gallery cracked with lava, the great cavern of gold and bones, and the hoard's heart.
- **The Ruined Keep** ("keep", "halls", "tower", "ruin", "workshop", "works"; the land's old ruins): the old road, the
  broken curtain wall, a courtyard of rubble, the tower's stump with its sealed door, the roofless great hall, the
  undercroft.
- **The Lord's Castle** ("lord", "castle", "tournament", "pretender", "manor", "court", "baron"): the road over the
  drawbridge across the moat, the gatehouse, the bailey and tilting yard, the chapel, the lord's hall, the treasury.
- **The Haunted Barrow** ("barrow", "crypt", "churchyard", "tomb", "cairn"; the land's great bones;
  underground, so the churchyard is seen by torchlight too): open graves under dead trees, the barrow's sealed door, a
  passage of coffins, a tomb behind a secret door, the burial chamber.
- **The Bandit Camp** ("camp", "hideout", "trail", "road", "bandit", "deserter", "robber", "outlaw", "brigand"; a
  robbed cart's robbers): the forest track, the pickets at the stockade's gate, fires and bedrolls, a cage, the stash,
  the chief's fire.
- **The Woodland Shrine** ("clearing", "grove", "shrine", "oracle", "well", "witch", "pasture", "huntsman", "glade"):
  the track under the trees, the old oaks, a ring of standing stones about an altar, the still pool, the great tree.
Eighteen of the sagas’ 27 trips come to one of them; the rest (a wolf's den, the drowned chapel, the ghost ship...) and
every other trip keep the watch screen as it was.

**Picking** (`storyPlaceOf(s, trip, name)`, pure): the places that fit the trip's destination (`placesFor`); among
several, the 'storyPlace' side stream (`new Rng(hashSeed(`${s.seed}:storyPlace:${trip.id}`))`) picks, so a trip is
always seen at the same one and nothing else is drawn on. The snapshot's expedition has a new optional `place` (its id).

**On the watch screen** (`delve/floorMap.ts`: `mapWatchOf` now gives the map of a delve or of a story place, as a
`MapWatch`; `placeWatch`): the last quarter of the way out (`PLACE_NEAR`) is walked through the place spot by spot to
the boss's spot, where they fight on arriving (a red ring while they do); while they're there afterwards they go on to
the spots past it. Out of doors it's all in daylight; the lair and the barrow are dark but for the party's torches.

**Previews.** `__storyPlace('Bandit_Camp')` in the phone page's console shows every trip at that place, and sends a
party (as `__delve`'s) to a robbed cart a way off, four fifths of the way there; `__storyPlace()` stops it.
`storyPreview` is never set in play.

**Screenshots** (`docs/notes/hand-made-maps/`): `story-*-tall.png` each place on the way in at 393x852,
`story-lords-castle-wide.png` at 852x393; `place-*.png` the places whole.

**Tests** (`test/storyPlaces.test.ts`): the data is the converter's make of the project, which is LDtk 1.5 JSON; the
six places, each walked from the way in to every spot in turn, props on open ground one a cell, every tile in the sheet,
four in daylight; trips are matched by destination, words and the kind of place (a dragon's lair, five sagas' places,
a robbed cart, old ruins; a cave and a wolf's den by none), at least half the sagas' trips come to one; among several
places the pick is the same for a trip, either by the trip, and never draws on the town's stream.

## The starting valleys, drawn by hand

Four starting valleys are drawn in `maps/start-valleys.ldtk` (48x48 cells a valley, a cell a land cell), and a town
founded from the New town panel may start in one, laid over the land the seed makes round its camp. This changes HISTORY
"The wide land" (`makeLand`) and "Mountains in every land" (the relief), and the founding (`newGame`).

**The format** (`VALLEY_SPEC` in `sim/startValleys.ts`): **Ground** (IntGrid: the land's own grounds, written as the land
writes them, `VALLEY_GROUNDS`; an empty cell keeps the land's own, so each valley's edge is frayed into the land round
it), **Relief** (IntGrid: level, downs, rocky, high, ramp, range, `VALLEY_RELIEF`; empty is level where the valley lays
ground), **Things** (one `Camp`, laid on the land's camp cell; `Landmark`s, `LANDMARK_KINDS`: old walls, ruins, pillars,
a statue, a well, boulders, bones, a skeleton, stumps, reeds, flowers, an old cart, a signpost), and the level fields
`name`, `about`, `biomes` (the lands it's a start in) and `scenarios` (data/founding.ts; none: any).

**The valleys** (`docs/notes/hand-made-maps/valley-*-tall.png` in the game at 393x852, `valley-old-ruin-wide.png` at
852x393):
- **The River Valley** (forest, steppe, jungle, taiga, swamp, highlands): a river down the west side with a ford by an
  old signpost, rich banks, a wood on the rising ground east, rocky hills north.
- **The Old Ruin** (forest, steppe, highlands, desert, ashlands, taiga; lone, band and supplied starts): the ring of a
  town that was here before, stretches of its wall still standing (drawn along their runs), the rest rubble to quarry,
  old foundations, its gate's pillars, a statue, a well, the wild come back inside.
- **The Mountain Shelf** (highlands, taiga, tundra): a level shelf under a range, a stream down from it to a tarn, high
  ground east climbed by a ramp, downs falling away south.
- **The Coastal Cove** (coast): a cove between two headlands, sand and shallows, a stream to the beach, a wood behind.
Each keeps an open, level meadow round the camp and at least `MIN_KIND_NEAR` of every wild kind within `OPEN_START`, so
nothing the land does afterwards changes a cell of it.

**In the sim** (land-making and founding only). `newGame` with the new `NewGameOptions.valleys` (set by the New town
panel and the first launch in `shared/simHost.ts`; the tests' towns leave it out, so they're on the seed's own land as
before) asks `pickValley(seed, biome, scenario)`: the valleys for the land and scenario (`valleysFor`), picked
`HAND_VALLEY_SHARE` (0.6) of the time from `new Rng(hashSeed(`${seed}:valley`))`, never for a hold or a shore town (they
have their own shapes). `NewGameOptions.valley` names one (previews, tests; `VALLEY=` in tools/make-save.mjs). `makeLand`
takes it: `layValley` lays its ground after the land's rivers, shores and the camp's clearing (and carries water that
runs off its edge, more than `RUN_CORNER` from a corner, on to the land's edge, wandering and banked); the wild kinds
near the camp, the pools and the relief are made as on any land; then the valley's ground is laid again where the
relief changed it (pools filled on its own stream, `${seed}:valley:pools`) and its relief over the land's
(`layValleyRelief`). The town keeps `GameState.valley` (optional; older towns have none), and the snapshot has it.
Regions, places, fog and where the town puts things are worked out as for any land.

**On the map** (`iso/isoView.ts`): `setValley` reads the valley's landmarks (`valleyLandmarks`) and draws each with a kit
piece (`LANDMARK_PIECES`: the raid boards' `wild/` ruins, pillars, statue, bones, stumps, reeds and flowers, the
settlers' stone wall, well, cart and signpost, the dwarves' boulders) in place of the cell's scenery, while the cell's
ground is as the valley left it and nothing is built on it; a stretch of wall is mirrored to lie along its run.

**Tests** (`test/startValleys.test.ts`): the data is the converter's make of the project, which is LDtk 1.5 JSON with
the game's own lists; each valley has one camp in an open, level meadow, its range on mountain rock, its ramps leading up,
landmarks on its own ground, its edge frayed; laid on each of its lands it stands as drawn, every wild kind near the
camp, every wild cell holding something, and most of the wide land walked to; the pick is the seed's, about 0.6, by
land and scenario; the tests' towns have none; a town founded in one keeps it, has the founder its seed makes, its
camp where it was, regions, and spots found for its first buildings; a hold and a shore town never have one.

## The buildings' rooms, furnished by hand

Seven rooms are furnished by hand in `maps/rooms.ldtk` (16px cells, a cell a floor tile; the back wall is drawn above
the top row), and a building looked into (`Look inside`) is furnished as the room drawn for it. This changes HISTORY
"Inside every building" (interior/interiorView.ts); no rule changes, nothing saved.

**The format** (`ROOM_SPEC` in `renderer/interior/handRooms.ts`; the data is `data/interiorRooms.ts`): **Floor** (IntGrid:
planks, the default; flagstones; the red rug, laid by its neighbours from DawnLike's nine rug pieces), **Things**:
`Furniture` (`FURNITURE`: beds, chairs (`chair_r` faces the other way, `chair_up` from behind), tables round, plain and
long (three cells), the throne, candles, a candelabra, shelves, bookshelves, a cupboard, desks, the cross, pots, barrels,
crates, chests, the gold, racks of weapons, shields, potions, plants, jars, a book, a stool, a tall shelf, a grey rug;
DawnLike's decor cells and the dungeon packs' clutter the view already drew with), standing on the bottom of its cell;
`Spot` (`bed`, `station`, `desk`, `seat`, `hearth`: where the folk go, as the view's own layouts have them) and `Fire`
(a furnace or a brazier). Level fields: `name`, `about`, `kinds` (what kind of room it is for: map/roomKinds.ts's, and the
view's temple and barracks) and `defs` (buildings it's for by id, before any kind).

**The rooms** (`docs/notes/hand-made-maps/room-*-tall.png` in the game at 393x852, `room-tavern-wide.png` at 852x393;
the townsfolk sheltering from the rain sat at their places):
- **The Common Room** (the brewery): the bar with its kegs and stools, the hearth and its rug, a long table, a round one.
- **The Town Hall** (every people's seat, the town hall): flagstones, a red runner to the founder's chair, the
  strongboxes and the gold, bookshelves, the council's long tables.
- **The Shop** (the market hall): shelves, jars and potions along the back, the counter with two places behind it,
  crates, barrels and a chest of stock.
- **The Smithy** (every forge: the smithy, bloomery, kiln, armourer, gunsmith...): the furnace, racks of blades and
  shields, the quench barrel, a bench, three places to work.
- **The Chapel** (the temple, the cathedral): the aisle up to the cross, candles, eight pews.
- **A Cottage** (homes of up to three): three beds, the hearth, a table and two chairs on a rug.
- **A Longhouse** (homes of up to six): six beds down both walls, the fire in the middle, the long table.

**Picking** (`handRoomFor(def, kind, beds, building)`, pure): the rooms for the building by id (`defs`), else by its
kind (`roomsFor`; a home's only with a bed spot for everyone who sleeps there); the smallest that does, and among those
the building's own id picks (`hashSeed(`room:${building}`)`), so a building is always the same room. None (a study, a
block of flats, a barracks...) is furnished as it always was (`layout`): the fallback.

**The drawing** (`interior/interiorView.ts`): `handLayout` turns the room into the view's own `Layout`: its pieces
(`FURNITURE_PIC`), its beds, stations, desks, seats and hearth, its fire, and its floor drawn cell by cell. The folk go
to those spots as they go to the generated rooms' (asleep in the beds, at the stations working, reading at desks, at the
seats and the hearth, the rest about the floor).

**Left for the owner.** The inns (the Fireside Inn, the Tavern) and the shops (the Trading Post, the General Store and
the specialty shops) have no `Look inside`: their own window shows them, furnished piece by piece with what the town
buys (and `test/interiors.test.ts` keeps it so). So the hand-made Common Room and Shop name them in their `defs` but are
seen at the brewery and the market hall. If the owner wants the inns' and shops' own windows drawn from these rooms (or
a `Look inside` on them as well), that's a change to the venues' window (panel/shopPanel.ts).

**Previews.** `__room('Tavern')` in the strip's console (the iframe's window) furnishes every building looked into as
that room (`roomPreview`, never set in play). `HOME_DEF=longhouse` in tools/make-save.mjs builds a home at the start
with everyone's bed in it.

**Tests** (`test/interiorRooms.test.ts`): the data is the converter's make of the project, which is LDtk 1.5 JSON with
the game's own lists; every room fits the screen, one piece a cell, a long table on the floor, somewhere for its folk, at
most one fire, a home's bed spots on its beds, every building it names real; the brewery, the market, the town hall,
every seat, the smithy, the temple, a cottage (three beds) and a longhouse (six) get their rooms, a block of flats and a
library the old layouts, each a building the town can look into; the pick is the same for a building each time.

## The whole of it

`node tools/ldtk-maps.mjs` makes every hand-made map's data (raid boards, floors, story places, valleys, rooms) from
`maps/*.ldtk`; `node tools/floor-preview.mjs` draws the floors and story places whole; `python3
tools/compose-floor-art.py` cuts the DawnLike sheet every one of them (and the LDtk editor) draws with. The scratch
authoring scripts that first laid the maps out are not kept: the LDtk projects are the maps now.
