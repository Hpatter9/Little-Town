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

## Craftpix dungeon props (the watched delves)

The doors, chests, gate, wall torches and braziers seen down a dungeon (`src/renderer/art/delve/`) are from
**Craftpix.net**'s free 2D Top-Down Pixel Dungeon pack; the skull altar and the guillotine from its free Pixel Dungeon
Props and Objects pack.

## Craftpix interiors and tower-defence tiles

The shop's and tavern's furnishings (shelves of jars, glass cabinets, tables, planters, crates, rugs, the counters) and
the brick hearth's furnace (`src/renderer/art/interior/`) are from **Craftpix.net**'s free Glassblower's Workshop
top-down pack. The raid map's cobbled trail and the pads under the shooters' spots (`src/renderer/art/td/`) are from its
free Fields Tileset and Village Tileset for top-down tower defence. The Village Tileset's half-timbered houses and striped
awnings also stand for the medieval town's cottages, row houses, inn, trading post and stalls on the town map.
The town's roads on the map (`src/renderer/art/roads/`) are from its free Path and Road top-down pixel tileset: slabs,
cobbles, bricks and paving by era, laid a quarter-tile at a time.

## Craftpix top-down objects (the raid map's scenery)

The trees, bushes, rocks, mushrooms, crystals, bones, idols, corals and shells scattered over the raid's battle map
(`src/renderer/art/props/`, built by `tools/compose-props.cjs`) are from **Craftpix.net**'s free Tree, Bush, Rocks,
Rocky Area Objects, Forest Objects, Top-Down Cave Objects, Top-Down Seabed Objects and Fields Tileset (tower defence)
packs.

## Craftpix trees, bushes, rocks and clouds (the town)

The town's trees, bushes and rocks and the sky's clouds (`src/renderer/art/scenery/`, built by
`tools/compose-scenery.cjs`) are from **Craftpix.net**'s free Tree Pixel Art, Bush Assets, Rocks Pixel Art and Clouds
Pixel Art packs.

## Craftpix parallax backgrounds (the fights' backdrops)

The watched fights' backdrops (`src/renderer/art/backdrops/`, built by `tools/compose-backdrops.cjs`) come from free
**Craftpix.net** packs: Free Nature Pixel Backgrounds, 4 Free Seamless Nature Backgrounds, Forest and Trees, Summer,
Autumn, Mountain, Mountain Peak, Winter Nature, Winter, Ancient Temple, Crystal Cave, Desert Oasis, Abandoned Places,
City Ruins, Ocean and Clouds, City, Futuristic City, Steampunk Cityscape, Underwater World, Moon, Seamless Cloudscape,
Sky with Parallax Clouds, Sky with Clouds, Cloud and Sky, Post-Apocalyptic, and Fantasy 2D Battlegrounds backgrounds,
and the industrial platformer pack's Day and Night backgrounds.

## Item icons

Crafted items use icons from **DawnLike** (16x16 universal roguelike tileset) by **DragonDePlatino**, on
**DawnBringer**'s palette, licensed **CC-BY 4.0** (`src/renderer/art/items/`, copied from
`assets/DawnLike/Items` and `assets/DawnLike/Characters/Reptile0.png`). As the author asks, Platino is
hidden somewhere in the game.

## Music

"Tiny RPG" town and battle themes by **Luis Zuno (@ansimuz)** (`src/renderer/music/`, from
`assets/TinyRPGMusic`): free for personal and commercial use.

## Effects

Hit sparks: **Super Pixel Effects Gigapack** — Will Tice / unTied Games (`src/renderer/art/effects/`,
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
- **Free Mining Pixel Icons** (CraftPix): material icons on cost chips (`src/renderer/art/materials/`).
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
  flames on burning buildings, the emotes over townsfolk (zzz, hearts, anger, sweat, notes), the golden
  arrow when someone's skill goes up, and the fire and lightning bursts where gunshots and lasers hit.
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
Bonislawsky), Fondamento (Astigmatic) and MedievalSharp (Wojciech Kalinowski).
