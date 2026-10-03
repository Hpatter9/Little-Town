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
  dungeons later) off the board and map until their region is mapped; old destinations are never hidden.
  `destinationHidden`/`regionKnown` in `sim/expeditions.ts` (`destinationUnlocked` refuses hidden ones); a scouting party
  home maps its region (`mapRegion`, a milestone naming what it found), and its trip leaves the board. The map
  (`worldMapView.ts`) lays soft fog (`.map-fog`) and a faint name over each unmapped region; scouting trips are ringed
  dots. Map dots are left out of the menu themes' button rules (they drew as big grey buttons).
- **Dungeon delves (step 8, done):** `src/shared/data/dungeons.ts` (`DUNGEONS`: region, era, research, rooms, foes, boss,
  loot, hoard, road and inside scenes, map spot, `threat`; `ROOM_SECONDS`; each a destination of type `delve` merged into
  DESTINATIONS, MAP_SPOTS, ROUTES and `HIDDEN_IN`). A delve is an expedition with `e.delve` (`sim/delves.ts`): the party
  is picked by the player (`sendDelve`, the `sendDelve` command, up to `MAX_DELVERS` 5; roles by `rolesFor`), its rooms
  rolled from the town's seed and the trip (`startDelve`: a fight first, a camp before the boss, else fights, traps,
  treasure, shrines, puzzle doors, camps and forks), and a torch packed a room plus `SPARE_TORCHES`, each cut from a
  unit of wood. In the work phase `stepDelve` goes room by room (`DelveHooks`: back, fight, room): more foes deeper, a
  scout may spot a trap, a puzzle door to the cleverest, a risky party takes the darker fork (more foes, more gold). No
  torches, or half the party down: they turn back. The boss beaten, its hoard comes home and `s.delved` counts the clear.
  The Expeditions tab's dungeon cards have a chip a fighter to pick the party (`delvePicks`, ticked when picked) and
  Delve: safe / risky; an active delve shows its room, torches and latest line (`ExpeditionView.delve`). Place names in
  the trips' notices go through `the`/`The` (data/expeditions.ts), and foes through `describeGroup` (bosses by name,
  "wolves"), so no more "the The Labyrinth".
- **Watching a delve (step 9, done):** the Watch view (`FightScene`) follows a delve down the dungeon's inside scene:
  the party walks on between rooms and stops (`STOP`, the first 30% of a room) at each room's thing, drawn by
  `drawDelve` from `art/delveProps.ts` (Craftpix's 2D Top-Down Dungeon pack seen side-on: a door and a chest opening,
  a gate for a fork, braziers at camps, wall torches along the corridor; its Dungeon Props pack's skull altar at
  shrines and guillotine at traps), left behind as they walk on (`propAt`). The light dims as the torches run low. The
  HUD's top window has the delve's latest line, and the foes' window the room and torches between fights
  (`ExpeditionView.delve.progress`). The phone feed has a card for each delve under way; tapping it watches the party.
- **Dungeon types, twists, elites and dozens of bosses (step 10, done):** 12 dungeons, one of each `DungeonType`
  (crypt, warren, mine, fey, temple, tower, nest, wreck, ice, forge, vault, den) across the fogged regions and the eras.
  Each has a pool of bosses (`bosses`; one rolled per delve into `Delve.boss`, named by `bossName`), among them 27 new
  ones in `src/shared/data/dungeonBosses.ts` (`DUNGEON_BOSSES`, merged into ENEMIES): drawn from the existing sheets,
  bigger, with a `look` the fight view applies as a colour filter (`lookFilter` in fightView.ts: hue turned, greyed,
  brightened; a tint only darkens). Their kits have no trophy (`BossKit.trophy` is optional); each carries a unique of its
  own (27 more rows in uniques.ts). Every delve rolls a twist (`TWISTS`: Haunted, Flooded, Rich Veins, Cursed, Swarming,
  Pitch Dark, Blessed, Champions, or none), which changes rooms' time (`delveRoomTicks`), torches, fights, treasure and
  healing. Foes in a delve's fights may be elites (`raiseElites`: `ELITES` fiery, armoured, swift, vampiric, giant;
  `Fighter.elite`, named and tinted), more often deeper down, for a risky party and in a Champions run. The card, the
  HUD and the feed show the twist.
- **Quests, rivals, the trophy hall, respawn, alerts (step 11, done):** `src/shared/sim/quests.ts`: of an evening
  (`questsHourly`, hour 19) a tavern guest (or a stranger at the edge of town) may offer a quest on a dungeon the town
  knows (`s.quests`, at most `MAX_QUESTS` 2, lapsing after `QUEST_DAYS` 6): a rescue (the captive joins), a bounty
  (coins), a relic hunt (one of `QUEST_UNIQUES`) or a fallen delver's gear (a fine weapon of the dungeon's era). They
  pay when the party that cleared the dungeon is home (`questsDone`, from `delveHome`). Rival delvers (`RIVALS` by era,
  `RIVAL_CHANCE`) wait at a `rival` room halfway down: a risky party fights them for their finds, a safe one shares the
  way and may win one over (`joinTown`). A cleared dungeon is quiet for `QUIET_DAYS` (`s.dungeonQuiet`, not on the board
  meanwhile), then wakes (`delvesHourly`) `DEEPER_ROOMS` deeper with one more foe a fight per clear. The Trophy Hall
  (`trophy_hall`, Writing; the planner builds it once the town holds 2 treasures) adds `TROPHY_RENOWN` per relic or
  unique held to the venues' attractiveness (`trophyRenown` in shop.ts). Phone alerts: the `delves` setting (forecast
  kind `delve`: the boss met, cleared, a unique, a dungeon woken). The Expeditions tab lists open quests and marks
  dungeons with a quest or lying quiet. Tests: `test/quests.test.ts`.
- **Fewer pop-up notices over the town upright:** the phone page marks the strip `feed-shown` (`layout()` in
  `mobile.ts`) while the feed is on screen; then the strip pops up only the small change the feed leaves out
  (`CHATTER` in `renderer/chatter.ts`, shared with `feed.ts`). Sideways (no feed) every notice still pops up.
- **The keep's stairs stay clear:** when a new era widens the keep, `clearStairs` (castle.ts, from era.ts) moves any
  room left standing over a stair tower to the nearest clear spot.

- **Townsfolk tab: short rows, and an inspect page:** `panel/townsfolkPanel.ts`. The list is one row per person (their
  face cropped from the composed LPC sprite, name, class and level, what they're doing, mini health and morale bars, a
  flag for trouble); tapping a row inspects them (`inspecting`; "‹ Everyone" goes back to where the list was scrolled).
  The inspect page has their gear laid out as in Diablo (`paperDoll`: the figure in what they wear, weapon in hand, with
  the seven slots round it, each ringed in its grade's colour with its +N; tap a slot for its item card, `pieceCard`,
  stats worked out at grade and +N), their bag as a grid of cells (`bag`, `stockIcon` in `art/materialIcons.ts`: every
  material now has a picture, from DawnLike's Food/Flesh/Ammo sheets or code-drawn `mat_*` icons), how they'd fight
  (`PersonView.battle` and `.kit`, from `personFighter` and `kitOf`, cached in snapshot.ts's `fightView`), and the rest.
  Sideways, the gear sits on the left and the rest beside it, and the list is two columns. The code-drawn icon sheet
  (`customSheetUrl`) had drawn every icon into its first cell since the fine-grid painter (the Painter's constructor
  reset the shift), so guns, tavern fare and furnishings showed blank: fixed.

- **Founders' own callings and looks:** `src/shared/data/founderClasses.ts` (`FOUNDER_CLASSES`: one line of five stages
  for each of the 36 ready-made founders, standing on a `base` class for gear, spells and skills, with signature
  `stats` and `FOUNDER_EDGE` in `classStat`). `Person.fcls` holds it (set in `makeFounder`; older towns' founder,
  person 1, adopts theirs by look in `adoptFounderCalling`). Names come from `callingName`/`callingText` everywhere
  (snapshot `clsName`, `clsPast`, `clsText`, `founderCalling`; journal lines via `aCalling`). The Townsfolk tab names
  only the current calling; tapped, it shows the stages passed and what the next needs (`???`, its level, an
  ascension for the last). Founders' outfits are fuller (capes, crowns, hoods, gloves), and in the town they're drawn
  `FOUNDER_SCALE` (1.14) bigger with a soft aura in their origin's colour (`AURA` in peopleView), and never swapped
  for a class's stock sprite (`CLASS_LOOK`). The New Town cards name each founder's first calling.

- **The town's scenery from the packs:** `tools/compose-scenery.cjs` (run by hand) cuts Craftpix's side-on trees,
  bushes, rocks and clouds into one atlas, pixel for pixel (`src/renderer/art/scenery/scenery.png`, beside the page;
  frames by set in `art/scenery.json`). `art/scenery.ts` draws them at half size, so each of their pixels is one
  fine-grid pixel, through the layer's tone (the far land's haze) and turned for autumn (`autumn()`: broadleaf trees and
  bushes only). `scenerySets` (`art/scenerySets.ts`) picks by land and season: leafy, conifer, snowy (winter, and the
  tundra always), dry (desert); bushes bare in winter; rocks snowy or desert. `withPackScenery` swaps them into a
  `SpriteSet` once loaded; TownView redraws through `setSeason` when they arrive (`packed`), and the expedition pane takes
  them too. The sky's clouds are the pack's (`skyView`, half scale), still tinted by the hour. Until the atlas loads (or
  if it can't), the painted ones stand in. Frame rate unchanged (the headless browser gives the same with and without).

- **Construction sites:** `art/constructionSite.ts` (`drawSite`, from `BuildingsView.updateBlueprint`; the walls still rise
  from the ground as the finished picture is masked to the progress). Before work, the plot is staked out with a string
  line and the materials pile up as delivered; then scaffolding climbs a lift ahead of the walls (uprights, ledgers,
  braces, boards), with a ladder, a gin-pole hoist whose load goes up and down, and the site's gear (stacked lumber,
  stone or bricks, a mortar tub, a sawhorse, a wheelbarrow, crates, barrels, sacks). The kit by the era of what's built
  (`eraOfResearch`): lashed poles, timber, steel tubes with couplers, green safety netting in the modern eras. The
  medieval field-work pack's props were tried and left out: their cartoon outlines don't sit with the pixel art.

## Planned (owner's requests)

- **Weapons, ten times over, with +N** (the owner's choices; done, uniques included):
  - About 160 weapons (from 16): every era gets several of each kind (swords, axes, maces, spears, daggers, bows,
    crossbows, slings, staves, wands, guns...), with different damage, accuracy, speed and quirks (reach, armour
    piercing, bleeding, stun, splash, beast or undead bane), so fights vary. Drawn from the icon sheets already used.
  - **+0 to +5** on crafted weapons and armour, rolled when made from the crafter's Crafting skill and luck, **on top
    of** the quality grade (Poor to Divine). +4 and +5 are very rare. A basic weapon at +5 is about as good as one
    three tiers up (+N adds to its damage and accuracy; the grade multiplies as now).
  - **Unique weapons** that come only from bosses and quests (named, one of each, with special effects), many more
    than the 7 relics.
- **Dungeon delves** (the owner's choices: the player picks the party members; done, steps 7 to 11):
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
- **Classes, levels, spells and skills** (the owner's choices; done, steps 2 to 5):
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
- **Boats** (the owner's idea, for later): boats for long journeys: far destinations over water (islands, other
  coasts) that only a boat reaches, or that it reaches faster than walking. Likely a boatyard on the coast or river,
  boats as built things (rowboat → sailing ship → steamer by era), a party sailing (watched like a trip, at sea), and
  dangers of their own (storms, sea monsters, pirates). Not designed yet.
- **Merfolk rework** (the owner's request, for later): the merfolk need much more of an ocean and merfolk feel. Likely:
  a shoreline or reef town (water in front of the town, tide pools, docks and coral), merfolk who look like merfolk
  (tails or fins and scales in the water, sea colours; not just elf ears and blue skin), sea-themed buildings and
  homes, the Craftpix ocean and underwater backdrops and seabed props, sea food and materials (kelp, pearls, coral),
  and sea raiders and beasts. Not designed yet.
- **The top-down town (decided, in progress):** the side-on strip is replaced entirely by a sprawling top-down map in
  the raid map's style (Craftpix's top-down village, fields, path and road tilesets and the props atlases; buildings
  stand on their footprints, drawn front-on, sorted by depth). The town builds outward with roads and buildings laid
  out sensibly; the local map opens up as it grows (minerals, caves, map events: a burnt-out trader's cart that starts a
  quest, a strong beast to put down; a fight is offered with townsfolk the player picks, fought on the FF screen).
  - The owner's decisions: no side view kept; **a new save is required** (old towns aren't carried over: a new town is
    founded); the vampire town is **one level**: a castle that adds rooms as it grows, not a sprawling town; pack
    sprites are welcome even where their style is a little bulky (more detail than the code-drawn ones; removed later
    if they don't work).
  - Phases: (1) the land: a 2D map of 32px cells (`sim/land.ts`: terrain, pools, rivers, the open area, footprints,
    roads, pathfinding), tested on its own; (2) the sim moved onto it (buildings by cell and footprint, people moving
    in 2D along paths, gathering on cells, the planner laying out roads and districts; the old `tiles`, layers and
    `World` retired; save version bumped); (3) the top-down renderer replacing TownView (ground, roads, scenery props,
    buildings, people in four directions, fog, pan and pinch on the phone, the feed); (4) the map growing and its
    places and events, fights through the party picker and the FF screen; (5) raids fought on the town's own map;
    (6) origins: the castle as one level of rooms, the nomads, the merfolk later; more pack art; (7) soak, phone checks,
    PR.
  - **Phases 1 and 2 are done** (the sim runs on the land; the old strip renderer still draws it sideways until phase 3):
    - `sim/land.ts`: `LandMap` (96x96 cells of `Ground`: grass, forest, rock, marsh, hill, water, fertile, sand; `pools`
      on the wild cells; `roads`; `marked` cells to gather; the `camp` and how far the land is `open`), `makeLand` (noise,
      exactly half wild, a river with fertile banks, the coast's sea, the camp's clearing, and `MIN_KIND_NEAR` of each
      wild kind within reach: a town must find wood near by), `fits`/`spiralSpot`/`doorOf`/`roadDistance`, `findPath` (A*,
      eight ways, roads cheap, water and footprints impassable). Save version 16: older saves are refused (`old-version`).
    - Buildings stand on footprints (`tile`, `row`; `depthOf` the def; `footprint`, `buildingDoor` at the middle of the
      bottom edge, `buildingCentre`); `placeBlueprint(s, def, x, y)` lays a road to the door (`connectRoad`). People,
      raiders, travellers and the visitor have `y`; everyone walks by `sim/walk.ts` (`walk`: a path kept on the walker,
      found again every `REPLAN_TICKS` or for a new goal; straight at it when there's no way); raiders go straight
      (`moveToward` in raids.ts) along the camp's row and break the walls across their line (`wallBetween`). Gather tasks
      hold a cell index (`land.pools`, `land.marked`; `clearCell` when a pool runs out). `campXY`, `edgeXY` (off the
      land's edge on the camp's row, where strangers come and go), `campEdge` (the town's edge on a side), `dist`, `cellXY`
      in state.ts.
    - The planner: `findSpot` spirals out from the camp preferring spots near a road (`spiralSpot`'s `prefer`), walls go on
      the camp's row past the last building (`wallSpot`), rooms inside the keep (`roomSpot`); `openLand` grows the known
      land with the town (`townRadius` + `OPEN_BEYOND`) and further when a wanted material has run out within it; a store
      full of the harvest no longer stops wood being gathered (the reserve rule in `planGathering`); fields are never
      upgraded by the quiet-spell loop (only `consolidateFields`), and the "learned to build it" loop skips food fields and
      anything already rebuilt into something better (`planned` through `UPGRADES`); no second campfire as a desk.
    - The castle is one level: `keepRect` over the camp (its era's size plus the wings it has grown: `s.keepGrown`,
      `growKeep` when a room finds no place, up to `KEEP_MAX`); rooms (`roomKind`) go inside, everything else outside
      (`canPlace`). Floors, stairs and climbing are gone. The nomads' camps are points (`s.nomad.home/pasture/camp`).
    - Tests: `test/helpers.ts` has `camp`, `row` (free ground two rows below the camp), `put`, `freeSpot`, `wildsNear`/
      `nearestWild`, `makeWild`, `clearAround`, `poolOf`, `isWild`, `campPx`. Soak (10 days, one town each): settlers 22,
      vampires 20, druids 20, nomads 28, dwarves 21.
  - **Phase 3, the top-down renderer (first cut, in progress):** `src/renderer/map/`. `mapView.ts` (`MapView`): the
    land's ground painted in 8-cell chunks (`groundArt.ts`: each ground kind by season, roads as beaten-earth paths, water
    with lighter edges, the land beyond `land.open` dimmed by distance and black past `FOG_BAND`), the wild cells' trees,
    rocks, bushes and plants from the props atlases (`art/propKinds.json`, written by `tools/compose-props.cjs`: each
    object's kind; `PROPS_ON` says what stands on each ground), the buildings on their footprints (the old front-on
    `buildingArt`, feet on the footprint's bottom edge, sorted by it; fields and pens as flat plots from `fieldArt.ts`;
    the campfire animated; blueprints masked to progress with `drawSite`), the marked cells outlined, a placement ghost,
    and the day's tint on `world`. `mapPeople.ts`/`mapRaiders.ts` are the people and raider views in 2D (side-on LPC
    sprites facing left or right, sorted by their feet). `mapCamera.ts` pans in 2D (drag, momentum, wheel, follow).
    `main.ts` drives it (hover kinds: person, building, `cell`, raider, pane); the sky, spells, animals, herds and the old
    strip views are no longer drawn (the old `town/` files stay until the map is complete). The phone page shows the map
    at zoom 0.5 by default (keys `littletown.zoom4*`, 0.25 to 2.6), filling the strip's room. `setCamera` culls the
    chunks and things outside the view (Pixi draws everything else). `window.__map` and `window.__hitTest` are for
    previews. Still to do later (phases 6 and 7): homes and workshops from the top-down packs, the keep's walls, the
    nomads' camp, animals, spell effects, people facing up and down, and deleting the old `town/` views (battleView and
    fightView still import spellsView, spellLooks and peopleView's constants).
  - **Phase 4, the land's places (done):** `src/shared/data/places.ts` (`PLACE_DEFS`: ore vein, cave, trader's cart,
    beast's lair, old ruins, great bones; `PLACE_FOES` by era, `BIOME_BEASTS`) and `src/shared/sim/places.ts`
    (`s.places`, seeded from the seed on first use by `seedPlaces`: `PLACE_COUNT` of them `PLACE_NEAR`..`PLACE_FAR` cells
    from the camp, `PLACE_APART`). `placesHourly`: a place inside `land.open` is found (a journal line naming the
    direction); the peaceful ones the town looks over `LOOK_HOURS` later (`lookOver`: a vein turns its cells to rich rock
    with iron ore and coal in the pools, ruins half the topic being studied and give coins, a cart coins and goods,
    bones bone); a cave, a lair, and `CART_ROBBED` of carts have foes (`rollFoes`) and wait: each is a destination on the
    Expedition Board (`placeDestination`, id `place:<n>`, type `clear`; `destinationOf(s, id)` in expeditions.ts finds
    these beside `DESTINATION_BY_ID`), the player picks the party as for a dungeon (`sendDelve` takes them; the panel's
    `delveControls` with Fight: careful / all out), the fight is on the way and watched on the FF screen, and
    `placeCleared` (from `finishBattle`) adds the hoard and coins; a beast left `BEAST_DAYS` wanders off. Snapshot
    `places` (`PlaceView`); the map draws them from the `places` props set (compose-props: cave mouths, dragon bones, a
    skull, a shrine, crystals, carts, camp tents; `renderPlaces` pulses a ring round a fight waiting), tap: a card with
    "Pick a party…"; the feed has a card per fight waiting. Tests: `test/places.test.ts`.
  - **Phase 5, raids fought on the town's own map (done):** `layOut(s, side, flank)` in `sim/battle.ts` lays the battle
    on the land: the trail is `trail(s, side)`, the cheapest path (`findPath` with `PathOpts.ford`: a river is waded at
    cost `FORD` where it must be; buildings gone round) from where the raiders come out of the fog (`landEdge`:
    `TRAIL_FROM` cells past `land.open` on the camp's row, at least `MIN_TRAIL` from the gate) to the gate (`gateCell`:
    `townEdgeX` on the camp's row), straight runs folded; the flank is the same from the other side. Spots are land cells:
    blocks along the trail (closer together on a short one, none in a ford), ground spots on free cells beside it, wall
    spots on the town's walls within `WALL_NEAR` of it, towers on defence buildings within their range + `TOWER_NEAR`,
    traps where the trail crosses them. `BattleMap` is `len`, `paths`, `spots`, `gate`, `style`, `wall` (the old decor,
    walls, keep, hedges and water are gone: the land itself is the scenery). Each tick the raiders' px follow `foeAt`
    (and allies stand at their spots), so MapRaiders draws them on the trail; `through` puts one at the gate. A placed
    fighter walks to their spot (`doDefend` in people.ts) and fights, holds and is struck only once within `IN_PLACE`
    of it (`inPlace` in `stepBattle`); the unplaced wait at the gate, and `nearestRaider` skips raiders still on the
    trail. `src/renderer/map/mapBattle.ts` (`MapBattle`) draws over the map (MapView's `under` and `over` containers):
    the trail lit the whole way (it runs into the dark), its rut, rings for the spots (lit while placing, filled when
    held, white round the picked fighter's), the gate, shots, bursts, casts and the fighters' act sheets at the raiders'
    px, and the aim ring; `toMap`/`spotAt`/`screenOf`/`leadScreen` for main.ts and previews (`window.__battle`). main.ts
    routes a tap to `battleTap` first (aim, place, pick up), the camera centres on the gate as a battle begins and
    follows the lead raider (`MapBattle.lead`); the HUD bars (`battleHud.ts`) are unchanged. The old `battle/battleView.ts`
    and `art/battleArt.ts` are gone. The phone page keeps the town's zoom in a battle (`watchOn` alone draws at 1).
    Soak (3 towns per origin, 10 days, people/deaths): settlers 17–24/1–2, druids 16–24/2, vampires 20–24/0–1, knights
    21–24/0–1; no town lost.
  - **Phase 6, origins and pack art on the map (in progress):** the vampire keep is dressed by `src/renderer/map/keepArt.ts`
    and `MapView.syncCastle` (from `snapshot.castle.rect`): a flagstone floor (a tiling sprite) with a carpet from the gate,
    the curtain wall seen like the buildings (walk above, face below, battlements), a gatehouse in the south wall, round
    corner towers; the floor and side walks in MapView's `under`, the walls among the `things` (the north wall's zIndex at
    its walk, so rooms by it stand in front; `wide` sprites are never culled). The rooms are the ordinary building
    pictures. `src/renderer/map/packBuildings.ts`: Craftpix's Village tileset houses and awnings (`src/renderer/art/village/`,
    bundled as data URLs) stand for the cottage, row houses, inn and tavern, trading post, stall and general store in the
    base and knights looks (`PICKS`, `STYLES`), scaled to the footprint plus `OVERHANG` on the fine grid (`packArt`; the
    code-drawn picture stands until the image loads, then `onPackArt` bumps `artGen` and the buildings are drawn again),
    with street furniture at a finished one's front corners (`packDressing`: lantern posts, barrels, crates, carts,
    signboards, by the building's id; `DrawnBuilding.extras`).
    The pens' animals amble inside their footprints (`src/renderer/map/mapHerds.ts`, `MapHerds`, the painted farm animals
    of `art/livestockArt.ts`, sorted by their feet among the things). The feed shows alike fights waiting on the land as
    one card ("Beast's Lair found ×2").
    The side-on views nothing drew with any more are gone (`town/peopleView.ts`, `raidersView.ts`, `animalsView.ts`,
    `skyView.ts`, `renderer/camera.ts`); the notes above that name them describe what the map views took over.
    Soak after phase 6 (2 towns per origin, 15 days, people/deaths): settlers 30–32/0–4, liches 32/0, druids 22–32/1–3,
    vampires 32–34/1–2, werewolves 31–37/0–1, machines 29–31/0–1, dwarves 32/0, merfolk 32–34/1–4, nomads 37–39/0, fae
    34–35/4–7, alchemists 28–36/0–2, knights 30–34/0–1; no town lost. (Those death counts, and the earlier soaks', were
    undercounts: the soak scripts watched the journal's length, and the journal is capped at `MAX_JOURNAL` 400 entries, so
    nothing was counted once a town's journal had filled a few days in. Counted properly, deaths were never rare: see the
    deaths pass below.)
  - **Phase 7 (next): the asset pass.** The owner's standing order (see Priorities): replace the code-drawn map art with the
    packs wherever one has the thing: the ground (the Fields, Path and Road, Green Zone and Village tilesets' grass,
    soil, roads, water edges), fields and pens (the Fields tileset), more buildings for every era and origin (the
    Undead tileset for the liches and vampires, the Dungeon and Cave packs for the dwarves), props and effects.
    - **Roads (done):** `src/renderer/art/roadTiles.ts` lays Craftpix's Path and Road tiles (16px, a road two tiles
      wide, so a 32px road cell is four quarter-tiles): `roads/roadTiles.json` maps each quarter's case (road on past
      its two outer sides, across its outer corner) to a tile, worked out from the sheets by sampling them (a missing
      inner corner falls back to the full tile). `ROAD_BY_ERA`: slabs (road5), cobbles (road1), bricks (road2), paving
      (road4); grass-tufted edges on green ground, bare earth on sand, soil and rock, bare in winter. `paintChunk`
      paints the ground under, then the road over; the chunk key carries the era and whether the sheets have loaded
      (the painted path stands until then).
    - **Plots, pens and the campfire (done):** `src/renderer/art/fieldTiles.ts` (the Fields tileset's soil tiles by
      what they have grass on, `SOIL`, mirrored for the right-hand pieces; `drawSoil` edge-aware over a plot;
      `drawFence` rails and posts round a pen with a gap for the gate; `campfirePack` the six flame frames).
      `fieldArt` builds a `packedPlot` on them once loaded (`fieldTilesReady`; `onFieldTiles` bumps MapView's `artGen`),
      the crop rows still drawn over the soil; MapView's campfire takes the pack's frames.
    - **More picks (done):** `PICKS` in packBuildings.ts is a table of `Pick`s (one image, `parts` laid together on a
      `size`, or `any` of several by the building's id; `overhang`; `styles`, else every look but `OWN_TENTS`): the
      Fields pack's camp tents for the lean-to, hide tent and longhouse, its crates and logs heaped for the stockpile,
      the Village pack's palisade stakes and gate for the palisade wall and gate.
      A `Part` may crop a sheet (`[url, x, y, sx, sy, sw, sh]`): the dungeon pack's stonework for the stone wall and
      gate, its props' bookshelves for the library, an alchemist's bench for the healer's hut, a table for the
      workbench, and the undead pack's graves for the graveyard.
    - **Footpaths (done):** the land remembers foot traffic (`LandMap.wear`, one character per cell: `addWear` when a
      walker steps into a new cell (`tread` in walk.ts, `Walker.cell`), never a road; `decayWear` hourly from sim.ts,
      the field dropped when nothing is worn; `WEAR_*` in land.ts). `paintChunk` draws a worn cell (from `WEAR_SHOW`,
      fully at `WEAR_FULL`) as patches of the Path and Road pack's bare-earth blob (`drawWornPatch`, the grass sheet's
      round patch) at its middle and toward each worn or road neighbour, faded by how worn; the chunk key carries the
      worn levels a cell either side. Test: `test/footpaths.test.ts`.
    - **Blood (done):** a blow that lands on a townsperson is remembered (`Person.lastHit`, `hitFrom` the side it came
      from, set in `attackPerson`; `PersonView.sinceHit`/`hitFrom`); the Gigapack's red splatters (`effects/splat_*.png`,
      `splatFrame` spray/gush/burst, `SPLAT_SIZE`) are sprayed away from the striker on the map (people in mapPeople,
      flesh raiders in mapRaiders: `bleeds` = `natureOf` person or beast; the undead and machines still spark), on the
      raid map's spots (mapBattle) and on the fight screen (fightView). Whoever is struck down leaves a stain: the sim
      marks it (`markBlood` in state.ts, `s.blood`, `BLOOD_LASTS` 3 game hours, `BLOOD_MOST` 40; raiders when they fall
      in `updateRaid` (`Raider.bled`), people in `knockDown`/`killPerson` when a blow just landed), `snapshot.blood`
      carries them with their age, and `map/bloodPools.ts` (`BloodPools.sync`, in MapView's `under`) draws the burst's
      widest frame flattened and darkened, fading as the mark ages. Tests: `test/blood.test.ts`.
    - **Combat actions (done):** `src/renderer/art/combatPoses.ts`, shared by the map (mapPeople) and the fight screen
      (fightView). The sim remembers a defender's blow (`Person.lastBlow`, set in `defenderAttack` whether or not it
      lands) and a raider's blow turned on armour or a shield (`lastBlock`, in `attackPerson`); `PersonView.sinceBlow`/
      `sinceBlock`. `fightAnim` picks the LPC row by the weapon's family (`ANIM_BY_FAMILY`: spears, polearms and
      daggers thrust; bows, crossbows, slings, thrown and guns shoot; staves, wands and a ranged calling cast; the rest
      swing); `fightPose` plays it over `BLOW_TICKS` (`SHOOT_TICKS` for a bow) after a blow, a flinch (the hurt row's
      first frames) when just struck, the hurt row's last frame when down, else standing ready (no more endless
      thrusting). The fighting callings take a **combat form** while they fight and for `HERO_LINGER` after
      (`HERO_FORM`: knights and guardians the Craftpix knights, warriors and dragoons the samurai commander, samurai
      and spellblades the samurai, archers, rangers and hunters the samurai archer, monks the ninja monk, assassins and
      dancers the kunoichi, witches, shamans and chronomancers the wizards; `heroSheet` by the person's id, scaled to
      `HERO_HEIGHT`): `heroFrame` plays dying, hurt, one of two attacks (`attack2`), the guard (`defend`, after a block),
      the walk or the idle. `tools/compose-sheets.cjs` gives those sheets the two extra rows (`hero()`; the new rows come
      after the five every sheet has, so the layout of the rest is unchanged); `creaturePoseFrames` and the
      `CreaturePose` type in creatures.ts. The Pixel Champions looks (`CLASS_LOOK`) and founders keep their own
      sprites. Test: `test/combatPoses.test.ts`.
    - **The plain ground (done):** `src/renderer/art/groundDetail.ts`. The top-down packs draw their ground as a flat
      colour with lighter patches on it, so that is how the map paints it now: the Path and Road pack's patch sheet
      (`ground_grass.png`: five bands, two flat colours each: `Patch` kinds grass, meadow, teal, leaf, olive, soil, loam,
      chalk, sand, peat) gives each kind of ground its patches (`PATCH_OF` by season in groundArt.ts, none in winter) and
      its plain colour (`groundUnder`: the patch's colour darkened; sand and rock keep the palette's, the marsh is dark
      green with teal pools, `BASE_FROM`), the Fields pack's tufts, flowers and pebbles are scattered on the grass and
      hills (`drawTuft`; pebbles on rock), and the Undead pack's ripples (`water/ripples.png`, the first row of its
      sheet) lie on the water recoloured to its light (`drawRipple`, where there's open water to the right). The chunk
      key carries `groundDetailReady`; until the images load the old speckled ground stands.
    - **More buildings from the packs (done):** about 40 more `PICKS` in packBuildings.ts, the sprites cropped from the
      packs' sheets by hand into `src/renderer/art/packs/` (the cropping is one-off, with the scratch scripts; no tool
      kept). A `Pick` may have `variants` (`styles` and a pick of their own, tried first: `pickFor`), which is how the
      nomads get the rocky-area pack's tipis and yurts for their homes, the dwarves the cave pack's carved gates for
      every mine and its totems and statue for the storytellers' circle, and the liches a green crystal phylactery.
      Base and knights looks: the Village pack's third timber house with each trade's gear at its door (smithy,
      bakery, sawmill, tannery, loom). Every look: the stone well, carts (wagon circle), racks, the hunters' camp tent
      and the barracks' tents behind a palisade, the cave pack's fire pits for the bloomery and kiln, the storytellers'
      fire with logs round it, the herb garden on soil tiles, mine mouths, the skull altar shrine, crystal phylactery,
      the dungeon props' furniture (scriptorium, school, glassworks, infirmary, hospital), and the futuristic objects
      pack's tanks, transformer, consoles, racks and screens for the industrial and later plants (power station,
      refinery, oil derrick, battery plant, electronics plant, chip fab, AI core, mission control, robot workshop).
      Still code-drawn: the towers, the windmill, the elder lodge and town hall, the trophy hall, the factory and
      garage, and the origin halls (no pack has them).
    - **The undead's land (done):** a props set `undead` (compose-props.cjs: the Undead pack's dead and broken trees as
      trees, thorns as bushes, pale weeds as plants, bones, skull piles, rocks and crystals as rocks; one shadow direction
      of each), the only set on the liches' and vampires' land (`MapView.blighted()`, plus `winter` when it snows), and
      their ground is blighted (`paintChunk(..., blight)`: `BLIGHT_PATCH`/`BLIGHT_FROM` in groundArt.ts: olive grass and
      peat woods on peat, no flowers; the chunk key carries it).
    - **Code-drawn buildings from the map's angle (done):** `src/renderer/art/topDown.ts` (`topDownArt(def, w, d, tone,
      toneKey, style)`) replaces the side-on `buildingArt` on the map (MapView's `art` and the placement ghost; the feed
      and report cards keep the side-on pictures) for every building without a pack pick: a roof plane seen from above
      (`roofPlane`: foreshortened, lit at the ridge, shaded to the eaves, covered in the era's way: thatch bands, tile or
      slate courses, metal panels) over the front wall on the footprint's bottom edge (`frontWall`: wattle, half-timber,
      brick or panels by `eraOfResearch`, a door and lit windows), `EAVE` px over the footprint each side and `LIFT` px
      above it. Shapes by id (`SHAPES`): house, hall (taller walls, a front gable with a window, columns), flat (a
      parapet, vents, a skylight, a glass band), works (a sawtooth roof with glazing and stacks), tower (a drum with a
      platform seen from above: battlements, a thatched cap on the lookouts, a mast, a barrel, the windmill's sails),
      dome (shaded rings, ribs, a glint), wall (walk and face), pad (the launch pad with its rocket standing, the spike
      trap); `topper` adds a cupola, a red cross, a barrel, antlers. Then `reclad` (now exported from originStyles.ts,
      with `Style`) swaps in the origin's materials. `window.__topDownArt` is for previews (a gallery script draws every
      building).
    - **Spells on the map (done):** `src/renderer/map/mapSpells.ts` (`MapSpells`, in MapView's `over`): each cast in
      `snapshot.spells` plays its look's effect sheet (`LOOKS` in town/spellLooks.ts, `SHEETS` in town/spellsView.ts:
      the Pixel Magic, pvfx and Alenia sheets) over whoever it touched or over the caster, with the magic circle under
      the caster and the name floating up; people and raiders are followed by id. Spell targets and casts now carry
      `y` on the land (`SpellTarget.y`, `SpellFx.y`, `SpellView.y`; set in powers.ts and rivals.ts); older casts
      without one are drawn at the camp's row. The old side-on `spellsView.ts` keeps the sheet table and the code-drawn
      kinds the fight and battle views still use.
    - **People facing up and down (done):** `tools/import-lpc-faces.mjs` (run by hand; Playwright's Chromium) finds
      each LPC layer's sheet in `../chronos-assets/Universal-LPC-spritesheet-master` by name, picks the colour variant
      whose walk-right row matches the data's best (all 136 non-weapon layers found, most exactly; hair differs only in
      colour, which the lightness tint evens out), and cuts its walk-up and walk-down rows into
      `src/renderer/art/lpc/lpcFaces.json` (a 1 MB file beside the page, copied by the builds, fetched by `loadLpcFaces`
      after the rest loads; side-on until then). `lpcCanvas`/`lpcFrame` take a `facing` ('up' | 'down'), used for the
      walk when every layer that shows has it (`canFace`); the facing rows are tinted with their own lightness
      reference. The people view (`Drawn.face`) faces someone up or down the map when that's mostly how they moved
      last, and keeps it while they stand; never when mounted or fighting. Raiders and travellers' LPC sprites stay
      side-on (raiders don't walk the facing rows yet).
    - **Deaths pass (done):** the "deaths run low" watch item was mostly a counting bug (above). A soak must count journal
      entries by identity (a `WeakSet` of the entry objects seen, scanning `s.journal` each tick), never by its length,
      since the journal is capped. Counted that way (4 towns per origin, 15 days, people/deaths): settlers 26.8/20 (15
      at raiders' hands, 1 of wounds, 4 of plague), knights 34.3/—, vampires 35.0/14, liches 32.5/—. One rule added
      all the same: **a fighter who falls back off the line takes a parting blow** from each raider they were holding
      (`stepBattle` in battle.ts: the raiders held at that spot strike once at their back as they go, then walk on), so
      leaving the trail is a danger rather than a refuge. With it: settlers 30.0/19 (18 at raiders' hands), vampires
      31.8/32 (every one at raiders' hands; their fighters fall back often, and now pay for it). Test:
      `test/battle.test.ts` (the parting blow). `KILLING_BLOW` and the rest of `data/raids.ts` are unchanged.
    - **Lights and smoke on the map (done):** finished buildings' windows and fires glow after dark: MapView's
      `lights` container stands beside `world` (so the night's tint doesn't dim it), follows the camera, and fades in
      from dusk (`setDaylight`); a glow per lamp the painted art found (`PixelArt.lights`: the top-down painter's
      `WINDOW` colour and each origin's, through `reclad`), and one fire glow (`FIRES`, `FIRE_GLOW`) for the campfire,
      bloomery, kiln and storytellers' circle, whose pack pictures have no lamp colours. Pack houses have no glow
      (their windows aren't lamp colours). Smoke rises from chimneys and stacks: the top-down painter records them
      (`PixelArt.smoke`: the house chimney in the medieval and industrial eras, the works' stacks), MapView keeps a
      `ChimneySmoke` (town/ambientView.ts, puffs `size` 1.6 for the map's distance) in `over`, fed by `renderAir(dt)`
      each frame with `smokeAmount` from `airFor` (main.ts, per snapshot); off while `calm`. The feed's and report's
      building pictures (`__picture` in main.ts, `cardArt`) are the map's now: the pack's picture, else the top-down
      painter's.
      The pack's timber houses smoke too (`Pick.smoke` in packBuildings.ts: the chimney's top in source px, scaled
      with the picture), and their windows glow (`Pick.lamps`: the windows' centres, made `PixelArt.lights` in the
      painter's window colour); the nomads' tipis and yurts smoke from their tops. **Shared props for every look:**
      `OWN_TENTS` (the vampires, liches, machines, nomads and merfolk, with homes and walls of their own in
      originStyles.ts) now keeps from them only the picks marked `own` (the Fields pack's tents, the hunters' and
      barracks' tents, the palisade and stone walls and gates); the well, racks, logs, fire pits, benches, shelves,
      graves, mines and the industrial plants suit them like everyone else (they were all withheld before).
      The open fires (`FIRES`: campfire, bloomery, kiln, storytellers' circle) smoke as well as glow.
    - **Night life (done):** everyone out after dark carries a lantern: `MapPeople.lights` (the map's lights layer, set
      by main.ts) holds a warm glow per person (`Drawn.lamp`) at their feet, hidden indoors; the layer's dusk fade
      makes it night-only. **Fireflies** (`MapView.fireflies`, from `renderAir`): on spring and summer nights in fair
      weather (`MapView.weather`, per snapshot), not in the tundra or desert, up to `FLIES_MAX` tiny green-yellow glows
      drift over the grass, forest, marsh and hills in view (`FLY_GROUND`, not in the dark beyond the open land), each
      blinking a few times and winking out; none on a slow phone (`calm`).
    - **Birds by day (done):** `src/renderer/map/mapBirds.ts` (`MapBirds`, in `things`, fed by main.ts per snapshot:
      `on` by daylight in fair enough weather, `winter`, `land`, `folk` = everyone about, raiders too): little flocks of
      sparrows, a robin, a grey bird, or a lone crow (DawnLike's Avian sheets, two frames each, cut into
      `art/birds.png`) come down (`landingSpot`: lit open ground, a road or a field in view with nothing standing on it,
      `MapView.standingAt`), hop about pecking, and take wing when someone comes within `SCARE` px or when they've had
      enough, climbing and shrinking with a shadow left behind. At most `MOST` (9, `MOST_WINTER` 4), none when `calm`.
      `window.__birds` for previews; `MapView.view` is public (the view in world px).
    - **The shallows (done):** on the coast, half the shore's water cells (`SHALLOWS` in groundArt.ts) show the bottom
      through the water: a coral, urchin, starfish or shell of the Seabed props set (`propImage('sea')`, `propFrames` in
      art/props.ts: the atlas image itself, painted onto the chunk's canvas at 0.42 alpha, under the ripples; the set's
      drowned statues left out); the chunk key carries whether the atlas has loaded. The old WeatherView fireflies (screen-wide pixels) are gone: the map's are the fireflies now.
    - **Snow on the buildings (done):** `art/snowCap.ts` (`snowCapped`): in winter every finished building but the plots
      and the campfire is drawn from a capped copy of its picture (cached per picture): white blended along each
      column's first opaque pixels (`tops`), `DEEP` (5 px) where the edge runs level, thinner down a slope, stopping at a
      hole. The building `sig` carries the winter flag, so the town is redrawn once at the turn of the season. The
      vampire keep's walls and towers are capped too (`syncCastle`, its key carries the season). The old strip's
      `town/townView.ts`, `buildingsView.ts` and `herdsView.ts` are deleted (nothing drew with them); `spellsView.ts`
      keeps its own `WALK_Y`. The notes above that name those files describe what the map views took over. **Construction sites were invisible on the map:** the site's and the mask's Graphics stood at
      the world origin and drew at world coordinates, and `setCamera` culls each thing by where it stands, so they were
      hidden wherever the camera wasn't at the map's corner. They stand at the picture's corner now and draw from there.

- Steps: (1) weapons and +N; (2) armour and gear kinds; (3) levels and the 125 classes; (4) the 160 spells and 200
  skills in the fight sim (expeditions, raids); (5) the side-view fight screen; (6) uniques and the bosses' loot
  tables; (7) scouting and the opened map; (8) the delve sim (rooms, fights, supplies, retreat, the boss, loot); (9)
  the delve view; (10) dungeon types, modifiers, elites, dozens of bosses; (11) quests, rivals, the trophy hall,
  respawn, alerts; soak, phone checks, PR. All eleven are done; boats are what's left.

## Known problem (fixed, watch)

- **Slow growth after the livestock change** was the planner counting hide as available because a goat pen can be
  culled (`sourceable` in `planner.ts`). Pens are culled only when full or short of food, so towns queued buildings that
  cost hide and nobody could supply it. Now only pens kept for meat count. Later soaks (8 towns per origin, 15 days,
  after the Phase 4 farming) had no town die out: druids 29.6, dwarves 30.9, settlers 28.3.
