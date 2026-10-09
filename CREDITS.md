# Credits

## Character sprites

Townsfolk are assembled from layers of the **Universal LPC Spritesheet**, built from Liberated Pixel Cup
entries (lpc.opengameart.org). The layers are dual licensed **CC-BY-SA 3.0** and **GNU GPL 3.0**.

- Per-layer authors: [assets/lpc-credits/AUTHORS.txt](assets/lpc-credits/AUTHORS.txt) and
  [assets/lpc-credits/CREDITS.txt](assets/lpc-credits/CREDITS.txt)
- Licence texts: [assets/lpc-credits/cc-by-sa-3.0.txt](assets/lpc-credits/cc-by-sa-3.0.txt),
  [assets/lpc-credits/gpl-3.0.txt](assets/lpc-credits/gpl-3.0.txt)

The layer data (`src/renderer/art/lpc/lpcData.json`) was imported from the Little Wayfarers project with
`tools/import-lpc.mjs`; it is recoloured in code. The skeleton body and the red eyes (worn by some of the ready-made
founders) were added from the same spritesheet (`body/male/skeleton.png`, `body/*/eyes/red.png`; authors as listed in
its AUTHORS.txt).

## Creatures

Wolves, boars and the Cave Bear use **whtdragon**'s RPG Maker MV animal sprites
(`src/renderer/art/creatures/`, copied from the Little Wayfarers assets). The pack folder has no licence file:
check whtdragon's posted terms of use before any public release.

## Craftpix packs (the bestiary)

The foes and bosses in `src/shared/data/bestiary.ts` are drawn from free **Craftpix.net** packs (craftpix.net,
free licence: use in games allowed, no redistributing the raw files). `tools/compose-sheets.cjs` builds one small
sheet per creature (`src/renderer/art/creatures/packs/`) from the packs kept in the private assets repository:
Free Werewolf, Gorgon, Minotaur and Satyr Sprite Sheets; Free Forest Bosses; Free Samurai, Ninja, Wizard, Robot,
Knight and Skeleton Sprite Sheets; Free Yokai Character Sprites; Free Tiny Hero Sprites; Free Enemy Pixel Pack for
Top-Down Defense; Free Fantasy RPG Top-Down Boss Creatures (Boar King, Devil Leader, Shaman King) and Pirate Boss
Characters (Pirate Leader, Pirate Zombie, Squidman).

## Craftpix magic effects (spells and skills in fights)

The spells' and skills' effects in the watched fights and on the raid's battle map (`src/renderer/art/effects/mg_*.png`
and `slash_*.png`, built by `tools/compose-effects.cjs`) are from **Craftpix.net**'s free Pixel Magic Sprite Effects pack
and free Magic Slash Effects pack.

## Craftpix dungeon props (the hold's rooms)

The barrels, crates, jars, chests, heaps of gold, shields, stools, tables, desks, shelves, potion racks and books set
about a hold's rooms (`src/renderer/art/clutter/`) are cut from **Craftpix.net**'s free 2D Top-Down Pixel Dungeon pack
and free Pixel Dungeon Props and Objects pack; the flickering candles are the former's candle animation, and the wall
torches and braziers its fire animation (already in `art/delve/fires.png`). https://craftpix.net, free licence.

## Craftpix dungeon props (the watched delves)

The vampire castle's flagstone floor, its gate and the small arched door (`src/renderer/art/castle/`) are cut from the
2D Top-Down Pixel Dungeon pack's walls-and-floor sheet. The doors, chests, gate, wall torches and braziers seen down a dungeon (`src/renderer/art/delve/`) are from
**Craftpix.net**'s free 2D Top-Down Pixel Dungeon pack; the skull altar and the guillotine from its free Pixel Dungeon
Props and Objects pack.

## Craftpix interiors and tower-defence tiles

The shop's and tavern's furnishings (shelves of jars, glass cabinets, tables, planters, crates, rugs, the counters) and
the brick hearth's furnace (`src/renderer/art/interior/`) are from **Craftpix.net**'s free Glassblower's Workshop
top-down pack. The raid map's cobbled trail and the pads under the shooters' spots (`src/renderer/art/td/`) are from its
free Fields Tileset and Village Tileset for top-down tower defence. The Village Tileset's half-timbered houses and striped
awnings also stand for the medieval town's cottages, row houses, inn, trading post and stalls on the town map.
The rooms seen inside the town's buildings (`src/renderer/interior/interiorView.ts`) are furnished from **DawnLike**'s
`Objects/Decor0.png` by **DragonDePlatino** (beds, chairs, tables, shelves, candles, rugs, a throne:
`src/renderer/art/interior/decor.png`, CC-BY 4.0), and walled and floored from the Glassblower's Workshop pack's
`Walls_interior.png` (`src/renderer/art/interior/walls.png`, Craftpix.net free licence).

The shops' fronts on the town map (`src/renderer/art/shops/`) are cut from the Glassblower's Workshop pack's exterior
and interior sheets: its big timber house and small shop (the gable set on its walls), the red market canopy over the
trading post, the cloth awning (tinted to each shop's colours), crates, sacks, barrels, a wheelbarrow, a shelf of jars,
a potted plant and a vase; the armour store's helm is the Village Tileset's.
The town's roads on the map (`src/renderer/art/roads/`) are from its free Path and Road top-down pixel tileset: slabs,
cobbles, bricks and paving by era, laid a quarter-tile at a time. The plots' soil, the pens' rail fences and the town's campfire
(`src/renderer/art/fields/`) are from its free Fields Tileset for tower defence. The stone wall and gate, the library's bookshelves, the
healer's bench and the workbench on the town map are cut from its free 2D Top-Down Pixel Dungeon pack and Dungeon Props
pack (`src/renderer/art/village/dwalls.png`, `dprops.png`); the graveyard's stones from its free Undead Tileset
(`grave*.png`). The ground's detail on the map is the Path and Road pack's ground patches (`roads/ground_grass.png`), the
Fields Tileset's grass tufts, flowers and small stones (`fields/tuft*.png`, `flower*.png`, `pebble*.png`), and the Undead
Tileset's water ripples, recoloured to the water (`src/renderer/art/water/ripples.png`). More of the town's buildings on the map
are the packs' objects (`src/renderer/art/packs/`): the Village Tileset's well, carts, anvil, rack, log pile, bucket and
trade signs and its third timber house (the workshops), the Fields Tileset's logs, crate, stump and camp tents, the
Top-Down Cave Objects' fire pits, crystals, carved gates, skull altar, statue and totems, the Rocky Area Objects' cave
mouths, tipis and yurts (the nomads' homes), the Dungeon Props' glass tanks, shelves, desks, chairs and benches, the
2D Top-Down Pixel Dungeon pack's barrel and sacks, and the loose futuristic objects pack's tanks, transformer, consoles,
server racks and screens (the later eras' plants), with its lattice pylon (the radio tower), shuttered block (the
garage, the drone hub, the factory) and pipe run (the factory). The liches' and vampires' land takes the Undead Tileset's dead and
broken trees, thorns, pale weeds, bones, skull piles, rocks and crystals as its scenery (`src/renderer/art/props/undead.png`). The monster nests and the Calamity's heart (`src/renderer/art/nests/`) are
the Rocky Area Objects' cave entrance (the goblin warren), the Top-Down Cave Objects' webbed cocoon (the spider den) and
dark totem (the heart), and the Undead Tileset's skull door (the barrow) and pile of skulls; the ward stone is the Cave
Objects' white crystal.

## Craftpix cave objects (the Deep)

The things down in the Deep under the town (`src/renderer/art/deep/`: the glowing mushrooms of the fungus grottos, the
blue-green and white crystals of the geodes, the ruins' cathedral gates, statue, totem, demon skull and summoning circle,
the dinosaur and human skeletons, the boulders, the bonfire in the first chamber and the carved gates of the way down)
are from **Craftpix.net**'s free Top-Down Pixel Art Cave Objects pack; the shaft on the map is its carved gate with the
Village Tileset's rack and barrel, and the tunnels' torches the 2D Top-Down Pixel Dungeon pack's fire animation
(`art/delve/fires.png`). https://craftpix.net, free licence.

## Craftpix top-down objects (the raid map's scenery)

The trees, bushes, rocks, mushrooms, crystals, bones, idols, corals and shells scattered over the raid's battle map
(`src/renderer/art/props/`, built by `tools/compose-props.cjs`) are from **Craftpix.net**'s free Tree, Bush, Rocks,
Rocky Area Objects, Forest Objects, Top-Down Cave Objects, Top-Down Seabed Objects and Fields Tileset (tower defence)
packs.

## Craftpix trees, bushes, rocks and clouds (the town)

The town's trees, bushes and rocks and the sky's clouds (`src/renderer/art/scenery/`, built by
`tools/compose-scenery.cjs`) are from **Craftpix.net**'s free Tree Pixel Art, Bush Assets, Rocks Pixel Art and Clouds
Pixel Art packs.

## Craftpix windmill and watchtowers (the town)

The windmill and the two timber watchtowers on the map (`src/renderer/art/packs/su_windmill.png`, `su_watchtower.png`,
`su_lookout.png`, scaled down), and the stone keep and the crystal-crowned mage tower that stand for the halls of the
liches, the Moon Pack, the alchemists, the fae and the druids (`su_castle.png`, `su_magetower.png`), the round keep for the
merfolk's halls (`su_roundcastle.png`) and the tent for the nomads' (`su_tent.png`), are from **Craftpix.net**'s free
Simple Summer Top-Down Vector Tileset, used under Craftpix's free licence (use in the game; the raw files are not
redistributed).

More homes and defences on the map (`src/renderer/art/packs/`): the cottage on its stone footing for the lean-to and
hide tent (`su_house.png`, shrunk) is from the same Simple Summer tileset; the long house (`tt_long.png`, its inn sign
painted over with its own window) and the tall gabled house (`tt_gable.png`) are cut from the town tileset of
**tiny-rpg-town** by **Luis Zuno (@ansimuz)**; the pit, stakes and spikes (`dl_pit.png`, `dl_stakes.png`,
`dl_caltrops.png`, `dl_spikes.png`) are cells of **DawnLike**'s `Objects/Trap0.png` by **DragonDePlatino**, and the bars of
the ring wall's water grates (`dl_fence.png`: its wooden, iron and pale fence runs) cells of its `Objects/Fence.png`; the electric
coil (`ao_coil.png`) is the first frame of the trap in the loose Craftpix animated-objects pack.
The places of leisure are laid from the Fields tileset's signpost, rail fences and stump (`f_pointer4.png`, `f_fence1.png`,
`f_fence3.png`, `f_stump.png`), the Village tileset's bucket and bench (`v_bucket.png`, `v_bench.png`), and the pieces
already copied (logs, boxes, lanterns, a tent, the bridge pack's planks).
The work you can see (`src/renderer/art/chores/`): the felled trees' stumps are the Fields tileset's (`f_stump.png`), the
rubble of broken rock its small stones (`rubble1`..`4.png`), the banner run up over a finished building its animated flag
(`flag.png`), and the stockpile's heaps its logs and crates (`box3.png`, `log4.png`, with the pieces already copied); the
Village tileset gives the heaps' barrel, crate and log bundle (`barrel.png`, `crate.png`, `logs.png`), the stump with an
axe left in it (`stump_axe.png`) and the well's bucket (`v_bucket.png`); the sacks are the Glassblower's Workshop pack's
(`shops/gb_sacks.png`). The haystack and the bale left on a reaped field (`hay_heap.png`, `hay_bale.png`) are **Craftpix.net**'s
free Medieval Field Work 2D tileset's hay, shrunk to the map's pixel.

## The town over time and its moods (moving machinery, signposts, homes, smoke)

The windmill's turning sails are cut from the same Simple Summer windmill: its body with the sails taken away and the
hidden tower filled in (`src/renderer/art/packs/su_windmill_body.png`), one blade (`su_windmill_sail.png`, turned
upright) and the hub (`su_windmill_hub.png`); the full picture (`su_windmill.png`) stays for still pictures. The mills'
water wheel (`packs/sb_wheel.png`) is the top half of the ship's wheel of **Craftpix.net**'s free Top-Down Seabed
Objects pack, mirrored. The venues' banners are the animated flag of **Craftpix.net**'s free Fields Tileset for tower
defence (`src/renderer/art/fields/flag.png`, recoloured per shop), and the crossroads' signposts its pointers
(`packs/f_pointer4.png`, `fields/pointer1.png`, the loose board `fields/board.png`). The shutters closed at a raid's
warning and the rich homes' painted doors are a cell of **DawnLike**'s `Objects/Door0.png` by **DragonDePlatino**
(`src/renderer/art/village/dl_door.png`). The flower boxes, gardens and the clutter of the poor are pieces already copied
(the Fields Tileset's box, flowers and tufts, the dungeon clutter, the Village Tileset's bucket, the Fields logs). The
coughs' puffs, the smoke columns over fires and the plague's crosses on doors are strips of the **5000 Pixel Effects**
atlas already in the game (white and poison puffs, white smoke darkened, the blood cross).

## The seats of the towns (every people's, all five stages)

The seat at the heart of each town (`src/renderer/map/seatPacks.ts`) is laid together from sprites of the packs: the
Simple Summer keeps, round castle, mage tower, tent and towers, the tiny-rpg-town and Glassblower's Workshop houses and
the Village Tileset's timber houses, lanterns and palisade (all **Craftpix.net** and the tiny-rpg-town pack, as
credited above); the Top-Down Cave Objects' altar, gate, totem, crystals and fires; the Rocky Area Objects' tipis and
yurts; the futuristic objects' tanks, consoles and pylon; and from the folder `src/renderer/art/seats/`: the grove
trees of **Craftpix.net**'s free Forest Objects pack (`grove_*.png`), the corals, shell and mermaid statues of its free
Top-Down Seabed Objects pack (`coral*.png`, `shell.png`, `mermaid*.png`), the ruins, giant lich and pile of skulls of
its free Undead Tileset (`ud_*.png`), the Fields Tileset's banner (`flag.png`), and **DawnLike**'s throne, rugs,
candelabra, coffins and gold (`dl_*.png`, from `Objects/Decor0.png`) by **DragonDePlatino** (CC-BY 4.0) for the holds'
throne rooms.

## Craftpix seabed wreck (the sea beast's reef)

The broken wreck a sea beast lairs on, off a shore town (`src/renderer/art/packs/sb_wreck.png`), is from
**Craftpix.net**'s free Top-Down Seabed Objects pack. The town's boats are painted in code (`art/boatArt.ts`): no pack
has a whole working boat.

## Craftpix parallax backgrounds (the fights' backdrops)

The watched fights' backdrops (`src/renderer/art/backdrops/`, built by `tools/compose-backdrops.cjs`) come from free
**Craftpix.net** packs: Free Nature Pixel Backgrounds, 4 Free Seamless Nature Backgrounds, Forest and Trees, Summer,
Autumn, Mountain, Mountain Peak, Winter Nature, Winter, Ancient Temple, Crystal Cave, Desert Oasis, Abandoned Places,
City Ruins, Ocean and Clouds, City, Futuristic City, Steampunk Cityscape, Underwater World, Moon, Seamless Cloudscape,
Sky with Parallax Clouds, Sky with Clouds, Cloud and Sky, Post-Apocalyptic, and Fantasy 2D Battlegrounds backgrounds,
and the industrial platformer pack's Day and Night backgrounds.

The ground the party walks on where a backdrop has none at foot height (`src/renderer/art/fightGround/`): the
grass-topped earth from Craftpix's **Free Platformer Game Tileset (Pixel Art)**, and the capped brick and metal panels
from the industrial platformer pack's `1 Tiles` (both free, **Craftpix.net**).

## Item icons

Crafted items use icons from **DawnLike** (16x16 universal roguelike tileset) by **DragonDePlatino**, on
**DawnBringer**'s palette, licensed **CC-BY 4.0** (`src/renderer/art/items/`, copied from
`assets/DawnLike/Items` and `assets/DawnLike/Characters/Reptile0.png`; the small birds about the town on the map
are its `Characters/Avian0.png` and `Avian1.png`, five of them cut into `src/renderer/art/birds.png`, and the
butterflies its `Pest0.png` and `Pest1.png`, two cut into `src/renderer/art/butterflies.png`; the wild beasts beyond the
town (deer, stag, boar, fox, wolf, squirrel, bear, camel, snow fox) are cells of its `Quadraped`, `Dog` and `Rodent`
sheets, with the ducks, swan and leaping fish from its `Avian` and `Aquatic` sheets, and the town's dogs, cats, rooster
and hen from its `Dog`, `Cat` and `Avian` sheets, all cut into
`src/renderer/art/wildlife.png` by `tools/compose-wildlife.cjs`; the bees, dragonflies, moths, bats and rats about the
town are cells of its `Pest`, `Avian` and `Rodent` sheets, cut into `src/renderer/art/critters.png` by
`tools/compose-critters.cjs`, beside the box hive, which is the **Craftpix** Fields Tileset's crate `Box1.png`). As the
author asks, Platino is
hidden somewhere in the game.

The menagerie's 304 creatures (`src/shared/data/menagerie.ts`) are DawnLike's too: cells of its `Characters` sheets
(Aquatic, Avian, Cat, Demon, Dog, Elemental, Humanoid, Misc, Pest, Plant, Quadraped, Reptile, Rodent, Slime and
Undead; both animation frames, `0` and `1`), cut into `src/renderer/art/creatures/dawn.png` by
`tools/compose-dawn.cjs`. Same licence, same credit: **DragonDePlatino**, on **DawnBringer**'s palette, **CC-BY 4.0**.

The little things the townsfolk handle in their idle moments and on the watch (`src/renderer/art/life/`: the jolly's
juggled apple, orange and pear from `Items/Food.png`, the grumpy's pebble from `Items/Rock.png`, an elder's pipe from
`Items/Tool.png`, the night watch's torch from `Items/Light.png`) and the coffin carried at a funeral's head
(`Objects/Decor0.png`) are single cells of **DawnLike** too: **DragonDePlatino**, on **DawnBringer**'s palette,
**CC-BY 4.0**.

The busker's instruments (`src/renderer/art/life/lute.png`, the lyre, and `flute.png`) are single cells of
**DawnLike**'s `Items/Music.png`: **DragonDePlatino**, on **DawnBringer**'s palette, **CC-BY 4.0**. The log an elder
sits on to feed the pigeons, and a couple by the water at dusk, is the Craftpix Village tileset's log already in the
game (`art/village/`).

## Music

"Tiny RPG" town, battle and two boss themes by **Luis Zuno (@ansimuz)** (`src/renderer/music/`, from
`assets/TinyRPGMusic`): free for personal and commercial use. Everything else heard in the game (the generated
pieces of `src/renderer/musicGen.ts` and every sound effect) is made in the browser by the game's own code.

## Effects

Hit sparks, and the blood (the red burst and directional splatters, `splat_*.png`, sprayed from a landing blow and left
as a stain where someone falls): **Super Pixel Effects Gigapack** — Will Tice / unTied Games (`src/renderer/art/effects/`,
bundled with the game as the licence allows; see http://untiedgames.com/files/license.txt).

## Horses

Horses are from **whtdragon**'s RPG Maker MV animal sprites (see Creatures above for the licence note).

## Bosses and monsters

- **whtdragon**'s RPG Maker MV sheets (same licence note as Creatures): the green wyvern (recoloured red in code) is
  Vermithrax the dragon; young dragons are its hatchlings; a golem is the Iron Colossus; a blue flame-skull from
  *skeleghouls* is the Summoner's spirit; *zombie animals* join the zombie outbreak; the *wolfman* shows
  werewolves on full-moon nights (`src/renderer/art/creatures/`).
- **PackMonsters** (Monster 8) is the Abomination (`src/renderer/art/creatures/horror.png`). The pack folder has
  no licence file: check the author's terms before any public release.
- The boss blast is an explosion from the **Super Pixel Effects Gigapack** (see Effects).
- **tiny-rpg-town** by **Luis Zuno (@ansimuz)**: the Dark Knight is the Black Knight boss; the *Battle Sprites*
  Observer, Steel Eagle, Drone and Sentinel are the combat drones, war bots, the Rogue AI and the Star Reaver
  (`src/renderer/art/stills/`, `creatures/dark_knight.png`).
- **Pixel Champions v3**: townsfolk who take up a special class are drawn as its heroes (Hex = Necromancer,
  Linail = Summoner, Ley = Beast Tamer, Glenys = Blood Knight; `creatures/champ_*.png`).
- **Magic Items 01** (free version, free projects only): relic icons (`items/Magic.png`).
- Revive sparkles and the conjuring swirl are from the **Super Pixel Effects Gigapack** (see Effects).
- More tiny-rpg-town battle sprites: the Ogre and Hedge Wizard (warbands), the Mummy (outbreaks), the Bog Slime
  (an early raid) and the Metal Slug crawler bot (drone swarms).
- **Free Mining Pixel Icons** (CraftPix): material icons on cost chips (`src/renderer/art/materials/`), the minerals' (copper, tin, silver, sulphur and their ores) among them.
- **DungeonItemsLite**: gravestones where townsfolk fell, the Stone Gate's archway, and the Steel Cuirass icon.
- whtdragon's *ghosts* drift through an undead haven at night.
- The War Machine is drawn in code.
- **Alenia Star Magic Pack**: the spells round townsfolk as they're turned (shadow spores for the undead, a ring of
  blood for a vampire, moonlight for a werewolf), Blood Knight hits, and the golden vortex as the ship lifts off
  (`src/renderer/art/effects/`, cut to every third frame and cropped). The pack folder has no licence file: check
  the author's terms before any public release.
- **pvfx foundry thirteen** (CC0): the medkit's healing glow, the laser turret's shock, the Summoner's rift portal,
  and the bosses' sweeping attacks (Vermithrax's fire, the Colossus's ground rupture, the War Machine's shell, the
  Star Reaver's beam, the Abomination's acid, the Frost Archmage's frost nova), smoke over burning buildings, meteor
  impacts, and the dust where a building comes down.
- **5000 Pixel Effects** (16px + 32px; licensed for use in games, see `assets/pixel-effects/LICENSE.txt`): the
  flames on burning buildings, the emotes over townsfolk (zzz, hearts, anger, sweat, notes, and the alarm, question, skull, dots and star), the golden
  arrow when someone's skill goes up, and the fire and lightning bursts where gunshots and lasers hit; and, as
  one atlas (`tools/compose-pixelfx.cjs`), every element's every shape (bolts, orbs, bursts, pillars, rain, novas,
  spikes, runes, auras, sparkles...) played where spells and skills land in fights, on the raid map and the
  tactics board.
- **Holy VFX 02**: the pillar of light as someone is brought back from death (no licence file in the folder:
  check the author's terms before any public release).
- The Rat Plague: whtdragon's *mouse* sheet (rats, plague rats, and the Rat King drawn huge; same licence note).
- The Deep Freeze: whtdragon's *golems2* (the ice golem) and *snowmonkey* (the frost yeti) (same licence note as
  Creatures); the ice mages' frost bursts and casting vortex are from the **ICE skills** pack (no licence file in the
  folder: check the author's terms before any public release).

## Terrain and scenery

Terrain, the campfire and the smaller scenery (grass, flowers, stumps, ferns...) are pixel art drawn in code for this
project; the trees, bushes, rocks and clouds drawn in code stand in until the Craftpix ones (above) have loaded.

## Rival armies and spells

Taken from the owner's asset repository (hpatter9/chronos-assets, private); only the individual sheets used are in
the game.

- **pvfx foundry thirteen spritesheets** (CC0): the spell sheets `src/renderer/art/effects/pvfx_*.png`: roots for
  Entangle, rain, leaves, blooms, wards, a parry shield, a mending light, a charge, splashes and surf, an hourglass
  and a quicksilver shape (Transmute, Assemble), stone spines, a cinder orchid, a magic missile, moths and a prism.
- **Alenia Star Magic Pack**: six effects shrunk from 320px (`effects/spell_*.png`): the vampire's blood bubble and
  blood storm, dark flames, a golden vortex, a fountain of life and a chaotic storm. Bundled inside the game only, as
  its licence allows; never redistributed as files.
- **Golems and elementals** (pack by batareya): the rival armies' treant, stone golem, water elemental, brass
  homunculus, iron sentry, wraith, crystal fiend and fire elemental (`src/renderer/art/stills/elem_*.png`). The pack
  folder has no licence file: check the author's terms before any public release.
- **Tiny RPG Character Asset Pack 02** (Demon_A and Blood Monster_A): the Countess's demons and blood fiends
  (`creatures/demon.png`, `creatures/blood_monster.png`, their walk, attack and idle strips stacked into one sheet).
- **mobs** (goblin and slime): the Wild Hunt's redcaps and the Mad Alchemist's acid slimes (`creatures/goblin.png`,
  `creatures/slime.png`, strips stacked the same way). The pack folder has no licence file: check the author's
  terms before any public release.
- **Pixel Champions v3**: three more heroes as rival lords: Prime the Great Sage (the Mad Alchemist), Oratio the
  Mercenary (the Khan) and Wyvera the Queen Dragoon (the Tide Queen) (`creatures/champ_sage.png`,
  `champ_mercenary.png`, `champ_dragoon.png`).

## Beasts and things that come alive

- **whtdragon**'s RPG Maker MV sheets (see Creatures for the licence note): desert lions and wild dogs, coastal
  crocodiles, the Behemoth, possessed tomes, vampire bats, the desert caravan's camels and the druid's walking
  mushrooms (`creatures/lions.png`, `wilddogs.png`, `crocodiles.png`, `behemoth.png`, `tomes.png`, `bats.png`,
  `camel.png`, `shrooms.png`).
- **mobs** (mimic): the Mimic (`creatures/mimic.png`, its walk, attack, idle and disguise frames stacked into one
  sheet; see the licence note under Rival armies).

## Fonts

Each look's fonts are Google Fonts under the **SIL Open Font License 1.1**, bundled from the @fontsource packages
(`src/renderer/fonts.ts`, copied into `fonts/` by `build.mjs`): Alegreya, Alegreya SC and Alegreya Sans (Juan Pablo del
Peral, Huerta Tipográfica), Pirata One (Rodrigo Fuenzalida, Nicolas Massi), IM Fell English and IM Fell English SC
(Igino Marini), Uncial Antiqua (Astigmatic), Crimson Text (Sebastian Kosch), Grenze Gotisch (Omnibus-Type), EB Garamond
(Georg Duffner, Octavio Pardo), New Rocker (Impallari Type), Orbitron (Matt McInerney), Share Tech Mono (Carrois
Apostrophe), Cinzel (Natanael Gama), Berkshire Swash (Astigmatic), Quicksand (Andrew Paglinawan), Marcellus SC (Brian J.
Bonislawsky), Fondamento (Astigmatic), MedievalSharp (Wojciech Kalinowski) and Metal Mania (Open Window, the orcs' look).

## Craftpix bridges (the shore town's piers)

The wooden pier planks (`src/renderer/art/roads/pier_v.png`, `pier_h.png`, cut from its bridge sheet) are from
**Craftpix.net**'s free Bridges Top-Down Pixel Art Asset Pack, used under Craftpix's free licence (use in the game;
the raw files are not redistributed).

## Himeko Sutori sprite share (townsfolk and monsters)

The townsfolk and founders (the bodies, outfits, hair, beards, helms, shields, weapons and tools in
`src/renderer/art/himeko/`, copied and cut to their drawn rows by `tools/import-himeko.cjs`) and the ogres, demons,
juggernaut, tyrant, slimes, mummy, ghost, zombies, imp and the orc warband (grunt, archer, brute and warlord: the Orc body
in the barbarians' outfits) (`src/renderer/art/creatures/packs/hk_*.png`, their layers
composed and their right-facing frames cut by `tools/compose-sheets.cjs`) are from the Himeko Sutori sprite share, free
to use with attribution. The spear (`spear01*.png`) is the pack's naginata with its blade redrawn as a spearhead by
`tools/make-spear.cjs`. The scarecrow on the fields (`src/renderer/art/scarecrow.png`, by `tools/compose-critters.cjs`)
is put together from the pack's man's body (turned to sacking), its first peasant's robe and its gunslinger's hat.

- Half-Kaizer sprite template created by Showkaizer.
- Additional Half-Kaizer poses by Aleesa Tana.
- Armor, weapon, shield, helmet, hair, skeleton, zombie, demon, fairy, mecha, wolf, boar, pumpkin, turkey, slime,
  skullbird, dragon, cactus, and other sprites are from Himeko Sutori and Septaroad Voyager by Rockwell Studios, LLC.
