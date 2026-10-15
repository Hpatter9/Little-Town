# Chronos Settlement (formerly Little Town)

A pixel-art town that runs itself, like an ant farm. It's played mainly as a phone web app (a PWA on the
owner's Android, hosted on GitHub Pages). There's also a Windows desktop overlay (Electron): a strip above the
taskbar. TypeScript + PixiJS. `DESIGN.md` is the original design, and `README.md` covers how to play and build.

## Read this first (for every agent: Claude, Gemini or any other)

Read this whole file: it is the working guide. The full record of what has been built (about 460 KB) is in
`docs/HISTORY.md`: don't read that top to bottom. Find the system you are about to touch in **The systems** at the end
of this file, then grep `docs/HISTORY.md` for its heading, files and names (`grep -n "ringWall" docs/HISTORY.md`), and
read that part before changing anything.

**How to work:**

1. Start from the latest `main` on a branch of your own (Claude uses `claude/...`; other agents use
   `gemini/<topic>` or similar). Never push to `main` directly: the owner merges.
2. Before editing a file, read it and the files next to it, and copy their style: names, comment density,
   plain-English comments, British spelling in the game's text.
3. Keep each change small and finish it before starting the next one.
4. Check your work: `npm run typecheck`, then `npm test` (every test must pass; while working, `npm test -- castle
   ringWall` runs only the files whose names contain those words), then `npm run web` if you touched the renderer.
   Fix what fails. Never skip, delete or loosen a test to get it to pass.
5. Add a test in `test/` for any new rule in the simulation (copy a nearby test file's shape; `test/helpers.ts`
   has `plainGame` and the land helpers).
6. Write a short note for what you built in a new file `docs/notes/<branch-topic>.md` (e.g.
   `docs/notes/upkeep.md`), in the style of `docs/HISTORY.md`: a `##` heading, then what it does, the file, the key
   names and constants. Never append to `docs/HISTORY.md` or to this file's index yourself: several agents work at once,
   and the coordinator folds the notes into HISTORY.md (and a line into **The systems** below) when it merges. A
   change to an existing system's rule still gets its note, naming the HISTORY.md section it changes.
7. Commit with a clear message and push your branch. Only add an AI attribution line that names the model actually
   doing the work. Never put a model name or ID in code, comments or this file.

**Rules that are easy to break:**

- **The simulation is deterministic.** In `src/shared/sim/` never use `Math.random()`, `Date.now()` or anything
  that varies from run to run. Randomness comes from the town's seeded stream (`s.rngState` through the `Rng`
  passed in) or a side stream: `new Rng(hashSeed(`${s.seed}:<your-system>:${s.tick}`))` (`src/shared/rng.ts`).
  A **new** system should use its own side stream. Drawing extra numbers from the town's stream changes how every
  existing town plays out and breaks balance tests.
- **New systems run only with the autopilot on** (`if (!s.autopilot) return;`). The tests' `plainGame` turns it off
  so single mechanics can be tested alone. A test of your system sets `s.autopilot = true` itself.
- **Save compatibility.** New `GameState` fields are optional (`field?: T`), and code must cope with them being
  missing (older saves). Don't bump the save version unless the owner asks.
- **The renderer never changes the game state.** It reads the snapshot (`sim/snapshot.ts`). The player acts through
  commands: add the type and its checks in `src/shared/sim/commands.ts` and apply it in `src/shared/sim/sim.ts`.
- **Danger by day uses `paceDay(s)`** (`sim/time.ts`), not the plain day: the game is paced to last months.
- **Research bonuses:** read `researchMods(s)` (cached), not `modifiers(s.research)`.
- **New content is merged into the shared tables:** new buildings into `BUILDINGS`, foes into `ENEMIES`, items into
  `ITEMS`, raid kinds into `RAID_KINDS`. Follow how an existing data file (e.g. `data/workshops.ts`) does it.
- **Menus:** a panel redraws only when its key changes. Anything a button changes must be in that panel's key, or
  the tap seems to do nothing. A new `h2` section in a menu needs its heading in `GROUPS` (`panel/subtabs.ts`).
- **Modules the tests import** must not import Pixi or touch the DOM. Keep game rules in pure functions.
- **Art:** use sprites from the packs (see below), copied one at a time into `src/`, and credit them in
  `CREDITS.md`. Never change `../chronos-assets`.
- **Never run** Electron (`npm start`) or `npm run dist`.
- **When unsure what the owner wants, ask.** Don't guess at design decisions or add manual controls the owner didn't
  ask for (the town is hands-off).

## Priorities (from the owner)

- **Phone first.** Design every change for the phone version. Before calling anything done, check it at phone
  sizes both upright (393x852) and sideways (852x393) in a browser preview.
- **Hands-off.** The town decides for itself what to research, gather, build and craft
  (`src/shared/sim/planner.ts`). The player only sets the town's **direction** (Growth, Defence, Trade or
  Knowledge, in the Plan tab) and sends **expeditions**. Don't add chores or manual controls.
- **Deaths should be common.** Raids, disasters and hunger are meant to bite.
- **Use the assets, not code-drawn art.** The owner doesn't like the look of the textures and sprites the code paints.
  From here on, wherever an uploaded asset (the packs in `../chronos-assets`) can stand in for something code-drawn,
  use the asset: buildings, ground tiles, fields and pens, props, effects, creatures. Code-drawn art is the fallback
  only where no pack has the thing. Prefer a pack's sprite even where its style is a little bulky.
- **Assets.** The project is free and private, so any sprite from the asset packs may be used. Credit the source
  in `CREDITS.md`. The packs live in the private repo `hpatter9/chronos-assets` (clone it next to this one, at
  `../chronos-assets`); copy in only the individual sprites the game uses, never whole packs. Sprites the game uses
  are in `src`. Images load through `art/loadImage.ts` (a refused `decode()` falls back to the load event).

## The asset packs (`../chronos-assets`)

- The original packs are at the repo's top level (DawnLike, LPC, Pixel Champions, pvfx, Alenia, Golems, Robot
  Warfare, Tiny RPG, the mining and industrial tilesets...).
- **`assets/`** (added later): about 60 free Craftpix packs, one folder each, the pack's own layout kept.
  - Characters: samurai (Samurai, Archer, Commander), ninja (Kunoichi, Monk, Peasant), wizards, robots (Destroyer,
    Infantryman, Swordsman), tiny heroes, yokai.
  - Monsters: werewolves (black, red, white), gorgons, minotaurs and satyrs (three each), forest bosses (3),
    top-down defence enemies (3 sets), top-down boss creatures, pirate bosses.
  - Effects: pixel magic effects and icons, magic slashes.
  - Tilesets: top-down dungeon, village, undead, fields, path and road, green zone, glassblower's workshop; a
    platformer medieval field work set.
  - Objects: trees, bushes, rocks, rocky area, forest, cave, seabed, bridges, dungeon props.
  - Parallax backgrounds: nature, forest and trees, summer, autumn, winter, desert oasis, mountain, mountain
    peak, crystal cave, ancient temple, sky and clouds, cloudscape, ocean, city, futuristic city, city ruins,
    post-apocalyptic, abandoned places, fantasy battlegrounds.
- **More Craftpix packs at the top level** (added at the same time, outside `assets/`): knight character sprites,
  skeleton sprite sheets, a platformer tileset, and winter, underwater, moon, steampunk city and cloud-and-sky
  backgrounds. One more pack is unpacked loose at the top level (`1 Tiles`, `2 Background` (Day/Night),
  `3 Objects` (tubes, decoration, power lines), `4 Animated objects` (card, chest, money, trap), with its `PSD/`,
  `License.txt`, `Font.txt`).
- Check a pack's folder before using it: frame sizes, animation names, and split frames or whole sheets vary.
  Within a pack, pick either the split frames or the sheet and keep to it.
- Use the PNGs only. Ignore `__MACOSX/`, `COUPON.*`, `.url`, and `.psd`/`.ai`/`.eps` files.
- Vector-only packs, with no PNGs to use: crystal caves, tower defence, tropical medieval city, underwater game
  objects.
- Never change the assets repo. Copy only the sprites used into this repo, and credit them in `CREDITS.md`.
  Craftpix's free licence allows use in the game, but not redistributing the raw files.

## Commands

```bash
npm install
npm run typecheck      # tsc --noEmit
npm test               # headless sim tests (node test runner): every file, in parallel, slowest first
npm test -- castle     # only the test files whose names contain "castle" (several words: any of them)
npm run web            # build the phone version into out/web (what GitHub Pages serves)
npm run build          # build only (desktop + renderer) into out/
npm run dist           # Windows installer (needs Windows; not for the cloud)
```

To preview the phone version, serve `out/web` with any static server and open it at a phone size.
`window.__game` is the game loop (`__game.sim.step()` fast-forwards), and `window.bridge.openPanel('build')`
opens a menu. Never launch Electron; the owner runs the desktop app themselves.

## Layout

- `src/shared/sim/`: the deterministic simulation. It runs at 10 ticks a second, with 600 ticks per game hour
  and 10-day seasons (`DAYS_PER_SEASON`; it was 3 before 0.64.0).
  - `sim.ts`: the step order.
  - `planner.ts`: the self-running town. It can be turned off with `state.autopilot = false`; the tests' `plainGame`
    helper does this.
  - `people.ts`: jobs and tasks.
  - `snapshot.ts`: what the renderers see.
  - `save.ts`: save versions and migrations.
- `src/shared/data/`: buildings, research, items, the world map spots, founding (backgrounds and scenarios), and
  so on.
- `src/renderer/`: the town strip.
  - `main.ts`: input, the phone's tap card and pinch.
  - `town/`: the views: sky, weather, seasons (via `art/palette.ts`).
  - `panel/`: the menus.
  - `mobile/`: the phone page. It holds the strip and the menus in two iframes that share one bridge;
    `mobileBridge.ts` runs the game in the page and saves to `localStorage`.
- `src/main/`: the Electron desktop app.
- `tools/build-web.mjs`: the phone build (manifest, offline service worker, icons).

## Conventions

- Run `npm run typecheck` and `npm test` after changes, and add tests for new rules in `test/`.
- After CSS changes, check the braces balance and that each `@media` block holds only what it should. A broken
  `@media` block once wrecked the phone layout.
- **The version (the owner's ask):** the ☰ menu ends with "Version 0.116.0 · <commit> · built <day>" (`gameVersion` in
  `mobile/mobile.ts`; `tools/build-web.mjs` defines `__GAME_VERSION__` from package.json, `__GAME_COMMIT__` from
  `git rev-parse --short HEAD`, `__GAME_BUILT__` the build's day). With every merge to main, bump the minor version
  in `package.json` (0.3.0, 0.4.0, ...) in the merged branch, and tell the owner the new number afterwards.
- Saves on the phone use the keys `littletown.*`, and the desktop uses `%APPDATA%\Little Town`. Keep both, or
  existing towns are lost.


## The systems (an index; the full notes are in `docs/HISTORY.md`)

One or two lines a system: the main files (`sim/` and `data/` are under `src/shared/`; `map/`, `panel/`, `art/`,
`mobile/` and the other views under `src/renderer/`) and, after **H:**, words of the HISTORY.md heading to grep for.
Grep the file and constant names too: most systems were changed again in later sections.

**The engine**
- **The step and the loop:** `sim/sim.ts` (step order, commands applied), `sim/commands.ts`, `shared/gameLoop.ts`,
  `sim/time.ts` (`paceDay`, `DAYS_PER_SEASON` 10), `data/pace.ts`. H: "A game of generations", "Longer seasons".
- **Saves and time away:** `sim/save.ts` (version, packed pools), `sim/offline.ts` (`awayPlayMs`, two days at most),
  `sim/awaySummary.ts` (the "While you were away" card), `sim/raidWait.ts`. H: "Offline pacing", "Raids wait for
  you", "A plain return", "Catch-up without recaps".
- **The phone's worker and snapshots:** `shared/simHost.ts`, `mobile/simWorker.ts`, `mobile/mobileBridge.ts`,
  `shared/snapDelta.ts`, `sim/snapshot.ts` (`personFast`/`personSlow`). H: "The phone made smoother".
- **The land and walking:** `sim/land.ts` (`LandMap`, `makeLand`, `findPath`), `sim/landRegions.ts` (named regions,
  192x192), `sim/walk.ts`, `sim/regrow.ts`, footpath wear. H: "Phases 1 and 2", "The wide land", "Footpaths",
  "The wild grows back".
- **Biomes:** `data/biomes.ts` (ten lands), `map/groundArt.ts` (`BIOME_LOOKS`). H: "Ten lands".
- **The planner (the self-running town):** `sim/planner.ts` (research, gathering, building, crafting, `findSpot`,
  `openLand`), `sim/pins.ts` (the player's building wishes), `sim/research.ts` (`pickResearch`). H: "Phase 1",
  "Research picked by hand", "Medieval tuning", "Mood drives what the town builds".

**People**
- **Jobs and tasks:** `sim/people.ts` (`chooseTask`, haul order, builders' spots), `sim/operators.ts` (town jobs),
  `sim/townsfolk.ts` (needs, mood, visitors, `keepKin`), `sim/property.ts` (build skill). H: "Town jobs", "Work for
  every hand", "Builders build, the rest carry", "construction crews".
- **Health:** `sim/health.ts` (downed, healing, succession `heirOf`), `sim/injuries.ts` + `data/injuries.ts` (wounds,
  lost parts, prosthetics), `sim/sickbeds.ts`, `sim/prisoners.ts`, care research. H: "Injuries, lasting harm",
  "Prisons with cells", "Deaths made common again".
- **Age, families, lineage:** `sim/ageing.ts`, `data/lifespans.ts`, `sim/social.ts` (pairs, enemies, devoted),
  `sim/lineage.ts` (lessons, apprentices, family trees, inheritance). H: "Age and lifespan", "Couples and
  children", "Step 4, relationships", "Schools, apprenticeships".
- **Character:** `data/natures.ts` (natures, habits, speech), `data/backstories.ts`, `sim/ambition.ts`,
  `sim/diary.ts`, `sim/gossip.ts`, `data/founders.ts`/`founderLines.ts`, names in `data/people.ts`. H: "Natures",
  "Everyone's own story", "Townsfolk with more inner life", "Ready-made founders".
- **Callings, levels, stats:** `data/classes.ts` (26), `data/paths.ts` (roads and evolutions), `data/originPaths.ts`,
  `data/levels.ts`, `sim/classes.ts`, `sim/attributes.ts` + `data/attributes.ts`, `data/pathAttrs.ts`,
  `data/emblems.ts`, `data/pathLore.ts`. H: "Classes and levels", "Class paths", "Stat points", "Evolutions that
  matter", "Skills and levels run to 100".
- **Deeds and titles:** `sim/deeds.ts`, `data/deeds.ts`, origin titles in `sim/annals.ts`. H: "Titles from deeds".
- **Strangers and secrets:** `sim/strangers.ts`, `data/strangers.ts`, `sim/specials.ts` (secret newcomers),
  `sim/bands.ts` (visiting bands, refugees, disguised bandits). H: "Strangers of other peoples", "Special
  newcomers", "Visiting bands".
- **Leisure, ceremonies, the tavern night:** `sim/leisure.ts`, `sim/ceremonies.ts` (funerals, weddings, feasts),
  `sim/nightOut.ts`, `sim/pastimes.ts`, `sim/idleScenes.ts`, `sim/roughSleep.ts`. H: "Places of leisure",
  "Step 7, life's ceremonies", "The evening at the tavern", "Sleeping rough".
- **Guilds:** `sim/guilds.ts`, `sim/guildPerks.ts`, `data/guilds.ts`. H: "Guilds and squads".
- **Companies (bonded parties):** `sim/companies.ts`. H: "Bonded parties".

**The town and its economy**
- **Buildings:** `data/buildings.ts` (`BUILDINGS`, `UPGRADES`), `sim/buildings.ts` (`placeBlueprint`, `upgrade`,
  `connectRoad`, `demolish`), `data/workshops.ts`, `data/recreation.ts`, `data/stores.ts`. H: "Upgrades and fewer
  homes", "More buildings and crafting stations", "Buildings pulled down".
- **The seat:** `data/seats.ts` (opens each age's research), `map/seatPacks.ts`. H: "The seat of the town", "The
  seats from the packs", "The seat opens each age's studies".
- **The ring wall:** `sim/ringWall.ts` (one construction, shapes by people, gates, grates), `data/ringShapes.ts`,
  `sim/prowlers.ts`. H: "The ring wall", "One coordinated wall project", "The wall raised as one construction",
  "Grates", "The palisade's gate", "The ring's shape".
- **Streets:** `sim/streets.ts` (planned, then paved; bridges, gate paths). H: "Streets are built", "No roads
  through the ring wall".
- **Castles and holds:** `sim/castle.ts` (rooms, doorways, gates, the mountain hold), `map/castleArt.ts`,
  `map/castleClutter.ts`. H: "The castle as one body of rooms", "The dwarves' hold", "Walls that hold".
- **Farming and animals:** `sim/farming.ts`, `data/crops.ts` (soil, blight, sections), `sim/livestock.ts`,
  `data/livestock.ts`. H: "Phase 4, more farming", "Animal husbandry", "Pens bought, bred", "Fields worked a section".
- **Crafting and quality:** `sim/crafting.ts`, `data/items.ts`, `data/quality.ts`, `data/weapons.ts`,
  `data/armour.ts`, `data/uniques.ts`, `data/armed.ts`. H: "The armoury", "Unique weapons", "Three orders a station",
  "A calling's weapon in hand".
- **Coins, pay, tax, rent:** `sim/economy.ts`, `sim/treasury.ts`, `sim/property.ts`, `sim/wages.ts`,
  `data/economy.ts`. H: "The townsfolk's own economy".
- **Shops and taverns:** `sim/shop.ts`, `data/shop.ts`, `data/decor.ts`, `panel/shopPanel.ts`. H: "Phase 2",
  "Five shops", "A shop like a real shop", "Inside the venues", "Tavern rooms".
- **Trade:** `sim/trade.ts` (caravans), `sim/markets.ts` + `sim/prices.ts` (prices, trade house, routes, loans),
  `data/minerals.ts`. H: "A real trade economy", "Minerals", "The town trades with caravans".
- **Light and dark:** `sim/lighting.ts`, `sim/lightField.ts`, `data/lighting.ts`, `map/lightMap.ts`,
  `map/flicker.ts`. H: "Real light", "Light that's stopped", "The town lights itself", "Lights at the gates first".
- **Politics and law:** `sim/politics.ts` (blocs, laws, council, crime, trials, strikes, edicts). H: "Town politics
  and law", "The founder's edicts".
- **Faith:** `sim/faith.ts`, `data/gods.ts`. H: "Gods and faith".
- **Memory:** `sim/annals.ts` (the fallen, chronicles), `sim/memorials.ts`, `sim/statues.ts`, `sim/ruins.ts`,
  `sim/settlementName.ts`, `sim/legacy.ts` (legends). H: "The annals", "Memory in the town", "Dynasties and legacy".
- **Daughter villages:** `sim/villages.ts`, `data/villages.ts`. H: "Daughter villages".
- **Interiors:** `sim/interiors.ts`, `interior/interiorView.ts`. H: "Inside every building".

**Danger**
- **Raids:** `sim/raids.ts` (budget, size, might, kinds), `data/raids.ts` (`RAID_KINDS`), `sim/raidRecap.ts`,
  `sim/raiderWounds.ts`, `sim/raidSkip.ts`, `sim/rally.ts`, `sim/defenses.ts` + `data/defenses.ts`. H: "Raids bite
  again", "A recap after every raid", "Raiders lamed", "Tower defence, deeper", "Skip a raid".
- **Raid battles:** `sim/tactics.ts` + `sim/tacticsArea.ts` (the default board, FF Tactics), `sim/battle.ts` (the
  trail), `tactics/tacticsView.ts`, `map/mapBattle.ts`, `battle/juice.ts`. H: "Tactics battles", "Tower-defence
  raids", "Phase 5", "Many ways in", "The flashier raid screen".
- **Combat rules:** `sim/combat.ts` (`personFighter`, `weaponOf`), `sim/actions.ts` (kits), `data/spells.ts`,
  `data/abilities.ts`, `data/moreAbilities.ts`, `data/actFx.ts`, `data/taming.ts`. H: "Turn-based fights",
  "Weapon range", "Combat effects".
- **Foes:** `data/enemies.ts` (`ENEMIES`), `data/bestiary.ts`, `data/menagerie.ts` (300+ DawnLike foes),
  `data/dungeonBosses.ts`, `sim/bosses.ts` (loot). H: "The bestiary", "The menagerie", "Monsters from the Himeko".
- **On the land:** `sim/roamers.ts` (roaming bands, skirmishes), `sim/places.ts` (lairs, caves, carts, mines),
  `sim/nests.ts`, `sim/lurkers.ts`, `sim/caveBear.ts`, `sim/dragon.ts`. H: "Hostiles roaming the land", "Phase 4,
  the land's places", "Monster nests", "The Dragon".
- **The Calamity:** `sim/calamity.ts`, `data/calamity.ts`, `sim/blight.ts`. H: "The Calamity".
- **Disasters and events:** `sim/disasters.ts`, `sim/doom.ts`, `sim/fire.ts`, `sim/events.ts`, `data/events.ts` and
  `moreEvents1..4.ts`, `data/fatefulEvents.ts`, `data/eventFit.ts`, `data/eventKit.ts`. H: "Choice events",
  "Events with purpose", "Fateful events", "Natural disasters", "Events that fit the town".
- **Rivals and the realm:** `sim/rivals.ts` (lords' spells), `sim/factions.ts` (powers, envoys, war hosts,
  assaults), `sim/risingPowers.ts`, `sim/worldLife.ts`, `data/kinship.ts`. H: "Rival origins", "The realm",
  "Rising powers", "The living world map".
- **The conquest (switched off: `CONQUEST.on`):** `sim/conquest/`, `data/conquest.ts`, `data/troops.ts`,
  `panel/warPanel.ts`. H: "The Conquest update".

**Trips and quests**
- **Expeditions:** `sim/expeditions.ts`, `sim/parties.ts` (the town's own parties, veto, bounties), `sim/muster.ts`
  (a party raised by hand), `sim/watchAsk.ts`, `sim/roadEvents.ts`, `data/scenes.ts`. H: "Step 5, parties",
  "Sending a party yourself", "Expedition stakes".
- **Dungeons and places:** `sim/delves.ts`, `data/dungeons.ts`, `data/regions.ts` (scouting). H: "Dungeon delves",
  "Dungeon types", "Scouting".
- **Quests and sagas:** `sim/quests.ts`, `sim/questBoard.ts`, `sim/hunts.ts` (the guild), `sim/sagas.ts` +
  `data/sagas*.ts`. H: "The quest board", "Sagas", "The Monster Hunters' Guild".
- **Boats and the sea:** `sim/boats.ts`, `data/boats.ts`, `sim/sea.ts`. H: "Boats", "The merfolk's shore".
- **The Deep and portals:** `sim/deep.ts` (the shaft's levels), `sim/portals.ts`. H: "The Deep", "Portals".
- **Cutscenes:** `data/cutscenes.ts`, `sim/cutscenes.ts`, `cutscene/`. H: "Cutscenes".

**The peoples (origins)**
- **Origins in general:** `data/origins.ts` (rules, powers, starting heritage), `sim/origin.ts` (multipliers),
  `sim/powers.ts`, `data/research.ts` (heritage lines), `data/originResearch.ts` (names, pace, forgone topics),
  `theme.ts`/`skins.ts` (looks), `art/originStyles.ts`, `sim/heritage.ts` (the Our ways tab). H: "Origins are
  done", "Research for each people", "The peoples made deeper".
- **Each people's own system:** the Blood Court `sim/vampires.ts`; the liches `sim/occult.ts` and the undead
  village; the druids `sim/grove.ts`; the fae `sim/bargains.ts`; the alchemists `sim/greatWork.ts`; the knights
  `sim/chivalry.ts`; the machines `sim/foundry.ts`; the settlers `sim/frontier.ts`; the Moon Pack `sim/pack.ts`; the
  nomads `sim/nomads.ts`; the merfolk `sim/sea.ts`; the dwarves the hold (`sim/castle.ts`); the orcs `sim/warpath.ts`.
  H: each people's name, e.g. "The Orc Warband", "The Moon Pack", "The merfolk rework".

**The renderer**
- **The map:** `map/mapView.ts` (ground chunks, buildings, props, lights layer), `map/mapPeople.ts`,
  `map/mapRaiders.ts`, `map/mapCamera.ts`, `map/minimap.ts`, `main.ts` (input, tap cards, hover). H: "Phase 3",
  "Phase 6", "Phase 7".
- **Building art:** `map/packBuildings.ts` (`PICKS`, grades per people), `art/topDown.ts` (painted fallback),
  `art/constructionSite.ts`, `art/farmland.ts`, `art/fieldTiles.ts`, `art/roadTiles.ts`. H: "More buildings from the
  packs", "Every building from the packs".
- **Townsfolk art:** `art/hkFolk.ts` (Himeko paper doll), `art/hkTexture.ts`, `art/heroForms.ts`,
  `art/combatPoses.ts`, `map/bodyMarks.ts`. H: "The townsfolk in the Himeko pack's dress", "Hair", "Combat actions".
- **Life on the map:** `map/mapWildlife.ts`, `mapBirds.ts`, `mapPets.ts`, `mapWater.ts`, `mapCritters.ts`,
  `mapSky.ts`, `mapTracks.ts`, `wideWorld.ts`, `townLife.ts`, `workSeen.ts`. H: "The living land", "The lively
  town", "The town comes alive", "More life".
- **Fight screens:** `fight/fightView.ts`, `fight/fightHud.ts`, `art/fightBackdrop.ts`, `fight/mineView.ts`,
  `deep/deepView.ts`, `portal/portalView.ts`. H: "Watching a party's fights", "Painted backdrops".
- **Menus:** `panel/panel.ts` (redraw keys, `pressing`), `panel/subtabs.ts` (`GROUPS`), `panel/details.ts`, the
  `panel/*Panel.ts` files, `shared/ipc.ts` (`PANELS`). H: "The menus redone", "Every menu in sub-tabs", "Tap for more".
- **The phone page:** `mobile/mobile.ts` (layout, zoom, pinch), `mobile/notices.ts` (the news bubble),
  `mobile/eventSheet.ts` (the event box), `mobile/tips.ts`. H: "The news bubble", "Smooth zoom", "Events told in
  full", "The first hour".
- **Sound:** `ambience.ts`, `ambienceMix.ts`, `sfx.ts`, `music.ts`, `musicScore.ts`, `musicGen.ts`, `musicMood.ts`,
  `soundZones.ts`, `audioGate.ts`, `volume.ts`. H: "The soundscape", "Music, sound and real light", "Sounds that
  match".

**Tests and tools**
- `test/helpers.ts` (`plainGame`, land helpers), `test.mjs` (the runner: parallel, slowest first, slow files split
  test by test; times kept in `out/test-times.json`, seeded from `test/times.json`; `npm test -- --save-times`
  rewrites the seed), `tools/perf-sim.mjs` (sim timing on `test/fixtures/late-town.json.gz`), the `tools/compose-*.cjs`
  sprite cutters (run by hand).
