Warning: truncated output (original token count: 109808)
Total output lines: 4076

# Chronos Settlement (formerly Little Town)

A pixel-art town that runs itself, like an ant farm. It's played mainly as a phone web app (a PWA on the
owner's Android, hosted on GitHub Pages). There's also a Windows desktop overlay (Electron): a strip above the
taskbar. TypeScript + PixiJS. `DESIGN.md` is the original design, and `README.md` covers how to play and build.

## Read this first (for every agent: Claude, Gemini or any other)

This file is long (about 430 KB). Read this section, **Priorities**, **Commands**, **Layout** and **Conventions** in
full. Everything after "Current work" is a record of what has been built: don't read it top to bottom. Search it
(grep) for the system, file or name you are about to touch, and read that part before changing it.

**How to work:**

1. Start from the latest `main` on a branch of your own (Claude uses `claude/...`; other agents use
   `gemini/<topic>` or similar). Never push to `main` directly: the owner merges.
2. Before editing a file, read it and the files next to it, and copy their style: names, comment density,
   plain-English comments, British spelling in the game's text.
3. Keep each change small and finish it before starting the next one.
4. Check your work: `npm run typecheck`, then `npm test` (about 3 to 5 minutes; every test must pass), then
   `npm run web` if you touched the renderer. Fix what fails. Never skip, delete or loosen a test to get it to pass.
5. Add a test in `test/` for any new rule in the simulation (copy a nearby test file's shape; `test/helpers.ts`
   has `plainGame` and the land helpers).
6. Add a short note for what you built in the right section of this file (or a new `##` section at the end), in
   the same style: what it does, the file, the key names and constants.
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
npm test               # headless sim tests (node test runner)
npm run web            # build the phone version into out/web (what GitHub Pages serves)
npm run build          # build only (desktop + renderer) into out/
npm run dist           # Windows installer (needs Windows; not for the cloud)
```

To preview the phone version, serve `out/web` with any static server and open it at a phone size.
`window.__game` is the game loop (`__game.sim.step()` fast-forwards), and `window.bridge.openPanel('build')`
opens a menu. Never launch Electron; the owner runs the desktop app themselves.

## Layout

- `src/shared/sim/`: the deterministic simulation. It runs at 10 ticks a second, with 600 ticks per game hour
  and 3-day seasons.
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
- **The version (the owner's ask):** the ☰ menu ends with "Version 0.59.0 · <commit> · built <day>" (`gameVersion` in
  `mobile/mobile.ts`; `tools/build-web.mjs` defines `__GAME_VERSION__` from package.json, `__GAME_COMMIT__` from
  `git rev-parse --short HEAD`, `__GAME_BUILT__` the build's day). With every merge to main, bump the minor version
  in `package.json` (0.3.0, 0.4.0, ...) in the merged branch, and tell the owner the new number afterwards.
- Saves on the phone use the keys `littletown.*`, and the desktop uses `%APPDATA%\Little Town`. Keep both, or
  existing towns are lost.

## Current work: the ant-farm redesign

- **Phase 1 is done:** the self-running town, direction, and a zoomed-out phone view with pinch-to-zoom.
- **Phase 2 is done:** coins and a shop (`src/shared/sim/shop.ts`, data in `src/shared/data/shop.ts`).
  - The planner researches Barter and builds a Trading Post, which grows by upgrade (General Store, then Emporium).
    Straight away if the land can't give what it needs (`unsourced`).
  - It crafts furnishings (items with `furnish` in `data/items.ts`), and the shopkeeper (an operator role) sets them
    out on the shop's floor grid (`shopLayout`). Appeal: more travellers, bigger purses.
  - Travellers (`s.travellers`) walk in, trade at the shop, and walk out. The planner decides what's for sale
    (`forSale`) and what to buy (`shoppingList`). Materials travellers sell count as sourceable once there's a
    shop, which is how desert towns get fiber.
  - Attractiveness (`attractiveness()`: appeal plus `s.renown`) sets the customer tiers that come (`CUSTOMER_TIERS` in
    `data/shop.ts`: travellers, merchants, nobles, magnates). Higher tiers want wares (items with `ware` in
    `data/items.ts`, unlocked by research). Served, renown rises; disappointed, it falls.
  - The planner makes wares from spare materials only, spends coins on the shop (`planShop`: extensions when crowded,
    else piece levels), and weights research toward wares for tiers it draws but can't serve (`wareGaps`).
  - Venues are general (`floor.venue` in `data/buildings.ts`: `shop` or `tavern`; the tavern chain is Fireside Inn →
    Tavern). They start bare; furnishings are commissioned (`CraftOrder.for`) only when the town can pay, and crafters
    are paid (`payCrafter` in `crafting.ts`). Renown, the log and unmet wants (`asked`) live on each venue's `b.shop`.
  - Strangers (`Traveller`) have a name, temper and `want`; keepers upsell on Social (`talkChance`). Tavern guests need
    comfort (`req`).
  - Quality (`data/quality.ts`, 8 grades) is rolled from Crafting skill; inventory qualities live in `s.itemQ`
    (kept in step by `qualitiesOf`), worn ones in `p.gearQ`.
  - Wages and gear buying: `sim/wages.ts`. With a shop, `equipAll`/`pickTool` stop handing gear out. The daily ledger
    is `s.ledger` (`earn` in `state.ts`); per-person activity is `p.recent` (`remember`).
  - Research: one person per station (`researchStations`, `freeStation`, `topicFor` in `research.ts`); the research
    task carries its station and topic.
  - The lich path: `offerLichRite`/`chooseLich`/`watchLich` in `occult.ts`, `s.lichChosen` then `s.lich` (permanent).
    `snapshot.theme` is `'lich'` once it's set; `src/renderer/theme.ts` holds the look (one stylesheet scoped to
    `html.theme-lich`) and the menus' new names, applied by the phone page, the panels and the strip's HUD.
  - The interior is the `shop` and `tavern` panels (`src/renderer/panel/shopPanel.ts`), opened by tapping the shop: an
    angled (three-quarter) view, the back wall up top and the floor in foreshortened rows (`DEPTH`), each piece a box
    with a top and a front (`TALL`), wall pieces hung (`ON_WALL`), everything painted back to front with the keeper and
    strangers as their own side-on LPC sprites (`lpcCanvas`, flipped to walk left).
  - All the new state fields are optional (no save version bump): old saves load with no coins and no shop.
- **Menus take the whole screen on the phone** (the `menu-open` class in `mobile/index.html`): the town runs
  itself, so there's little to watch while a menu is open. The tabs stay visible (along the bottom upright).
- **The phone held upright:** a slim title bar, the town filling the rest of the height (`layout()` in `mobile.ts`),
  and one slim row of tabs along the bottom (a mark over a short name: `TAB_ICONS`, `SHORT_LABELS`). The feed that
  once sat over the town is gone (the owner's ask); the news is the **news bubble** (see "The news bubble" below).
- **The phone's selected tab:** `#tabs button.on` in `mobile/index.html` has a brighter gold underline and heavier
  label, so the open menu is easy to spot in both upright and sideways layouts.
- **The phone's news bubble:** `#notice-bubble` in `mobile/index.html` is a smaller circle at the top left; on its side
  it sits below the tabs so it does not cover them.
- **The phone stays awake:** `keepScreenAwake()` in `mobile/mobile.ts` requests a screen wake lock while the page is
  visible, and asks again when it becomes visible after being backgrounded. Browsers that do not support it carry on
  normally.
- **The townsfolk's people mark:** `PersonView.origin` carries each person's own origin (or the town's for its own
  people); `folk-race` in `panel/townsfolkPanel.ts` shows its mark beside their name and its full name on hover.
- **Names by origin:** `ORIGIN_NAMES` in `data/people.ts` makes more than 3,000 seeded combinations from 16 name parts
  per origin, with the old common names kept for Settlers. `personName` chooses an unused name in that pool first;
  town arrivals, founders, and origin-known newcomers use their people's names.
- **Phase 3 is done** (the Tavern: see above).
- **Origins are done:** `src/shared/data/origins.ts` (defs: start, rules, powers), applied at founding in
  `newGame`; the rule multipliers are in `src/shared/sim/origin.ts` (asked for by people, farming, raids, crafting, the
  shop, townsfolk); powers in `src/shared/sim/powers.ts` (`castPowers`, cast by the town itself; buffs in `s.buffs`);
  looks in `src/renderer/theme.ts` (one palette per origin, CSS generated and scoped to `html.theme-<id>`, menu names,
  building tint), and each origin's menu materials and shapes in `src/renderer/skins.ts` (appended to the theme's
  CSS: small inline SVGs; use `pseudo()` to put `::after` on a selector list). Undead and machines are both
  `tireless` (state.ts).
- **Rival origins are done:** `src/shared/data/rivals.ts` (each origin's lord, army and hostile spells), raid kinds
  `rival_*` in `data/raids.ts` (with `origin` and `leader`; never picked for the town's own origin), enemies and
  relics in `data/enemies.ts` and `data/items.ts`. `src/shared/sim/rivals.ts` casts the lords' spells
  (`rivalsInRaid`) and holds the hexes on `Raid.hex` that raids.ts and powers.ts read (`heldBack`, `fogAim`,
  `wardOf`, `frenzyOf`, `turretsDown`).
- **Spell visuals:** casts are recorded with `castSpellFx` (state.ts: caster, targets by id, how long) from
  `castPowers` (the `TOUCH` table in powers.ts says what each power touches) and `rivalsInRaid`; `snapshot.spells`
  carries them; `src/renderer/town/spellsView.ts` draws them (looks per spell in `town/spellLooks.ts`: bolts,
  streams, roots, rain, fog, rings, domes, arrows, flasks...), above the day-and-night tint so they glow.
- **The vampire castle:** the old strip's keep of floors and stairs is gone; the castle is one level of rooms (see "The castle as one body of rooms" under the top-down town).
- **Spell sprites:** `SPELL_SHEET_DEFS` in `art/effects.ts` (pvfx and Alenia sheets), matched to spells by `sprite` in
  `town/spellLooks.ts` and placed by `SHEETS` in `spellsView.ts` (foot offset, frame rate, glow). Rival troops use
  the golem/elemental stills (`elem_*`) and strip sheets with a `feet` share (`creatures.ts`).
- **Beasts and lurkers:** biome-only raid kinds (`biomes` on a `RaidKind`: lions, wild dogs, crocodiles); the
  Behemoth joins beast raids (`BEAST_RAIDS` in raids.ts). `src/shared/sim/lurkers.ts`: raids that start inside the
  town (`startRaid(..., inside)`: the Mimic at the shop by night, possessed tomes at a library) and their rewards
  (`lurkersBeaten`, from `endRaid`).
- **The nomads' seasonal round:** `nomadic` in an origin's rules. `src/shared/sim/nomads.ts`: `s.nomad` (home ground,
  summer pasture, current camp; `campX` follows the camp), `updateNomads` (moves at midsummer and midwinter, by day;
  settles in the Industrial era), `moveCamp` (`PORTABLE` tents move and are re-pitched as blueprints at `PITCHED`),
  `buildOrigin` (rooted great works go on the home ground), the wagon circle (`circleWagons` at a raid warning; the
  `wagon_circle` def is `never` built by the planner) and no walls while nomadic. The renderer follows the caravan
  (`snapshot.nomad.move`). Their tents and the settled caravan city's adobe are in `src/renderer/art/nomadArt.ts`
  (style `nomads_city` once `snapshot.nomad.settled`); parked wagons and old camp marks (`nomad.left`) in animalsView.
- **Origin buildings:** `src/renderer/art/originStyles.ts`: each origin's own homes, walls and gates; every other
  building gets its materials swapped (`reclad`) and dressing on top. `buildingArt` takes the style (the theme id).
- **Research, doubled:** general topics per era and a six-topic **heritage** line per origin (`origin` on a `Topic`,
  branch `heritage`; built with `T()`/`heritage()` in `data/research.ts`, whose `unlocks` text comes from
  `describeEffects`). New effect kinds: `rule` (the origin levers: build, craft, travellers, prices, fight, guard,
  day, night; multiplied in by `sim/origin.ts` through the cached `researchMods`), `quality` and `powers` (recharge
  and duration, in `castPowers`). `prereqsMet`/`canQueue`/`queueResearch` take the town's origin; another origin's
  heritage is refused (`foreignHeritage`). (The Research tab's Hide toggles went with the tech tree: see below.)
- **Animal husbandry (Phase 4):** pens in the background (`chicken_coop`, `goat_pen` from Domestication;
  `pig_sty`, `sheep_fold`, `cattle_pasture` from Animal Husbandry), their herds in `data/livestock.ts` (`HERDS`) and
  `sim/livestock.ts` (`b.herd`; `tendHerds` hourly: breeding, winter fodder, starving; `workPen`, tended through the
  Farm job's `farm` task after the fields; `rustle` when raiders get away). New materials `eggs`, `milk` (food),
  `wool` (spun into cloth at the loom). The animals are drawn by `town/herdsView.ts` (`art/livestockArt.ts`) in the
  background layer.
- **Terrain art:** `art/terrain.ts` paints each walkway and midground tile as one texture (road with ruts, stones,
  puddles and a verge; footpaths; forest floor; cobbles; marsh pools), continuous across tiles via `noise()` on
  world x. `art/sprites.ts` has the scenery (trees with bark and leaf clusters, stumps, logs, ferns, mushrooms);
  the background has mountains and a wooded ridge, hedgerows, furrows, river banks.
- **Offline pacing:** `awayPlayMs` in `sim/offline.ts`: the first half hour away passes as in play, the rest at a
  quarter pace, and at most 1 game day passes for one absence (`MAX_OFFLINE_MS`).
- **Raids wait for you:** `src/shared/sim/raidWait.ts`. During the catch-up after time away, raiders reaching the gate
  hold there (`holdAtGate`: `Raid.waiting`, the town paused, a `gate` prompt, "Watch the fight", with no countdown);
  answering it or unpausing lets them in (`openGate`). Held more than `RAID_WAIT_MS` (12 real hours, across visits), or
  away that long after they came, and the raid plays out alone (`Raid.alone`). Phone alerts (ntfy) are shared by both
  apps: `src/shared/alerts.ts` (`plan` looks one absence ahead with the forecast, stops at the first raid, and times
  them by the away pace, `awayRealMs`); the phone page books them when it goes to the background and drops them when
  it comes back (`mobileBridge.ts`, keys `littletown.alerts`, `littletown.scheduledAlerts`); the panel is in the ☰
  menu. The look ahead takes seconds on a phone, so the page works it out while open, in slices (`startForecast`,
  redone every minute), and on leaving sends the alerts at once, all together, as plain `keepalive` requests (title,
  tags, priority and time in the query string). The phone page's CSP has `connect-src 'self' https:` for ntfy: before
  it, every alert was blocked.
- **One choice event while away:** during catch-up a choice event pauses the town (`holdForEvent` in `events.ts`:
  `s.event.held`, `s.paused`) and the catch-up stops; answering it (`answerEvent`) sets the town going. The forecast
  stops at it too (kind `event`), and its alert is always sent when alerts are on (high priority).
- **Hide toggles:** `panel/hide.ts` (`HidePrefs`): Build and Crafting each have a "Hide:" row, kept in
  `localStorage` (`buildHide`, `craftHide`); the Research tab's went when it became a tree.
- **Upgrades and fewer homes:** `UPGRADES` in `data/buildings.ts` (homes: lean-to or hide tent → longhouse →
  cottage → row houses → apartments → dome; research stations; healer's hut → infirmary; watchtower → radio tower →
  drone hub). `upgrade(s, back, id, absorb?)` in `sim/buildings.ts` can pull down a neighbour of the same kind and make
  the two one (two lean-tos become a longhouse). The planner's `consolidateHomes`: when beds are wanted it rebuilds a
  small home bigger before building another; in a quiet spell it upgrades one anyway (up to `SLEEP_ROUGH` sleep out
  meanwhile). New homes are paced by beds (`lastHomeBeds`), so bigger homes don't speed growth. Soak: about 10 homes
  (mostly longhouses) for 30 people at day 15, where it was about 28.
- **Choice events:** 500 in all (the owner's ask): the 100 of `EVENTS.md` in `src/shared/data/events.ts` and 400 more in
  `moreEvents1.ts` (daily life, weather and seasons, the shop and tavern, fields and pens, the wilds), `moreEvents2.ts`
  (eight or so per origin, and prisoners), `moreEvents3.ts` (the Medieval, Industrial, Modern and Space ages) and
  `moreEvents4.ts` (faith and omens, crime and law, children, elders and the dead, the land and the roads, war); the
  types, shorthands and `when` helpers (`season`, `biome`, `children`, `elders`, `tavern`, `sea`, `library`, `walls`,
  `mines`, `graveyard`, `hero`, `pack`, `monsters`, `strangers`, `prisoners`, `horses`) are in `eventKit.ts`. A `later`
  effect waits at most 72 hours (the test gives it three days). The data: (`EVENTS`: title, text, `who`
  for a townsperson in it, `when`, two or three options with one `default`, each a list of `EventEffect`s: notes,
  morale and lever marks, gains and losses, coins, renown, newcomers, leaving, deaths and wounds, sickness, raids
  sooner or later, research, the Occult, chances and `later` effects). `src/shared/sim/events.ts`: `maybeEvent` hourly
  (one at a time, `EVENT_GAP_HOURS` apart, none repeated within 25), a prompt of kind `event` that waits
  `EVENT_HOURS` in play and holds its clock while the town is caught up (`holdEventClock`), `answerEvent`. Marks are
  `s.marks`: a lever's are multiplied in by `markMult` in `sim/origin.ts`, morale ones join `mood()`. The tests'
  `plainGame` turns events off.
- **Rally and held powers:** `src/shared/sim/rally.ts`: in a raid a defender's tap card offers **Rally!** (the `rally`
  command): harder, faster blows for `RALLY_TICKS` (`p.rallied`, read by `defenderAttack` and `doDefend`), a second
  wind, then a town-wide cooldown (`s.rallyReady`); the rallied pulse gold (peopleView). `PersonView.rally` and
  `snapshot.rallyIn` drive the card. A power held back (`s.heldPower`, `holdPower`/`castHeld` in `powers.ts`; the Plan
  tab's Hold back / Cast now) is never cast by the town; in a raid a button by the clock casts it (`hud.ts`).
- **Morning report card:** `src/shared/sim/highlights.ts` picks the three biggest things from the away report's
  milestones (deaths together first, then a new age, raids, weddings, newcomers, great buildings, research), each with
  a building or a townsperson to show; stored on the report (`JournalEntry.highlights`). The away card draws them as
  pictures (`textureCanvas` in `art/pixelArt.ts`; the picture callback in `main.ts`), buttons above the long list.
- **Follow a hero:** a person's tap card has **Follow** (the `follow` command, `s.hero`; `snapshot.hero` while they
  live). The camera no longer follows them, nor a raid's lead raider (the owner's call: it kept jumping); it moves only
  when the player moves it, or once to the gate as a battle begins. Their big moments (journal milestones with their name) are a forecast kind, `hero`, sent as phone alerts
  (the `hero` alert setting, on by default).
- **Expedition stakes:** the town plans every party (`planParty` in `sim/expeditions.ts`: the fittest for the trip,
  the founder stays unless alone, half the town kept home, roles, horses, a truck); the player picks the destination
  and the stakes (`sendParty`, the `sendParty` command): safe (cautious, packs 75%, half the fights) or risky (bold,
  packs 150%, more fights), `STAKES`, `Expedition.stakes`. The Expedition Board shows the planned party and the two
  buttons (the manual picker is gone).
- **More to watch (all eight done):** raids wait for you, a day at most away, choice events, rally, a held power, the
  report card, following a hero, expedition stakes (each above).
- **Fonts:** `src/renderer/fonts.ts`: a display and a body font for each look (`FONTS`, keyed by theme id; `town` is
  the base game), Google Fonts (OFL) bundled from @fontsource by `build.mjs` into `fonts/` (so they work offline).
  `theme.ts` declares the faces on every page and sets `--font-display`/`--font-body` (a theme overrides the two);
  the pages' CSS uses the variables, never a font name. Titles, headings and tabs take the display font.
- **Texture and scenery detail:** every sprite painted with `paint()` gets a surface grain (`grain` in
  `art/pixelArt.ts`: fine and clumped light/dark noise, `GRAIN`; pass 0 to `paint` to skip it). The Graphics-drawn far
  land is textured in `townView.ts` (mountain strata and crags, a mottled ridge canopy, turf on the hills). More kinds
  underfoot (`sprites.ts`: pebbles, twigs, tall seeding grass, bramble; twice the flower variants and more colours),
  placed from a second random stream per tile (`0xc3` midground, `0xb3` background) so older layouts don't move.
  Autumn leaves drift over the town (`town/leavesView.ts`); flocks cross the sky twice as often. Frame rate checked:
  about 57 fps where it was 60 in the headless browser.
- **Phase 4, more farming (done):** new fields in `data/crops.ts`: `flax_field` (fiber), `vegetable_patch`
  (`hardy`: full speed in autumn), `orchard` (`establishHours`, then `crop.bearing`: fruits again without sowing).
  New foods `vegetables` and `fruit`. Soil (`crop.soil`, `SOIL`): each sown harvest drains it and scales the yield; it
  rests while fallow and in winter, and pens with animals muck it. A tired field rests unless food is under 2 days
  (`fieldToWork`). Blight (`BLIGHT`, daily in `tendFields`) is worse in the wet and with many fields of one crop, and
  spreads between them. The planner's `cropPower` favours a mix (and no orchard while food is short). `ripensInTime`
  stops autumn sowing that winter would kill. The harvest home is a morale mark at the turn of winter. The research
  effect `soil` (Crop Rotation, Fertilisers) lessens the wear and the blight. Tests: `test/fields.test.ts`.
  - The new crops are Stone Age (Garden Crops, Orcharding), since towns are still there at day 20; the planner scores a
    new food crop +12 for the mix. Fields upgrade (`UPGRADES`: `garden_plot` → `open_field` (Ard Plough, width 8, two
    plots merged) → `estate_farm` (Crop Rotation)) through the planner's `consolidateFields` (both plots fallow; in
    winter, with food to spare, or when more food is wanted). The planner counts fields as garden plots' worth of food
    (`plotsWorth`), so a town has about 12 fields where it had 20.
- **Roomier venues:** Trading Post 8x5, General Store 11x6, Emporium 14x7, Fireside Inn 9x6, Tavern 13x7 (`floor` in
  `data/buildings.ts`), up to `MAX_EXTENSIONS` (5) extensions of 2 columns and a row each. Aisles are kept clear
  (`fixedCell` in `shop.ts`: from the door up to the row in front of the counter, and along it). The keeper fills at most
  `FILL_MAX` (half) of the free floor (`fill`, checked in `spotFor`); past that the venue is crowded and `planShop` saves
  up to extend it.
- **Tavern rooms:** guest rooms upstairs (`roomsOf`: one per 3 cells of width, so extensions and the Tavern add rooms). Beds are furnishings (kind `bed`: `straw_pallet`, `box_bed`,
  `feather_bed`), one to a room, set at y `UPSTAIRS` (-1) with x the room; the common room stays for tables and hearths. `lodge` in `shop.ts`: after being served, an evening guest (`LODGING` in `data/shop.ts`) takes the best free
  bed they can pay for (`Traveller.bed`), stays till morning, and pays; with none, they ask (`asked.bed`), which the
  planner's `furnishValue` turns into a bed order. The tavern panel draws the guest rooms as a storey over
  the common room (`upstairs()`, `UPSTAIRS_H`), the sleepers in their beds (`asleepHour`), and a Rooms line
  (`ShopView.rooms`, `beds`, `lodgers`).

- **Out of the Stone Age:** towns learned everything by day 3, then stalled for want of the Bear Cave totem (only a
  player-sent party fetched it). `src/shared/sim/caveBear.ts`: with the Elder's Council learned, no totem, and no party
  headed for the cave, after `BEAR_WAIT_HOURS` (36) the Cave Bear raids the town (raid kind `cave_bear`); killed, it gives
  up the totem (`caveBearBeaten`, from `endRaid`); if not, it comes again later. Towns now reach the Medieval era by days
  5 to 8. The town note says so.
- **Succession:** the founder's death no longer ends the game while a grown-up is left: `heirOf` in `health.ts` (the
  partner, a grown child, else the best at Social then Research; someone at home first) becomes `s.mainId`, and the town
  mourns (`SUCCESSION_MORALE` for `SUCCESSION_HOURS`). Only children left, or nobody: the camp breaks apart.
- **Medieval tuning:** work is stretched by the era of what's made, not the town's (`eraOfResearch` in
  `data/research.ts`, `earlier` in `data/eras.ts`): a lean-to, a spear or a garden plot takes no longer in the Medieval
  era; gathering from the land isn't stretched at all. The planner makes a material by a recipe it has the makings for
  (cloth from fiber while there's no wool: it used to pick the first recipe, and towns waited on wool forever).
  Blueprints that haven't moved for `STALL_HOURS` (12) and wait on something the town has none of are set aside
  (`shelveStalled`: refunded, their kind not tried again for `SHELF_HOURS`), so they don't hold every build slot. Soak
  (8 per origin, 15 days): alchemists 29.0 (was 24.8), druids 32.4 (28.1), vampires 32.6 (29.5), the rest steady.
  Settlers stay lowest (about 23): they start with one person where the others start with three.
- **Lighter nights:** the map's night tint (`NIGHT_TINT` in `map/mapView.ts`) is a moonlit `0x8a96c8`.
- **Defenders hold the town's edge:** `townEdgeX` in `raids.ts` (just past the outermost building, walls included, not the
  fields; else the camp's cleared ground). Defenders gather there before a raid (`rallyX`) and in a fight go no further out
  (`doDefend` in `people.ts`), except as far as `THROW_RANGE` after an enemy archer shooting in. Raiders fleeing with loot
  or a captive get away once past it. Soak: growth up a little, about 45% fewer deaths (toughened again: see below).
- **Raids bite again** (`raids.ts`, constants in `data/raids.ts`): the budget grows with the town's grown-ups
  (`RAID_BUDGET_PER_PERSON`), so does the raid's size (`RAID_SIZE_*`: one more raider per 4 beyond 8, up to 16) and its
  raiders' `might` (health and blows, `RAID_MIGHT_*`: 3% per grown-up beyond 8, up to double). A raid of people of at
  least `FLANK_MIN` may split (`FLANK_CHANCE`, more each day): a party comes round the other end (`Raider.side`, which it
  also flees back to), where nobody is waiting. Struck down by a raider, someone may die on the spot (`KILLING_BLOW`
  0.3, bosses 0.6, the founder 0.12) instead of lying wounded to be tended. Soak (4 towns, 15 days): raid deaths back to
  the old rate or above (settlers alone 8, vampires 2, druids 4, dwarves 5, liches 5); knights and werewolves still
  rarely lose anyone (they didn't before either: armoured and fierce).
- **Night windows:** `ShopView.night`; the shop's and tavern's windows show the night sky.
- **Ready-made founders:** `src/shared/data/founders.ts` (`FOUNDERS`: three per origin, each with a name and title, a
  line of story, a background named for the origin, a trait or two, and a look). The New Town screen shows the
  origin's three as cards with their pictures (only the name can be changed); the old look editor, background and trait
  pickers are gone. `FounderSpec.pick` (checked by `cleanFounder`) makes `makeFounder` in `state.ts` use the def.
  `Look` has optional founder pieces: `body` (`skeleton`: liches and machines, tinted by `skin`), `ears`, `eyes`
  (`red`), `wear` (always worn: `layersFor` in `lpcCompose.ts` puts it first, and `peopleView` skips the rolled
  wardrobe) and `height` (dwarves 0.86). The skeleton body and red eyes were added to `lpcData.json` from the LPC
  sheet (rows 3, 7, 11, 15, 19, 20 are the right-facing rows the data keeps). Children take a parent's `ears`.
- **Sharp on the phone:** the phone page scales the strip with a CSS transform; it tells the strip its scale
  (`__setStripScale` in `main.ts`), which draws at `devicePixelRatio * scale` so the picture isn't stretched. `layout()`
  in `mobile.ts` snaps the scale to whole screen pixels per art pixel, preferring an even number (for the fine grid).
- **Art on a fine grid:** `paint()` (`art/pixelArt.ts`) draws on a canvas `FINE` (2) times the art's size, carried as the
  texture's resolution (sizes unchanged). The Painter's usual methods fill whole art pixels; `frect`, `fpx`, `fline` draw
  on the fine grid; `reset()` undoes a translate (never `setTransform(1, ...)`); `pixels()` reads back by art pixels. A
  `detail()` pass over every painted sprite: Scale2x-rounded steps, light on tops and left edges, shade on bottoms and
  right edges, a crease where a light surface meets a darker one, and a material texture guessed from each colour
  (`stuffOf`: wood grain along the run, straw, stone pits, leaf glints, brick); `DetailOpts` (`tile` for ground tiles,
  whose sides carry on; `stuff: false`). Shared pieces have hand detail on the fine grid: `log`, `beam`, `roof` (straw
  ends, eaves fringe), `bricks`, `concrete`, `stones` (buildings.ts), castle `blocks`, `fineLeaves`, bark, pine needles,
  boulder cracks (sprites.ts), grass blades, speckle and pebbles (terrain.ts). `reclad` swaps near colours too (keeping
  the difference), so the fine shades follow an origin's materials.
- **Lights and air:** `paint()` finds lamps (`LAMPS`, `registerLamps`: window glow, candles, flame; each origin's window
  colour) and water; `PixelArt.lights` and `.shimmer` (glint frames). `Layer.place` adds a glow per light to the layer's
  `glow` container and plays the shimmer over the water. TownView's tint is on `scene` (sky, land, town, weather; main
  adds to `town.scene`); `town.lights` holds the layers' glows over it, kept in step in `setCamera`, faded in after dusk in
  `setDaylight`. `town/ambientView.ts`: `ChimneySmoke` from homes' chimneys (`BuildingsView.chimneys()`, the top of the
  roof), `Mist` bands (dawn and wet), a steady haze over the far land, all from `airFor(hour, season, weather)` via
  `town.air()` each frame. Soft shadows (the `glowTexture` tinted black) under people, raiders and finished buildings.
- **Finer townsfolk:** `lpcFrame` (`art/lpc/lpc.ts`) puts each composed character frame on the fine grid through
  `fineTexture` (`pixelArt.ts`: doubled, the steps rounded by `detail` with `shapeOnly`).
- **More hand detail:** origin roofs, domes and arches (`originStyles.ts`), nomad tents and adobe (`nomadArt.ts`), the
  castle's windows, shelves, candles and rugs (`castle.ts`), the farm animals (`livestockArt.ts`).
- **Quality steps down on a slow device** (`main.ts`): from 15 s after start, in 10 s spells while visible, under 28 fps
  drops to quality 1 (no smoke or mist: `TownView.calm`), then 0 (the plain screen resolution).
- **Settlers bring a friend:** a ready-made founder can bring companions (`FounderDef.brings`, added in `newGame`); each
  settler founder brings one, so the classic town no longer starts a person short (soak: about 21.5 people at day 15,
  where a lone founder reaches about 15 with the tougher raids). A town founded without a ready-made founder (the tests)
  still starts alone.
- **Menu themes leave colour swatches and cards alone:** the button rules in `theme.ts` and `skins.ts` skip `.swatch`
  and `.card` (they once painted the colour choices blank and made the Fae's pick cards unreadable).

- **Tower-defence raids (done):** every raid is a battle on a map built from the town (`src/shared/sim/battle.ts`,
  part of the deterministic sim: `Raid.battle`, `Raider.bt`). `startBattle` runs when a raid turns active (`battlesOn`:
  `s.battles !== false`; the tests' `plainGame` turns it off), `stepBattle` each tick from `updateRaid`; raiders through
  the trail (`bt.out`) come on into the town as before, and the in-town loop skips the rest.
  - The map (`layOut`): since the top-down town it is laid on the town's own land (see "Phase 5" under the top-down
    town below): the trail from the fog to the gate, spots in land cells. (It was a zigzag trail on a map of its own,
    with the town's buildings as decor and an origin's shape; that is gone.)
  - Phases: `placing` (`PLACE_TICKS`, 30 s; `battleGo` starts at once), `fighting`, `breather` between waves (bigger raids
    come in up to 4 waves of `WAVE_SIZE`), `done`. Whoever isn't placed is placed by `autoPlace` (blockers by cover,
    shooters walls first; the badly hurt kept back); `autoBattle` (`s.autoBattle`, remembered) and `Raid.alone` place
    everyone at once and cast the spells at `bestAim`.
  - Fighting: raiders walk the trail (`PACE`), held by a blocker with room (`capacity`: melee skill, the founder one more),
    shoot fighters in reach, rout below a quarter health (`back`, quickly; the wave doesn't wait). Fighters strike on
    `INTERVAL` with `GROUND` (1.5) on their blows; they fall back below `FALL_BACK`; deaths are real (`attackPerson`).
  - Spells: `aimableSpells` (powers that touch foes); the player taps one and the trail (`battleCast` → `castAt`, which
    aims `foes()` through `b.aim` at `AIM_RADIUS`).
  - Mages: the class `mage` (`data/classes.ts`, research The Arcane Arts, Medieval) is not rare: one for every
    `perPeople` (5), given out like every calling (`assignClass` in sim/classes.ts). They fight from range; their fire (`mageFire` in
    raids.ts, `MAGE_*` in data/raids.ts) ignores armour and bursts over those beside the target for half, in town and on
    the battle map (`MAGE_INTERVAL`, `MAGE_BURST`). Drawn as the sage sheet's blue wizard (`CLASS_LOOK` in peopleView).
  - The screen: the battle is drawn on the town's own map (`map/mapBattle.ts`, see "Phase 5" under the top-down town) with the HUD bars of `battle/battleHud.ts`; on the phone it takes the whole screen (`body.battle` in `mobile.ts`).
  - Tuning: `GROUND` 1.2, `FALL_BACK` 0.12, raiders rout at `ROUT` 0.15 (the first cut, at 1.5 and a quarter,
    roughly halved deaths: settlers 2 where it was 8 with battles off). Soak (4 towns per origin, 15 days, people and
    deaths): settlers 23.8/10, vampires 28.3/12, druids 25.5/3, dwarves 34.0/2, werewolves 27.3/2, knights 32.0/1,
    liches 24.8/3, merfolk 31.0/6, nomads 31.0/3, fae 31.5/3, alchemists 28.3/5, machines 25.8/0; no town died out;
    battles about 80 to 125 s; about 4 mages a town by day 15. The planner values a topic that teaches a common calling
    (+12, +24 raided or on defence).

- **The armoury (done):** `data/weapons.ts` (`FAMILIES`: 23 families with their quirks; `ROWS`:
  name, family, tier, era, research, icon; stats, cost and station worked out from those; `tierDamage`), `data/armour.ts`
  (`SETS` per era: cloth, light, medium, heavy body and head pieces, three shields, two trinkets; `ArmourWeight` on
  `ItemDef.weight`). New effects: `speed`, `crit`, `pierce`, `cleave`, `stun`, `reach`, `undeadDamage`, `machineDamage`
  (weapons), `dodge`, `power` (armour). **+N:** a piece's number holds its grade and its +N (`piece`, `gradeOf`,
  `plusOf`, `pieceLabel` in `data/quality.ts`; `rollPlus` from Crafting, `PLUS_STEP` per +), rolled in `finishPiece` for
  `ARMS` slots. `weaponOf` (combat.ts) is the weapon's stats with grade and +N; `hitDamage` and `afterBlow` apply the
  quirks (also in raids' `defenderAttack` and on the battle map). Foes have a `natureOf` (beast, undead, machine,
  person) and `enemyArmor`. The planner's `weaponWorth` favours a mix of families. Crafting has Weapons and Armour hide
  toggles.

- **Classes and levels (done):** `data/classes.ts` (25 lines, `stages` five names each, all 125 distinct; role,
  `ranged`, `rarity`, `affinity`, `armour` weights and `weapons` families allowed, `stats`), `data/levels.ts` (`levelOf`,
  `stageOf`, `classStat`, `hpMult`, `levelPower`; `xpToLevel`, `LEVEL_SHARE_*`), `sim/classes.ts` (`assignClass` once,
  weighted by `classPull` and decided by the seed; `classesHourly` gives classes and announces evolutions; `gainLevelXp`
  from `gainSkill`; `canWear` used by `equipAll`, `buyGear` and the planner's `wielders`). The last stage needs
  `p.ascended` (`ascend`: a small daily chance from level 45, `ASCEND_DAILY`; a rare legendary wanderer; quests and
  events later). Class stats feed `personFighter`, `maxHp`. Armour pieces have a `tint` (worn, `BY_WEIGHT` in held.ts)
  and `hue` (icon). Spells (`data/spells.ts`, 160, `spellsKnown`) and skills (`data/abilities.ts`, 200,
  `abilitiesKnown`) are data so far, with effects from `data/effects.ts`.

- **Watching a party's fights (done):** the Expeditions tab's **Watch** (the `watch` command, `s.watching`,
  `snapshot.watch`) swaps the town for `src/renderer/fight/fightView.ts` (`FightScene`): the party walking right between
  fights, and in a fight the foes on the left and the party on the right, as in the old Final Fantasy games (numbers,
  hit flashes, each spell's element colour), with blue windows from `fight/fightHud.ts` (the action's name, the foes,
  the party's health and time gauges, Back to town). On the phone it takes the whole screen like a raid's battle.
  - **25 scenes** (`src/shared/data/scenes.ts`: `SCENES`, `ROUTES` per destination, `sceneFor`): 17 outdoors and 8
    inside dungeons (cave, keep, dragon's den, crypt, machine vault, ship's hold, factory, bunker). On the road it's the
    land on the way; arrived at a dungeon, it's inside. The town's biome swaps the green ones (dunes, tundra, coast).
    Painted by `src/renderer/art/fightBackdrop.ts` (each scene a recipe in `OUT`/`IN`: sky, far land, middle features,
    ground, path, water, props, front; walls, decor, columns, roof, floor) in four layers that scroll at their own
    pace (`Backdrop.pace`). `window.__scene` forces one, for previews.
- **Raiders as seasoned as the town:** `seasonedMight` in raids.ts (`RAID_MIGHT_PER_LEVEL` 0.07 per level of the
  grown-ups' average, up to `RAID_SEASONED_MAX`), since classes, spells and skills made defenders much stronger. Levels
  past `LEVEL_STEEP` (25) cost `LEVEL_STEEPNESS` (1.12) more each, so the last evolution stays rare: by day 15 the best
  in a town is about level 13 to 16 since levelling was slowed (see "Slower levels"). Soak (4 towns, 15 days, people/deaths): knights 33.0/2, liches 26.8/7, settlers
  17.3/8, vampires 29.5/5.
- **A set-up stage before every wave (the owner's complaint: defenders ran out past the raiders):** fighters were
  sent to spots along the whole trail, out to the fog where the raiders come out, and the 30 s count ran out while
  they walked. Now blocking and ground spots lie only on the last `HOLD_REACH` (14) cells of trail before the gate
  (the raiders walk the rest under the towers), and when the count is up (or, on auto, once everyone stands ready) the
  town places whoever's left and the raiders stay in the fog until everyone placed has reached their spot
  (`Battle.settling`, `onTheWay`), never longer than `SETUP_MOST` (90 s) from the stage's start (`Battle.opened`; the
  breathers too). The battle bar says "Taking positions · N still on the way" (`BattleView.onTheWay`); on auto it
  shows that in place of the count. Test in `test/battle.test.ts`.
- **Many ways in, winding (the owner's ask, after the RPG tower defences: Fantasica, Kingdom Rush, Arknights):** a
  raid comes down `lanesFor(s)` ways from its side (2, then 3 at 6 fighters, 4 at 12: `LANE_PER_FIGHTERS`,
  `LANES_MOST`), plus one from the other side for a flanking party (`BattleMap.sides`, `laneSide`; older battles read
  the second trail as the flank). `lanesOf` in battle.ts: the first lane comes out of the fog where the straight trail
  did, the others turned round the gate either side (`SPAWN_TURN`; a sea raid's shifted along the shore); each is a
  `windingTrail`: `BENDS` (3) bends swung off the straight way, alternately either side, by random amounts (`SWING`,
  the last one nearer the gate `SWING_NEAR` so the raiders zigzag in under the towers), kept outside the town (never
  nearer the camp than the gate), each stretch the cheapest way over the land (`leg`). Seeded by the town and the tick
  (`layOut(..., salt)`), so a raid replays the same and the next raid's trails differ. The raiders of each wave are
  dealt over their side's lanes in turn. Out in the far reaches (more than `FAR_FROM_GATE`, twice `HOLD_REACH`, from
  the gate) they walk `FAR_PACE` (1.8) as fast, since winding trails are long. **Shooters stand where they see the most
  trail:** the ground spots are the free cells that have the most of the held stretches (out to `SHOOT_REACH` 1.25
  `HOLD_REACH`) of every lane in bow range, `GROUND_PER_LANE` (3) a lane, `GROUND_APART` apart, never where a far
  stretch runs nearer than a held one (the bends and crossroads, as the tower defences place their archers); the
  town's placing (`autoPlace`) counts every lane. **Traps lie on the path:** a trap the town has built that no trail
  crosses is laid on a way in for the battle (`TRAP_FROM_GATE` before the gate, the next on that lane `TRAP_APART`
  further out, the lanes in turn), so every trap bites. Tests in `test/battle.test.ts`.
- **Weapon range (the owner's ask):** every weapon has a `range` in battle-map cells (`ItemEffects.range`; by family in
  `FAMILIES`: dagger and claws 1, sword, axe and mace 1.2, flail and great weapon 1.5, scythe 1.6, spear 2.2, polearm
  2.6, thrown 3, sling, wand and pistol 3.5, staff 4, bow 4.5, crossbow and automatic 5, longbow and energy 6, long gun
  and heavy 6.5; the older weapons in items.ts and the boss trophies by hand). `weaponRange(p, shooter)` in combat.ts:
  the weapon's range; a shooter with no ranged weapon throws (`THROWN_RANGE` 3) or a mage casts (`MAGIC_RANGE` 4); bare
  hands `UNARMED_RANGE` 1. On the battle map a fighter strikes only raiders within it (plus `WALL_REACH` for a shooter
  on a wall), so a spear on a blocking spot reaches the raider stepping up behind the one it holds. Shown on each
  weapon's card (`statLines`: "Range N cells") and the Character tab (`PersonView.battle.range`), and in the generated
  weapons' descriptions. Test in `test/weapons.test.ts`.
- **Battle speed:** the raid battle's top bar has a speed button (1×, 2×, 3×; the `battleSpeed` command,
  `s.battleSpeed`, kept for later battles). `battleSpeedNow` (battle.ts) is read by `GameLoop.pump`, which runs that
  much more sim time while a battle is on; back to the town's pace when it's over.
- **The bestiary (from the Craftpix packs):** `tools/compose-sheets.cjs` (run by hand; needs Playwright's Chromium)
  turns each pack's per-animation strips (or the painted bosses' frame folders, scaled down) into one sheet per
  creature in `src/renderer/art/creatures/packs/` (rows: walk, attack, idle, hurt, dead; frames cropped to the creature,
  feet on the bottom edge), with `packs.json`/`packs.ts` (layout) and `src/shared/data/packSheets.ts` (sheet ids and
  figure heights). The sheets are files beside the page (copied by `build.mjs` and `build-web.mjs`), not inlined.
  `creatures.ts` folds them in (`PACK_DEFS`); `creatureFrame` takes a pose (`idle`, `hurt`, `dead`: the fallen lie down).
  `src/shared/data/bestiary.ts`: about 40 foes, 12 bosses with kits and relic trophies, 14 raid kinds, and 12 lairs
  (legendary destinations with map spots and scenes), merged into ENEMIES, RAID_KINDS, ITEMS, DESTINATIONS,
  MAP_SPOTS and ROUTES. `test/bestiary.test.ts` checks every pack sheet is used. `atPlace` (data/expeditions.ts) says
  "at The Labyrinth" rather than "at the The Labyrinth".
- **Monsters from the Himeko Sutori sprite share (the owner's new assets):** a paper-doll character pack at the assets
  repo's top level (bodies, outfits by calling, ~150 weapons and hand items, helms, shields, hair; monsters in `Large
  Humanoid/`, `Slime/`, `Tyrant/`, `Undead/`, `Other Monsters/`): every sheet is 8 poses by 4 facings of 128px cells
  (front, left, right, back: stand, two steps, arm raised, lunge, two punches, kneel), layers laid one on another (the
  2048 sheets are the grid doubled). `himeko(id, layers)` in `tools/compose-sheets.cjs` composes a creature's layers and
  cuts the right-facing row into the usual pack sheet (`HK_POSES`: walk step-stand-step-stand, attack raise-lunge, idle,
  the kneel for hurt and dead). 17 sheets (`hk_*`): ogre and horned ogre, demon and armoured demon lord, the brass
  juggernaut, the tyrant, slimes in five colours, the mummy, the ghost, three zombies, the imp; they stand for the ogre,
  slimes, mummy, zombies, wraith and the Lich Lord (enemies.ts), the Ooze Mother (dungeonBosses.ts) and 14 of the
  menagerie (`HIMEKO_LOOK` in menagerie.ts: hill ogre, brute and ring demons, brass and steam golems, four slimes,
  two mummies, two zombies, the red imp). The ogre keeps `nature: 'person'` (stills counted as people). Credits in
  CREDITS.md (the pack's terms ask for three lines of attribution).
- **The townsfolk in the Himeko pack's dress (the owner's call: founders too, everywhere they're pictured):**
  `tools/import-himeko.cjs` (run by hand) copies the 606 layers the dressing uses into `src/renderer/art/himeko/` (each
  cut to the four drawn rows, 1024x512, and made a palette PNG by `tools/pngPalette.cjs`: 5.4 MB), with
  `art/himeko.json` (the feet's place, the keys); both builds copy the folder beside the page, outside the precache (a
  layer is fetched when first worn and kept). `src/renderer/art/hkFolk.ts` (no Pixi): `hkLayers(who, doing)` stacks a
  person back to front: the hair behind, the body by sex and skin (light, tan, dark; bone for the raised dead), a scar,
  eyepatch or freckles, a beard, the outfit of their calling (`OUTFIT`) at their stage's grade (`GRADE`; a founder at
  least the third; no calling: by the armour they wear, else travelling or peasant clothes), the hair in front (men have
  bangs: the pack has no men's hair), a helm by the head piece's weight (else a founder's crown, a calling's hat:
  `BARE_HEAD`), a shield, and in a fight the weapon of its family by tier (`WEAPON`; claws and thrown weapons are knives,
  a sling is bare-handed) or at work the tool (`TOOL`; the sickle is a man's only, a woman reaps with the scythe).
  `hkPose` picks the cell (the walk, the arm raised and the lunge for blows and work, a punch for shooting, the kneel for
  hurt and down). `hkCell` composes and caches cells (LRU of 900; `onHkEvict`); `hkDraw` puts one on a canvas;
  `onHkLoad` calls back when layers arrive (a callback returning true is done). `hkWhoOf` (a PersonView), `hkWhoOfLook`
  (a stranger), and `hkKnow`/`hkWhoById` (who's who from the last snapshot, for views that know someone by id: main.ts
  and the venue panel feed it). `art/hkTexture.ts` makes the cells Pixi textures (`hkTexture`, `hkSprite`).
  Used by the map (mapPeople: four ways round, ahead of the old side-on, hero, founder and class looks; werewolves still
  take wolf form under the moon and in fights, merfolk swim to the waist), the fight screen's party and march
  (fightView), the mine's diggers (mineView), the expedition pane, the shop and tavern windows (keeper facing the room,
  strangers in travelling clothes), the Townsfolk tab (list faces and the paper doll, drawn at twice the old frame's
  resolution), the New Town founder cards, and the feed, event box and report card (`personPicture` in main.ts, painted
  over in place once the layers load; the feed copies it again as they come). The old LPC figure stands in only while a
  person's layers load. The Craftpix hero sheets (`HERO_FORM`, `founderSheet`) are no longer worn by townsfolk; they are
  kept for bosses and special strangers. Test: `test/hkFolk.test.ts`.
- **Painted backdrops from the packs:** `tools/compose-backdrops.cjs` stacks each parallax background's layers (far
  to near; packs that number "Plan 1.." near to far are reversed) into one WebP per background in
  `src/renderer/art/backdrops/` (114 of them; `backdrops.json`, `src/shared/data/backdrops.ts`). Not precached: the
  service worker keeps each once a fight has fetched it. `SCENE_LOOKS` in data/scenes.ts lists each scene's looks
  (`painted`, a backdrop, or `sky:` a sky pack over the painted land), `lookFor` picks one per trip (the green scenes
  take autumn and winter ones in season). `FightScene.setLook` loads it (`art/backdropImages.ts`) and tiles its layers,
  the near ones scrolling faster; `window.__look` forces one, for previews.
- **Spell and skill effects in fights:** `src/renderer/fight/actLooks.ts` (`actSprite`) picks the sheet that plays
  where a spell or skill lands: a striking skill is a slash in its element (`slash_*`, Craftpix's Magic Slash pack), a
  spell a magic sheet for its element (`mg_*`, the Pixel Magic pack, or the older pvfx/Alenia ones), mending the healing
  glow, a blessing a ward. The watched fight (`FightScene`, timed from when each act is first seen; `window.__fxSlow`
  slows them for previews) and the raid's battle map (`BattleView.acts`) both play them. Sheets are cut by
  `tools/compose-effects.cjs`.
- **The raid map's scenery from the packs:** `tools/compose-props.cjs` cuts Craftpix's top-down objects to what's drawn,
  scales them to the map (twice its 16px cells) and packs them by set into `src/renderer/art/props/<set>.png` (frames
  in `art/props.json`, loaded by `art/props.ts`, files beside the page): `wild`, `winter` (tundra, and winter
  anywhere), `desert`, `coast`, `cave` (the dwarves' rock), `grove` (mixed in for the fae and druids) and `sea` (under
  the merfolk's water, seen through it). `BattleScene.propSets` picks them; until loaded, the town's side-on scenery
  stands in.
- **Shop and tavern from the packs:** `shopPanel.ts` draws the furnishings from the Glassblower's Workshop sheet
  (`art/interior/workshop.png`; `WORKSHOP` boxes, `SPRITE_OF` per item, laid across the footprint by `sprites()`), the
  counters as its long board (ends and a repeated middle), and the brick hearth as its animated furnace (`FORGE`). Pieces
  without a picture, and all of them until the sheet loads, are painted as before. The Trade tab has a button for each
  venue once built (`venue-row`), besides tapping them in the town.
- **The raid map's ground from the tower-defence tilesets:** `art/tdTiles.ts` (the Fields tileset's cobbles, the
  Village tileset's tower pads, in `art/td/`); `battleGround(..., td)` lays a cobble tile per trail cell and a pad under
  each shooter's spot. The battle view loads them and lays the map out again when they come.
- **Unique weapons and boss loot (step 6, done):** `src/shared/data/uniques.ts`: 51 named weapons, one of each in the
  world (`ItemDef.unique`, also `relic`: never made or sold), each a family and tier hitting `UNIQUE_EDGE` (1.35) times a
  made one, with the family's quirks and its own (new quirk `lifesteal`: a share of each blow heals the striker, as
  `Quirks.drain` in combat.ts and raids' `defenderAttack`). `UNIQUE_FROM` says which bosses drop each; the 8 with none
  (`QUEST_UNIQUES`) are kept for quests. Every boss has a loot table (`bossLoot`: its uniques, `UNIQUE_CHANCE` 0.5 of one
  a kill, a purse of coins by its health); `dropLoot` in `sim/bosses.ts`, from `bossSlain` (raids and expedition fights,
  kitless bosses too), rolls it deterministically and records `s.uniques`, so none drops twice. A town that buys its gear
  still has its treasures (relics, uniques) handed out by `equipAll`. The Expeditions tab lists the uniques found and who
  carries them (`snapshot.uniques`). A boss struck down on the battle map as the raid ends is paid out by `endRaid` (it used
  to lose its trophy). Soak (4 towns, 15 days): about half the towns win Ursine Claws from the Cave Bear; growth and
  deaths as before.
- **Scouting and the opened map (step 7, done):** `src/shared/data/regions.ts`: the world map's 8 regions (`REGIONS`:
  centre, fog radius, era, the scouts' loot and foes, scene). Home (`HOME_REGION`, the Heartland) is known; the rest are
  fogged until a scouting party maps them (`s.regions`). Each region has a scouting trip (`SCOUT_DESTINATIONS`, type
  `scout`, `scoutId`; merged into DESTINATIONS, MAP_SPOTS, ROUTES). `HIDDEN_IN` keeps places (the 12 lairs now, the
  dungeons later) off the board and map until their…79808 tokens truncated…e wild grown back gives it (`noteRegrown`), and the druids tend `TEND_CELLS` felled cells on (their regrowth
  hurried a day). Pleased (`BLESSED_AT`) it blesses the day's crops and foraging (marks `BLESS_MULT`) and sends a
  guardian beast every `GUARDIAN_DAYS` (`GUARDIAN_KINDS` by the land: `grove_wolf`, `grove_bear`, `grove_boar` in
  `GROVE_ENEMIES`, merged into ENEMIES; up to `GUARDIANS_MOST`) that fights beside the town in every raid
  (`groveAllies` from `startRaid`, `Raider.guardian`) and is lost if struck down (`groveRaidOver` from `endRaid`).
  Angered (`ANGRY_AT`) it curses the crops, its thorns cut a woodcutter (`THORN_CHANCE`), it looses wolves
  (`WOLVES_CHANCE`), and its guardians leave (`GUARDIAN_LEAVES_AT`). At `RITE_HOUR` on each season's first day the
  circle keeps a rite (`RITES`: the Greening, the Midsummer Fire, the Reaping, the Long Night: an offering for a mark,
  a gift of food or the hurt eased; poor without the offering). Probe (15 days, 5 towns): favour 13 to 49, guardians
  in three. Tests: `test/grove.test.ts`.
- **The Fae Court's bargains** (`data/bargains.ts`, `sim/bargains.ts`, `s.court`): at `COURT_HOUR` every `OFFER_DAYS`
  the Court offers one of `BARGAINS` (a `ways` prompt, `askWays` in sim/telling.ts, answered through sim/heritage.ts
  `answerWays`; the town's own choice, `wise`, the default): a boon now (events' effects through `apply`), a price due
  `due` days later (`s.court.debts`; besides the events' effects, `youth` (days of someone's life), `taken` (a child or
  anyone, gone to the Court), `forget` (levels of the best at a skill)). The Court always collects (`collect`); a price
  that can't be paid is forfeit: someone is taken (`takeAway`). Favour moves with bargains struck, paid and refused
  (`STRUCK_FAVOUR`, `PAID_FAVOUR`, `REFUSED_FAVOUR`, `FORFEIT_FAVOUR`); refused, it may play a trick (`PRANKS`). Cold
  iron (`IRON_HARM` iron, steel and ore in store) hurts the fair folk (`coldIron`: morale, favour); a charmed Court
  (`REVEL_AT`) holds revels under the full moon (morale, travellers). Prompt kind `ways` (`Prompt.ways`: system,
  about) is shown by the event box. Tests: `test/bargains.test.ts`.
- **The alchemists' Great Work** (`data/greatWork.ts`, `sim/greatWork.ts`, `s.work`): at `WORK_HOUR` the best at
  Research (`alchemist`) runs an experiment (`experiment`): the best transmutation the age and the stores allow
  (`TRANSMUTATIONS`: clay to copper, stone to tin ore, copper or iron to silver, silver to gold, coal to gems), else a
  potion (`POTIONS`: a lever's mark), on odds by their Research (`oddsOf`, better after Nigredo); failed, it may blow up
  (`BLAST_CHANCE`: a wound, the nearest building alight on `FIRE_CHANCE`) or misfire (a sickness, a sour mood). Each
  success adds progress; `advance` reaches each of the five `STAGES` at its mark, with its age and its offering in
  store (told in the event box): Albedo grows homunculi (`HOMUNCULUS_DAYS`, up to `HOMUNCULI_MOST`, each
  `HOMUNCULUS_WORK` on the town's work; now and then one runs off), Citrinitas mends every wound weekly, Rubedo makes
  `RUBEDO_COINS` weekly, and the Philosopher's Stone wins the game (`s.gameOver.won`). Probe (15 days): about 12
  experiments of 15 worked, progress 12. Tests: `test/greatWork.test.ts`.
- **The knights' code** (`data/chivalry.ts`, `sim/chivalry.ts`, `s.order`): the Order's honour (−100..100). At
  `CODE_HOUR` grown-ups swear vows (`VOWS`: valour (fell a foe in time), poverty (what they earn past `POVERTY_MOST`
  goes to the Order; owning property breaks it), temperance (no drink at the tavern), chastity (no partner), vigil (stay
  a guard)); `checkVows` hourly: kept to the end (or valour's foe felled), honour, a level of melee and spirits
  (`Person.keptVow`); broken, shame (`Person.sore`, honour). The kept with melee `KNIGHT_LEVEL` are dubbed (`dub`: the
  title Knight of the Order, told in the event box). A tournament every `TOURNEY_DAYS` at `TOURNEY_HOUR` (`tourney`:
  the best `TOURNEY_ENTRANTS` against visiting knights of `VISITOR_LEVEL` plus the days; winners take `TOURNEY_PURSE`,
  the crowd draws travellers). The liege's call every `LIEGE_DAYS` (`liegeCall`, a `ways` question: `LIEGE_SENT` away
  `LIEGE_HOURS` (`Person.away` −4000001), home with pay and honour, now and then hurt or dead; refused, honour and
  `LIEGE_FINE`). The Grail (`grail`): at `GRAIL_HONOUR` from the Medieval age the best rides out alone (away −4000002)
  for `GRAIL_HOURS` to each of `GRAIL_STAGES` (odds by melee, `grailOdds`; failed, hurt or lost, `GRAIL_KILLS`, and a
  wait); the third found wins the game. Tests: `test/chivalry.test.ts`.
- **The machines' factory mind** (`data/foundry.ts`, `sim/foundry.ts`, `s.foundry`): at `FOUNDRY_HOUR`: power
  (0..100, `power`): the sun (`SOLAR` plus `SOLAR_PER_BUILDING` for each building's panels, less in rain and winter), a
  power station `STATION_POWER`, cells and coal burned below `BURN_UNTIL`, less `DRAIN_PER_UNIT` a unit; under
  `BROWNOUT` the town works slower, at nothing a blackout (work and study halved, a unit may shut down). Wear
  (`wear`: `WEAR_DAILY` a unit, mended at `MEND_AT` for an alloy (stone and wood before there are any); worn through, a
  fault). The production line (`line`): a unit built from `UNIT_PARTS` in `UNIT_DAYS` (`newcomer` in powers.ts, now
  exported), while there's room (`UNITS_PER_BUILDING`) and power. Modules (`fitModule`, `MODULES`: levels of a skill,
  two a unit) while circuits are spare. The Mind (`mindAwake`: the seat at stage `MIND_SEAT_STAGE`): every
  `MIND_DAYS` a directive (`DIRECTIVES`: recycle the oldest unit, overdrive, expand, purge the food, ascend), a `ways`
  question; overruled `DISSENT_MOST` times, it carries the next out itself. Tests: `test/foundry.test.ts`.
- **The settlers' frontier** (`data/frontier.ts`, `sim/frontier.ts`, `s.frontier`): at `FRONTIER_HOUR`: a people met
  (a stranger of theirs in town, their caravan at the market: `learnTricks`) teaches its trick for good (`TRICKS`: a
  lever `TRICK_MULT`, a mark renewed each morning); every stranger settled in town teaches `TEACH_PUPILS` others their
  best skill (`teach`); every `CLAIM_DAYS` a land claim is staked at the edge of the known land (`stakeClaim`: the land
  opened `CLAIM_OPEN`, a first haul by the ground, `CLAIM_HAUL`; up to `CLAIMS_MOST`), and claim-jumpers may come for
  one (outlaws on the land, `spawnRoamerAt`). Tests: `test/frontier.test.ts`.
- **A win for every new system:** the druids' Heart of the Grove (`BLOOM_AT` held `BLOOM_DAYS` mornings,
  `GroveState.bloom`), the fae crowned by the Court (`CROWN_BARGAINS` prices paid, `CourtState.paid`, with favour at
  `CROWN_AT`), the machines' Singularity (`SINGULARITY_BUILT` units off the line, the Mind awake and never overruled,
  full power), the settlers' frontier tamed (every claim staked and `TAMED_TRICKS` peoples' tricks learned), beside the
  alchemists' Stone and the knights' Grail; each shown as "To win" on its Our ways card (`.win-goal`).
- **Old grudges and friendships** (`data/kinship.ts`, `KINSHIP`, `kinship(us, them)`): a power of the realm feels so
  about the town by its people alone (the vampires and the pack, the Order and the dead, the hold and the fae, the grove
  and the machines...; the grove and the fae, the hold and the Order, the crucible and the machines...), added to its
  temper's rest in `realm()` and in the daily drift (sim/factions.ts); the Realm card says why
  (`FactionView.kin`). Tests: `test/originWins.test.ts`.
- **Skip a raid to its recap (the owner's ask):** `sim/raidSkip.ts`. A battle's **Skip ⏭** (the trail's battle bar,
  `battleHud.ts`; the tactics board's corner, `tacticsView.ts`; the `raidSkip` command) or the Town menu's Raid battles
  row "Skip to the recap" (`s.skipRaids`, the `skipRaids` command; `skipRaidsTick` skips each raid as it turns active)
  sets `s.raidSkip` (keeping the player's `autoBattle`): the town fights it out on auto (`setAutoBattle`, and the board
  plays itself while `raidSkip` is set), and `GameLoop.pump` runs the sim flat out, `SKIP_SLICE_MS` a frame, until the
  raid ends (the same ticks, so it ends as a watched raid would); `endRaid` restores the setting (`raidSkipOver`) and the
  recap shows. "The town fights it out… ⏭" (`#raid-skipping`, `snapshot.raidSkipping`) sits over it meanwhile. Tests:
  `test/raidSkip.test.ts`.
- **More gates as the castle grows (the owner's ask: the castle only entered by its doors, and not all by one):**
  `sideGates` in sim/castle.ts: a castle on the land (not the mountain hold) opens one more gate for every
  `ROOMS_PER_GATE` (4) rooms, up to `GATES_MOST` (4) in all, each on the outer wall where open firm ground lies outside,
  as far as can be from the gates already there; `CastleLayout.gates` (`CastleGate`: inside, outside, side) are every
  way in or out (`castleStep` lets a step through any of them and nowhere else). `snapshot.castle.gates` carries the side
  gates; castleArt.ts draws the arched door in a south or north wall and a doorway in a west or east one. A room may no
  longer be built over the ground before the main gate (`canPlace`: "The way to the gate"; one once walled a castle shut).
  Test in `test/castle.test.ts`.
- **The Court's blood shown (the owner's ask):** `bloodView` in sim/vampires.ts (the store against `BLOOD_KEEP`, whether
  the thralls are spared, the thralls, the pens' head, the Blood Farms and their cells filled, about how much comes in
  at dusk), on the Our ways tab ("Our ways: the blood") and as a Blood tile on the Town overview. Test in
  `test/bloodCourt.test.ts`.
- **Owner's calls with this batch:** stat points are spent the class's way by default (`statsHourly` asks only when
  `s.statsAsk === true`: the Town menu's row turns asking on); and a castle's or a hold's own rooms have no Look inside
  (`lookInside` refuses a `roomKind`; main.ts leaves the button off for a cell of `snapshot.castle`), since they are
  seen into on the map already.

## Music, sound and real light (0.41.0; the owner's asks)

- **Much more music (the owner: "so it's not always the same 2 songs"):** `src/renderer/musicScore.ts` (pure): 18
  pieces (`PIECES`: a name, the moods it suits, a key and mode (ionian, dorian, phrygian, lydian, mixolydian, aeolian,
  harmonic minor), a tempo and metre, an A and a B chord plan, a lead and an accompaniment instrument, drums, how busy),
  and `compose(piece, seed)` writes one out as notes: A A B A twice over (the second pass varied), the melody from a
  motif that comes back, walking the scale and landing on the chord's tones on the strong beats, broken chords, held
  chords, a drone or a strum underneath, a bass, and drums (light, march, heavy); a new seed each time, so each playing
  differs. `src/renderer/musicGen.ts` (`createPlayer`) plays it in Web Audio (no files): flute, pluck, harp, bell
  (partials), pad, organ, brass, bass, kick, snare, hat, tambourine, through a made-up room's echo, scheduled ahead by a
  timer. `music.ts` (`createMusic().update(on, mood)`) picks by **mood** (`Mood`: day, night, winter, dark, feast,
  battle, boss, sea, heroic; `moodOf` in `musicMood.ts` from main.ts's snapshot: a boss bar, a raid or a fight on
  screen, a feast or a wedding, the lich and vampire towns, night, winter or the cold lands, the merfolk, the knights),
  `nextFor` takes turns between the composed pieces and the recorded tracks (`FILES`: town, battle and two boss themes
  from TinyRPGMusic; about one in four in the town, half in a fight) and never plays the same twice running. A fight's
  music starts at once and ends with it; a quieter change waits for the piece to end. `window.__music.now` names what's
  playing. Tests: `test/music.test.ts`.
- **Many more sound effects:** 22 more synth cues in `ambience.ts` (`clash`, `arrow`, `thud`, `hurt`, `fall`, `spell`,
  `heal`, `coin`, `levelup`, `chime`, `rooster`, `bell`, `door`, `cheer`, `fanfare`, `dirge`, `rumble`, `whoosh`, `saw`,
  `anvil`, `gallop`, `baby`), played by `src/renderer/sfx.ts` (`soundsBetween(prev, next, view)`, pure): blows struck
  and landing on the townsfolk in view (a bow's twang for an archer), raiders struck and falling, spells cast (mending
  ones chime), coins in, a level gained, a question asked, a raid won (a fanfare) or pillaged (a toll), the rooster at
  six (not in a lich or machine town) and the bell at noon and six in a town of six, doors as people go in, a feast's
  cheer and a funeral's bell, a birth, an earthquake's rumble and a wildfire's rush, the anvil and the saw at work in
  view, hooves on the road; at most two of a kind a snapshot. On with the ♪ button, as the music. Tests:
  `test/sfx.test.ts`.
- **Real light (the owner: torches that must be fed, that light so far and cast shadows, and the dark without them; a
  castle's or cave's rooms dark):** `src/shared/data/lighting.ts` and `src/shared/sim/lighting.ts`. The town keeps
  lights (`s.torches`, `Torch`): street lights by the roads (`streetCells`: every `LIGHT_EVERY` road cells by hash,
  nearest the camp first, `STREET_LIGHTS_BASE` + `STREET_LIGHTS_PER_PERSON` a grown-up up to `STREET_LIGHTS_MOST`),
  and in a castle or the hold a sconce in the hall and every room (`room`: its castle region; the dug galleries have
  none), placed hourly (`placeLights`). Each age's light (`LIGHT_KIND`): a torch and a lantern burn wood, a gas lamp coal, electric
  light needs nothing. A light burns an hour of fuel each dark hour (`FUEL_MOST` 12; outdoors by night; a room's sconce
  only while someone is in the room (`someoneIn`), in a castle by night, under the mountain from `CAVE_WAKE` to
  `CAVE_SLEEP`: a hold of two once spent its days carrying wood to sixteen sconces) and goes out when it's empty (`isLit`). **The lamplighter:** a `light` task (people.ts):
  from `FEED_FROM` (15) to `FEED_UNTIL` (23), a cave's sconces at any hour, one or two of the town (one more a dozen
  people) walk to the emptiest light below half and fill it from the stores (`lightToFeed`, `feedLight`: a unit fills
  `FUEL_PER_UNIT` hours; `FEED_SECONDS`), ahead of their own work (and when idle). **The dark bites:** work goes at
  `DARK_PACE` (0.75) where it's dark and unlit (`darkPace` in `workFactor`; `inDark` from a lit-cell grid cached by the
  hour and the lights: the lights' reach, the camp's fire `CAMPFIRE_RADIUS`, the open fires `FIRE_RADIUS`, a room whose
  sconce burns); the dead, machines and vampires see in the dark. Only with the autopilot on (`lightingOn`; off in the
  tests' plainGame, `s.lighting = false` turns it off). `snapshot.lights` (`lightsView`: the age's light, its reach,
  each light burning or not). **Drawn:** `src/renderer/map/lightMap.ts` (`LightMap`, in the world under `over`, in
  multiply): the night's dark (`NIGHT`, a deep moonlit blue; the map's own tint stands down to a faint blue,
  `MapView.realLight`), and added on it each burning light's warm pool (`falloffTexture`) with the shadows of the
  buildings in its reach thrown away from it (the edges turned from the light, projected out; drawn into the light
  texture of the whole land, an eighth of its size, only when the lights or buildings change), the camp's fire and the
  open fires, a lit room filled wall to wall (`roomCells`) with a glow at its sconce, and each frame the lanterns people
  carry after dark; under the mountain the halls are dark by day too (`CAVE`) but for the lit ones. The street lamp posts
  (`streetLamps.ts`) stand where the town's lights are and glow only when fed. No shadows or lanterns on a slow phone
  (`calm`). `window.__lightMap` for previews. Tests: `test/lighting.test.ts`.

## The quest board, and buttons that answer (the owner's asks)

- **The quest board** (`src/shared/sim/questBoard.ts`, `src/renderer/panel/questBoardPanel.ts`): a tavern guest's quest
  (sim/quests.ts) and a guild hunt (sim/hunts.ts) are first an **offer** (`Quest.accepted`/`Hunt.accepted` unset; up for
  `OFFER_HOURS` 48, `offerUntil`). Accepted (`acceptQuest`, the `quest` command, op `accept`), its time limit starts
  (`QUEST_DAYS` 6 / `HUNT_DAYS` from then, `until`); declined (`declineQuest`) it's gone. Only an accepted hunt is on the
  Expedition Board for the parties (`huntDestinations`), and only an accepted quest pays (`questsDone`). An accepted one
  out of time with no party out for it **fails** (`questBoardHourly`: `FAIL_MORALE` for a day, "the town's word wasn't
  kept"); an offer unanswered lapses, or after `AUTO_ACCEPT_HOURS` (18) the town takes it up itself when it has an
  adventurer at home (hands-off). A town run by hand (autopilot off: the tests) takes every quest as offered. Ended
  quests go to `s.questLog` (`logQuest`: done, failed, lapsed, declined; `LOG_MOST` 10; `snapshot.questLog`). The Trips
  menu's sub-tabs: **Quest board** (the offers: the giver, the tale, the reward, how long it's open and the time limit it
  would have; Accept and Decline), **Accepted** (each accepted quest with its time left as a bar, red under a day, the
  tale and reward, the round trip against the time left, and either the party out for it (where they are and the trip's
  bar via `tripLabel`/`tripShare`, the room and torches in a delve, who went, **Watch them**) or **Form a party…** (the
  muster); tapped, where it is, when it was taken up, the foes; then the **Quest log**), and **Sagas** (the sagas, the
  guild's forge, the uniques). The hunts' cards moved from the old Quests list onto the board. `expeditionsKey` now
  carries the quests, hunts, forge, log and sagas (new hunts and saga lines didn't redraw before). Tests:
  `test/questBoard.test.ts`.
- **Buttons that answer (the owner: the Townsfolk inspect page's buttons didn't work well):** the inspect page's own
  tabs (Equipment, Character, Background, Skills) set `inspectTab`, which wasn't in `townsfolkKey`, so a tap did nothing
  until something else redrew the page; it is now. And every menu holds its redraws while a finger is down on it
  (panel.ts `pressing`: from pointerdown until just after the pointer lifts, never more than 1.5 s), so a snapshot can
  no longer pull a button from under a tap. The tabs take the display font (`.inv-tab`).

## The Orc Warband (0.42.0; the owner's pick of the new origins, made as deep as the others)

- **The people** (`orcs` in `ORIGINS`, data/origins.ts: the Orc Warband, Chronos Warcamp): fight 1.25, guard 0.9, build
  1.15, research 0.75, craft 0.85, quality −0.5, crops 0.85, travellers 0.6, prices 0.85, captives 1.5; start with two
  hunters, meat, wood and spears. Rites (sim/powers.ts): **War Cry** (a buff, `war_cry`: fighting ×1.35 in origin.ts),
  **Berserk** (raw meat eaten, every raider struck), **Grog Feast** (spirits under 50). Founders (data/founders.ts,
  founderClasses.ts): Grakk the Warchief (warrior), Ushna Bloodaxe (blood knight), Old Mogra the Bone-Reader (shaman).
  Lifespan short (grown at 14, old at 50); backstories, four gods (Grub-Mother, Old Tusk, Gork, Mork), kinship (the hold
  and the Order hate them, the pack and the steppe riders less so), a stranger people (`STRANGER_ORIGINS`), the
  six-topic heritage line (War Paint to The Star Horde), a troop (Orc Boyz), a workshop (the Grog Pit: grog, war paint, tusk
  charms) and a defence (the Skull Totem, `rout`).
- **Greenskins:** the townsfolk wear the Himeko pack's **Orc body** (`Look.body` 'orc', `orcLook` in sim/strangers.ts:
  a green skin under it for the side-on fallback, pointed ears), kept by `keepKin` for the town's own (a stranger taken in
  keeps their looks), and go about in the pack's barbarian outfits (`hkLayers`: grade by id) unless armoured.
- **As a rival** (data/rivals.ts, raids.ts `rival_orcs`, factions.ts: The Warband at the Skull Pit, warlike, goods meat):
  Gorbag the Warlord (`orc_warlord`, trophy Gorbag's Cleaver) and orc grunts, archers and brutes, four Himeko sheets
  composed by `tools/compose-sheets.cjs` (`hk_orc_*`: the Orc body in the barbarians' outfits with an axe and round
  shield, a bow, a sledge, a horned helm and a great axe). The lord casts War Cry (frenzy), War Drums (dread) and More Orcs
  (summon).
- **The look:** a palette, labels (Warcamp, Bone Lore, The Horde, Loot, Raids, War Tales) and a skin of hide, rivets and
  war paint (theme.ts, skins.ts: tusks before the headings, torn tab banners), the Metal Mania font (@fontsource, OFL),
  the tipis and yurts for homes and the striped tent for the hall (`NOMAD`, `TENT_HALL` in packBuildings.ts), every
  other pack building recoloured (`GRADES.orcs`), hide huts and spiked palisades with skulls in originStyles.ts, and a
  seat of five stages (data/seats.ts, seatArt.ts: Skull Pole, War Hut, Great Longhut, Iron Hall, Throne of Skulls).
- **The warpath** (data/warpath.ts, sim/warpath.ts `hordeHourly`, `s.horde`; autopilot on): **fury** (0..100) rises
  each morning at `HORDE_HOUR` (`FURY_DAILY`, more after `RESTLESS_DAYS` with no fight), with a raid beaten at home and a
  war raid won; at `BRAWL_AT` the bored horde brawls (a wound, a grudge, a morale mark). From `CALL_AT` the warchief
  calls a **war raid** (a `ways` question, system `horde`: raid the weakest power not yet sacked, raid the roads, or hold
  back for more fury and sore spirits); `RAID_SHARE` of the fit go (`Person.away` = `RAID_AWAY`, shown as "the war") for
  `RAID_HOURS`; the odds are their might against the power's troops (`raidOdds`). Won: plunder (half to the raiders'
  purses, half to the hoard), the power's goods, captives put in the cells as **thralls** (each morning every prisoner
  hauls `THRALL_WORK` wood and stone into the stores), the power's troops and goodwill down (war at `WAR_AT`), the
  power **sacked**; the roads instead scare the travellers off. Lost: the dead and wounded. **Glory** per orc
  (`addGlory`: raiders felled at home, raids) brings **names** at 10, 30, 60 and 100 (`GLORY_NAMES`: the Blooded,
  Skullsplitter, Ironjaw, Warboss...). At full fury the **Waaagh!** is called (`waaagh`: fight and build marks for
  `WAAAGH_DAYS`, the whole fit horde marches at once with better odds; the first is the cutscene `waaagh`). **The Great
  Waaagh** (`checkWin`): every power sacked or razed and `WIN_WAAAGHS` Waaaghs called wins the game. Shown on the Town
  menu's Our ways tab (`hordeSection`: fury bar, raids, thralls, the powers sacked, the "To win" line, the glory board) and
  a Fury tile on the overview. Tests: `test/warpath.test.ts`.

## Rising powers, the first hour, the timelapse, a faster town (0.52.0; the owner's picks)

- **Rising powers (the owner: the shogunate, corsairs and infernal packs as enemy powers, "a force that grows like the
  town does"):** `src/shared/data/risingPowers.ts` and `src/shared/sim/risingPowers.ts`. Three powers in every realm
  besides the rival peoples and the bandits (`FactionDef.rising`; `realm()` adds them, `addRising`, older towns too; never
  in `pickRivals`, so the conquest's realms are as before): **the Shogunate** (Shogun Raizen of the Mists, the
  samurai commander sheet tinted; ashigaru and dart ninjas, then ronin, archers, kunoichi and shadow monks, then the
  tengu), **the Black Tide Corsairs** (Admiral Vask the Red, the pirate captain's sheet; deckhands and the drowned, then
  sea reavers, then gunners and squid spawn; from the sea at a shore town, `seaRaids`) and **the Infernal Host**
  (Malphas, Prince of the Pit, the Himeko demon lord; imps and satyrs, then gorgons and minotaurs, then brute demons and
  ring demons). Each army is a raid kind per stage (`shogun_0..2`, `corsairs_*`, `infernal_*`: the stage is the town's
  age, `stageOf`; `raidOf` in sim/factions.ts gives a power's current one for hosts, levies and allies), its lord casts
  like a rival lord (`spells`; `rivalOfLeader` finds them; looks `rival:*` in spellLooks.ts) and drops a trophy and a
  unique (`RISING_TROPHIES`; Mistcutter, the Red Tide, Pitfire in uniques.ts). **Met on their own days**
  (`RISE_MEET_DAYS` 5, 9, 13 paced), ill-disposed (`RISING_HOSTILITY`), and **they grow with the town**: each morning
  their troops close `RISE_CATCH` of the way to `RISE_TROOPS_BASE` + `RISE_TROOPS_PER_MIGHT` a point of `townMight`, and
  their folk to `RISE_FOLK_PER_HEAD` a townsperson (`rise`); broken, they come back. Their ordinary raids come only once
  met (`rivalRaidOdds`). **Their own moves** (`risingHourly`, the morning at hour 10; every roll the seed's own): the
  Shogunate at war sends **shinobi in by night** (`shinobi_night`, begun at a building's door at `NIGHT_RAID_HOUR`) and,
  not at peace, its champion **challenges the town's best to a duel** (an envoy `duel`: odds by the fighter's level
  and melee against `theirMight`; won, goodwill and the title Duellist; lost, `DUEL_KILLS` dead else badly hurt;
  refused, goodwill and spirits down); the Corsairs **take trade wagons off the road** (`seizeWagon` in markets.ts) or
  skim a shore town's stores when nobody is on watch; the Infernal Host at war **opens a rift** `RIFT_CELLS` out that
  looses its creatures by night as roaming bands (`RIFT_BANDS`), and offers **a pact** (an envoy `pact`: a life for
  `pactCoins` and a fighting mark; refused by default; never the founder). The Realm card says what each has grown into
  and its deeds (`FactionView.rising`, `riseLine`). The envoys' shuffle keeps the town's own dice for the old powers
  (the rising ones have their own), so a town runs as before until one is met. Tests: `test/risingPowers.test.ts`.
- **The first hour (the owner's ask):** `src/renderer/mobile/tips.ts` (`TIPS`: welcome, direction, choices, a stranger
  at the gate, a raid, the recap, a party, a place found, other powers, a rising power, callings, the quest board, the
  shop, a caravan, the fallen, a new age, the treasury). Each is met the first time its thing happens (`meet`, kept in
  `littletown.tipsMet`) and shows once as a gold 💡 notice in the news bubble (`tipNotice` in notices.ts; at most
  `TIPS_AT_ONCE` at a time) with a button to its menu and tab (`NoticeAction.tab` sets `littletown.subtab.<menu>`).
  Nothing to do: they only explain. The ☰ menu has "Tips: on/off" (`littletown.tips`). Tests in `test/notices.test.ts`.
- **The timelapse (the owner's pick):** `src/renderer/timelapse.ts`. Each day at noon the strip takes a picture of the
  town (`shootTown` in main.ts: the map over `townBox`, the buildings' square padded, never under `SHOT_LEAST_CELLS`,
  drawn by Pixi's extract with the culling lifted for the moment) squeezed to `SHOT_SIZE` (192) px as WebP, kept in
  `littletown.timelapse` per town (its seed), at most `FRAMES_MOST` (80; past that the older half is thinned, `thin`).
  The Chronicle's **Timelapse** tab (`panel/timelapsePanel.ts`) plays them as a flipbook with a slider and "Day N · age ·
  people". `window.__shootTown()` takes one now (previews). Tests: `test/timelapse.test.ts`.
- **A faster town (the owner's pick: profiled on a 25-day knights' town):** the gate streets (`gatePaths`) searched
  the whole land every hour for a gate with no way to it (half the sim's time and 250 ms hitches): a gate with no way is
  tried again only after `GATE_RETRY_HOURS` (12, `s.gateTried`). The roaming bands asked every tick whether the ring
  wall stood all round, walking the whole wall (two thirds of a big town's tick): `walledBox` is worked out once a tick
  and `ringComplete` keeps its answer until the buildings or the land change (the quick test, any piece unbuilt, first).
  Storage and the other read-only research bonuses use `researchMods` (remembered) not `modifiers`. Each venue's view
  in the snapshot is kept for `VENUE_EVERY` (10) ticks. On the map, `wallJoin` reads a set of the wall cells made once a
  sync (`wallCellsNow`), not every building for every neighbour. Saves pack the land's pools (`packPools`/`unpackPools`
  in save.ts, `land.packedPools` in the file only): a save went from 914 KB to 504 KB. Measured: a step plus a snapshot
  7.8 ms → 4.6 ms; a 30-day soak town runs in about half the time of main's.
## Fixes (0.43.0)

- **Nobody walks through the castle's walls (the owner's complaint about the vampires):** the paths always kept to the
  doorways and gates (`castleStep`), but a walker kept their path as long as the goal was the same, so someone put
  somewhere else (out of a building, off the raid board) or walking when a room went up and the doorways moved cut
  straight across to the old path's next cell, through a wall. `walk` (walk.ts) now finds the path again when the
  walker is more than `OFF_PATH` (2.2 cells) from its next cell, or when the castle's layout has changed since it was
  found (kept in a WeakMap, not saved). And with no way round (a river with no bridge yet) `pathTo` wades it (`WADE` a
  cell of river) rather than walking straight at the goal over the water and through the walls. Probe (5 vampire
  towns, 8 days): wall crossings outside raids from about 10 a town to 0 to 2. Test in `test/castle.test.ts`.
- **Whole coins:** a person's coins, pay, rent owed and a stranger's purse are shown in whole coins (the snapshot
  floors them; the purses may still hold a fraction from a share of a sale or a tax).

## The town comes alive (0.44.0; the owner's ask: all 22 of the art, effects and liveliness ideas)

Built by four agents in parallel and merged; mostly renderer-side. Code-drawn only where no pack had the thing: the
snowman, the washing lines and the straw skep.

- **Work you can see (the owner's ask):** rules pure in `map/workSeen.ts`; pack sprites through `art/choresArt.ts` (`choresTex`, `flagFrame`).
  - **Trees fall:** `syncProps` calls `onFelled` when a tree's cell is in `land.regrow` as forest or a rock's in `land.rubble`; `MapFelling.fall` tips the tree (`FALL_S`, `fallWay`) with leaves and dust and fades it, or crumbles the rock. A stump (Fields pack; now and then the Village pack's with an axe) stands on each felled forest cell till it grows back (`stumpCells`). Broken rock is `LandMap.rubble` (`noteCleared` in regrow.ts, `RUBBLE_DAYS` 2, cleared by `regrowHourly`), scattered with the Fields pack's stones (`rubbleCells`, `rubbleBits`).
  - **The stockpile:** `MapStockpile` heaps logs, stone, sacks, barrels and crates by the store's share of `storage` (`pileOf`, `stockPiles`, `slotGrid`, `layPiles`), hiding its own picture (`MapView.artHidden`).
  - **Floating gains:** `gainsBetween(prev, next)`: a load stored, a venue's sale (`b.shop.takings` now in the snapshot), a piece made (`CraftOrderView.made`, `.station`); none after a gap over `GAINS_GAP` ticks, at most `GAINS_MOST`; `MapGains` lifts the icon with "+N".
  - **A building finished:** `finishedBetween` (not plots, ring pieces or rooms): dust and the Fields pack's banner run up; builders cheer (`MapPeople.cheer`, `CHEER_MS`).
  - **The harvest left:** `crop.reaped` (farming.ts); `hayStacks` for `HAY_DAYS` (3), bales from the Medieval age (Medieval Field Work pack's hay, shrunk).
  - **Sowing by hand:** `'till'` holds no tool; `sowThrow`, and `MapChores` flings seed.
  - **The well:** by day a grown-up with a bed draws water at a finished well one idle wander in `WELL_EVERY` (`pastimeFor`: `WELL_FROM`..`WELL_UNTIL`, `wellFor`), activity `'draw'` (the Village pack's bucket bobbing), then carries it home (`'carry'`, `PersonView.bucket`).
  - **Washing lines:** `hasLaundry`, `LAUNDRY_SHARE` of homes, on a free side; out on fair days, not in winter (`laundryOut`); code-drawn, flapping with `MapView.wind()`.
  - Off when `calm`: falls, dust, gains, banners. `window.__workSeen`. Tests: `test/workSeen.test.ts`.
- **The townsfolk being themselves (the owner's ask):** the rules are pure in `src/renderer/map/townLife.ts`; mapPeople.ts draws each person's moment (`moment`, `drawProps`, a forced line through `speak(..., forced)`), `src/renderer/map/mapTownLife.ts` (`MapTownLife`) what isn't anyone's own sprite; props are DawnLike cells in `art/life/`. Off on a slow phone (`calm`) but the snowmen, the coffin and the dark windows.
  - **Habits by nature:** `HABITS`/`habitOfNature` in data/natures.ts: the jolly juggle fruit (`juggleBalls`), the grumpy kick a pebble (`kickedStone`), the curious peer at a window on tiptoe (`MapView.nearBuilding`), the dreamy lie in the grass on a fair day; any elder idle or by the fire smokes a pipe (`pipePuffs`). `habitNow`: only idle and still `HABIT_AFTER` ms, a `HABIT_FOR` bout each `HABIT_CYCLE`.
  - **The walk home:** for `TIPSY_HOURS` after the tavern closes those served are `PersonView.tipsy` (`walkingHome` in sim/nightOut.ts): they weave (`tipsyWeave`), sing (`songNow`, `SONGS`), now and then fall (`fallenNow`, `FALL_FOR`, "Whoops!").
  - **Waking and bedtime:** a stretch held `STRETCH_FOR` on rising; `PersonView.bedward` yawns (`yawningNow`); `MapView.darkWindows(darkHomes(people))` fades a home's glows once everyone in it at home is asleep.
  - **The children's winter:** a code-drawn snowman by homes with a child (and a third of the rest: `snowmanHomes`), melting through spring's first day (`snowmanLeft`); children pair off for snowballs (`snowballPairs`, `SNOWBALL_REACH`, `snowballNow`); near frozen water (`iceAt`, `SKATE_REACH`) they skate loops (`skateLoop`).
  - **Processions:** a gathering may begin with `walk` (`gather(..., from)` in sim/ceremonies.ts: `PROCESSION_PACE`, at most `PROCESSION_MOST` hours, none under `PROCESSION_LEAST` px); `gatheringPlace` puts two beside the head and the rest in a column `PROCESSION_GAP` apart. A funeral carries the coffin from the dead's door (`mournFor`) to the graveyard; a wedding walks from the couple's door (`weddingFeast`) with hearts; on rite days (sim/faith.ts) `holdRite` leads the pious and `RITE_SHARE` of the rest from the fire to the greatest place of worship to kneel `RITE_HOURS` (gathering kind `'rite'`, activity `'pray'`, `prayStep`). `snapshot.gathering.head`/`.bearers`.
  - **The watch:** by night (`WALL_WATCH_FROM`..`WALL_WATCH_UNTIL`), the ring standing all round, a guard on watch walks the inside of the wall a quarter turn at a time (`wallWalk` in people.ts) with a torch (`torchHours`, `PersonView.onWatch`); at 6 and 18 (`changingWatch`) they say so (`WATCH_ON`, `WATCH_OFF`); a lookout stands on each lookout, watchtower and archer tower (`LOOKOUT_TOWERS`, `MapView.pictureOf`). Tests: `test/townLife.test.ts`.
- **Small creatures and the air (the owner's ask):** renderer only, none on a slow phone (`calm`) but the hives and scarecrows. `src/renderer/map/critterRules.ts` (pure, tested): `beesOut`, `hiveKind` (a skep to the Medieval age, then a box hive), `dragonfliesOut`, `batsOut` (full at dusk), `mothsOut`, `hasScarecrow` (by the field's id, about three in five crop fields, never the orchard or herbs), `tempting` (ripe or growth 0.7), `crowsFor` (`CROWS_PER_FIELD` 3, one past a scarecrow), `ratCount` (none under half-full stores, up to `RATS_MOST` 9; +2 with a full granary, +6 in the rats' plague: `ratPlague` from the `f_rats` prompt or outcome), `frostOn`, `dewOn`, `hailing` (a third of the cold seasons' storms), `driftDepth`. `src/renderer/map/mapCritters.ts` (`MapCritters`, fed by main.ts with `lamps.litGlows()` and the camp's fire): a hive by every herb garden and orchard (`BEE_PLOTS`) with `BEES_PER_HIVE` bees, `BEES_WILD` over the grass; `DRAGONFLIES_MOST` over the water; bats in `over`; `MOTHS_PER_LIGHT` round each lamp; crows (the birds' atlas) on tempting fields, put up by feet (`CROW_SHY`) or the scarecrow's flap (`SCARE_EVERY`, `SCARE_REACH`); rats along the stores' feet (`byStore`), bolting from feet (`RAT_SHY`) and cats (`CAT_FEAR`); the cats chase them (`MapPets.prey`, `onCatch`, state `hunt`: `CAT_SEE`, `CAT_CHASE`, `CAT_CATCH`). Art: DawnLike's bee, dragonfly, moth, bat and rats, the Fields pack's crate as a box hive and a pixelled skep in `art/critters.png`; the scarecrow `art/scarecrow.png` (Himeko layers as sacking, robe and hat on a pole); both by `tools/compose-critters.cjs`. `src/renderer/map/groundFrost.ts` (`GroundFrost`, in `under`): rime and glints on the grass, hailstones that bounce and melt (`HAIL_MOST`), snow drifted along buildings' feet (`driftDepth`). `window.__critters`. Tests: `test/critters.test.ts`.
- **The town over time and its moods (the owner's asks):** renderer-side but two small sim rules. **Wealth you can see** (`map/homeDecor.ts`, rules `map/moodRules.ts`): `homeWealth` by the owner's purse: `RICH_COINS` (150) is `rich` (a flower box under each window from `MapView.fronts()`, a painted door (DawnLike's door tinted, `PAINT`, where `DOOR_AT` knows the door), a garden); everyone under its roof under `POOR_COINS` (12) or in debt is `poor` (crates, pots, a bucket, a log by the door); plain in a town with no money yet. **Ready for a raid:** from the warning shutters close over every window and the glows go dark (`MapView.setShutters`, `SHUTTER_PX`); sheltering children run (`SHELTER_RUN` 1.5 in people.ts) with the alarm emote (`MapPeople.alarm`); a column of dark smoke climbs `SMOKE_HIGH` (320) px over every building alight, leaning with the wind (`map/smokeColumns.ts`, `MapView.smokeColumns`; thinner when `calm`). **Sickness you can see:** the sick cough (`coughing`, `COUGH_FOR`/`COUGH_EVERY`, a puff, "*cough*", poison-green in a plague); `plagueOn` (sim/pastimes.ts: `PLAGUE_DOOMS` active or `PLAGUE_SICK` 3 sick) marks sick households' doors with the blood cross (`markedDoors`); the healer (`isHealer`), idle, goes the rounds (`sickHomes`, pastime `rounds`) in the Himeko gas-mask helm (`PersonView.rounds`, `HkWho.mask`). **Moving machinery** (`map/machinery.ts`, `MapView.turnMachinery`): the windmill's sails cut from the pack's windmill (`Pick.turning`, `packTurning`) turn at `sailSpeed(wind)`; a mill by the river (`MILLS`, `millSide`) turns the Seabed pack's wheel (`WHEEL_TURN`); venue banners are the Fields pack's animated flag recoloured with the emblem (`bannerOf`, `Dressing.frames`) at `flagRate(wind)`. **Crossroads signposts** (`map/signposts.ts`, `map/signRules.ts`): up to `SIGNS_MOST` (5) crossroads (`crossroads`, `SIGN_APART`, not within `SIGN_NEAR_CAMP`), a Fields-pack post with a board each way (`boardsFor`: the region most nearly that way within `SIGN_SPREAD`, and rival towns by `townBearing` from `MAP_HOME` to `STRONGHOLD_SPOTS`); tap (hover kind `sign`). `window.__homes`, `__signs`. Tests: `test/townMoods.test.ts`.

## The seats from the packs (0.45.0; the owner's complaint: the origin buildings looked clunky and rough)

- **Every people's seat is laid together from pack sprites** (`src/renderer/map/seatPacks.ts`: `SEATS`, five `Pick`s a
  people, parts on a `SEAT_CANVAS` (220 px) canvas with `SEAT_OVERHANG`; `seatPack(origin, stage, w)` through
  `pickArt`), in place of the code-drawn seats: the settlers' cairn and benches to moot hall, guildhall, civic hall and a
  keep between two gabled spires; the liches' altar, barrow, horned ruin, candled crypt and the Undead pack's giant lich;
  the druids' stone arch, sacred grove and the grove trees growing to a world tree; the werewolves' den, tipi and lodge to
  a keep with wolf totems; the machines' consoles and tanks to the Overmind's pylon; the merfolk's coral and mermaid
  statues to round towers; the nomads' tent, yurts and a round palace; the fae's toadstools to the crystal mage tower;
  the alchemists' still house, alembic tower and laboratories with their tanks and furnace; the knights' lookout to a
  citadel of keeps and round towers; the orcs' skull pole and hut to the horned throne. A stage may be graded for its
  people (`grade`: the werewolves', orcs', merfolk's and nomads' later stages). The holds' throne rooms (`ROOMS`,
  `seatRoomPack`: DawnLike's throne, rugs, candelabras, coffins for the Court, gold and chests for the hold) furnish the
  hall in castleArt.ts. `art/seatArt.ts` stands in only while the sprites load (MapView `art`, the feed's `cardArt`,
  `roomFurniture`). New sprites in `src/renderer/art/seats/`; the rocky-area tipis (`packs/rocky_tipi*.png`) were
  re-cut without the stray shell and teal bits the pack's sheet had beside them (the nomads' homes showed them).
  Tests: `test/seatPacks.test.ts`.

## Light that's stopped (0.46.0; the owner's ask: every light lights all round it as far as its kind reaches, and is
blocked by buildings, structures, trees and rocks)

- **One rule, shared:** `src/shared/sim/lightField.ts`. `occluders` reads the land into what stops light: a finished
  building that stands up (not one lying `flat`: fields, pens, traps, yards, the stockpile and the fire, `LOW_BUILDINGS`
  in data/lighting.ts), walls and gates, a castle's or hold's walls and the mountain stop it over the whole cell
  (`SOLID`); a tree (a wood) or a rock only round its middle (`ROUND`, `ROUND_BLOCK` 0.38), so their shadows are round.
  `lightSources`: each light's reach by its kind: the age's street light (`LIGHT_KIND`: torch 3.5 cells to light panel
  6.5), the camp's fire and the fires and furnaces at buildings (`FIRE_LIGHTS`: campfire 4.5, storytellers' circle 3.5,
  bloomery 3, kiln and smithy 2.5, glassworks 2; from the building's middle, its own walls seen through). `clearLine`
  walks a ray cell by cell from the light: the light's own cell and building are seen through, and so is the last `FACE`
  (half a cell) of the way, so a wall or a trunk is lit on the side facing the light and dark behind. The sim's
  darkness (`litGrid` in sim/lighting.ts, which slows work in the dark) and the drawn light use it alike.
- **Drawn** (`renderer/map/lightMap.ts`): four points a cell, each lit by every light that sees it, with the falloff
  (`falloff`); one ray from the light's middle, and at a shadow's edge four more from round the flame (`SPREAD_X/Y`) for
  a soft edge (a single ray grazing a corner left lone dark points). Each light's pool is kept (`pool`, by `poolKey`: its
  reach, strength and the hash of what stands in it), so a felled tree or a new hut redoes only the lights near it; the
  whole is put together at most every `REBUILD_MS` (1.5 s), and only while the light shows. The texture is sampled
  smooth (the game's default is nearest: the pools showed as squares). The old building-only shadow polygons are gone.
  Worst case (70 electric lamps, every pool new): about 150 ms on a desktop, once. Tests in `test/lighting.test.ts`.
- **Flames flicker (0.47.0; the owner's ask):** `src/renderer/map/flicker.ts` (pure: `FLICKER` how far each kind
  wavers: a torch or a fire most, a lantern less, a gas lamp a little, electric light not at all; `flicker(kind, t,
  phase)` a share of full strength on two slow beats and a quick one, `phaseOf` so neighbours keep their own time). The
  light map bakes only steady light (electric lamps, the castle's rooms) into the land's texture; each flame's pool is a
  texture of its own (`flameTexture`, kept with the pool) drawn every frame at its flicker. The lanterns people carry
  flicker on their own beat (by id), and the street lamps' glows flicker by the age's light (steady when electric).
  Steady on a slow phone (`calm`). Tests: `test/flicker.test.ts`.

## Sounds that match, and torches that light (the owner's asks)

- **Every blow by the weapon in hand** (`renderer/sfx.ts`): `weaponCue` by the weapon's family (`FAMILY_CUE`: blades
  `slash`, maces and flails `bash`, spears and polearms `stab`, bows `arrow`, crossbows `crossbow`, slings and thrown
  `throw`, staves and wands `zap`, guns `gunshot`, automatics `burst`, energy `laser`, heavy `boom`); with none, a
  caster's `zap`, a shooter's `throw`, else fists (`bash`); a beast's shape `bite`. A foe's blow by what it is
  (`foeCue`: beasts `bite`, machines `laser`/`bash`, the rest `slash`/`arrow`). A shield turning a blow `block`; raiders'
  own blows; the trail battle's towers (`ballista`) and fire.
- **Every fight is heard:** a watched party's fight (`fightSounds`: each side's blows, spells, an ultimate's `ult`, the
  hurt, the fallen, the victory or loss) and the raid's tactics board (`tacticsSounds`, from its `fx` and `hits`: blows
  and shots by the striker's weapon, spells, mending, towers, traps' `snap`, chests, the lost). With the map hidden,
  main.ts plays those and `globalSounds` (levels, coins, questions, a raid's end, the hours, gatherings, disasters), and
  no longer the map's work, ducks and footsteps.
- **The work as itself** (`workSounds`, `workCue`): `PersonView.work` (`workOf` in snapshot.ts: the task and the station
  or building it's at) tells a crafter from a builder, so a station sounds of its trade (`stationCue`: `anvil`, `saw`,
  `loom`, `reap` for tanning, `bubble`, `pound`, `chisel`, `machine`, `page`); paving `chisel`, a fire fought `splash`,
  the sickle `reap`, the hoe `till`, study `page`. A building finished `built`; a tree felled `timber` and a rock
  `crumble` (from `map.onFelled`, at most one every `FELL_HEARD_MS` 1.5 s, so a catch-up isn't a forest crashing
  down). 25 new synth cues in ambience.ts. Tests: `test/sfx.test.ts`.
- **Carried torches light like street torches** (`renderer/map/lightMap.ts`): a guard on the night watch (`onWatch`
  in `torchHours`, as mapPeople draws the torch) casts a street torch's pool (`CARRIED_TORCH`, held `TORCH_HELD` px up),
  stopped by buildings, trees and rocks as any light, flickering as a torch; worked out where it's held to the light
  map's texel and kept (`torchPool`, up to `TORCH_POOLS_MOST`). Everyone else out after dark keeps the small lantern.

- **Volume sliders (the owner's ask):** the ☰ menu has a Music volume and a Sound effects volume slider under the
  Music on/off (`slider` in mobile/mobile.ts, `.volume` in mobile/index.html), each 0 to 100% in steps of 5. Moving one
  sets the strip's level at once (`window.__volume` in main.ts: `music.setLevel`, `ambience.setLevel`, a share of each's
  own full loudness; a slider moved mid-fade takes over from the fade, `cancelFade` in music.ts) and keeps it
  (`src/renderer/volume.ts`: `littletown.musicVolume`, `littletown.sfxVolume`, read at start by `readLevel`). The ♪
  button still turns both on and off. The menu scrolls when it's taller than the screen (held sideways it is). Test:
  `test/volume.test.ts`.

## Sleeping rough (0.48.0; the owner's complaint: the bedless stood in the middle of town to sleep)

- `src/shared/sim/roughSleep.ts` (`roughSpot`): someone with no bed beds down on a spot of their own round the camp's
  fire: the first just beside it (where the town always slept rough, so a lone founder's nights are as before), the
  rest on rings about it (`RINGS`, `PLACES`) by their id, never on a road, in a building, in water or rock, nor where
  someone already lies, and a cell clear of any building where there's room. The spot is kept on the sleep task
  (`spot`); `sleepTask` in people.ts keeps the task through the night (the wounded's too), so it isn't lost. On the
  map they lie flat on the ground (mapPeople's `moment`, on a slow phone too). Test: `test/roughSleep.test.ts`.

## The town lights itself, and hair that stays on (0.49.0; the owner's asks)

- **Lights where the town needs them** (the owner: "the townsfolk are also adding torches to cover the town in light
  as needed"): `outdoorCells` in sim/lighting.ts replaces the old street lights (a light every fifth road cell). What
  should be lit is every finished building's door (but the walls), the fields and pens (`FIELD_WORTH`), and the roads
  among them (`ROAD_WORTH`) out to the furthest building and at least `CAMP_GROUND` (8) about the fire; the camp's fire,
  the fires at the buildings and the lights already standing (kept while their cell is clear) light some; each new
  light goes on a road or open ground beside a building (never in one, in water, rock, the mountain or a castle) where
  it lights the most still dark through sim/lightField.ts's `clearLine`, until all is lit (`LIGHT_LEAST`) or the town
  has as many as it can keep. A camp of fewer than `SMALL_LIGHTS` (3) grown-ups keeps a light a head. Test in
  `test/lighting.test.ts` (every home's door lit).
- **Hair on the head in the side lunges** (the owner: hair still slid off in some animations): in the left- and
  right-facing lunge (every tool swing and blow) the pack draws the head 16px toward the face and the beards, hoods and
  clothes with it, but every hair and bangs layer only 6 and the sideburns and white long hair and pigtails 4 the
  other way. `nudgeOf` in art/hkFolk.ts moves hair and bangs 10px and those 20px in cells 12 and 20 (measured against
  the bodies' heads, checked by eye). Test in `test/hkFolk.test.ts`.
- Rough sleepers' spots are never inside a castle's walls (`roughSpot`: one inside made the walkers' path searches
  fail over and over, a vampire test three times slower).

## Known problem (fixed, watch)

- **Slow growth after the livestock change** was the planner counting hide as available because a goat pen can be
  culled (`sourceable` in `planner.ts`). Pens are culled only when full or short of food, so towns queued buildings that
  cost hide and nobody could supply it. Now only pens kept for meat count. Later soaks (8 towns per origin, 15 days,
  after the Phase 4 farming) had no town die out: druids 29.6, dwarves 30.9, settlers 28.3.

## Palisades that get finished (0.50.0; the owner's complaint: the ring was never built before the town outgrew it)

- A first ring is about 116 pieces, and towns raised about 4 a day: two sections at a time, only with a build slot to
  spare, and its wood never counted as wanted, so it was built from leftovers. Now the ring's sections in work have a
  queue of their own (`blueprintCount` leaves them out; `RING_AT_ONCE` 5), a section is released with `RING_SPARE` 1.5
  times its cost beyond what other sites wait on, the next `RING_GATHER_AHEAD` (8) planned sections' makings are in the
  planner's demand (`ringWants` in sim/ringWall.ts, added in `needs`), so the town gathers for its wall, and a palisade
  costs 4 wood and 20 s (a grate 5 and 25 s). Probe (20 days, main → now, pieces standing at day 19): druids 1 → 18 and
  26 → 114 of 116 (finished), settlers 7 → 29; knights finished their first ring by day 14 and a wider one by day 19.
  Test in `test/ringWall.test.ts`.
- **No sound in the background (the owner's complaint):** `src/renderer/audioGate.ts`. Every Web Audio context (musicGen.ts,
  ambience.ts: `gateContext`) is suspended and every recorded track (music.ts: `gateTrack`) paused the moment the page is
  hidden (`visibilitychange`, `pagehide`, `freeze`), and carried on when it's back; while away `wake` does nothing, and
  the music's next piece waits (`onBack`). A new sound source must go through it. Test: `test/audioGate.test.ts`.
- **Sound effects you can hear (the owner: none were heard):** the cues (the hammer, the axe, blows, coins, bells...)
  peaked at the wind's level, a tenth of the music's. They go through a bus of their own in ambience.ts (`CUE_GAIN` 4,
  then a limiter) over the land's beds and calls; the saw is louder too. Measured in the phone build: the hammer about
  twice the music's peak.

## Builders build, the rest carry (the owner's ask)

- A site no longer waits for all its makings before work starts: its walls go up as far as what's been brought
  (`deliveredShare` in sim/buildings.ts). A builder takes a site once it has `BUILD_AHEAD` (5%) more delivered than
  built (`buildableNow`), stops when they catch up (people.ts `build`), and comes back as more arrives. Someone who
  builds a site at full pace (`skillPace` 1, and the founder always) tries Construct before Haul at the same priority
  (`buildsFirst`, `BUILDER_JOBS` in people.ts). The less skilled haul first, as before. Haulers bring to the sites being
  built first (`haulOrder`), so a builder isn't left waiting. Test: `test/haulers.test.ts`.

## More life (the owner's "all of them in one big batch": sixteen atmosphere ideas)

- **Memory in the town:** `sim/memorials.ts` (`memorialsHourly` from sim.ts), `data/memorials.ts`, `data/homeNames.ts`.
  **Statues:** someone `famous` (`FAMOUS_FELLED` 12 raiders felled, `FAMOUS_LEVEL` 18, or `FAMOUS_TRIPS` 5) who dies
  is honoured (`honour`, from `recordFallen` in annals.ts; up to `HONOURED_MOST`); at `STATUE_HOUR` (11) the town raises
  a statue (the `statue` building, never built by the planner: `NEVER`) at `statueSpot` for `STATUE_STONE`, up to
  `STATUES_MOST` (12); `sim/statues.ts` `deedsOf` tells their story on the tap card; drawn by `map/statueArt.ts` (a
  plinth and the old statue, `art/memorial/`). **Ruins:** a building burnt, felled by a disaster or pulled down leaves
  a ruin (`demolish(s, id, ruin)`; `sim/ruins.ts`: `RUIN_HOURS` burnt 72, felled 60, pulled 36, `RUINS_MOST` 24,
  `ruinsHourly`, `ruinLine`), cleared when something is built over it; drawn by `map/mapRuins.ts`, tap kind `ruin`.
  **Home names:** each home has a name (`nameHomes`, `Building.homeName`) on a sign by its door when zoomed in past
  `SIGN_ZOOM` (0.95: `map/homeSigns.ts`). `window.__memory`. Tests: `test/memorials.test.ts`.
- **The wide world** (renderer only; `map/wideWorld.ts`, `WideWorld`, plays `onHonk`/`onChime`; `window.__wide`):
  **past the fog** (`map/horizonRules.ts`, `map/mapHorizon.ts`): the realm's towns that lie beyond the fog
  (`settlementsSeen`, `fogEdge`, `HEARTH_BEYOND`) show campfires by night (`FIRES_BY_TIER`) and smoke by day
  (`SMOKES_BY_TIER`), and a war host coming shows its torches (`hostTorches`, `HOST_FAR`). **Couriers**
  (`map/mapCourier.ts`, `Couriers`): news worth riding for (`NEWS_PROMPTS`, `newsBetween`) gallops in from its way
  (`newsBearing`, `GALLOP`) to the seat and waits (`WAIT_AT_SEAT`). **Eyes in the dark and wisps** (`map/airRules.ts`,
  `map/mapEyes.ts`): pairs of eyes blink at the forest's edge by night and flee feet (`EYES_*`, `forestEdge`); wisps
  over the graveyard (`WISPS_*`, more on the dead's land). **Geese** (`map/mapGeese.ts`, `art/geese.png` from DawnLike
  by `tools/compose-geese.cjs`): a V (`vFormation`) crosses in spring and autumn (`geeseFly`, `GEESE_EVERY`) with
  shadows and a honk. **Dust** (`map/mapDust.ts`): tumbleweeds and dust devils on dry lands (`dustWanted`).
  **Vanes and chimes** (`map/mapVanes.ts`): weathervanes (`hasVane`, `vaneAngle` by `gustAt`) and wind chimes ringing
  in gusts (`chimeRings`). **Sun shafts and dawn haze** (`map/mapSunShafts.ts`, `shaftsStrength`, `dawnHaze`, the
  golden hours). Off on a slow phone. Tests: `test/wideWorld.test.ts`.
- **Sound and feel:** `src/renderer/soundZones.ts` (pure): places heard by nearness to the view's middle and the zoom,
  panned: the tavern's hubbub and fiddle, the market, hymns from the temple, the forge, workshops, herds; ambience.ts
  plays them on buses of their own. **Vibration** (`src/renderer/vibration.ts`: a pattern per moment, `buzzesBetween`;
  the page buzzes through the bridge, never while hidden; the ☰ menu's Vibration on/off, `littletown.vibrate`).
  **The time away replayed:** `src/shared/replay.ts` and `GameLoop.sampler` keep a frame each game hour of the
  catch-up; `replay/replayPlayer.ts` plays it sped up over the map before the report card, letterboxed with the day
  count, tap to skip (`body.replay`). Tests: `test/soundZones.test.ts`, `test/vibration.test.ts`, `test/replay.test.ts`.
- **Townsfolk with more inner life:** **Gossip** (`sim/gossip.ts`, `data/gossip.ts`): `readNews` turns the Journal's
  milestones into news; `townGossip` keeps the last `GOSSIP_HOURS` (36), newest first, up to `GOSSIP_MOST` (6), as
  `snapshot.gossip`; `GOSSIP_SHARE` (0.45) of fresh speech is news (`gossipNow` in speech.ts; never in a raid, dance,
  mourning or protest), told with the nature's opener (`gossipLine`) and answered (`gossipReply`). **Today's diary**
  (`sim/diary.ts`, `data/diary.ts`): `diaryTick` (autopilot on) counts each person's day on `Person.diary` every
  `DIARY_EVERY` (a quarter hour): what they did and who was within `DIARY_NEAR` (3 cells); `writeDiary` (pure) writes it
  in their nature's `VOICES` with their own lines in the first person (`firstPerson`), mood, wounds, grief, a raid, the
  talk, the weather; `PersonView.diary`, the parchment on the People page's Background tab (`.diary-page`). **Rain:**
  hoods up (`hooded`, `HkWho.hood`); grown-ups take the eaves of the nearest roof within `EAVES_REACH` (14) in a town of
  `EAVES_PEOPLE` (3) (`eavesSpot`), children splash between puddles (`puddleSpot`). **Small scenes** (pastimes,
  `pastimeActivity` in sim/pastimes.ts; rules `sim/idleScenes.ts`, looks `map/sceneMoments.ts`, drawn by
  `map/mapScenes.ts`): tag (`tagIt`, `tagTarget`, `tagStep`), an elder feeding pigeons on a log 10 to 17 (`PIGEON_*`,
  `benchSpot`, `MapBirds.feeders`), a couple on the riverbank at dusk 18 to 21, not in winter (`riverSpot`,
  `RIVER_PLACES`, `RIVER_APART`), a busker of a merry nature 10 to 18 in a town of `BUSK_PEOPLE` (6) with DawnLike's
  lyre or flute (`art/life/`, `instrumentOf`) and a soft `busk` cue near the view. Probe (8 towns, 14 days, eaves on
  against off): ring pieces 448 against 471, one knights town down, the settlers up: the towns' courses drift apart,
  no steady cost. Tests: `test/innerLife.test.ts`.

## The palisade's gate, and a sentry on it (the owner's asks)

- **The gate as the pack builds it:** the Village pack's gate frame, two tiles tall (Tile2_36, 37, 44, 45: the
  crossbeam and braces over the cell above, the posts to the ground), with its double door (`gate_door.png`, the pack's
  DoubleDoor1: frame 0 shut, frame 4 open) and steps up to the beam on the town's side (the Green Zone pack's ladder in
  the palisade's wood, `gate_ladder.png`): `gateFront` in packBuildings.ts, before the frame for a gate in the north
  wall and behind it for one in the south. A gate turned down a column (`gateSide`) is the pack's DoubleDoor2 edge on in
  the wall's line when shut, a gap when open, a plank landing at its north end and the steps; the east wall's mirrored
  (`Pick.flip`). `wallJoin` (mapView.ts) tells which wall a palisade gate stands in by the camp (`gn`, `gs`, `v`, `ve`;
  `GateJoin`) and adds `x` when shut: `MapView.gatesShut`, set by main.ts each snapshot from `GATES_SHUT_FROM` (21) to
  `GATES_OPEN_AT` (6) and whenever raiders are coming. (It drew only the crossbeam, squeezed into one cell at the foot.)
- **A sentry up on the gate:** `gatePost` in people.ts: by night (the wall watch's hours) with the ring standing, the
  first half of the guards on watch each stand up on one of its gates and the rest walk the wall; a lone guard climbs up
  every other hour, a different gate each time. The `patrol` task carries `post` and keeps the guard there.
  `PersonView.onGate` (`gateView` in snapshot.ts: a sentry at the post, or a fighter on a gate's wall spot in a battle
  on the trail) has mapPeople lift them onto the beam (`GATE_LIFT`) and draw them before it (`GATE_FRONT`). A sentry
  on a gate sees through bandits in disguise better (`GATE_SENTRY_CATCH` in data/bands.ts).
- **The night watch sleeps by day:** a hired guard on the night watch (the odd ids: `onShift`) went to bed at ten with
  everyone else, so nobody kept it; once the ring stands they sleep `DAY_SLEEP_FROM` (8) to `DAY_SLEEP_UNTIL` (16)
  (`nightWatch`, `bedtime` in townsfolk.ts), never the founder (a lone founder taken on as the guard slept the working
  day away). Everyone else's hours are untouched (waking from 6: moving it to 5 changed how lone towns grew). Tests:
  `test/gateSentry.test.ts`.
- **A wider wall pushed well out (the owner's ask):** when the town outgrows its ring, the new one is `RING_WIDEN`
  (10) cells further out each side than the town needs yet, and at least `RING_STEP` past the old ring (`widened` in
  sim/ringWall.ts); it was only just past the buildings and soon outgrown again. The first ring is as before. The ring
  tests clear 50 cells round the camp (the wider ring reaches past the old 34). Test in `test/ringWall.test.ts`.
