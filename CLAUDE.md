# Chronos Settlement (formerly Little Town)

A pixel-art town that runs itself, like an ant farm. It's played mainly as a phone web app (a PWA on the
owner's Android, hosted on GitHub Pages). There's also a Windows desktop overlay (Electron): a strip above the
taskbar. TypeScript + PixiJS. `DESIGN.md` is the original design, and `README.md` covers how to play and build.

## Priorities (from the owner)

- **Phone first.** Design every change for the phone version. Before calling anything done, check it at phone
  sizes both upright (393x852) and sideways (852x393) in a browser preview.
- **Hands-off.** The town decides for itself what to research, gather, build and craft
  (`src/shared/sim/planner.ts`). The player only sets the town's **direction** (Growth, Defence, Trade or
  Knowledge, in the Plan tab) and sends **expeditions**. Don't add chores or manual controls.
- **Deaths should be common.** Raids, disasters and hunger are meant to bite.
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
- **The phone held upright:** a slim title bar; a live **feed** (`src/renderer/mobile/feed.ts`): cards for what wants
  attention now (raid, disaster, a question), the hero being followed, and the latest happenings (the Journal, the
  day's small change left out: `CHATTER`), each with a picture borrowed from the strip (`window.__picture` in
  `main.ts`: the townsperson's head, or the building in the town's style) or a mark for the kind of news; the town,
  bigger, in the lower `UPRIGHT_TOWN` (55%) of the height (`layout()` in `mobile.ts`: the strip fills its room, sky over
  the town; upright zoom key `littletown.zoom3`, default 1.5); and one slim row of tabs along the bottom (a mark over a
  short name: `TAB_ICONS`, `SHORT_LABELS`). Sideways is as it was.
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
- **The vampire castle:** `castle` in an origin's rules (the Blood Court). `src/shared/sim/castle.ts`: the keep's span
  over the camp (`castleSpan`), which buildings are rooms (`roomKind`), floors (`Building.room`/`floor`; `canPlace`
  checks overlap per floor), `openFloors`, `roomOf` (the room someone's in: `PersonView.floor`), `adoptRooms` for
  older saves. The planner's `roomSpot` fills it. Drawn by `src/renderer/art/castle.ts` (`roomArt` cutaways, `keepArt`
  shell, sliced per 16px in `BuildingsView.syncCastle`); `mobile.ts` zooms and grows the strip so the keep fits.
  - The look is Castlevania and cut open: rooms and empty chambers seen in section (`section()` hatches the stone the
    cut runs through: the floors between rooms, the walls between them), and a seeded skyline (`seeded(lo, hi)`: the
    same castle every time) of round `turret`s with needle spires, a great tower with a `roseWindow`, a steep hall roof,
    little gables along the battlements, `buttress`es, `gargoyle`s, corbelled corner turrets on the stair towers, and a
    crag with a round flanking tower each side (the picture is `KEEP_MARGIN_X` wider each side than the keep).
  - The keep is narrow at the foot and reaches out as it rises (`s.keep`: 12 tiles on the ground floor, 4 more per era,
    each floor up `flare` 1 tile further out on each side, on corbels, up to `CASTLE_FLOORS` 6). The stair towers stand
    just past the ground floor's ends and run up through the wider floors; `inKeep` keeps rooms off them. `castleReach`
    (the top floor) is kept clear of other buildings. Castles from older saves (no `s.keep`) keep the old 16 tiles
    straight up. The crown spreads across the top floor, with a great corner tower at each end.
  - Inside the keep everyone is drawn at `INSIDE_SCALE` (0.6, `peopleView.ts`; raiders too, in `raidersView.ts`, who
    count as inside on its ground floor too), about their feet: only the drawing, so they walk at the same pace.
  - The keep widens each era (`castleWidth`: 4 more tiles per era). Nothing that belongs inside sprawls: with no
    room in the keep the planner clears the keep's ground or waits for it to grow. Wells, stables and racks are rooms
    too (`OUTSIDE` keeps only mines, the graveyard and the launch site out).
  - Floors are real: `Person.floor`/`climb` and `Raider.floor`/`climb`. A stair tower stands at each end of the keep
    (`stairXs`, drawn as an open stairwell in `keepArt`); `moveOnFloors` walks to the nearer one, climbs a floor per
    `CLIMB_SECONDS`, then walks along. People use it through `goTo`/`goToB` in `people.ts`; defenders fight only on their
    foe's floor. Raiders strike only on their own floor, weigh a climb (`FLOOR_COST`) in choosing a target, break the
    walls on the ground first, climb after the townsfolk, and come down before they flee. `PersonView.floor` and
    `RaiderView.floor` are how high up they are (fractional on the stairs).
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
  heritage is refused (`foreignHeritage`). The Research tab's Hide toggles are kept in `localStorage`
  (`littletown.researchHide`).
- **Animal husbandry (Phase 4):** pens in the background (`chicken_coop`, `goat_pen` from Domestication;
  `pig_sty`, `sheep_fold`, `cattle_pasture` from Animal Husbandry), their herds in `data/livestock.ts` (`HERDS`) and
  `sim/livestock.ts` (`b.herd`; `tendHerds` hourly: breeding, winter fodder, starving; `workPen`, tended through the
  Farm job's `farm` task after the fields; `rustle` when raiders get away). New materials `eggs`, `milk` (food),
  `wool` (spun into cloth at the loom). The animals are drawn by `town/herdsView.ts` (`art/livestockArt.ts`) in the
  background layer.
- **The background clears with the land:** `backNow`/`backOpen` in `sim/buildings.ts`: a forest, hills or marsh
  column behind a cleared tile is `cleared`, and background buildings can go there (never on a river). TownView
  draws the background per column (`b<i>` groups) and rebuilds a column when its tile clears.
- **The far wall:** `enclosure()` (sim/buildings.ts; `snapshot.enclosure`): walls finished beyond both ends of the
  town. `art/farWall.ts` draws it in the background's far depth, in the weaker end's material.
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
- **Hide toggles:** `panel/hide.ts` (`HidePrefs`): Research, Build and Crafting each have a "Hide:" row, kept in
  `localStorage` (`littletown.researchHide`, `buildHide`, `craftHide`).
- **Upgrades and fewer homes:** `UPGRADES` in `data/buildings.ts` (homes: lean-to or hide tent → longhouse →
  cottage → row houses → apartments → dome; research stations; healer's hut → infirmary; watchtower → radio tower →
  drone hub). `upgrade(s, back, id, absorb?)` in `sim/buildings.ts` can pull down a neighbour of the same kind and make
  the two one (two lean-tos become a longhouse). The planner's `consolidateHomes`: when beds are wanted it rebuilds a
  small home bigger before building another; in a quiet spell it upgrades one anyway (up to `SLEEP_ROUGH` sleep out
  meanwhile). New homes are paced by beds (`lastHomeBeds`), so bigger homes don't speed growth. Soak: about 10 homes
  (mostly longhouses) for 30 people at day 15, where it was about 28.
- **Choice events:** the 100 of `EVENTS.md` are data in `src/shared/data/events.ts` (`EVENTS`: title, text, `who`
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
  live). The camera eases to keep them in view (`Camera.follow`), waiting `FOLLOW_WAIT_MS` after the player drags or
  scrolls. Their big moments (journal milestones with their name) are a forecast kind, `hero`, sent as phone alerts
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
  - Fields are drawn on the rise behind the town (`slope()` in `art/buildings.ts`: rows of crops climbing back, about
    40px tall) so they show over the houses' roofs.
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
- **Lighter nights:** the town's night tint (`NIGHT_TINT` in `town/townView.ts`) is a moonlit `0x8a96c8` (it was `0x4a5688`, about a
  third of the light), and the night sky in `town/skyColors.ts` is lifted to match.
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
  - The map (`layOut`): a zigzag trail (longer and bendier as the town grows, `len` 18 to 36 cells) to the gate, block
    spots on it every 3 cells, wall spots from the town's walls (an outer line too with many), towers beside it from
    defence buildings, traps on it, ground spots for shooters, the town's buildings along it (`decor`, drawn in its style),
    a second trail for a raid that splits. Each origin's shape (`SHAPES`): the dwarves' rock, the merfolk's shore
    (`water`), the nomads' wagons (wall spots), the druids' hedges (`hedges`), and a castle town's keep (`keep`: through
    its gate and up its floors, `KEEP_BAND` cells each, a carpeted run across and the stairs at its end, murder-hole wall
    spots on the floor above).
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
    `perPeople` (5), and the planner trains them itself (`trainMages`). They fight from range; their fire (`mageFire` in
    raids.ts, `MAGE_*` in data/raids.ts) ignores armour and bursts over those beside the target for half, in town and on
    the battle map (`MAGE_INTERVAL`, `MAGE_BURST`). Drawn as the sage sheet's blue wizard (`CLASS_LOOK` in peopleView).
  - The screen: `src/renderer/battle/battleView.ts` (`BattleScene`: the ground painted by `art/battleArt.ts`, the decor,
    scenery beyond the map's sides, fighters with green bars, raiders with red bars and a red glow, shots, casts in each
    spell's look, mage fire bursts; it follows the raiders unless dragged) and `battleHud.ts` (top bar: wave, phase,
    count, Fight now, Auto; bottom bar: fighters to place or spells to aim, hidden when there's nothing to pick).
    `main.ts` routes taps (place, move, aim) and drags. On the phone the battle takes the whole screen (`body.battle` in
    `mobile.ts`, the feed hidden); the map fits between the bars (`insets`). `window.__battle` is the scene (for previews:
    `screenOf`, `leadScreen`).
  - Tuning: `GROUND` 1.2, `FALL_BACK` 0.12, raiders rout at `ROUT` 0.15 (the first cut, at 1.5 and a quarter,
    roughly halved deaths: settlers 2 where it was 8 with battles off). Soak (4 towns per origin, 15 days, people and
    deaths): settlers 23.8/10, vampires 28.3/12, druids 25.5/3, dwarves 34.0/2, werewolves 27.3/2, knights 32.0/1,
    liches 24.8/3, merfolk 31.0/6, nomads 31.0/3, fae 31.5/3, alchemists 28.3/5, machines 25.8/0; no town died out;
    battles about 80 to 125 s; about 4 mages a town by day 15. The planner values a topic that teaches a common calling
    (+12, +24 raided or on defence).

- **The armoury (in progress, see Planned):** `data/weapons.ts` (`FAMILIES`: 23 families with their quirks; `ROWS`:
  name, family, tier, era, research, icon; stats, cost and station worked out from those; `tierDamage`), `data/armour.ts`
  (`SETS` per era: cloth, light, medium, heavy body and head pieces, three shields, two trinkets; `ArmourWeight` on
  `ItemDef.weight`). New effects: `speed`, `crit`, `pierce`, `cleave`, `stun`, `reach`, `undeadDamage`, `machineDamage`
  (weapons), `dodge`, `power` (armour). **+N:** a piece's number holds its grade and its +N (`piece`, `gradeOf`,
  `plusOf`, `pieceLabel` in `data/quality.ts`; `rollPlus` from Crafting, `PLUS_STEP` per +), rolled in `finishPiece` for
  `ARMS` slots. `weaponOf` (combat.ts) is the weapon's stats with grade and +N; `hitDamage` and `afterBlow` apply the
  quirks (also in raids' `defenderAttack` and on the battle map). Foes have a `natureOf` (beast, undead, machine,
  person) and `enemyArmor`. The planner's `weaponWorth` favours a mix of families. Crafting has Weapons and Armour hide
  toggles.

- **Classes and levels (in progress):** `data/classes.ts` (25 lines, `stages` five names each, all 125 distinct; role,
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
  in a town is about level 21 to 29. Soak (4 towns, 15 days, people/deaths): knights 33.0/2, liches 26.8/7, settlers
  17.3/8, vampires 29.5/5.
- **Battle speed:** the raid battle's top bar has a speed button (1×, 2×, 3×; the `battleSpeed` command,
  `s.battleSpeed`, kept for later battles). `battleSpeedNow` (battle.ts) is read by `GameLoop.pump`, which runs that
  much more sim time while a battle is on; back to the town's pace when it's over.
- **Fewer pop-up notices over the town upright:** the phone page marks the strip `feed-shown` (`layout()` in
  `mobile.ts`) while the feed is on screen; then the strip pops up only the small change the feed leaves out
  (`CHATTER` in `renderer/chatter.ts`, shared with `feed.ts`). Sideways (no feed) every notice still pops up.
- **The keep's stairs stay clear:** when a new era widens the keep, `clearStairs` (castle.ts, from era.ts) moves any
  room left standing over a stair tower to the nearest clear spot.

## Planned (owner's requests, not started)

- **Weapons, ten times over, with +N** (the owner's choices):
  - About 160 weapons (from 16): every era gets several of each kind (swords, axes, maces, spears, daggers, bows,
    crossbows, slings, staves, wands, guns...), with different damage, accuracy, speed and quirks (reach, armour
    piercing, bleeding, stun, splash, beast or undead bane), so fights vary. Drawn from the icon sheets already used.
  - **+0 to +5** on crafted weapons and armour, rolled when made from the crafter's Crafting skill and luck, **on top
    of** the quality grade (Poor to Divine). +4 and +5 are very rare. A basic weapon at +5 is about as good as one
    three tiers up (+N adds to its damage and accuracy; the grade multiplies as now).
  - **Unique weapons** that come only from bosses and quests (named, one of each, with special effects), many more
    than the 7 relics.
- **Dungeon delves** (the owner's choices: the player picks the party members):
  - Exploring the region with expeditions (a new scouting kind) reveals new areas on the world map, and with them
    dungeons; this is also how more of the map opens up.
  - A delve is like an expedition but longer (several hours to a few game days) and more involved: the party goes
    room by room, fights what turns up, and ends in a boss fight with great loot. Dozens of new bosses.
  - **Watching it:** tap the delve (on the Expeditions tab or a feed card) and the town view is replaced by the
    party walking to the right through the dungeon, fighting what comes, until the player goes back to the town.
  - Several locations and dungeon types (crypt, goblin warren, flooded temple, deep mine, wizard's tower, fey hollow,
    spider nest, sunken ship, ice cave, volcanic forge, machine vault, dragon's den...), each with its look, monsters
    and bosses. Sometimes a quest is tied to one.
  - **Varied rooms:** traps (scouts spot them), treasure rooms, shrines (blessings or curses), puzzle doors (Research),
    rest camps, forks (riskier or safer way).
  - **Run modifiers and elites:** each delve rolls a twist (Haunted, Flooded, Rich Veins, Cursed: no healing...);
    some monsters are elites with affixes (fiery, armoured, swift, vampiric...).
  - **Supplies and retreat:** torches and rations; running low or losing too many turns the party back with what
    it found.
  - **Depth and respawn:** a cleared dungeon goes quiet, then reawakens weeks later deeper and harder.
  - **Quests:** rescue a captive (they join), bounties on named monsters, relic hunts for a visitor or tavern guest,
    a fallen delver's gear to recover; offered through events and the tavern.
  - **Trophy hall:** a building showing boss trophies and uniques; each adds renown and draws travellers.
  - **Rival adventurers:** another party sometimes races for the same dungeon (beat them, help them and they may
    join, or fight them for the loot).
  - **Phone alerts:** the boss reached, a unique found, someone lost, home again.
  - Deterministic sim like everything else (delves play out offline and in tests); deaths are real.
- **Classes, levels, spells and skills** (the owner's choices):
  - **125 classes:** 25 base classes (knight, ranger, beast tamer, archer, sorcerer, witch, white mage, monk,
    assassin, and so on; the five classes there are now fold in), each evolving four times as it levels, so five
    stages per line. A grown-up is given a class once, at random, weighted by their skills and traits; some classes
    are much rarer. Never switched after.
  - **One level from all XP** (work and fighting both feed it, fighting faster): it unlocks the class's skills and
    spells and its evolutions.
  - **Gear by class:** each class wears certain kinds (cloth, light, medium, heavy armour; shields; weapon families),
    overlapping: mages cloth only, knights heavy, assassins light. About 100 armour pieces (robes, hats, leathers,
    mail, plate, shields), all with +N.
  - **160 spells and 200 skills** across the classes; a few general ones every class can have, most unique to a class.
    A caster has 3 spells ready at a time, swapped for better ones as they level, each on a cooldown (the best on
    long ones, so they're used sparingly).
  - **Fights in the style of the old Final Fantasy games** (the owner's picture: foes on the left, the party on the
    right, a box naming the action, a panel of names and health along the bottom): automatic, watched if the player
    wants. Used for expedition and delve fights. The tower-defence raids stay maps, but their fighters use their
    classes, skills and spells.
- Steps: (1) weapons and +N; (2) armour and gear kinds; (3) levels and the 125 classes; (4) the 160 spells and 200
  skills in the fight sim (expeditions, raids); (5) the side-view fight screen; (6) uniques and the bosses' loot
  tables; (7) scouting and the opened map; (8) the delve sim (rooms, fights, supplies, retreat, the boss, loot); (9)
  the delve view; (10) dungeon types, modifiers, elites, dozens of bosses; (11) quests, rivals, the trophy hall,
  respawn, alerts; soak, phone checks, PR.

## Known problem (fixed, watch)

- **Slow growth after the livestock change** was the planner counting hide as available because a goat pen can be
  culled (`sourceable` in `planner.ts`). Pens are culled only when full or short of food, so towns queued buildings that
  cost hide and nobody could supply it. Now only pens kept for meat count. Later soaks (8 towns per origin, 15 days,
  after the Phase 4 farming) had no town die out: druids 29.6, dwarves 30.9, settlers 28.3.
