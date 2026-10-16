# Chronos Settlement: the record of what has been built

Moved here unchanged from CLAUDE.md, which keeps the working guide and an index of the systems. Don't read this top to
bottom: grep it for the system, file or name you are about to touch, and read that part first. New notes go in
`docs/notes/<branch-topic>.md`; the coordinator folds them in here when the branch is merged.

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
  quarter pace, and at most 2 game days pass for one absence (`MAX_OFFLINE_MS`; 1 before 0.64.0).
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
- **Morning report card (removed in 0.60.0 with the away report; `sim/highlights.ts` is left unused):** `src/shared/sim/highlights.ts` picks the three biggest things from the away report's
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
- **Fewer pop-up notices over the town:** the phone page marks the strip `feed-shown` (`layout()` in `mobile.ts`,
  the class keeping its old name) whenever no battle is on; then the strip pops up only the day's small change
  (`CHATTER` in `renderer/chatter.ts`), since the news bubble carries the rest.

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

- **Age and lifespan (done; the owner's request):** every townsperson has an age in years and a lifespan of their
  people's. `src/shared/data/lifespans.ts` (`LIFESPANS` per origin: `grown` and `old` in years, `elderDays` and
  `oldDays` as a grown-up: settlers and knights 50/65 days, 18 to 70 years; nomads shorter; alchemists and druids
  longer; merfolk 90 days to 120 years; dwarves 130 days to 250 years; the fae 200 days to 600 years; a werewolf's
  curse 50 days to 52 years whatever the town, `CURSED_LIFESPAN`). `sim/ageing.ts`: `lifespanOf(s, p)`, `ageYears`
  (a child's years climb to `grown` over `CHILD_DAYS`), `lifeStage` (child, young, prime, elder, old, deathless),
  `ageLine` ("A dwarf of 112 years, in their prime. Dwarves grow old at about 250."); the old-age odds past
  `oldDays` climb scaled to the span (`HUMAN_OLD_DAYS`), and founders arrive up to `primeSpread` (40% of the elder
  days) into their prime. The Townsfolk rows show the years (`· 64y`), the inspect page `Aged N` and the line, the
  tap card the years. Snapshot: `ageYears`, `lifeStage`, `ageText`. Tests: `test/ageing.test.ts`.
- **Werewolves wear the pack's sprites:** `WOLF_FORMS`/`WOLF_SCALE` in `art/combatPoses.ts` (Craftpix's black, red
  and white werewolves, by who they are): a werewolf townsperson takes wolf form on the map under the full moon and
  whenever they fight (mapPeople), and on the fight screen in every fight (`FighterView.wolf`, at a hero's height);
  the `werewolf` raider and `the_alpha` (data/enemies.ts, `packSprite`) are the pack's too, so the Moon Pack's raid,
  the Alpha's summons and the rival packs all match. The old `wolfman` sheet is left for nothing but its type.

- **The merfolk's shore (done; the owner's call: coast only, half sea, building on land and in the water, swimming):**
  the Tide Clan's land is shaped by the sea (`rules.shape: 'sea'` in data/origins.ts; `LandShape` in land.ts; a shore
  town is always founded on the coast: `newGame` forces the biome, the New Town screen says so instead of the biome
  cards). `makeLand(seed, 'coast', 'sea')`: the south half is `water`, its shore `SEA_FOOT` rows below the camp and
  wandering further off, `shallows` (ground 'S', `SHALLOW_ROWS` out, waded by anyone at a cost) along it, sand on the
  strand; the biome's own edge-sea is left out. Every cell of the sea holds a pool (`seaPool`: fish, kelp in the
  shallows, now and then a pearl; `fish`, `kelp`, `pearls` in data/materials.ts, fish and kelp food, pearls worth 14),
  gathered as `Fishing` (`TERRAIN.shallows`/`water` in data/terrain.ts: a gather task on a sea cell once dropped
  itself for want of an entry, and the marked pearl cells then clogged the marking cap); a fished-out cell stays the
  sea (`clearCell`) and gives again each dawn (`replenishSea` in `sim/sea.ts`, `SEA_REFILL`). `sim/sea.ts`: `seaTown`,
  `swims` (everyone of a shore town: `walk`/`pathTo` take `swim`, `PathOpts.swim` = `SWIM_COST` 0.8 a cell of water),
  `seaBuild` (homes, the seat, defences, the shrine, well, tower, circle, graveyard may stand in the sea: `canPlace`
  allows wet ground for them, `fits`/`doorFree`/`spiralSpot` take `water`, the planner's `findSpot` prefers the sea for
  them by `SEA_PREFER`; fields, pens and workshops stay on the strand), `inSea`. The planner fishes when food is under
  4 days and keeps one pearl cell marked (`PEARLS_WANT`, `RESERVE` 0: sold). The map: `shallows` in the ground palette
  (clear water over sand, the Seabed props showing through, foam at the strand, ripples); a merrow in the sea
  (`PersonView.swimming`) is drawn to the waist (`waistUp` crops the frame to `WAIST`) over a code-drawn tail
  (`art/merTail.ts`, four sea colours by id, swaying; no shadow); a building in the sea has a ring of foam for its
  shadow. Tests: `test/sea.test.ts`. Probe (5 days): 11 people, 11 lean-tos in the shallows, fish, kelp and pearls
  in store. Soak (15 days, one town): 18 people, 2 deaths (slower than the old merfolk's 31: half the land is sea now,
  so the wild stuff is further; watch it). The sea raiders, fins, trip backdrops, stilt homes and tide pools came later:
  see "The merfolk rework".

- **The undead village (done; the owner's call: only the dead in a lich town):** `keepKin` in `sim/townsfolk.ts`,
  hourly from sim.ts: whoever is in a kin town and not of its kin is made kin, by whatever door they came (a wanderer,
  a captive brought home, a raider come round, a rival won over, a quest's captive; a lich town once held three living
  and a vampire by day 10). In a lich town they are raised (`monster` undead, "is dead, and risen") and look it
  (`raisedLook`: the LPC `skeleton` body in a bone tint by id, no hair, the clothes they died in; the founding
  companions too); the lich keeps their own shape. A pack bites its newcomers, a colony remakes them. In a fight the
  raised dead take the Craftpix skeleton forms (`skeletonSheet` in art/combatPoses.ts: the archer for a shooter, the
  warrior or the spearman by id; mapPeople and fightView through `FighterView.undead`). Tests: `test/kin.test.ts`.

- **The dead don't eat (the owner's complaint: a lichdom farmed as if alive):** the lich is dead in body too
  (`Person.undying`, set at founding and by the rite in occult.ts, and on older towns' lich by `keepKin`), so
  `tireless` (state.ts) covers the raised, the lich and machines: no hunger, sleep, sickness, age or pairing. Raised
  or remade, needs are set full for good (`makeUndying`: someone raised hungry once stayed hungry). Food is reckoned for
  eaters only (`eatersOf`, `foodDaysFor`: `NO_EATERS_DAYS` when nobody eats): the planner's `Needs.eaters` sizes the
  fields (a town of nobody who eats sows one field, and only for its tavern's guests), the berry and fish wants, and
  sells all its food; farming's, the pens' and the feasts' food days likewise (the dead dance and eat nothing); a party
  packs food only for its living; a wanderer is never turned from a dead or machine town for want of food. The dead
  skip the tavern's night out, feel no hunger or weariness in their mood, and the lich no "Living among the dead". The
  Townsfolk page shows "Needs neither food nor sleep" for them (`PersonView.tireless`). Homes stay as they were (the
  crypts, and a bed is still what lets a newcomer in). Soak (10 days): lich towns 5 to 6 food fields → 1, machines 8 → 1,
  growth as before. Tests: `test/undead.test.ts`.
- **Strangers of other peoples, xenophobia, the hidden vampire's thirst (done; the owner's request):**
  `src/shared/data/strangers.ts` and `src/shared/sim/strangers.ts`. `Person.origin` and `Traveller.origin` (their
  people when not the town's; `peopleOf`): a wanderer is of another people `STRANGER_CHANCE` of the time, a traveller
  `TRAVELLER_STRANGER_CHANCE` (`strangerOrigin` from `STRANGER_ORIGINS`, never the town's own, the dead and machines
  never), with their people's look (`strangerLook`: dwarves short, the fae and merfolk long-eared, the merfolk
  sea-skinned, the Blood Court pale) and lifespan (`lifespanOf` reads `p.origin`); a stranger of the Blood Court comes
  as a vampire in hiding, of the Moon Pack as a werewolf (`makeStranger`). A traveller who leaves the shop well served
  may ask to settle (`offerToSettle`, `SETTLE_CHANCE`, a bed free: they become the town's visitor, taken in or sent
  on as any wanderer). The `xenophobic` rule (data/origins.ts: the Deep Hold) turns strangers from the gate
  (`welcomes`), wanderers and settlers alike. **The thirst:** a hidden vampire feeds the quiet ways first
  (`updateMonsters`: the town's blood tithe, a prisoner, a beast of a full pen (sometimes drained), a lodger at the
  tavern (who leaves pale, half their purse)), townsfolk last: a bite stirs the Guild `GUILD_BITE` and counts
  (`s.bites`), and after `THIRST_BITES` the town speaks of it: a prompt of kind `thirst` ("A thirst in the dark",
  `askThirst`/`answerThirst`, `THIRST_OPTIONS`): a blood tithe (`s.tithe`: fed cleanly from then on, `TITHE_MORALE`
  off everyone once), the Guild called (hostility to its threshold: hunters at the next noon), or nothing said. Tests:
  `test/strangers.test.ts`.

- **Natures (done; the owner's ask: villagers with personalities of their own):** `src/shared/data/natures.ts`:
  fourteen natures (cheerful, grumpy, shy, bold, dreamy, pious, greedy, kind, proud, curious, gloomy, jolly, stern,
  restless), each with a name and a line, a `mood` nudge to the morale they settle at (`driftMorale`), a `work` pace
  (`workFactor`), `friction` and `likes`/`clashes` (`natureFit`, added to the pair's `chemistry` in `updateSocial`,
  so like warms to like and some natures grate), and lines to `say` on each `Topic` (greet, work, cold, hot, rain,
  night, hungry, tired, raid, friend, rival, idle, sea, sick, old, child; `ANYONE` fills a gap). `natureOf(p)` is
  decided by the id (`Person.nature` overrides; no save change). **Speech bubbles:** `src/renderer/map/speech.ts`
  (`topicFor` from the person's view and what's going on, `lineNow`, `makeBubble`: a white box with a tail, the
  look's body face) and `MapPeople.speak`: each person has a slot of `SPEECH_EVERY` (48 s, offset by id) and speaks
  in `SPEECH_SHARE` of them for `SPEECH_FOR`; someone within `TALK_NEAR` answers `REPLY_AFTER` later; never asleep,
  fighting, just struck, indoors or a visitor. main.ts feeds `weather`, `season`, `hour` and `raid`;
  `window.__talk = 1` makes everyone talk (previews: glowshot's TALK=1). The Townsfolk rows, the inspect page and the
  tap card name the nature (`PersonView.nature`, `natureName`, `natureLine`). Tests: `test/natures.test.ts`.

- **The Blood Court's blood (done; the owner's request: blood as a resource, a blood farm, tithes, prisoners kept and
  bled):** `blood` is a material (data/materials.ts, worth 5; the planner keeps `RESERVE` of it like any other and
  sells the surplus). `src/shared/data/vampires.ts` and `src/shared/sim/vampires.ts`: each dusk (`TITHE_HOUR`,
  `bloodHourly` from sim.ts) a blood town (`bloodTown`: the Court; it keeps the tithe from its founding, `tithed`)
  gets `TITHE_PER_THRALL` from every living grown thrall, `BLOOD_PER_HEAD` from the pens' beasts and
  `BLOOD_PER_PRISONER` from each prisoner in the **Blood Farm**'s cells (`BLOOD_FARM`, `origin` vampire from the
  Medieval age, merged into BUILDINGS; `FARM_CELLS` 4 a farm, escapes `FARM_ESCAPE` as likely); the vampires drink
  from the store before any other way (`drinkBlood`, first in `updateMonsters`' order, in any town with blood in
  store), and the surplus is brewed into `blood_wine` (a tier-2 ware, 3 blood, 18 coins; code-drawn icons
  `blood_wine` and `mat_blood`). The Court's prisoners are kept, never won over (`updatePrisoners` skips conviction
  in a blood town), and its thralls take the fallen alive `captives` times as often (the rule in data/origins.ts, 2;
  `takePrisoners`). Tests: `test/bloodCourt.test.ts`.

- **More buildings and crafting stations (done; the owner's ask):** `src/shared/data/workshops.ts`: 29 workshops, each a
  station of its own (`WORKSHOP_BUILDINGS`, merged into BUILDINGS; their ids in the `Station` union and `STATIONS`), with
  about 70 recipes (`WORKSHOP_ITEMS`, merged into ITEMS: wares for the shop, fare for the tavern, furnishings for either
  venue, and material recipes) and six new topics (`WORKSHOP_TOPICS`: Jewellery, Printing, Clockwork, Canning, Household
  Appliances, Biofabrication; the rest hang on topics the game had). By age: the smokehouse, bone carver and basket weaver
  (Stone Age); brewery, tailor, jeweller, cooperage, apothecary, chandlery, dyeworks (Medieval); printing press,
  clockmaker, cannery, textile mill (Industrial); appliance plant, pharmacy (Modern); biofabrication lab, nanoforge
  (Space); and one of each people's own from the Medieval age (`origin` + `era`: the Court's blood cellar, the liches'
  bone forge, the hold's gem cutter, the druids' bower, the merfolk's pearl works, the nomads' felt works, the fae's
  glamour loom, the alchemists' alembic, the machines' assembler, the knights' armourer, the pack's pelt house). Three
  comforts besides: the granary (150 storage), the theatre and the bathhouse (morale). The planner builds one of each it
  has learned ("a new workshop") and sells their wares. Pictures: `PICKS` in packBuildings.ts (the medieval trades in the
  pack's timber house with their gear at the door; the rest from the camp's racks and fires, the dungeon props and the
  futuristic objects). `isUnlocked` now reads a settlers' town's missing `origin` as settlers, so another people's
  buildings (the blood farm, the origin defences) are never theirs. Tests: `test/workshops.test.ts`.
- **The ring wall (done; the owner's ask: a wall round the town that grows with it):** `src/shared/sim/ringWall.ts`.
  An open town (not a castle or the hold, which have walls of their own, nor a tribe on the move) walls itself all
  round once it is `RING_PEOPLE` (6) grown-ups strong (sooner when raided or set on Defence): `wantRect` is the box
  round every building but the fields, pens and old walls, `RING_PAD` (3) out and each side stepped out from the camp to
  a multiple of `RING_STEP` (4), at least `RING_MIN` (6) each way; `ringCells` its perimeter; `gateCells` a gate on the
  camp's row on the west and east (where raids come in) and wherever a road crosses the ring. `s.ring` (`Ring`: gen,
  rect, wall, gate, gates, done) is the ring under way; its pieces are ordinary wall and gate buildings tagged
  `Building.ring` with the generation (the best wall learned, `bestWall`; gates for every wall now: brick, concrete and
  force gates added to data/buildings.ts and UPGRADES). `planRing` (from `planBuilding` each pass, before the wishes)
  places the gates first, then the walls (`missingPieces`: a cell with water, mountain or another building is left as
  the wall there; wild cells are cleared first), at most `RING_AT_ONCE` (2) on the queue with a slot always left for the
  rest, only while the stores hold `RING_SPARE` (3) times a piece's cost, none while food is under 2 days, and not
  before the shop in a town that must buy what it builds with (`shopFirst`); when the town grows past the ring (`contains`) a wider one is started outside
  it (a new gen), and once the new ring stands all round (`ringComplete`) the older pieces, and the old strip's end
  walls, are demolished (half refunded). **One blueprint for the whole wall (the owner's ask):** every piece of the ring
  that can stand now is laid at once as a *planned* blueprint (`Building.planned`: it takes no build slot
  (`blueprintCount` counts only `inWork` blueprints), nobody hauls to it or builds it (people.ts), the planner's wants
  and `shelveStalled` skip it, and `blockedBy` lets people walk through it); the map draws a planned piece as the wall's
  ghost alone (`updateBlueprint`), and `planRing` releases the sections into work in the ring's order (the gates first,
  then round), `RING_AT_ONCE` at a time under the old stock rule; a better wall learned remakes the planned pieces as
  it. Test in `test/ringWall.test.ts`. The known land is opened to the ring's corners. Townsfolk walk out through the
  gates (`blockedBy` in walk.ts and `connectRoad` let gates through; a sealed town walks straight through, as `walk`
  always did); raids' trails end at the ring's gate on their side (`ringGate` in battle.ts `gateCell`), raiders break
  the gate or wall as before (`wallBetween`), and shooters stand on the ring's pieces near the trail (wall spots). The
  planner's old end walls (`wallSpot`, "a wall at each end of town") are gone. **Continuous walls:** a one-cell wall
  piece's picture is chosen by how it joins its neighbours (`MapView.wallJoin`: along a row, down a column, a corner,
  alone; in the building's `sig`, so a piece is redrawn when a neighbour goes up): `Pick.joins` in packBuildings.ts
  gives each join its own picture. **Palisades that join (the owner's complaints):** laid from the Village pack's palisade tileset as the
  pack itself lays an enclosure (`palisade01`..`46` are its `Tile2_NN`): a run along a row is two tiles tall, the pointed
  tops over the cell above and the feet with their stones on the cell (`pal2`, one of three by id: `PAL_RUN`, chosen
  through `Pick.of`); each corner is the pack's own corner piece (`nw` 01/09, `ne` 06/14, `sw` 33/41, `se` 38/46); down
  a column the post of that side (`v` the west wall's 17/25 at the left of the cell, `ve` the east wall's 22/30 at the
  right, so it meets the corners' posts: `wallJoin` tells the side by which way the run turns at its ends); a lone piece a
  single post (`POST`); a piece with walls both ways along a row or a column is the straight piece, so a T holds the line.
  **Gates in the wall:** a gate on the west or east run stands **turned** (`Building.turned`:
  `footprint` swaps its width and depth; `canPlace`/`placeBlueprint` take `turned`; `gateTurned`/`gateAt` in
  ringWall.ts cover the ring cell and the one below it), drawn from the gate pick's `joins.v`, the same parts with
  `Pick.rotate` 90 (rotated in `pickArt`); `upgrade` keeps the road under a gate. Tests: `test/ringWall.test.ts`.
- **Turn-based fights where stats matter (done; the owner's ask):** `src/shared/data/attributes.ts` and
  `sim/attributes.ts`: everyone has Strength, Dexterity, Vitality, Intellect and Wisdom (`Attrs`; `attributesOf(p)`:
  `ATTR_BASE` 8, a class's growth by level in its own proportions (`CLASS_ATTRS`), the work skills' part, traits, a
  founder's edge). In `personFighter`: Strength (or Intellect for a caster) in the blow, Dexterity in aim, dodge and the
  time between turns (`speedOfDex`), Vitality in health; a fighter's health is the same share at the fight's reckoning
  and scaled back after (`finishBattle`). **Turns:** `stepBattle` lets one fighter act a tick and waits `TURN_BEAT`
  (6) ticks after each action (`Battle.beat`; `ULT_BEAT` after an ultimate), so turns come one at a time and the quick
  come round more often; fights run about twice as long as before (the dragon test waits 180 s). **Costs:** spells draw
  mana (`maxManaOf`, `spellCost` by the level learned), skills stamina (`maxStaminaOf`, `skillCost`); both return a
  little each turn (`manaRegenOf`, `staminaRegenOf`) and a plain blow gives `STAMINA_PER_BLOW` back; `KitAction.cost`/
  `pool`, `canPay`/`pay` in actions.ts; a fighter without pools (a raider on the map, a creature) pays nothing.
  **Ultimates:** every class's twentieth skill or so (`AbilityDef.ultimate`, the rows marked `'ult'` in
  `data/moreAbilities.ts`, learned by level 25) costs the **limit gauge** (`Combatant.limit`, 0 to 1: filled by hurt
  taken, `LIMIT_FROM_HURT`, and less by hurt dealt, capped a tenth a blow, `fillLimit` from `strike`); full, it is the
  thing to do (`takeTurn` adds 100 to its worth), the gauge empties, a shout goes to the Journal. **Twenty skills a
  class:** `data/moreAbilities.ts` (`MORE_ABILITIES`, merged into each class's list in abilities.ts): 12 or 13 more
  each, ten general ones besides (a skill that shares a spell's name carries `_art` on its id: ids are unique across
  both lists); `test/turns.test.ts` counts them. **Seeing it:** `Battle.acts` carry `ActMeta`
  (spell, ult, cost, pool); the snapshot's `acts` add `who`; `fightHud.ts` shows a **banner** (`#fight-banner`: who,
  a floating FF-style window lower in the scene naming the act and who used it at what cost, faded and lifted by
  the clock in `fadeBanner` since the strip's CSS animations never advanced; gold and bigger for an ultimate; CSS in
  index.html), a wide **turn gauge** under each party member's name (`.ff-turn`, lit when full; a thin red one per
  foe kind) with MP, SP and limit bars beside it (`.ff-pools`), and in a fight the top window gives way to a small
  corner button out (`#fight-leave`); `fightView.ts` shakes the scene and flashes white on an ultimate. The Townsfolk
  inspect page shows the five attributes, MP and SP, and each skill's cost (`PersonView.battle.attrs`, `kit[].cost`).
- **A hard cap on births:** `POP_HARD_CAP` (90, data/pace.ts): no child is born past it (wanderers already stop at
  `POP_SOFT_CAP`); the 200-day soaks had settlers at 71 by day 40 and climbing.
- **The Court's tithe stops at a reserve:** `BLOOD_KEEP` (30) in data/vampires.ts: with that much blood in store the
  thralls are spared (the pens and the cells still give).
- **A shore town knows more of its land:** `OPEN_START_SEA` (15, where a dry land opens 11) in land.ts, since half of a
  sea-shaped land is sea. Soak (15 days): merfolk 22 people (was 18).

## Planned (owner's requests)

- **Weapons, ten times over, with +N (done):** see "The armoury" and "Unique weapons and boss loot".
- **Dungeon delves (done, steps 7 to 11):** see "Scouting and the opened map" through "Quests, rivals, the trophy hall".
- **Classes, levels, spells and skills (done, steps 2 to 5):** see "Classes and levels", "Watching a party's fights" and "Turn-based fights where stats matter".
- **Boats (done; the owner's choices: every town by water sails, all four uses, real losses, the town sails on its
  own with the player's veto and bounty):** `src/shared/data/boats.ts` and `src/shared/sim/boats.ts`.
  - **The fleet:** `BOATS` by age (dugout canoe from Boatbuilding, longboat from Shipwrighting, carrack from
    Navigation, steamer from Steamships, motor launch, hydrofoil; `BOAT_TOPICS` in the logistics branch): crew, `speed`
    (a trip's legs divided by it), `hull`, `cargo` (on top of the party's packs), `catch` (fish a day at home). The
    **Boatyard** (`BOATYARD`, `shore`: `canPlace` wants water or shallows beside its footprint, `touchesWater` in
    land.ts; outside a castle's walls, `OUTSIDE` in castle.ts) builds them as crafting orders (station `boatyard`, items
    `boat_<kind>` with `ItemDef.boat`); finished, `launch` puts her in `s.boats` (`Boat`: kind, name from
    `BOAT_NAMES` in turn, hull, away) instead of the stores, and breaks up the worst past `FLEET_MOST` (3).
  - **The plan** (`planBoats`, hourly from `boatsHourly`, autopilot on): a boatyard at `boatyardSpot` (the nearest spot
    by water; with none in the known land the town opens its land 2 cells at a time, up to 40), then a boat when it
    has none, a second at 6 grown-ups, a better kind as each age brings one; one order at a time, only with the makings
    and 4 spare. The planner scores the boat topics +24 (a town of 4 or more; +16 more for Boatbuilding in a shore
    town; Navigation and Steamships +10 on Trade). Probe (25 days): dwarves and knights learn it about day 9 or 10 and
    sail by day 12; the merfolk by day 8.
  - **At home:** each evening (`FISH_HOUR`) every boat at home brings in her catch, landed at the boatyard (half in
    winter; `FISHING_STORM` a squall may batter her); each dawn she's mended `REPAIR_SHARE` of her hull for a unit of
    lumber or wood. She sails only above `SEAWORTHY` (half).
  - **Islands and sea trade** (`ISLANDS`, `Destination.byBoat`, spots in the world map's water, scenes the coast):
    Gull Rocks and Turtle Atoll (Boatbuilding), the Seal Skerries and the Drowned Spires (Shipwrighting), the Kraken
    Deep (Navigation: the Kraken, `BOAT_ENEMIES`, the squidman sheet huge and turned green) and Pirate Haven (a purse
    goes further), the Spice Port (Steamships). `canSend` refuses an island without a seaworthy boat, and the party is
    her crew (`mostFor` in parties.ts); parties choose islands only with a boat free.
  - **Faster along the water:** `waterside` (the Riverbank, and every place in the island regions: the Southern Isle,
    the Sea of Wrecks, the Far Isles, their scouting and trade trips) goes by boat when one is free (`sailsTo`).
  - **At sea** (`seaHour`, each hour out and back for a party with `Expedition.boat`): a storm (`STORM_HOURLY` by
    season, `STORM_HURT` of her hull, half for an iron hull; a bad one may sweep someone over the side, `OVERBOARD`),
    pirates from the Medieval age (`PIRATE_HOURLY`), the sea's foes (`MONSTER_HOURLY`, `SEA_FOES` by age); her hull gone,
    `wreck`: she's lost, the loot with her, each aboard drowns at `DROWN` (one who swims, a shore town's or a merrow,
    `DROWN_SWIMMER`), and the rest make for home (`Expedition.wrecked`).
  - **A hold has water too:** where the mountain swallowed every river, `makeLand` cuts a tarn below the hold
    (`TARN_*`), so every town can sail.
  - **Seen:** `snapshot.fleet`, `snapshot.mooring` (the water cell by the yard, never just behind it where the roof
    hides her), `ExpeditionView.boat`/`wrecked`, `DestinationView.byBoat`/`boat` (`boatLine`). The map's moored boats
    (`map/mapBoats.ts`, bobbing in a ring of ripples) and the watched voyage's hull under the party with open water over
    the scene's ground (`drawSea`, `showHull` in fightView.ts; the sea's looks for any party afloat) are painted
    (`art/boatArt.ts`: no pack has a working boat; the Seabed pack's two ships are wrecks). The Expeditions tab lists the
    boats and says on each card which boat a trip would take. Inventory icons `boat_*` in customIcons.ts.
  - Names that are a doing ("Scout the Far Isles", "Trade with ...") no longer take "the" (`OWN_ARTICLE` in
    data/expeditions.ts). Tests: `test/boats.test.ts`.
- **Merfolk rework (done):** see "The merfolk rework" below.
- **The top-down town (done):** the side-on strip is replaced entirely by a sprawling top-down map in
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
    - The castle is one level (first a `keepRect` over the camp that grew by era and wing; now a body of rooms built on
      to the hall: see "The castle as one body of rooms" below). Floors, stairs and climbing are gone. The nomads' camps
      are points (`s.nomad.home/pasture/camp`).
    - Tests: `test/helpers.ts` has `camp`, `row` (free ground two rows below the camp), `put`, `freeSpot`, `wildsNear`/
      `nearestWild`, `makeWild`, `clearAround`, `poolOf`, `isWild`, `campPx`. Soak (10 days, one town each): settlers 22,
      vampires 20, druids 20, nomads 28, dwarves 21.
  - **Phase 3, the top-down renderer (done):** `src/renderer/map/`. `mapView.ts` (`MapView`): the
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
    previews. (What this first cut left for later was done in phases 6 and 7, below.)
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
  - **Phase 6, origins and pack art on the map (done):** the vampire keep was first dressed as a walled rectangle
    (`keepArt.ts`, from `snapshot.castle.rect`, the rooms the ordinary building pictures); that is superseded by "The
    castle as one body of rooms" below, which draws the castle from its cells with `map/castleArt.ts`. `src/renderer/map/packBuildings.ts`: Craftpix's Village tileset houses and awnings (`src/renderer/art/village/`,
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
  - **Phase 7, the asset pass (done; the standing order goes on).** The owner's standing order (see Priorities): replace the code-drawn map art with the
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
      last, and keeps it while they stand; never when mounted or fighting. Travellers are drawn by the same view, and
      raiders' LPC sprites face the same way in mapRaiders.ts.
    - **Riding in town:** `mapPeople.ts` holds a mounted rider in a still saddle pose while the horse takes the walk
      cycle; a cached lower-leg crop of each horse frame draws over the rider's legs, seating them into the horse.
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
      keeps its own `WALK_Y`. The notes above that name those files describe what the map views took over.
    - **Butterflies (done):** `src/renderer/map/mapButterflies.ts` (`MapButterflies`, in `things`): by day in spring and
      summer in fair weather (not the tundra or desert; `on` and `land` from main.ts), up to `MOST` (7) butterflies
      (DawnLike's Pest sheets, two kinds, two frames, cut into `art/butterflies.png`) flutter about spots drifting over
      the grass, fields, marsh and hills in view, each fading in, living 12 to 28 s and fading out; none when `calm`. **Construction sites were invisible on the map:** the site's and the mask's Graphics stood at
      the world origin and drew at world coordinates, and `setCamera` culls each thing by where it stands, so they were
      hidden wherever the camera wasn't at the map's corner. They stand at the picture's corner now and draw from there.
      The raiders' health bars (mapRaiders.ts) had the same fault and the same fix: anything drawn with a Graphics in
      `things` must stand where it draws.
    - **The castle as one body of rooms (done; the owner's design):** the Blood Court's town is an ordinary land map with
      one castle in the middle that grows outward as rooms are added, each room walled and furnished inside it, not a
      separate building. `sim/castle.ts`: the castle is the hall at the camp (`coreRect`, `CORE_W` x `CORE_H`) plus every
      room (`roomKind`: the `mid` buildings but `OUTSIDE` and the venues; the shop and tavern stay separate buildings
      outside); `castleCells` is the set of all its cells; a new room must share a wall with it (`joinsCastle`,
      `sharedEdges`: the planner's `roomSpot` takes the snuggest spot of the nearest ring, so the castle stays compact),
      and nothing else may come within a cell of it (`nearCastle`; `canPlace`, `findSpot`). Inside, people walk through
      the rooms (`blockedBy` in walk.ts skips rooms) and a room's door is its own middle (`doorCell`); roads run to the
      gate before the hall's south wall (`castleGate`; `connectRoad` never crosses the castle) and a road a room is built
      over is taken up (`unsetRoad`). The keep's eras, wings and limits are gone (`keepRect`, `growKeep`,
      `clearKeepGround`, `keepGrown`), and the old strip's `art/castle.ts` with them. `snapshot.castle` is `{ cells, core,
      gate, bounds }`. Tests: `test/castle.test.ts`. Soak (4 towns, 15 days): vampires 33.3 people / 25 deaths, as before.
      - Drawn by `src/renderer/map/castleArt.ts` (`buildCastle`, from `MapView.syncCastle(castle, buildings)`, rebuilt
        when a room is finished, the pack pictures load, or the look or season changes): the dungeon pack's flagstones
        (`art/castle/floor.png`, a 2x2 quilt of its four tiles) tiled over the hall and every finished room, the carpet
        from the gate; walls along each finished cell's edges, one piece a cell: the curtain wall where the castle ends
        (battlements, walk and face: `outerN` looks in at the top of a cell, `outerS` stands at a cell's foot with its
        face hanging outside, `outerW`/`outerE`), a thinner partition (`partH`, `partV`) where two regions meet (drawn by
        the lower or the right cell), a doorway (`doorH`/`doorV`) cut in the middle of the longest run two regions
        share, the pack's arched door (`gate.png`) in the hall's south wall, and keepArt's round `cornerTower` at every
        outer corner; all sorted among the things by their feet so people walk behind and before them. keepArt.ts now
        exports `blocks`, `walk`, `merlons` for it. A room's own picture is its furnishings (`roomFurniture`): the pack
        picture that suits it (racks, shelves, the well, fire pits...; `pickArt`, the generalised `packArt`), else
        painted beds for a home (one a sleeper, as many as fit, on a rug), crates and barrels for a store, or a table,
        chairs and a chest; stood in the middle of the floor (`draw`: no shadow, the whole footprint tappable:
        `DrawnBuilding.room`), with a candle's glow at night. A room under construction shows its furnishings' ghost and
        the site; its floor and walls come when it is done.

    - **The dwarves' hold (done; the owner's design):** the Deep Hold's land is half mountain (`rules.hold: 'mountain'` in
      `data/origins.ts`; `holdOf(s)` in `sim/castle.ts` is `'castle'`, `'mountain'` or null, and the castle rules below
      hold for both). `makeLand(seed, biome, 'mountain')` makes the north half `mountain` ground (code 'M', impassable,
      level by the camp and ragged beyond); the hall (`coreRect`) is cut into its foot `MOUNTAIN_FOOT` rows in, the camp
      fire and stockpile stand on the terrain before it, and rooms are carved into the rock (`carvable`, `carve`: the
      cells become `hall` ground, code 'H'; `canPlace`, `placeBlueprint` and `upgrade` carve; `spiralSpot`'s `carve`
      option) sharing a wall with the hold as a castle's rooms do. The one way in is the gate in the hall's south wall.
      Drawn by `groundArt.ts` (the mountain mass with seams and a lit cliff face where it meets the ground, halls as a
      dark floor) and `castleArt.ts`'s mountain style (rock walls, the cave pack's carved gate, no towers); hold homes
      show painted beds, never the camp tents.
      - **Digging deeper:** the mountain is mined like the wild land. `openFaces` (planner.ts, each planning pass) gives
        every mountain cell beside a hall within the open land a pool from `delvePool(depth)` (land.ts: stone always,
        coal and iron ore from depth 2, gold from `GOLD_DEPTH` 6, gems from `GEM_DEPTH` 9, richer the deeper;
        `delveDepth` counts rows in from the mountain's foot); dug out (`clearCell`) a face becomes a gallery (`hall`,
        and part of `castleCells`, so rooms may be carved over galleries: `solidCells` is what may not be built over).
        The hold keeps `DELVE_WANT` gold and gems coming (`planGathering`), and the shop sells the rest (`RESERVE` 0).
        Materials `gold` and `gems` (`data/materials.ts`, worth 9 and 16 in `data/trade.ts`, DawnLike icons). Selling
        ore ran the shop away (coins bought appeal, appeal drew more and bigger purses): attractiveness past
        `APPEAL_CAP` (100, `data/shop.ts`) adds nothing more to purses or the traveller rate. Probe at day 13 (4 seeds): dwarves
        hold 500 to 6000 coins (their shop takes 1000 to 3000 a day, nearly all gold and gems) where settlers hold 100
        to 300; it was 10 000 to 18 000 before the cap. Tests: `test/castle.test.ts` (the hold, its growth, the veins,
        the galleries).

    - **The mountain's look (done):** `src/renderer/map/mountainArt.ts`: the mass in relief (ridged noise shaded from the
      north-west, posterised to five shades, snow on the high crests, cracks where the slope breaks: `paintMountain`), a
      cliff face at its foot lit with a jagged brow and buttresses that reach down into the cell below, spurs biting in
      from the sides (`paintMountainEdge`, called for every terrain cell); cave rocks and crystals scattered over the mass
      (`PROPS_ON.mountain`, thinned by `PROPS_SHARE`). The land's foot line wanders with two noises (`makeLand`). The
      chunk key carries the ring of cells round a chunk, since the edge reaches into its neighbours.
    - **The seat of the town (done; the owner's request):** every origin has one central building, standing from the
      founding and rebuilt grander as each era comes: `src/shared/data/seats.ts` (`SEATS`: five stage names and lines per
      origin, a morale reason, a `boon`: wanderers, healing, raid warning or a deep store; `SEAT_DEFS` generated and
      merged into BUILDINGS, chained by `SEAT_UPGRADES` in UPGRADES; `SEAT_STAGE`, `isSeat`, `seatOf`). A stage is a
      building def with `era` (opens with the era), `origin` (another people's is never theirs: `isUnlocked` takes both,
      `unlockInfo` passes them) and `seat` (1..5), `never` built new: `newGame` founds stage 1 just beyond the fire
      (5x3; a hold's on its hall, 6x4, as a room: `seatCore`), the planner's `planSeat` rebuilds it as soon as the next
      stage is open and affordable (`shelveStalled` leaves it alone), and `canUpgrade` keeps a building no bigger than
      what stands where it is without asking `canPlace` (so a hold's seat is rebuilt on its hall, campfire and all). The
      nomads' first two seats are portable. Pictures: `src/renderer/art/seatArt.ts` (`seatArt(origin, stage, w, d)`, one
      painter per origin growing with the stage: moot hall to council spire, bone altar to throne of unlife, standing
      stones to world tree, den to howling hall, core pad to overmind, tide pool to pearl palace, yurt to palace of the
      horde, faerie ring to court of seasons, still house to philosopher's tower, motte to citadel; the holds' throne
      rooms `seatInterior`, drawn by `roomFurniture` at `THRONE_K`; `window.__seatArt`/`__seatInterior` for previews),
      used by MapView's `art`, the feed's `cardArt`. topDown.ts exports its pieces (`roofPlane`, `frontWall`, `MATS`,
      `G`). Tests: `test/seats.test.ts`.

    - **The Moon Pack (done; the owner's design, the Great Hunt win his call):** `src/shared/data/pack.ts` and
      `src/shared/sim/pack.ts`. Everyone in a werewolf town is a werewolf (`kin: 'werewolf'`; `joinOrigin` turns
      newcomers; the Hunter's Guild doesn't count them). `s.pack` (`PackState`): **renown** (a hunt +1, a beast raid
      beaten +2, a beast's lair cleared on the land +3, a rival pack broken +6, the Great Beast +10: `PACK_RENOWN`,
      `gainRenown`), which is in every blow (`fightRate`: `RENOWN_FIGHT` per point up to `RENOWN_FIGHT_MAX`). **The
      full-moon hunt:** at `HUNT_HOUR` of a full-moon night (`packHourly`, from sim.ts) the pack runs out as an
      expedition the town sends itself (`sendHunt`: the Alpha first, then by level, `HUNT_KEEP_HOME` of them left to
      guard; `Expedition.hunt`; destination `HUNT_DEST`, `huntDestination`, up to `HUNT_PARTY` 8), fights beasts on the
      FF screen (watchable; a feed card), and is home by morning. **Rival packs** (`RIVAL_PACKS`: the Ash Pack, the Red
      Fang, the Winter Wolves, each with an alpha boss in `PACK_BOSSES`, merged into ENEMIES): one raids at a full
      moon's dusk (`PACK_RAIDS` raid kinds, weight 0, started by `packHourly`; the alpha leads), and each lair is a
      destination on the Expedition Board (`packDestId`, `packDestination`, resolved by `destinationOf`; the player
      picks the war party as for a dungeon). A pack is **broken** when its alpha falls, at its lair (one or two
      survivors join the town) or at the gate (`packRaidBeaten`); its hills become a hunting ground (`grounds`:
      `GROUNDS_YIELD` meat and hide each dawn). **The Alpha:** the morning after a full moon one of the pack
      `CHALLENGE_LEVEL_EDGE` levels above the Alpha may challenge (`challenge`, `CHALLENGE_CHANCE`, never within
      `CHALLENGE_GAP_DAYS`): a roll of level, melee and health; the winner is `s.mainId`, the loser left at a quarter
      health. **The Great Hunt:** once renown reaches `GREAT_BEAST_RENOWN` the Pale Behemoth (`GREAT_BEAST`, the
      behemoth sheet greyed and brightened) joins the hunt's encounters; with it slain and every rival pack broken the
      game is won (`checkGreatHunt`, `s.gameOver.won`); the launch still wins too. Snapshot `pack` (`PackView`) drives
      "The pack" block on the Expedition Board (renown, hunts, grounds, the moon, the beast, the lairs' cards). On the
      map, werewolves under the full moon are the Craftpix werewolf sheets (`WOLF_FORMS` in mapPeople.ts, by id,
      through `heroFrame`). Tests: `test/pack.test.ts`. Soak (3 towns, 15 days): 33 to 37 people, 1 to 4 deaths, two
      hunts each (the full moons of days 6 and 12), renown 3 to 6, one town raided by the Ash Pack; no pack broken on
      its own, since only a player-sent war party breaks one at its lair.

    - **Tower defence, deeper (done; the owner's request):** `src/shared/data/defenses.ts`: traps and engines for every
      era (`DEFENSE_BUILDINGS`: the pit trap from Trapmaking; caltrops and boiling oil from Fortification; the ballista
      and catapult from Siege Engines (new topics in data/research.ts); the cannon and land mine from Firearms; the
      flame turret and mortar pit from Rifles; the Tesla coil from Energy Weapons) and one piece of each origin's own
      (`ORIGIN_DEFENSES`, `origin` + `era: 'medieval'`: militia post, bone spire, bramble snare, gargoyle perch, wolf
      trap, sentry bot, rune bolt thrower, tide pool trap, arrow wagon, glamour ring, acid sprayer, crossbow bastion),
      merged into BUILDINGS. `BuildingDef.defense` has quirks: `splash` (px; those beside take `SPLASH_SHARE`), `slow`
      (share of speed for `SLOW_SECONDS`), `burn` (a second for `BURN_SECONDS`), `chain` (leaps `CHAIN_REACH` px to that
      many more, `CHAIN_SHARE` each), `night` (multiplier after dark), `rout` (chance the struck one runs). `sim/defenses.ts`
      applies them: `fireAt` (shared by raids.ts `fireDefenses` in the town and battle.ts towers and traps on the trail,
      the latter never missing), `speedOf` (a slowed raider's step, in town and on the trail), `tickBurns` (from
      updateRaid). `Raider.slow/slowUntil/burn/routed`; a routed raider flees in town and breaks on the trail. The planner's
      `planDefenses` keeps about one piece for every `DEFENSE_PER_PEOPLE` grown-ups (more when raided or set on Defence),
      the best kinds first (its own origin's, then the latest era's), one of each before a second. Looks: `topDown.ts`
      (`SHAPES`: traps on pads drawn by `drawTrap`, engines on low mounts (`ENGINES`) with their own toppers).
      Tests: `test/defenses.test.ts`.
    - **A game of generations (done; the owner's call: about three months of real time):** `src/shared/data/pace.ts`.
      Research takes `RESEARCH_PACE` times longer by the topic's era (10, 5, 4, 3, 2), and the dangers that grow with
      the day count `paceDay` (sim/time.ts: the day over `DANGER_PACE` 2.5): the raid budget and interval shortening,
      the raid kinds' `fromDay`, boss and Behemoth raids, flanking, the lords' health. Study is spare-time work in a
      town of up to `SMALL_TOWN` grown-ups and never comes before a site ready to build with nobody on it
      (`researchCanWait` in people.ts; a researcher puts the topic down on the hour, its progress kept). Townsfolk
      **age** (`sim/ageing.ts`): `Person.grownAt` (children when they grow up; founders and wanderers up to
      `PRIME_SPREAD` days into their prime, by their id), elders from `ELDER_DAYS` 50 (`ELDER_WORK` 0.8, shown in the
      Townsfolk tab; `PersonView.ageDays`, `elder`), and from `OLD_AGE_DAYS` 65 each night may be their last
      (`OLD_AGE_DAILY` 0.05 + `OLD_AGE_DAILY_PER_DAY`; "has died of old age, full of days"); the undead, machines,
      vampires and a lich never age. Children grow up in `CHILD_DAYS` 18 (`CHILD_HOURS` was 420 days, so nobody ever
      did) and Family Life is a Stone Age topic now, so generations turn over. An event's `leave` never sends the
      founder away (a lone founder exiled once left an empty town with no end). Tests paced: research time, rival and
      beast raid days. Wanderers come less as a town fills and none past `POP_SOFT_CAP` (60): a 50-day knights' town
      had reached 105 people before it.

- Steps: (1) weapons and +N; (2) armour and gear kinds; (3) levels and the 125 classes; (4) the 160 spells and 200
  skills in the fight sim (expeditions, raids); (5) the side-view fight screen; (6) uniques and the bosses' loot
  tables; (7) scouting and the opened map; (8) the delve sim (rooms, fights, supplies, retreat, the boss, loot); (9)
  the delve view; (10) dungeon types, modifiers, elites, dozens of bosses; (11) quests, rivals, the trophy hall,
  respawn, alerts; soak, phone checks, PR. All eleven are done, and boats too.

- **Victory screen (done; the owner's ask):** a party's fight won, `finishBattle` (expeditions.ts) fills `Expedition.result`
  (`FightResult`: each member's experience and levels gained, the loot by name, the coins) and the snapshot carries it for
  `RESULT_TICKS` (80) as `ExpeditionView.result`; the fight HUD's `showResult` draws it as a blue window over the scene
  (`#fight-result`: "Victory!", a row a member with their experience and a level-up mark, the spoils). The skill banner
  floats lower (`#fight-banner`, JS-faded) with no buttons; `#fight-leave` is the one corner button.
- **Pinch to zoom, smooth and under the fingers (done; the owner's complaint):** while two fingers are down, `mobile.ts`
  only scales the strip on the screen (a CSS `translate(...) scale(...)` about the point between the fingers, which the
  strip reports with the spread: `bridge.pinch(phase, spread, mx, my)`; `#strip-box.pinching` clips it); when they lift,
  `setZoom` lays it out again, sharp, and the strip's `__zoomAbout(mx, my, from, to)` (main.ts) moves the camera so what
  was under the fingers stays there (the ticker's resize keeps the middle; this adds the rest). The snap below two of the
  screen's pixels allows halves (`layout()`), so the first steps aren't a doubling. The old way laid the strip out again
  on every move, snapped to whole pixels, and zoomed about the corner.
- **New Town, a step at a time (done; the owner's ask):** `newGamePanel.ts` asks one question a page (`STEPS`: who
  founds it, the founder, how it begins, where, how dangerous, then a summary with Found), with Back/Next in a row that
  sticks to the bottom (`.wizard-nav`), "Step N of 6" and dots to jump back (`.wizard-dot`, left out of the theme button
  rules). `step` is kept at module level so the panel's redraws don't lose it; founding resets it.
- **Pinching leaves the clock bar alone (the owner's complaint):** while two fingers are down `mobile.ts` scales only the
  strip's map canvas (`body > canvas` in the strip iframe), about the point between the fingers; the HUD stays put. On
  release the strip is laid out again at the new zoom as before.
- **Ground without squares (the owner's complaint):** `paintChunk` lays the plain ground for the whole chunk first, a
  2px block at a time, each taking the colour of the cell at a point nudged by smooth noise (`smooth`, `WARP` 11 px,
  `WARP_SCALE` 14), so where grass meets forest, rock, loam or water the border wanders; water joins in, with a pale
  shoreline where the warped water meets land (`softBase`, `warped`). Only the pack sheet's round blobs are used as
  patches (`LEFT`/`RIGHT` in groundDetail.ts: its square-with-a-hole, arch and fringe shapes are edge pieces, and laid
  loose they were the squares), drawn at 0.45 to 0.8 size and kept inside the chunk (`drawPatch`'s `room`). The fog
  beyond the open land is per 4px block by its own distance, black by the band's end, so its edge is round. The
  strip's HUD keeps its on-screen size at every zoom (`--ui-zoom` is `1 / z`; it only counter-scaled when zoomed out,
  so a big pinch grew the clock bar).
- **The map takes the feed's empty room (upright):** superseded: the feed is gone and the map has all the room (see
  "The news bubble").
- **Roads run edge to edge (done; the owner's ask):** `connectRoad` finds its way four ways (`PathOpts.four` in
  `findPath`: no diagonal steps, since the road tiles join along their edges) and `squareRoads` gives any diagonal step in
  an older road a cell beside it. Test in `test/land.test.ts`.
- **Rain over the whole map (done):** `WeatherView.render` takes the screen's height (it rained over the old strip's height
  only, the top half of the phone's map).
- **Three orders a station (done; the owner's ask):** `craftSlots` is `PER_STATION` (3) for every crafting station standing
  (never fewer than the campfire's three; research still adds), and `canQueueCraft` refuses a recipe whose station has
  its three (`stationSlots`, `stationQueued`: "Campfire has its 3 orders"). Test in `test/crafting.test.ts`.
- **Tools in hand (done; the owner's complaint that the harvest looked wrong):** the work shows its tool whether or not the
  town has made one (`heldWeapon` in art/held.ts): an axe to chop, a pick to mine, a hammer to build, a sickle to reap and
  a hoe to sow; all of them swung (`slash`) at their own pace in mapPeople's `pose`. A field's work is `reap` when the crop
  is ripe and `till` otherwise (new `Activity` values, set in people.ts; pens are tended by hand). The pick, sickle and hoe
  layers (`w_pick_*`, `w_sickle_*`, `w_hoe_*` in `lpcData.json`) are made from the LPC axe layer by
  `tools/make-lpc-tools.cjs` (run by hand; the axe head taken off the haft, the tool's head drawn at its end, frame by
  frame).
- **The desert shop (fixed):** a desert town never studied Fire Keeping (it opens nothing itself and scored lowest), so
  Barter and the shop never came, and the ring wall took every log. `planResearch` lets the one unlearned topic a wanted
  topic waits on inherit `LEADS_SHARE` (0.85) of its score; `planRing` leaves the other sites the materials they still
  wait on (`owed`) and a wider ring waits `RING_REGROW_HOURS` (72) after the last stands. The desert probe: shop by day 6.
- **Town jobs (done; the owner's ask: people whose job is a station, by how good they are):** built on the operator roles
  (`data/operators.ts`): every crafting station but the campfire (titles in `CRAFT_TITLES`: Smith, Tanner, Weaver,
  Baker...; the origins' own are artisans too), the mines (Miner, Driller), the hunters' lodge (Hunter) and the studies
  (Scholar) have a role beside the keepers, healer and captain; the fields have none (the Farm priorities already send
  the best farmers, and a field a person would take the whole town). `assignOperators` fills the worthiest roles first
  (venues, infirmary, tower, then the stations) with the most skilled free grown-up, one job a person, and once a day a
  free hand `TAKE_OVER_EDGE` (2) levels better takes an unchosen job over. A holder works their own post first
  (`ownWork` in people.ts: the station's orders, the mine, the desk), `HOLDER_EDGE` (1.15) faster (`holds`), and while
  they're at home and free for them nobody else takes that station's orders (`findCraft`'s `holderOf` check; with the
  holder on one order, others may take the station's others). `PersonView.job` ({title, at}) is shown first in the
  Townsfolk rows and on the inspect page. Test in `test/operators.test.ts`.
- **Minerals (done; the owner's ask: minerals to mine, trade for and buy):** `src/shared/data/minerals.ts`. Materials
  `copper_ore`, `tin_ore`, `silver_ore`, `sulphur`, `copper`, `bronze`, `silver` (worth in data/trade.ts; the mining icon
  pack's pictures in `art/materials/`). Topics Bronze Working (Stone Age, after Pottery) and Silversmithing (Medieval,
  after Jewellery); recipes `smelt_copper` and `cast_bronze` at the kiln, `smelt_silver` at the bloomery; wares (copper
  kettle, bronze mirror, silver ring and chalice, sulphur salve) and the Bell Tower (morale, bronze). The planner keeps a
  reserve of the ores and metals (`RESERVE`: it smelts to it) and sells the rest.
  - **Mines:** a cave cleared by a party opens as a mine (`openMine` from `placeCleared`, `MapPlace.mine`: depth, ores,
    the eight wall cells round the mouth): the walls are rock with pools of ore (copper and tin always; silver and
    sulphur by chance), dug like any wild cell (the pick animation), and when every wall is dug to the stone the next
    level opens on the hour (`deepenMine`, richer; gold from level 3, gems at `MINE_DEPTH` 4, then it's worked out).
    The planner wants `MINE_WANT` (8) of each ore while it has a mine (`ORES` are `GATHERABLE`). Tap a mine for its
    level and what's left, and **Enter the mine** (`watchMine` command, `s.watchingMine`, `snapshot.mine`: `MineView`):
    `src/renderer/fight/mineView.ts` (`MineScene`) takes the screen like a watched fight: the cave scene, a seam per wall
    cell flecked in its ores' colours with a bar of what's left, the diggers at their seams swinging picks with dust
    where they land, those on the way walking in; the fight HUD's top window (`FightHud.mine`) names it. The phone's
    `watchOn` counts it.
  - **Buying:** travellers sell copper and tin ore from the start (`EVERYDAY`), the era's caravan goods carry the ores and
    metals from the Medieval age (`CARAVAN_GOODS`). **Other peoples' caravans:** `FACTION_CARAVAN` (0.75) of the market's
    caravans are another people's (`Caravan.faction`, never the town's own): one of `FACTION_GOODS` is always on the
    blanket (the hold's ores, gold and gems; the shore's pearls; the alchemists' sulphur...), named in the notice, the Trade
    tab and the tap card.
  - **Trade caravans:** `TRADE_DESTINATIONS` (type `trade`, one per region: the Heartland's Crossroads Market from Barter,
    the rest once the region is mapped: `TRADE_HIDDEN`): a party takes the town's purse (`Destination.coins`, refused
    without it, spent as it sets out) and works the market with Social, bringing the region's minerals home as loot.
    The board shows the purse. Tests: `test/minerals.test.ts`. Probe (forest, a mine from day 3): the first level dug
    out in two days by 3 to 8 diggers, level 3 by day 11; silver and sulphur sold for a few hundred coins. Soak (12 days,
    one town each): settlers 20 people / 8 deaths, dwarves 20/9, knights (desert) 21/9; all three learned Bronze
    Working, smelted copper and bronze to the reserve and built a bell tower.
- **Townsfolk inspect page in tabs (the owner's ask):** under the person's card (name, what they're doing, their
  calling) four tabs (`INSPECT_TABS` in townsfolkPanel.ts, the open one kept in `inspectTab`): **Equipment** (the paper
  doll, the picked piece, the bag), **Character** (how they'd fight, health and spirits, traits), **Background** (age
  and people, nature, ambition, job and purse lines, ties and what happened lately) and **Skills** (work skills, then
  spells, fighting skills, the ultimate and passives as chips). Tapping a skill, spell, passive or trait opens a card
  saying what it does (`chosenSkill`, `infoCard`): the words come from `src/shared/data/describe.ts` (`SKILL_TEXT` for
  the work skills, `describeAct` for a spell's or skill's effects and cooldown, `describePassive`), carried on
  `PersonView.kit[].text` and `PersonView.passives`. Sideways each tab is two columns. `.skill` is left out of the menu
  themes' button rules.
- **Work for every hand (the owner's ask: nobody idle early, the founder able to do anything):** the Construction a
  building asks (`buildSkill`) no longer turns anyone away from a site; below it they work slower (`skillPace` in
  property.ts, down to `UNSKILLED_PACE` 0.4), and the founder always at full pace. `autoPriorities(skills, founder)`
  keeps the founder's building and study never below normal. Everyone already had every job on (never 0): what
  they're good at first, other work when theirs has none, and a job holder goes back to their post as soon as it has
  work (`ownWork`). Tried and dropped: the founder at the top for every job, and studying ahead of gathering; a lone
  founder then studied all day, gathered no wood, built nothing and so never had a bed for a newcomer (8 lone towns at
  day 10: 2 dead, 5 still alone).
- **Raid battles fight themselves by default (the owner's call):** `startBattle` places everyone and casts the spells
  itself unless `s.autoBattle` is `false` (the battle bar's Auto button turns it off, and the choice is kept).
  It goes on (and on again after a breather) as soon as everyone placed stands at their spot (`allInPlace`), no sooner
  than `AUTO_READY_TICKS` (2 s) and no later than the usual count. It used to go after 1.5 s and 3 s whatever: raiders
  reached the gate before a lone founder did, the founder lost a leg and the town never grew (the planner test caught
  it). Probe (8 lone towns, 10 days, people): auto 3 2 2 4 5 5 4 4, auto off 4 X 2 4 5 3 6 5.
- **What came of an answer, on a card (upright):** `tell` in sim/events.ts keeps the last answer on `s.eventOutcome`
  (title, the choice, what came of it); `snapshot.eventOutcome` carries it for `OUTCOME_HOURS` (4), and the feed shows
  it at the top as a green-edged card (`answered` in feed.ts). Sideways the same line pops up over the town as a notice.
- **What a move does, on the fight banner:** the snapshot's fight `acts` carry `text` (`actText` in snapshot.ts: the
  first line of `describeAct` for the spell or skill of that name), shown as a third line on `#fight-banner` (`.ff-what`),
  which then stays 0.7 s longer.
- **Every menu in sub-tabs (the owner's ask):** `src/renderer/panel/subtabs.ts` (`inTabs`, called from panel.ts on each
  menu's elements): a menu's sections, each opened by an `h2`, are grouped under named tabs by the heading's words
  (`GROUPS`: Plan: Direction, Town status, Powers, Treasury, Buildings; Studies: Stations, Tech tree; Expeditions:
  Parties, Places (the map goes with them), Quests; Townsfolk: People, Jobs; Crafting: Inventory, Recipes; Trade: Deals,
  Horses). A heading that opens no group stays in the one before; what comes before the first heading stays above the
  tabs unless `intro` names a tab. Only the open tab is drawn; it's kept per menu (`littletown.subtab.<menu>`, part of
  the redraw key through `tabKey`). A menu with under two groups to show is drawn as before (the Townsfolk inspect page
  has its own tabs). A new section in a menu needs its heading matched in `GROUPS`, or it falls in the tab before it.
- **Town status (the owner's ask: storage off the clock bar):** the clock bar shows people, beds and coins only; the
  Plan tab's Town status (`townStatus` in buildPanel.ts) has people, beds, food in days, the treasury, storage used
  against room with a bar, and every material in store with its picture.
- **A work bar over their heads (the owner's ask):** `PersonView.taskDone` (`taskDone` in snapshot.ts: the site's
  progress for building, health for a repair, the order for crafting at the station, the topic for study, the field's
  sowing or reaping, the load being gathered or dug, a patient tended; null while walking or doing anything else) is
  drawn by mapPeople as a small green bar (`WORK_W` 18 px, `WORK_ABOVE` 58 px over the feet), redrawn only when its fill
  moves a pixel.
- **Callings explained (the owner's ask):** `src/shared/data/classAbout.ts`: for each of the 25 callings what it is and
  how it fights (`CLASS_ABOUT`), and what each role means (`ROLE_ABOUT`: tank, bruiser, striker, shooter, caster,
  healer, support). The Townsfolk page's calling row always says the role; opened, it adds the two lines and the town
  skills the calling takes to (from its `affinity`). A founder's calling shows its base class's.
- **Everyone's own story (the owner's ask):** `src/shared/data/backstories.ts` (`backstory`): a name-led sentence of
  where they came from (`FROM`, by their people) and what they did before (`BEFORE`, by how they came), one telling
  thing about them (`MARK`) and what they want now (`WANT`, by ambition), each part picked by a hash of their id and
  name, so it never changes; children born in town get their birth and parents instead; a ready-made founder keeps the
  story written for them. `PersonView.story` (`storyOf` in snapshot.ts), shown first on the Background tab.
- **Game speed (the owner's ask):** a 1×/2×/3× button on the clock bar (`hud.ts`, the `gameSpeed` command,
  `s.gameSpeed`, `snapshot.speed`); `battleSpeedNow` (battle.ts, read by `GameLoop.pump`) returns it outside a battle,
  and the battle's own speed during one. Time away is unaffected.
- **Events with purpose (done; the owner's ask: every choice does something):** no answer is a bare note or a dab of
  morale any more (`test/eventPurpose.test.ts` checks all 1100 or so): the 250 that were got real outcomes. New effects
  in eventKit.ts (shorthands `teach`, `bond`, `trait`, `item`, `horse`, `build`, and `coin`, `rep`, `calm`, `raidIn`,
  `study` for the old ones): levels of a skill (the event's person, someone at random, the founder or everyone), what
  two people think of each other (`adjust` in social.ts, now exported), a trait, gear into the stores, horses, and a
  building's blueprint laid with its makings delivered (else the makings). Every answer, and every `later`, ends with
  one journal line under the event's title saying what came of it (`tell` in sim/events.ts: "A thief among you: morale
  -4 for a day, +6 wood, +4 stone").
- **Events told in full (done; the owner's ask: more description, a full-screen box, a picture that goes with each):**
  a choice event's prompt carries `story` (`eventTelling` in sim/events.ts: a line setting the scene from the hour,
  season and weather (`sceneLine` in data/eventScenes.ts), the event's text, its own passage (`EVENT_MORE` in
  data/eventMore.ts: one for each of the 526 events, {who} and {founder} filled) and what the treasury holds when it
  asks for coins), `picture` (a painted backdrop: `eventPicture`) and `who`. The phone page shows it full screen
  (`src/renderer/mobile/eventSheet.ts`, `#event-sheet`: the backdrop's layers stacked, the townsperson in it stood on
  the picture, the title, the telling in paragraphs, the answers as big buttons, the countdown; sideways the picture on
  the left); the strip's own question card stands aside for events (`__eventSheet`). **Pictures:** every backdrop was
  looked at and sorted into `POOLS` by what it shows (fire, the dead, war, holy places, ruins, caves, the deep, the sea,
  the sky, mountains, storms, snow, steam, cities, the future, forests, fields, the fae, an alchemist's lab, a town
  scene by the age: `TOWN_BY_ERA`); an event's words pick the theme (`THEMES`), and `PICTURE_OF` fixes the 275
  whose words mislead (every event was checked by hand). Green fields in winter show the snow. Tests:
  `test/eventTelling.test.ts`.
- **Special newcomers with secrets (done; the owner's ask: mysterious, powerful, diseased, cursed, wanted, a raider who
  undoes the defences before his clan comes, and ways to find them out):** `src/shared/data/specials.ts` (`SPECIALS`:
  the Veiled Champion, the Coughing Pilgrim, the Knight of the Black Oath, Red Jack the Highwayman, the Turncoat Scout,
  the Exile in Grey, the Runaway Heir; each a cover for the gate, a cover story and the truth, a `spot` skill and level,
  a daily `slip`, a `due` range, three answers and a picture) and `src/shared/sim/specials.ts`. A secret stranger comes in an event's turn (the
  owner's call: 1 in `SPECIAL_ODDS` (100) events, any day, secrets may overlap): `maybeEvent` asks `strangerTurn` (by the
  seed and the hour: no draw from the town's stream) and `secretStranger` (townsfolk.ts) puts them at the gate in place
  of the event; `specialFor` picks a kind the town hasn't met (each once a town, `s.specialsSeen`; none in a town of the
  dead or machines); besides, `SPECIAL_SHARE` (1 in 10) of ordinary wanderers are one (`secretWanderer`, by the seed
  and their id, in `maybeArrive`). `makeSpecial`
  gives their skills, level and calling and `Person.secret` (`Secret`); the gate and the visitor's question show only the
  cover (`coverOf`), and the Townsfolk page shows the cover story and no calling until it's out (`specialStory`,
  `secretView`, `PersonView.secret`). Taken in (`secretJoined`), `specialsHourly` runs it: at `SPOT_HOUR` the best in
  town at the spot skill may see through them (`SPOT_BASE` + `SPOT_PER_LEVEL` a level over), else they may slip; while
  hidden the curse makes accidents, the highwayman lifts coins, the exile surges, and the champion gives themselves away
  by fighting. Due and still hidden, it strikes: the champion's hunter (the era's boss) leads a raid, the fever spreads,
  the curse sets a fire, bounty hunters raid, the exile's power burns two roofs, the crown's riders take the heir; the
  saboteur waits for the small hours, and a guard on watch may catch him at it (`CATCH_BASE` + `CATCH_PER_LEVEL` of their
  best fighting skill), else he cuts the gates' bars (hp 0), springs the traps and towers (`s.sabotage`, read by
  `turretsDown` in rivals.ts), leaves, and his clan rides in with five minutes' warning. Found out, a prompt of kind
  `secret` asks what to do (`answerSecret`; shown full screen by the event box with its picture and the person): stand
  with or hand over the champion, nurse or drive out the pilgrim, break the curse for `CURSE_PRICE` or keep the knight,
  claim Red Jack's `BOUNTY` or hide them, lock up, turn (one time in four he lied) or drive out the saboteur, give the exile
  a tower (a topic learned) or bind them, send the heir home for `HEIR_REWARD` or keep their secret. Tests:
  `test/specials.test.ts`. (An earlier probe, at 0.3 of wanderers: seven of eight towns met one in 15 days; all seven kinds showed.)
- **Every menu in tabs, the venues too:** the shop, inn and stores' windows (`renderShop`, through `inTabs(id, ..., 'venue')`:
  Now, Trade, The room; each venue keeps its own tab) and the Chronicle's filters drawn as the same tabs. The open tab
  is lit under every look (`.inv-tab.on` in theme.ts and skins.ts: it was drawn like the rest).
- **Twenty-five more sagas (done; the owner's ask):** `src/shared/data/sagas2.ts` (The Lost Shepherd, The Hollow King,
  The Witch of the Fen, The Fallen Star, The Miller's Debt, The Stolen Bride, The Clockwork Heart (Industrial), The Red
  Harvest, The Dragon's Toll, The Ghost Ship (shore), The Frozen Prince (tundra or winter), The Desert Oracle (desert or
  nomads)) and `sagas3.ts` (The Pretender, The Last of Khazrun, The Sleeping Giant, The Rat Catcher, The Haunted Inn (an
  inn), The Alchemist's Apprentice, The Tournament, The Weeping Statue, The Wild Hunt, The Deserter, The Poisoned River
  (Industrial), Orphans of the Storm, The Machine That Dreams (Modern)), 31 in all. Their shorthands and the town checks
  they use (`has`, `knows`, `land`, `winter`, `wound`, `death`, `joins`...) are in `data/sagaKit.ts`. Thirteen more saga
  uniques in uniques.ts (Starfall, the Fen-Witch's Crook, Barrowblade, Tollbreaker, the Piper's Flute, the Champion's
  Lance, the Huntsman's Bow, Cogheart, Rimeblade, the Oracle's Staff, Ghostwind, the Giant's Knuckle, Dreamcaster). The
  saga test walks every chapter of all 31 (a plain town and a learned one with the buildings they ask about), checks
  every foe in every age, every raid kind and boss, and every prize.
- **Sagas (done; the owner's ask: long quest chains, varied and unique; the town takes them on itself; failure bends
  the story, with real losses now and then; mostly hand-written):** `src/shared/data/sagas.ts` (`SAGAS`: The Burnt Cart,
  The Wolf That Walks, The Drowned Bell (shore towns), The Feud (two of the town, `cast`), The Plague Doctor, The Iron
  Crown; each a graph of chapters: `choice` (a full-screen question with a picture; answers set flags), `trip` (a place
  on the Expedition Board), `task` (something the town must have done in time), `raid`, `wait`, `end` (triumph,
  bittersweet or ruin: effects, a title for the hero, a unique)). `src/shared/sim/sagas.ts`: `sagasHourly` begins one at
  `SAGA_HOUR` now and then: only one at a time (`MAX_SAGAS` 1), never sooner than `SAGA_GAP_DAYS` (10) after the last
  one ended, from day `SAGA_FIRST_DAY` (4), on `SAGA_DAILY` (a quarter) of the mornings after that, each saga once a
  town, off in the tests' `plainGame` (the owner's call: stories are occasions, with time between to try other things), and drives each run (`s.sagas`: `SagaRun`, `s.sagasDone`). A choice is a prompt of kind
  `saga` (the event sheet shows it; the default stands after `SAGA_ASK_HOURS`, so the town decides when nobody does;
  `answerSaga`); a trip is the destination `saga:<run>` (type `clear`; `sagaDestOf`, in `boardDestinations` and the
  snapshot's destinations), which the parties choose for themselves (`PULL_SAGA` in `pull`); `sagaTripHome` (from
  `comeHome`) goes on by whether they cleared it, and nobody going in time is its own branch (`late`); a raid chapter
  starts a raid tagged `Raid.saga` with its leader (`sagaRaidOver` from `endRaid`: beaten if the leader fell). Effects are
  the events' (`apply`, now exported from sim/events.ts) and the saga's own (`castBond`, `castHurt`, `castKill`,
  `title`, `unique`). The hero is the leader of the last trip won, else the founder; titles are on `Person.titles`
  (the inspect page). The six saga uniques are rows of uniques.ts marked `SAGA`. The Expeditions tab's Quests tab has a
  Sagas section (where each stands, its latest lines, those ended). `window.__saga(id)` begins one (previews). Tests:
  `test/sagas.test.ts` (every chapter reached, every next written, each saga can end well and badly). Probe (6 towns,
  15 days): 3 to 4 sagas a town, endings of every kind.
- **The Monster Hunters' Guild (done; the owner's ask: hunts now and then with rewards by difficulty, and components
  made into rare unique gear):** `src/shared/data/hunts.ts`: the topic Monster Lore (Stone Age), the guild hall
  (`monster_guild`, a crafting station; the planner builds it like any workshop and scores the topic +20 at 5 people;
  on the map the Glassblower pack's shop with a sword sign and a pelt rack), 21 quarries of one to five stars
  (`QUARRIES`: foes from the bestiary, the parts they give), the purse by stars (`HUNT_PURSE` 40 to 420), ten monster
  parts as materials (`COMPONENTS`: beast fang, thick pelt, venom sac, chitin, great horn, wyrm scale, gorgon's eye,
  ghost essence, monster heart, dragon's heart; worth in trade.ts, DawnLike icons), and the forge: seven unique weapons
  (rows of uniques.ts marked `FORGED`, their makings in `FORGE`) and six unique pieces of armour (`FORGED_ARMOUR`).
  `src/shared/sim/hunts.ts`: `huntsHourly` posts a hunt now and then while the guild stands (`HUNT_POST_CHANCE`,
  `HUNT_EVERY_HOURS` apart, at most `MOST_HUNTS`, lapsing after `HUNT_DAYS` (8); stars up to `starsFor`: the town's size and
  age), on the board as `mhunt:<id>` (type `clear`); parties take them up (`PULL_HUNT_STAR` 5 a star: at 3 the adventurers went elsewhere and hunts lapsed); `huntHome` pays the
  party the purse and stores the parts. `planForge` orders each forged unique once its makings are in store (one at a
  time); `canQueueCraft` refuses a unique already made or queued, and `finishPiece` records it in `s.uniques`. The
  planner keeps parts the forge still wants out of `forSale` and leaves uniques out of `bestMakeable`. The Quests tab has
  Hunts (stars, purse, parts) and the Guild forge (each piece, its makings, who carries it). `window.__hunt(id)` posts
  one (previews). Tests: `test/hunts.test.ts`.
- **The menagerie (done; the owner's ask: 250 more creatures, from the assets):** 304 new foes, every one a DawnLike
  creature (`src/shared/data/menagerie.ts`: a row each, its sheet and cell, a tier 1 to 10, a habitat, a family and flags:
  ranged, small, big, huge, undead, person, machine, armoured, quick). `tools/compose-dawn.cjs` (run by hand) cuts their
  two frames into `src/renderer/art/creatures/dawn.png` (`DAWN_ACROSS` pairs a row, 124 KB); the sheet `dawn` in
  `art/creatureSheets.ts` has `pairs`, so `creatureFrame` takes a creature's two frames and `creatureFlip` mirrors it to
  face right (the table of sheets moved out of creatures.ts into creatureSheets.ts, with no Pixi in it). Stats come from
  the tier (`statsFor`: 25 health at tier 1 to 358 at 10, stretched for size), loot by family, and from tier 4 a monster
  part for the guild. Where they turn up: a raid kind for each family and age (`MENAGERIE_RAIDS`, ids `m_<family>_<era>`,
  plus `m_ice_*` in the tundra, `m_dunes_*` in the desert and `m_deep_*` from the sea), from day 3, each bringing only
  its age's `RAID_TIERS` (gentler than the lairs': a Stone Age camp meeting tier 3 at its door grew half as fast; at
  tiers 1 and 2, lone towns reach 4.25 people by day 10 against 4.5 without them), half the land's lairs, caves and reefs (`rollFoes` in sim/places.ts: `placeHabitats` by the
  biome, `TIERS_BY_ERA`), up to `DUNGEON_GROUPS` (6) groups in each dungeon by its type (`DUNGEON_HABITATS`,
  `dungeonGroups`), and a guild hunt for each creature of tier 2 or more (`MENAGERIE_QUARRIES`, ids `m_<id>`, posted less
  often than the hand-written ones). **The Bestiary:** the Chronicle's fourth tab (`panel/bestiaryPanel.ts`): every foe
  (480) by family, tap a family to open it, met ones in colour and the rest as shadows, with their health, tier and
  habitat. The town remembers each kind it meets (`meet` in state.ts, `s.met`, from `fightGroup` and `endRaid`;
  `snapshot.met`). Pictures are CSS crops (`art/creatureThumbs.ts`) of the DawnLike sheet and the Craftpix pack sheets;
  the older MV-sheet creatures show a mark. `window.__raid(kind)` starts a raid (previews). Tests:
  `test/menagerie.test.ts` (every creature on the sheet, a foe, and turning up somewhere). **The Chronicle had been
  blank** since the menus went into sub-tabs: its entries came back after the redraw key had changed (`renderedKey !==
  key` in panel.ts); fixed.
- **Nobody stands on top of anyone (the owner's ask):** on the map, people standing still (`STILL_AFTER` 400 ms on one
  spot) are stepped apart: `MapPeople.spread` (every `SPREAD_EVERY`), by id, keeps each on their spot unless someone
  already placed is within `PERSONAL_SPACE` (32 px; up and down counts `SQUASH` 0.75), else gives them the nearest free
  place on rings round it (`ASIDE`); the step is eased in at a walk (`Drawn.aside`, `.off`) and dropped once they move.
  Walkers pass through each other. Drawing only: the sim's positions are untouched; `personAt` and `posOf` follow the step.
- **The map's grip (upright):** gone with the feed (the map always has the whole room now; see "The news bubble").
- **Fateful events (done; the owner's ask: events that change a town's course, toward fortune or ruin):**
  `src/shared/data/fatefulEvents.ts`: 25 events (a great fire, the black fever, a royal patron, gold in the river, a
  prophet who leads people off, the great blight, the lost library, the lost legion, an earthquake, a comet, the bandit
  king's tribute, the fat years, the barrow's curse, the founder's vision, a dragon's hoard, rats, the merchant princes,
  the town dividing, a miracle, the long winter, treasure under the hearth, war, a wanderer's gift, the wolves, a golden
  age). Each is `fateful` (its title marked ⚡), weighs `FATEFUL_WEIGHT` (6) against an ordinary event's 1, and comes no
  sooner than day `FATEFUL_FROM_DAY` (3) and no oftener than every `FATEFUL_GAP_DAYS` (4) (`s.lastFateful`). New effects
  in eventKit.ts, applied in sim/events.ts: `burn` (buildings set alight), `ruin` (pulled down), `exodus` (a share of the
  grown-ups leave, never the founder), `sickShare`, `learn` (topics learned outright), `heal`, `herdLoss`. Test in
  `test/events.test.ts`. Soak: two in 15 days per town.
- **Founders in their hero form always (done; the owner's ask):** on the map a founder is drawn with their combat sheet
  everywhere (`founderSheet` in art/combatPoses.ts: their calling's hero, else the archer for a shooter, a wizard for a
  caster, the samurai), walking, standing, fighting, and at work swinging the hero's blow (`WORK_SWING` in mapPeople).
  The raid map draws people with mapPeople, so it shows there too.
- **Slower levels (done; the owner's ask):** `LEVEL_SHARE_FIGHT` 0.35 and `LEVEL_SHARE_WORK` 0.11 (a quarter of before).
  Soak (15 days): the best in a town is level 13 to 16, the average 6 to 12, where the best was 21 to 29.
- **People join by the player's leave (done; the owner's ask):** a wanderer at the gate, or a traveller asking to settle,
  is a question (`askVisitor` in townsfolk.ts: a prompt of kind `visitor`, "Take them in" / "Send them on",
  `answerVisitor`), and the Townsfolk card has the same two buttons; the planner no longer lets them in itself
  (`planVisitor`), except where the gates are free (`freeJoin` in an origin's rules: the nomads' horde). Wanderers come no
  oftener than `VISIT_GAP_HOURS` (a week: 168 hours) apart (`s.lastVisit`; the owner wants arrivals few and far between, so people are known by name). Left unanswered till their wait is up, they're let in while the
  stores hold a day's food a head (`foodPerHead`; the prompt's default, applied by `updateVisitor`), so a town whose
  player is away still grows; else they're sent on. Otherwise people come by events, prisoners won over,
  and birth.
- **The town's inventory in tabs (done; the owner's ask):** the Crafting tab's Inventory lists every material in store and
  every item (in store or worn) with tabs by kind (`INV_TABS`: All, Weapons, Armour, Tools, Materials, Food, Furniture,
  For sale, Medicine; empty ones hidden; the tab remembered in `littletown.invTab`).
- **Crops grow before your eyes (done; the owner's ask):** a plot is redrawn at six stages (`CropLook`: fallow, sprout,
  young, tall, heading, ripe; `cropLook` in mapView.ts by the crop's growth): the rows taller and fuller each stage,
  pale green to deep, the heads turning, then ripe; an orchard from saplings to round trees in fruit (`packedPlot` in
  fieldArt.ts). The herb garden and every field show it.
- **Pens bought, bred, sold and widened (done; the owner's ask):** a pen is built empty (`herdOf` starts at 0); the
  planner's `planPens` buys its first animals from a drover (`stockPen`: up to the herd's `start`, `price` coins a head
  from `HerdDef`, paid in coins above `COIN_RESERVE`, else in spare goods at `BARTER_MARKUP` 1.3 over their worth,
  `payFor`). The herd breeds as before; a pen nearly full is fenced wider a column at a time (`growPen`: right, else left,
  over open buildable ground off the roads; `Building.wide`, which `footprint` adds to the width; up to `PEN_GROW_MAX`
  6), each column holding `PEN_ROOM_PER_COL` (3) more (`penRoom`). A full pen that can't grow sells a head at
  `SELL_SHARE` (0.7) of its price while food lasts `SELL_FOOD_DAYS` (4), else slaughters one (meat pens cull each
  tending, down to a pair). The map redraws a widened pen (its `wide` in the building's sig) and the animals roam the new
  ground (mapHerds recomputes the box); the tap card says the head against the room, or that it's waiting to be stocked.
  Test in `test/livestock.test.ts`.

- **The town's size is the player's (done; the owner's ask):** `s.popTarget` (`setTownSize` command; the Plan tab's
  Town size row: `TOWN_SIZES` 5, 10, 20, 40 or no limit; `snapshot.townSize`). `townFull` (state.ts) gates every door in:
  wanderers at the gate, travellers asking to settle, events' newcomers, rescues and captives freed, prisoners won
  over, quest and rival joiners, the pack's survivors, the raise-dead and assemble powers, the changeling, and births.
  A town kept under `RAID_SMALL_TOWN` (20) draws raids whose day-by-day growth is scaled down (`raidBudget`).
- **Couples and children:** `updateSocial` measured only x-distance (the old strip); it measures both ways now, and
  `WARM_PER_HOUR` is 1.2 (was 0.6) within `NEAR_PX` 6 cells, since a town that takes few newcomers grows by birth. The
  planner scores Family Life +40 once the town is 4 strong (it wasn't learned by day 15 at the slower research pace).
  Probe: a couple by day 10, two children by day 13.
- **Skills and levels run to 100 (done; the owner's call):** `MAX_SKILL` 100 (`SKILL_KNEE` 20, then each level costs
  `SKILL_STEEPNESS` 1.06 more; `skillSpeed` saturates past 15), `MAX_LEVEL` 100 (`LEVEL_STEEP` 40, `LEVEL_STEEPNESS`
  1.08), `STAGE_LEVELS` [1, 12, 30, 55, 85]. **The high grades are very rare:** `rollQuality` applies `GRADE_LUCK`
  from Rare up (0.5, 0.4, 0.3, 0.25, 0.15, compounding), and `typicalQuality`/`rollPlus` scale by the 100-point skill,
  so a level-20 crafter makes Common and Uncommon work.
- **Five shops (done; the owner's ask):** `src/shared/data/stores.ts`: beside the general store's chain, a Furniture
  Maker, Weapons Store, Armour Store and Apothecary Shop (`STORE_BUILDINGS`, merged into BUILDINGS; `floor.line` is
  what each sells: `ShopLine`; `LINES` has each one's banner, keeper title and colours). `isShop` is the general store
  only; `lineOfDef`, `lineOfItem`, `LINE_ITEMS` in data/shop.ts. In sim/shop.ts: `storeOf`/`storeOpen`; each store
  draws its own customers (`arrive(..., line)`, `s.nextStoreTick`, `Traveller.line`, `lineWant`: a `line` want or gear
  of the line), serves only its line and never buys; with a Weapons or Armour Store open the general store's
  customers come for tools instead. The planner builds one of each once the general store stands and the town is
  `STORE_PEOPLE` (6) strong, furnishes them, keeps `LINE_STOCK` (3) of each line made from spare materials, and spends
  on them like any venue. `snapshot.stores` (`ShopView.line`, `.stock`, `.stockMats`: what's on show); the windows are
  panels `store_<line>` (`STORE_PANELS` in ipc.ts; `venuePanel` in main.ts opens them, the Trade tab has a button
  each). On the map every venue hangs a **banner** out front (`bannerOf` in packBuildings.ts: a pole and cloth in the
  shop's colours with its emblem). **Exteriors from the pack:** the Glassblower's Workshop pack's shop fronts
  (`src/renderer/art/shops/`: the big red-roofed house for the inn, tavern and emporium; the smaller shop for the
  trading post, general store and the four stores, with its barrels, crates and signpost at the door).
- **A shop like a real shop (the owner's ask):** a shop's customer looks round first (`Traveller.stage` `browse`, for
  `BROWSE_HOURS` 0.35), then goes up to the counter (`counter`, `TALK_HOURS` 0.2), where `serveCustomer` runs (it used to
  run on arrival), then makes for the door (`done`). What was said is kept on `Traveller.talk` (`ShopTalk`: the ask, the
  keeper's answer, and `sold`, `order` or `no`), carried as `ShopView.customers[].stage`/`.talk`; the window walks them
  between the pieces, then to the counter, and shows the question and then the keeper's answer as speech bubbles laid over
  the canvas in HTML (`placeBubbles` in shopPanel.ts, `.shop-bubble` in panel.html: green for a sale, gold for an
  order, red for a no), and the keeper speaks in the first person when talking a customer round (`said`). **Orders:**
  with nothing they came for, and not talked round, the keeper orders it (`commission` in sim/shop.ts) if the town knows
  how to make one, its station has room for an order, the makings are in store now (so it won't stall) and the customer
  can pay up front (the cheapest that would do): a craft order of its own with `CraftOrder.commission` (who, what they
  paid, the shop); `finishPiece` sends the finished piece on to them, never into the stores, and the shop's log says so.
  Else the keeper turns them down. Tests: `test/shopTalk.test.ts`.
- **Inside the venues (done; the owner's ask):** every venue opens with basic furnishings (`STARTERS` in
  `src/shared/data/decor.ts`, set out once by `furnishStarters`; `b.shop.started`). The keeper decides a **décor
  direction** from their nature (`DECOR_OF_NATURE` → `DECOR_STYLES`: rustic, cosy, stately, austere, opulent, garden,
  sombre, festive; `decideDecor`, `b.shop.decor`), and the town pays for it in five steps (`DECOR_LEVELS`: painted
  walls, rugs, hangings, lamps, fine trim; `DECOR_COST`, `DECOR_APPEAL` each; `decorPrice`/`redecorate`; `planShop`
  takes the décor before polishing single pieces). The panel (`shopPanel.ts`) paints it: the walls in the style, a
  runner from the door and a rug before the counter, curtains and a hanging, sconces lit after dark, trim; the
  stores' own rooms (`storeRoom` from `LINES`) with the **stock on show** (`display`: a pegboard of weapons, armour on
  stands, the apothecary's shelves of jars and hung herbs, the furniture maker's long table, the general store's
  crates and shelf; icons through `iconSpot`/`materialIconSpot`). **The inn's rooms are down a hallway:** the guest
  wing (`wing()`, `ROOM_W`, `ROOM_D`) stands beside the common room, a doorway cut in its side wall onto a hall with
  each room's door open on it, a window, its bed and sleeper; the storey upstairs is gone (beds still sit at `UPSTAIRS`
  -1 with x the room). Tests: `test/shop.test.ts`.

- **The tech tree (done; the owner's ask: the classic look):** `src/renderer/panel/techTree.ts` (`renderTree`), on the
  Research tab under the queue and stations in place of the per-branch card lists. Read left to right: the eras are
  column bands (`tree-era`, named at the top, the town's own lit, the ones ahead darkened), each split by a topic's
  depth in its era's own chain of prerequisites (`depthOf`: one column right of its deepest same-era prerequisite), so
  the tree branches out and gets more advanced to the right; the branches are the lanes top to bottom (`LANES`, the
  town's heritage last, each with a name row `LANE_HEAD` that stays put as the tree scrolls); SVG curves run from each
  prerequisite to what it opens (lit once the prerequisite is learned). Nodes (`.tn`) are green when learned, gold with
  a progress bar when queued, lit when they can be studied next, dim when locked and fainter in an era not reached.
  Tapping one shows its card under the tree (`selected` in researchPanel.ts, in `researchKey`); the tree opens scrolled
  to the town's era and keeps its scroll after that (`scrollX`). The CSS is in panel.html (`.tree-*`, `.tn`). The
  Hide row is gone from the tab (`HidePrefs` stays for Build and Crafting).

- **Nobody stands frozen (done; the owner's ask):** `idleBreath`/`idleFidget` in `map/mapPeople.ts`: anyone standing
  (the walk's first frame, not fighting) rises a pixel on a slow breath and shifts their weight now and then (a step
  frame for a moment), each on their own clock by id; the venue windows' keepers and browsers do the same (`person` in
  shopPanel.ts). Founders and the fighting callings already had the hero sheets' idle animations.
- **Homes without tents (done; the owner's call):** the Fields pack's camp tents are gone from the lean-to, hide tent
  and longhouse (the nomads keep their tipis and yurts: those picks are `styles` NOMAD only); every other look draws them
  with the top-down painter's house. The elder lodge and the town hall are the Glassblower pack's big house (the lodge
  with the signpost and barrels, the hall with crates) and the trophy hall its shop with the shield sign, in the base
  and knights looks; the painter's `hall` shape stays for the other origins.

- **Tap for more (the owner's ask: "click on the quests for more information... almost everything"):**
  `src/renderer/panel/details.ts`. `expandable(card, key, more)` makes a card open on a tap and show `more()` under it
  (`facts` two columns, `list`, `subhead`; `foeLine`/`groupLine` for foes, `stockLine`, `itemStats`); `pickable(chip,
  group, id)` and `pickedIn(group)` do the same for small chips (inventory, store, bestiary), the details in a card under
  the group. Taps on buttons, links, inputs or `.no-expand` never toggle. What's open is kept for the session and is in
  the panel's redraw key (`detailsKey`, panel.ts). Wired into: the Expeditions tab (trips, places, quests: who asked and
  the reward, `QuestView.from`/`.reward`; hunts by `HuntView.quarry`; sagas with their whole story, `SagaView.story`,
  `.began`; the forge and uniques), buildings (`buildingDetails` in buildPanel.ts) and the Town status stores, recipes
  and the inventory (`itemDetails`, `materialDetails`), the caravan's deals (`dealDetails`), the bestiary (full stats
  once met) and a venue's guests (purse, people, wants, what was said). CSS `.expandable`, `.card-more`, `.facts`,
  `.pickable` in panel.html. Test: `test/details.test.ts`.
- **What came of an answer, in the event box (the owner's ask):** answering on the full-screen event box
  (`eventSheet.ts`) no longer closes it: the choice taken and "What came of it" take the answers' place, then Continue.
  The sim keeps the outcome with `setOutcome` (state.ts) for events (`tell`), secrets (`answerSecret`'s `say`) and sagas
  (`answerSaga`: what the answer brought and the lines that followed); `snapshot.eventOutcome.tick` tells the box it's
  the answer just given; with nothing told in `QUIET_MS` it says "It is done.". A battle or watched fight drops it.

- **Sending a party yourself (the owner's ask: control, and something to do, while the town still runs itself):**
  `src/shared/data/muster.ts` and `src/shared/sim/muster.ts`. Every board card has **Raise a party…** (the `muster`
  command, op `raise`): the most seasoned adventurer fit to go steps up to lead (anyone fit if the town has none) and
  `recruit`s from the willing; `s.muster` (`Muster`) holds it, and while it does the town forms no party of its own.
  The player asks people along (`addMember`), drops them, or makes one leader; some say no (`willing`: hurt, worn out,
  hungry or just home; on the watch; a venue or the healer's to keep; an enemy going; or, for a dangerous place, a
  homebody or `RELUCTANT_SHARE` of the rest who aren't adventurers or guards), and are talked round for coins from the
  treasury into their purse (`persuade`, `PERSUADE_*` by the danger) or ordered along (`order`: `p.sore`
  `ORDER_MORALE` for `ORDER_HOURS`; the only way for the hurt or a post's keeper). The leader reads the odds
  (`oddsLine`, `ODDS`: strength over danger, bold counting the danger 1.25 times); careful or bold, rations (`RATIONS`:
  the food packed, through `sendExpedition`'s `opts`), spare torches for a delve (`Expedition.extraTorches`, read by
  `startDelve`), horses or not; `sendMuster` sends them (`Expedition.ordered`, `start`). On the road a commanded party
  asks instead of rolling a road event (`crossroads`, at most `MOST_CROSSROADS`; `CROSSROADS`: the weather turns, a
  shorter way, fresh tracks, a ruin, heavy packs home, a traveller in the ditch), a prompt of kind `road` the event box
  shows with a backdrop and the leader, the bold answer the default on a risky trip; `answerCrossroads` applies it and
  tells the box what came of it. Home, `debrief` (from `comeHome`) puts a prompt of kind `debrief` on the box: how long,
  what they brought, who rose a level, who was hurt, who didn't come back. The sheet is `panel/musterPanel.ts` (over the
  Expeditions tab, `over-tabs`: the sub-tabs leave it alone). Tests: `test/muster.test.ts`.

- **The town trades with caravans itself (hands-off):** the player has the first half of a caravan's stay to take its
  deals; after that, once an hour, the town takes one it wants (`townTrades` in sim/trade.ts, with the autopilot on;
  `Caravan.arrived`): `goodDeal` is goods it's short of (`SHORT_OF`) at no more than `DEAR_BUY` times their worth, or
  a horse with a stall free, paid with what it can spare (`SPARE_KEEP`, `FOOD_SPARE` for food). Test in
  `test/trade.test.ts`.
- **Feed rows open:** tapping a happening on the phone's feed opens it (the full date, and **Show them/it on the map**:
  `__showOnMap` in main.ts centres the camera and opens the tap card); the hero's card does the same.
- **Fighters no longer stand behind the fight's windows:** in a fight the top window hides, and `FightHud.insets()`
  returned nothing then, so the scene ignored the party's window along the bottom; it gives each inset on its own now.

- **They wear what they're equipped with (the owner's ask):** `hkLayers` (art/hkFolk.ts) dresses a townsperson in the
  body armour they have on: its weight picks the outfit line (their calling's own where it is of that weight,
  `OUTFIT_WEIGHT`; else `ARMOUR_OUTFIT`: plate, leather, road clothes) at the armour's tier; with nothing on, casters
  keep their robes (`ROBES`) and founders their outfit, everyone else plain clothes (no more knights in plate they
  don't own). The helm is the head piece they wear (a samurai's helm no longer comes free); the shield the one in hand;
  the weapon is carried about town too, put away only for the work's tool. The map, the fight screen and the
  Townsfolk tab's paper doll all draw from it. Eighteen items pointed at empty icon cells (the visor helmet, the
  flail and Thornlash, the prosthetics, the Gorgon Aegis...): fixed, so the doll's slots show them.

- **Health bars and casters in raid battles (the owner's ask):** in a raid every townsperson on the map shows a health
  bar over their head (`hpBar` in mapPeople.ts, `HP_W`: green, gold when hurt, red when low, grey when down), as the
  raiders had. Every calling that fights from range (`fightsFromRange` in data/classes.ts: the class's `ranged`) stands
  off the trail on wall and ground spots (`defenderReach`), not only the mage; casters, healers and ranged supports cast
  at `MAGIC_RANGE` (`castsMagic`, a bolt on the map), and the caster role burns as the mage does (`castsFire`: `mageFire`,
  the burst). Their spells and skills were already used on the map (`takeTurn` in `stepBattle`). Test in
  `test/battle.test.ts`.

- **The realm: factions, war hosts and assaults (done; the owner's choices: full diplomacy; hosts up to about 60; an
  assault is one huge battle; conquest plunders, makes vassals or razes, and recruits come over):**
  `src/shared/data/factions.ts` and `src/shared/sim/factions.ts`. **The powers** (`realm(s)`, seeded from the world's seed
  into `s.factions`: `FACTION_COUNT` 4, three rival origins (never the town's own) and the Red Brotherhood's bandits;
  `FACTION_DEFS`: name, lord (an enemy id), stronghold, the raid kind its troops are, scenes, `temper` (warlike, greedy,
  honourable, treacherous), goods). A power is met by its envoy (`FIRST_MEET_DAY`, then one every `MEET_EVERY_DAYS`);
  `factionsDaily` (hour 9, from `factionsHourly`; autopilot on) grows its troops (`TROOPS_PER_DAY` up to `TROOPS_MOST`),
  drifts its goodwill to its temper's rest (`TEMPER_REST`, `ATTITUDE_DRIFT`; treaties and a marriage warm it), pays trade
  (`TRADE_COINS`) and a vassal's tribute (ledger line `realm`), declares war at `WAR_AT`, lets the treacherous betray
  (`BETRAY_CHANCE`) and a strong, sullen vassal rebel (`REBEL_CHANCE`), musters war hosts, and sends one envoy a day at
  most (`envoyAbout`: tribute demands, peace, trade, an alliance, a marriage, a surrender once beaten twice). **Envoys**
  are prompts of kind `envoy` (`Prompt.envoy`: faction, about, coins) shown in the event box; `answerEnvoy` (from
  `answerPrompt`). A marriage brings one of theirs to wed the founder or another single grown-up (`marry`, of their
  people by `makeStranger`). **The Realm** is the Expeditions menu's fourth sub-tab (`panel/realmPanel.ts`; `GROUPS`
  "The realm", "Assaults"): a card a power (stance, lord and stronghold, temper, a goodwill bar from the middle, troops
  against `townMight`, a host on its way) with the `realm` command's buttons (`realmCommand`: gift `GIFT_COINS`, propose
  peace, trade or an alliance by `TREATY_NEEDS`, offer a match, demand submission (only a power under 0.7 of the town's
  might kneels), free a vassal, declare war; breaking a treaty costs `OATHBREAKER` goodwill with everyone).
  `rivalRaidOdds` keeps a rival's ordinary raids to powers at war (twice as likely) or with no treaty.
  **War hosts:** a power at war musters one now and then (`HOST_CHANCE`, `HOST_GAP_DAYS` apart): `f.host` comes
  `HOST_WARNING_HOURS` (36) later (a feed card and the Realm say when), `HOST_SHARE` of its troops up to `HOST_MOST` (60).
  `launchHost` calls `startRaid(..., host)` (raids.ts takes `host`: its size over the usual cap, `siege` engines from the
  Medieval age, one per `SIEGE_EVERY`, and the lord at the head; `Raid.host`); the `siege_engine` (merged into ENEMIES,
  the Himeko juggernaut) strikes walls `SIEGE_WALL` times harder (`attackWall`). The battle comes in up to `HOST_WAVES`
  (8) waves of about `HOST_WAVE_SIZE` (`startBattle` in battle.ts). The town's allies send `ALLY_TROOPS` of theirs as
  ally raiders (`alliesFor`, from `startRaid`: always to a host, now and then to any raid). `hostOver` (from `endRaid`)
  counts the dead off the power's troops; broken (the lord down or 60% fallen) it may sue for peace or kneel.
  **Assaults:** destinations `assault:<faction>` (a power at war) or `assault:dungeon:<id>` (a dungeon on the board)
  (`assaultDestination`, resolved by `destinationOf`; `assaultTargets` for `destinationUnlocked`), raised through the
  muster (up to `ASSAULT_MOST` 16: `mostFor` and `canSend`). `planAssault` (in `sendExpedition`) plans the waves
  (`assaultWaves`: the power's troops in waves, its lord and guard last; a dungeon's foes thickening, its boss last) onto
  `Expedition.assault`; at the target `fightGroup` starts the first and hangs the rest on `Battle.waves`, and combat.ts's
  `nextWave` brings each on as the last falls (the fallen cleared, their loot kept in `spoils`; one fight, the party as
  it is). `assaultOver` (from `finishBattle`): won, plunder (`PLUNDER_PER_TROOP` coins to the treasury, `PLUNDER_GOODS`
  of its goods home), recruits (`RECRUITS`), and a `conquered` envoy: vassal or razed (`destroyed`); a dungeon's hoard;
  lost, the power is emboldened and a host comes. The fight screen fits a crowd (fightView: the party in two or three
  columns, the foes in rows past eight; the HUD's party window in two columns, `.ff-party.many`, and "Wave N of M",
  `ExpeditionView.assault`); the feed has a card for an assault under way. Names that are a doing take no "the"
  (`OWN_ARTICLE` has "storm"), and foes are pluralised at the head word ("knights of the order", "crossbowmen").
  Tests: `test/factions.test.ts`. Soak (3 towns each of settlers, knights and vampires, 20 days): no town lost, 1 to 5
  deaths, wars, peace, trade and a vassal; hosts of about 20 from day 11, growing with the power's troops.
- **The realm, rounded out (the owner's "do them all"):** an assault is fought in the stronghold's own scenes (`ROUTES`
  `assault:<faction>` is the power's `road` and `inside`; a dungeon's are its own); every stronghold and storming
  target has a spot on the world map (`STRONGHOLD_SPOTS` in data/factions.ts, merged into `MAP_SPOTS`; drawn by
  worldMapView as a `.map-hold` tower, ✕ when razed, tappable at war). **Phone alerts** for war (`AlertSettings.war`,
  forecast kind `war`: a host mustered, war declared, a vassal risen; high priority). **Siege engines on the trail**
  (`siegeBlow` in battle.ts): within `SIEGE_REACH` (4) cells of a wall or tower spot, or of the gate at the trail's
  end, an engine batters it (`SIEGE_WALL` times its blow; a wall or gate at 0 falls) and silences a defence for
  `SIEGE_SILENCE` (20) s. **Levies:** allies send `ALLY_TROOPS` and vassals `LEVY_SHARE` of their troops (up to
  `LEVY_MOST`) to march in an assault beside the party (`leviesFor`, pushed into the fight by `fightGroup`).
  **Envoys ride in:** `s.envoyRider` (`rideIn`, `envoyTick` from sim.ts): a mounted stranger of their people rides from
  the land's edge to the fire, waits while the question is open, and rides off (`snapshot.envoyRider`, drawn as a
  traveller by main.ts's `envoyPerson`). A demand the treasury holds `DEMAND_EASY` (2) times over is paid if nobody
  answers. Tests in `test/factions.test.ts`.
- **The Shapeshifter calling (26 callings now):** `shapeshifter` in data/classes.ts (a bruiser, rare, claws, spears
  and staves), its stages Skinchanger, Beastblood, Manyform, Primal, Wild God; it always fights in a beast's shape,
  a greater one each stage (`BEAST_FORMS`, `beastForm` in data/levels.ts: wolf, lion, bear, drake, wyvern; a druid
  from the third stage keeps to the bear). `PersonView.beast` and the fight's `FighterView.beast` carry the form
  (sheet, block, scale) to mapPeople and fightView. Twenty skills (`howl`, `savage_roar`, the ultimate
  `primal_fury`...). Test in `test/shapeshift.test.ts`.
- **Progress bars over watched trips and fights (the owner's ask):** `src/renderer/fight/progress.ts` (no DOM: `tripShare`,
  `tripLabel`, `fightShare`, `raidShare`). The fight screen (`#fight-progress` in fightHud.ts, under the top window or,
  in a fight, at the top beside the ✕) has a gold bar for the whole trip (a third out, a third there with a delve by its
  rooms, a third home; marks at the thirds) with where they are and the share, and in a fight a red bar of the foes'
  health gone (an assault counts the waves before as done: "Wave 2 of 5 · 40%"); hidden in a mine. The raid's battle
  bar (battleHud.ts, `.battle-progress`) shows the raiders beaten (green) and got through (red) of all that came
  (`BattleView.total`). The world map's stronghold labels are capitalised and the crowded ones spread
  (`STRONGHOLD_SPOTS`). Test: `test/progress.test.ts`.
- **A hunt is always a fight (the owner's complaint: a party of two walked out, swung at air and walked home):** the
  arrival fight of a `clear` destination (a guild hunt, a place on the land, a saga's foe, a pack's lair, an assault)
  is the whole errand, so `maybeFight` in sim/expeditions.ts never skips it (a careful party's `STAKES.fights` used to
  halve it) and a scout can't slip the party past it (`SCOUT_AVOID`). Test in `test/hunts.test.ts`.
- **The weapon drawn is the weapon carried (the owner's ask):** `weaponPiece` in art/hkFolk.ts picks the Himeko piece
  by the weapon's name first (`NAMED`: a katana the katana, a claymore or zweihander their greatswords, a great axe a
  great axe, a maul or sledge a great hammer, a morning star, war hammer, quarterstaff, club, sickle, longbow, crossbow,
  rifle, shotgun, laser rifle each its own; spears, pikes, lances, javelins, harpoons and tridents a spear made from the
  pack's naginata by `tools/make-spear.cjs` (run by hand: the curved blade, the biggest run of grey in each cell, swapped
  for a straight leaf-shaped head along the shaft's line; `spear01{male,female}`), glaives and halberds the naginata),
  else by its family and tier (`WEAPON`). Where the pack has nothing like it (claws, knuckles, slings, whips,
  bombs) they're drawn bare-handed rather than holding something else. The map, the fight screen and the paper doll all
  draw through it. The old LPC fallback draws a scythe as a sickle and claws bare. Test in `test/hkFolk.test.ts`.
- **A recap after every raid (the owner's ask):** `src/shared/sim/raidRecap.ts`. While a raid is on its blows are
  tallied on it (`Raid.tally`: each townsperson's harm dealt, raiders felled and harm taken, by `credit`/`took` around
  `defenderAttack` and `attackPerson` in raids.ts and the spells and skills in battle.ts; the towers and traps as one,
  `TOWERS`), and who was in town at what level is noted as it turns active (`noteRoll`, `Raid.roll`); `endRaid` puts it
  together on `s.raidRecap` (`raidRecap`: victory, driven off or pillaged; the felled, fled and through; the waves; each
  defender's row with experience and levels, the fallen and the slain; the best of them; spoils, prisoners, what was
  taken). `snapshot.raidRecap` carries it for `RECAP_HOURS` (6). The strip shows it once as a card over the town in the
  town's own look (the wood-and-brass card of the question and report cards, themed per people by theme.ts and skins.ts
  like `#prompt`; titles in `--heading`, a theme variable; the parties' victory window `#fight-result` likewise, and
  the whole fight screen's windows too: `.ff-window`, `#fight-banner` (an ultimate's stays fiery), `#fight-leave`, the
  bars), with a few lines of the raid told (`story`, `tellRaid`: where they came from, who led, who fought hardest
  and who bore the worst, the fallen and the dead, the towers' part, how it ended; also on the feed's card)
  (`battle/raidRecap.ts`, `#raid-recap`; the last seen kept in `littletown.recapSeen`), and the phone's feed has a card
  that brings it back (`__showRecap`). Test: `test/raidRecap.test.ts`.
- **The dead don't bleed out (fixed):** the raised dead, the lich and machines struck down (`knockDown` in health.ts,
  `tireless`) fall apart or shut down and pull themselves together in about `REFORM_HOURS` (3), needing no healer:
  no bleeding, no blood marks, no medkit spent; a killing blow still ends them.
- **A rout is a danger (the owner's ask):** a raider on the battle map that breaks and runs (`ROUT`) takes a parting
  blow from every placed fighter with it in their weapon's reach (`partingBlows` in battle.ts, through
  `defenderAttack`, so the recap credits it), as a fighter falling back already did. Probe (10 first raids): 8 of 24
  raiders felled where it was 2, deaths unchanged. Test in `test/battle.test.ts`.
- **Prisons with cells, sickbeds for the hurt (the owner's ask):** `src/shared/data/prisons.ts`. **Prisons:** the line
  stockade (3 cells, from the start) → gaol (8, Masonry, half the escapes) → prison (20, Sanitation, a quarter),
  `BuildingDef.cells`/`escape`, chained in UPGRADES. A raider is taken alive only while a cell is free (`cellsOf` in
  sim/prisoners.ts: the prisons' cells and a blood farm's; `takePrisoners` stops at the room left, and says so); each
  prisoner's escape odds are those of the cell they hold, the best filled first (`escapeAt`; one with no cell
  `NO_CELL_ESCAPE`). The planner lays a stockade once the town is 3 strong and has been raided or holds prisoners
  (`wantPrison`, not the Court, whose farm has cells), leaves the line out of its "learned to build it" loop, and
  rebuilds it as the next when the cells are nearly full (`planPrison`). Pictures: the Village pack's stakes and the
  dungeon pack's stonework (`stockade`, `gaol`, `prison` in packBuildings.ts). **Sickbeds:** `SICKBEDS` (healer's hut
  2, infirmary 4, hospital 8, trauma center 12) and `src/shared/sim/sickbeds.ts`: the downed and anyone under
  `SICK_AT` (half) of their health go to a free one (`sickbedFor`; a `sleep` task with `sick`) and lie till `MENDED`
  (0.85), getting up only to eat (`doSleep`); only those in a sickbed have the building's healing (`sickbedHealing`,
  in `heal` with `SICKBED_REST` on top, and as `TENDED` for wounds in injuries.ts). The planner builds the best healing
  building it can when the hurt outnumber the beds. The tap cards say the cells held and who lies in the sickbeds
  (`snapshot.cells`, `.nursing`). Probe (4 settlers towns, 10 days): a stockade by days 2 to 3, prisoners taken, the
  sickbeds used, 0 to 1 deaths. Tests: `test/prisonsAndSickbeds.test.ts`.
- **No expedition pane beside the map (the owner's call: it didn't look good and didn't help):** `SHOW_PANE` in main.ts
  is off, so a party away is no longer drawn walking in a strip beside the zoomed-out map (`town/expeditionPane.ts`
  stays, unused); parties are watched full screen and listed on the feed and the Expeditions tab.
- **Raiders lamed and run down (the owner's ask):** `src/shared/sim/raiderWounds.ts`. Every blow that lands on a raider
  (the town's, a tower's or a trap's: rolled in the recap's `credit`, `legWound`) may find a leg: `LEG_SHARE` times
  twice the blow's share of its health; each wound takes `LAME_PER` (0.3) of its pace, up to `LAME_MOST` (0.65)
  (`Raider.lame`, read by `speedOf` in defenses.ts, so it comes on and runs off slower; epic bosses shrug it off). A lame
  raider running from the fight with a fighter close by (`RUN_DOWN_CELLS` on the battle map, `RUN_DOWN_PX` in town)
  may be run down (`tryRunDown`, `RUN_DOWN_CHANCE` a tick by how lame): a person is taken alive (`Raider.taken`: sure to
  be a prisoner in `takePrisoners`), a beast or monster killed, the catcher credited. The rolls are the sim's own (by
  the raider and the tick), so a raid replays the same. Lame raiders limp on the map (`RaiderView.lame`, `limpDip`), and
  the recap counts the lamed, those run down and taken, and those who limped away (`lamed`, `runDown`, `takenAlive`,
  `limped`; a line of the story). Probe (10 first raids): 8 of 24 raiders lamed; of them 5 cut down as they limped off,
  1 run down and taken, 2 (chiefs) got clear. Tests: `test/raiderWounds.test.ts`.
- **Big fights ask to be watched (the owner's ask: "raiding the barrow crypt"):** `src/shared/sim/watchAsk.ts`. When a
  party meets a big fight (`bigFight`: a boss, or any fight at the place it set out for: a dungeon, a place to clear, a
  hunt, a stronghold stormed), `fightGroup` calls `askToWatch`: the fight holds (`Expedition.prompt`, as the trip's
  questions always did) and a prompt of kind `watch` asks "Watch the fight" (`s.watching`: the fight screen) or "Let it
  play out" (the default after `WATCH_ASK_HOURS`, 2). Once at the site and once for its boss a trip
  (`Expedition.watchAsked`); never while watching already, in a town run by hand (autopilot off: the tests), or while the
  sim runs unseen (`runtime.quiet`, set by the catch-up after time away and the alerts' look ahead). The phone's event
  box shows it full screen and closes on either answer. Test: `test/watchAsk.test.ts`.
- **Buildings pulled down to make room (the owner's ask):** (the owner's later complaint: a town pulled down its only
  crop for a house: now a field or pen, fallow or not, and a store with goods in it are never pulled down: `mayClear`.) An upgrade with no room where it stands (`canUpgrade` in
  sim/buildings.ts) may pull down what's in its way: at most `CLEAR_MOST` (2) finished buildings worth together no more
  than `CLEAR_WORTH` (0.6) of the upgrade's cost, never the seat, a gate or wall (`hp`), a castle's room, a venue, a
  prison, the campfire, anything alight, a field with a crop growing or a pen with animals, nor one of its own kind
  (those are merged, `absorb`), and only while everyone keeps a bed (`roomForSleepers`); a road over the ground is
  lifted and laid again round it. `upgrade` demolishes them (half their makings back, `demolish`) and says so in the
  Journal; the town builds them again elsewhere as it wants them. Pens are only a rail fence now (`drawFence` in
  art/fieldTiles.ts: the Fields pack's side rail `fence7` down the sides, rails stretched cell to cell), over the land
  as it lies. Test in `test/buildings.test.ts`.
- **Who owns what, on the map (the owner's ask):** a finished building's tap card (main.ts) says whose it is ("Owned by
  Elka", else "The town's own (the treasury's)"; not for walls and fields), and a home who lives there, the renters
  marked, and its beds (`PersonView.bedId`).
- **The wild grows back (the owner's ask):** `src/shared/sim/regrow.ts`. A wood, marsh or scrubby hill gathered bare
  (`clearCell` → `noteCleared`) is remembered on `LandMap.regrow` (what it was, the tick it returns: `REGROW_DAYS`
  forest 5, marsh 2, hill 3, spread ±40% by the cell) and `regrowHourly` grows it back with a fresh pool, unless it's
  built on, a road, beside a building (the yards are kept) or still walked (a footpath showing): then it tries again a
  day later. Rock and the mountain never grow back. Footpaths grass over twice as fast (`WEAR_DECAY` 2 an hour), so only
  the ways in use stay worn. Test: `test/regrow.test.ts`.
- **One asks to join a week (the owner's ask):** `VISIT_GAP_HOURS` is 7 days, and `joinTooSoon` (townsfolk.ts) holds
  back every way in that asks: wanderers at the gate, travellers asking to settle (`offerToSettle`) and secret strangers
  (`secretStranger`), all setting `s.lastVisit` (not where the gates are free, `freeJoin`).
- **Fields worked a section at a time (the owner's ask):** a field's sowing and harvest run left to right in sections,
  one a cell of its width (`sectionsOf`, `sectionsDone` in data/crops.ts, by `crop.work`); the farmer stands in the
  section under way (`fieldSpot` in farming.ts, from the `farm` task) and moves along, and each reaped section's share of
  the crop comes in as it's done (`workField`). The plot is redrawn by sections (`paintFarm`'s `cut`: stubble where it's
  reaped, the orchard's trees picked bare, seed in neat furrows where it's sown; the count is in the building's `sig`
  and the art key), and the tap card says "Being reaped: 2 of 4 sections in" or "Being sown". Test in
  `test/fields.test.ts`.
- **The menus redone (the owner's ask: organised by area, tappable):** six tabs (`PANELS` in ipc.ts; the ids kept so
  saves and the desktop app work): **Town** (`build`: Overview, Buildings, Stores, Treasury), **People** (`townsfolk`:
  People, Jobs), **Studies** (`research`: Studying, Tech tree), **Market** (`trade`: Shops, Caravan, Workshops, Animals),
  **Trips** (`expeditions`) and **Chronicle** (`journal`, "Annals" on the upright tab bar). The old Crafting tab is gone:
  its inventory is the Town's Stores (`renderStores` in craftingPanel.ts) and its orders and recipes the Market's
  Workshops (`renderWorkshops`); opening `crafting` lands on Workshops. The sub-tabs come from the sections' headings
  (`GROUPS` in subtabs.ts); `selectTab` opens one from elsewhere. `panel/townOverview.ts`: the Overview's tiles (`glance`:
  people, food, spirits, treasury, stores, building, studying, workshops, trips, shops, the age, a raid when one comes),
  each a tap through to its menu and tab (`goTo`); the Buildings tab lists what stands (`inTown`, grouped: the seat,
  homes, shops and inns, fields, pens, workshops, defences, stores, the rest), each card naming its owner and opening on
  its keeper, residents, crop or herd, holdings and sickbeds, with **Show on the map** (`showOnMap`: the strip's
  `__showOnMap`, the menu closed; also on a person's page); the old catalogue is the Building book under it. The Market's
  Shops are a card each (keeper, owner, renown, yesterday's takings, Step inside), its Animals the pens' herds and the
  horses. Per-people tab names in `PALETTES.labels` (theme.ts: the Town is the Necropolis, Grove, Domain, Den, Colony,
  Hold, Harbour, Camp, Glade, Works or Keep). The research queue's bars have a line of their own (`.queue-row > .bar`), and
  a menu's own filters (the stores' kinds) are small chips, not more tabs. The notes above that name the Plan, Crafting
  or Trade tabs mean these.
- **The annals: the year's chronicle and the hall of heroes (the owner's ask):** `src/shared/sim/annals.ts`. Everyone who
  dies is remembered (`recordFallen` from `killPerson`: `s.fallen`, name, day, cause, calling and level, titles, raiders
  felled, trips; up to `FALLEN_MOST`); each townsperson counts the raiders they struck the last blow on
  (`Person.felled`, from the recap's `credit`); raids are tallied for the year as they end (`tallyRaid`,
  `s.yearRaids`). At midwinter (`annalsHourly`: winter's `CHRONICLE_DAY` 2 at `CHRONICLE_HOUR` 19) `writeChronicle`
  tells the year since the last one (`s.yearStart`): the town's size then and now, births, newcomers, the lost and how,
  the raids, the year's champion, what was learned and built, a new age, tales ended, treasures won; kept in
  `s.chronicles` and put to the player as a `debrief`-kind prompt (the event box, with a winter picture). The
  Chronicle menu's **Heroes** tab (`panel/heroesPanel.ts`, `snapshot.annals`: the famous living, the chronicles, the
  fallen) sits beside the Bestiary; the menu's tabs now show even before anything has happened. Tests:
  `test/annals.test.ts`.
- **Rival towns on the world map (the owner's ask):** each power of the realm has a town of its own (`Faction.folk`,
  started at `FOLK_START`, older saves given one by their strength in `realm`), growing each day (`growTowns` in
  factionsDaily: `FOLK_GROWTH`, quicker in trade or alliance and slower at war or as a vassal, `FOLK_GROWTH_BY`; up to
  `FOLK_MOST`), shrinking when its host is broken (`FOLK_HOST_LOST`) or its stronghold stormed (`FOLK_STORMED`), and
  gone when razed. Its size (`townTier`, `TOWN_TIERS`: camp, village, town, city, capital) is on the world map (the
  stronghold's mark grows with its tier: a tent, a hut, a tower, a crown; the label "Stronghold · city") and the Realm
  card ("a city of about 120"). Test in `test/factions.test.ts`.
- **Ground under the fights' feet (the owner's complaint: they walked on nothing):** the backdrops with nothing at foot
  height (the cities, futures, industrial, steampunk and ruins skylines, the moons, the mountain lake, the open sea with
  no bed) get a strip of side-on tiles along the foot (`GROUND_OF` in `art/fightGround.ts`: earth, brick or metal,
  greyed, dimmed or toned to sit in the scene by `groundFilter`), drawn by fightView over the backdrop in full mode
  (`ground`, from `GROUND_LIFT` below the horizon line) and scrolled with the march. A new backdrop with no ground needs
  an entry there.
- **Shop exteriors reworked (the owner's ask):** the small shop picture (`art/shops/gb_shop.png`) was cropped with its
  gable floating above its walls and a loose chimney beside it; it is recut from the Glassblower pack's sheet with the
  gable set on the walls (110x98). The trading post is an open market stall: the pack's red canopy (`gb_canopy.png`,
  cut by its connected pixels) over crates and sacks. Every venue has a **storefront** in every look (`STOREFRONT` in
  packBuildings.ts, drawn by `packDressing` right of the door, beside the banner): the pack's cloth awning tinted to the
  shop's colours (`Dressing.tint`, set on the sprite in mapView) over the goods of its trade: crates and sacks (general
  store), crates, a vase and barrels (emporium), chairs (furniture maker), the weapon rack and anvil (weapons), a helm and
  a chest (armour), a shelf of jars and a potted plant (apothecary), a bench and barrel (tavern), a barrel (inn), a
  wheelbarrow (trading post). The other peoples' looks keep their own buildings with the same storefronts.
- **Every people's shops from the pack (the owner's complaint: a lich town's shop was "the old build"):** the venues'
  timber pictures were only for the base, settlers and knights looks, so every other people's shops were the top-down
  painter's. Now `pickFor` (packBuildings.ts) gives any venue (`venueOfDef`) the same pack picture **recoloured** for a
  look it doesn't suit (`Pick.grade`, `GRADES`: how much colour is taken out, the colour laid over the rest and the
  brightness: the liches' grey-green and dim, the Court's blood-dark, the machines' steel, the shore's sea-washed, the
  nomads' sand, the druids' green, the fae's violet...), done once on the canvas in `pickArt` (`regrade`).
- **Every building from the packs, in every look (the owner's complaint: the code-drawn stone buildings):** any pick that
  doesn't suit a look is now drawn **recoloured** for it (`pickFor` in packBuildings.ts: `Pick.grade`, `GRADES`), not
  painted: the timber houses, trades, market, theatre, bathhouse and walls in the liches' grey-green, the Court's
  blood-dark, the machines' steel and the rest (the merfolk keep their painted stilt huts). A pick may carry its own
  `grade` whatever the look: the stone wall's stonework as `brick`, `concrete` and `force` walls and gates. New picks:
  the lean-to and hide tent are the Simple Summer pack's cottage (`su_house.png`), the longhouse the tiny-rpg-town
  pack's long house (`tt_long.png`, its inn sign painted over with its window), the apartments two of its gabled houses
  (`tt_gable.png`); the guard and bell towers the Simple Summer watchtowers; the gunsmith, cinema and university pack
  houses with their trade's things; the boatyard logs, racks and a barrel; the blood farm graves; DawnLike's pit,
  stakes and spikes for the pit trap, spike trap, caltrops, wolf trap, bramble snare and land mine; the loose
  animated-objects pack's electric coil for the Tesla coil and shield generator (`ao_coil.png`); the late plants
  (steelworks, cement works, alloy foundry, fusion reactor, cryo pod, clone vat) from the futuristic objects, the trauma
  centre as the hospital, the habitat dome the round keep in steel; and the peoples' own defences from the cave and
  village props. Still painted, since no pack has them: the war engines and turrets, the launch site, the sentry bot,
  tide-pool trap and acid sprayer. `test/packCoverage.test.ts` (`pickCovered`) fails if a building has no pack picture
  in some look; the test build loads PNGs as `empty`.
- **Allies keep their colours:** summoned, tamed and allied fighters were washed green all over on the map, the fight
  screen and the expedition pane (a summoned wolf read as a stray green monster); now an ally on the map has a green
  glow underfoot and a green health bar instead (mapRaiders.ts).

- **Nobody turns into someone else at a fight, the Shapeshifter shifts, no bundles overhead (the owner's asks):** in a
  fight a townsperson's look gains their weapon's layer, and until it loaded the map fell back to an old Craftpix hero
  sheet (a different character for a moment). Now the map tries the look without the weapon, then holds the last frame
  drawn (`Drawn.hkLast` in mapPeople.ts), and the fight screen does the same. **Shapeshifters:** a druid from the third
  stage (Shapeshifter, `STAGE_LEVELS[2]`) takes a bear's shape to fight (`shapeshifts` in data/levels.ts): melee
  (`personFighter` drops the caster's range; `defenderReach` puts them on the trail), `BEAST_HP` 1.3, `BEAST_DAMAGE`
  1.25, `BEAST_ARMOR` +0.1; drawn in their `beastForm` (the bear; see the Shapeshifter calling) on the map while in combat and the fight
  screen (`PersonView.beast`, `FighterView.beast`). Test: `test/shapeshift.test.ts`. What a townsperson carries is no
  longer drawn as a bundle over their head (`d.load` hidden); it's in their pack.

- **Taming isn't sure (the owner's ask):** `src/shared/data/taming.ts`. A beast tamer in a raid tries the nearest beast
  in reach every `TAME_EVERY` (never a boss) and may fail: `tameChance` weighs the tamer's power (`tamerPower`: level,
  calling stage, Animals skill) against the beast's might (`mightOf`: its tier from its health, `tierOf`, and its kind:
  gentle beasts easy, wild ones hard, dragon-kind hardest, `KINDS`), from `TAME_BASE` by `TAME_PER_POINT` a point, more
  likely the more hurt it is (`TAME_HURT`), less with each failed try (`TAME_WARY`, `Raider.tameTries`), between
  `TAME_LEAST` and `TAME_MOST`; a tamer holds at most `tamedMost(stage)` at once (`Raider.tamedBy`). The roll is by the
  seed, the beast, the tick and the tamer. Tests: `test/taming.test.ts`.

- **Smoother on the phone (the owner's complaint: laggy now and then at about 20 townsfolk):** measured in a 22-person
  town. The sim: `wildCells` (planner.ts) is kept for the tick and the land's version (`wildHolds` for `sourceable`), so
  a planning pass no longer scans the whole land hundreds of times (the hitch every 15 s); `findPath` keeps its costs in
  typed arrays, not maps (land.ts); anything that adds or drops a pool bumps `land.version`. Lone towns turn out exactly
  as before, five times faster. The snapshot: the shop's deals every `DEALS_EVERY` (60) ticks, the planned parties and
  the next party forming through `slow` (`SLOW_EVERY` 50 ticks) in snapshot.ts (10 ms to 4.4 ms, ten times a second).
  The phone alerts' look ahead (mobileBridge.ts) runs `LOOK_SLICE_MS` (6 ms) of a copy of the town every `LOOK_PAUSE_MS`
  (60 ms), again every `LOOK_AGAIN_MS` (5 min): it was 60 ticks every 40 ms, most of the phone's time for a minute out of
  every two. The map: `syncLand` is skipped while the land, season, art and wear are as they were, and a chunk whose
  footpaths changed is painted again at most every `WEAR_REPAINT_MS` (1.5 s), one at a time; the old LPC frame is
  composed only until a person's Himeko look has drawn (mapPeople); the ground is its own Pixi render group. Walkers
  staggering their replanning was tried and dropped (it changed how lone towns grew).

- **Gods and faith (the owner's pick):** `src/shared/data/gods.ts` and `src/shared/sim/faith.ts`. Every people keeps four
  gods (`PANTHEONS`, one for each `Domain`: harvest, hearth, war, sky; `DOMAIN_DEFS`: what pleases and angers them, what's
  offered). `s.faith` (`FaithState`: favour -100..100 a god, the latest signs). Each morning (`faithHourly` at `FAITH_HOUR`,
  autopilot on) every god's favour drifts toward nothing (`FAVOUR_DRIFT`), sinks `NEGLECT` with nowhere to worship, rises by
  the places of worship standing (`WORSHIP`: wayside shrine, temple from Masonry, cathedral from Guilds; `FAITH_BUILDINGS`,
  chained in UPGRADES; pictures the cave altar, the mage tower and the stone keep) and the pious (`PIOUS`); the town lays an
  offering before the least pleased (`offer`, needs an altar) and keeps a rite every `RITE_EVERY_DAYS`. It raises its first
  shrine itself at `SHRINE_PEOPLE` grown-ups (or when a god turns ugly) and rebuilds it grander with the makings twice over
  (`buildForGods`; the planner's own loop leaves them alone: `NEVER`). A god at `BLESS_AT` may bless (a lever mark for a
  day, a holy light: `god:bless` in spellLooks), at `WRATH_AT` strike (`smite`: blight on the fields, a sickness, arms
  failing and raiders sooner, or lightning firing a roof and killing whoever it finds out of doors, `LIGHTNING_KILLS`).
  Rolls are the seed's own. The Town menu's **Faith** tab (`panel/faithPanel.ts`: the gods with favour bars, tap for what
  they want; the signs) and a Gods tile on the overview (`snapshot.faith`). Tests: `test/faith.test.ts`.

- **Natural disasters on the map (the owner's pick):** `src/shared/sim/disasters.ts` (beside the old unseen dooms of
  doom.ts). From day `DISASTER_FIRST_DAY` (5), one every `DISASTER_EVERY` (6 to 10) days (`s.nextDisaster`; autopilot on;
  the seed's own rolls), of what the land and season allow (`possible`): a **flood** climbs out of the river or sea a ring
  of cells an hour (`floodRise`, `FLOOD_RINGS`, one fewer once the sandbags are up), spoiling the fields' crops, a share
  of the stores and of the herds, and drowning who it rises over (`FLOOD_DROWNS`; never a swimmer or the dead), lying
  `FLOOD_HOURS`; a **wildfire** runs through the woods a cell an hour (`fireSpread`, `FIRE_SPREAD`, less in rain and with a
  firebreak), burning them to grass that grows back (`noteCleared`), catching what stands beside it (`setFire`) and
  whoever's in it; a **tornado** crosses the town in `TORNADO_TICKS` along `Disaster.path`, felling what it passes
  (`TORNADO_FELLS`, `demolish`) and throwing people (`TORNADO_KILLS`); an **earthquake** shakes (`s.bossShake`: the
  screen shakes), brings buildings down (`QUAKE_FELLS`, half with Masonry) and crushes the unlucky, with aftershocks for
  `QUAKE_HOURS`. Never the seat, a castle room or the fire. The town's crew goes to it (`crew`: the events' `s.busy`,
  sandbags at the shore or a firebreak at the woods). Drawn by `map/mapDisaster.ts` (`snapshot.disaster`,
  `DisasterView`): flood water rippling over the cells, the Fields pack's campfire frames as flames on the woods alight
  (in `over`), scorch and ash fading over two days (`s.lastDisaster`); the tornado and the dust are spell looks
  (`disaster:tornado`, `disaster:dust`). Tests: `test/disasters.test.ts`.

- **The living world map (the owner's pick):** `src/shared/sim/worldLife.ts`. The realm goes on beyond the town:
  `s.feuds` (two powers fallen out: `FEUD_START` a hundred mornings, at most `FEUDS_MOST`, ending on `FEUD_END`) and
  `s.marches` (`worldHourly` at `WORLD_HOUR`, autopilot on): each feud sends a host from one stronghold on the other
  (`MARCH_HOURS`), and the loser of the strike loses `STRIKE_LOSS` of its troops and half that of its town; a power in
  trade or alliance sends the day's caravan down the road (`TRADE_HOURS`), which the Red Brotherhood may rob
  (`ROAD_ROBBED`, half with two guards or more). A power at feud musters hosts against the town half as often. Realm
  news goes to the Journal. `snapshot.world` (`worldView`: the marches, a war host coming for the town placed by its
  arrival over `HOST_WARNING_HOURS`, an envoy riding in, the feuds) is drawn on the Expeditions world map
  (worldMapView.ts: tokens along the roads, `.map-march`, the host's road dashed red, crossed swords between powers at
  feud, `.map-feud`) with a line of the news under it. Tests: `test/worldLife.test.ts`.

- **Dynasties and legacy (the owner's pick):** `src/shared/sim/legacy.ts` and `src/renderer/legends.ts`. When a new
  town is founded over an old one that stood at least `LEGEND_LEAST_HOURS` (fallen, won or set aside), the phone page
  (mobileBridge.ts `newGame`) keeps it as a **legend** (`legendOf`: the founder, people, age, the dead, its fate, its
  three greatest heroes living or fallen, an heirloom (a unique held, else the founder's weapon), renown, the
  generation and the line) in `localStorage` (`littletown.legends`, the last 40). The New Town screen's last step has
  **The founder's line** (newGamePanel.ts `lineage`: a new line, or a descendant of a legend; `heir` in the options,
  read by the bridge): `inherit` gives the heirloom into the stores, `INHERIT_COINS` a generation, `INHERIT_RENOWN` of the
  old renown to the venues, a proud mark, and `s.lineage` (the line's name, its generation). The Chronicle's **Legends**
  tab is the Hall of Legends (`panel/legendsPanel.ts`, each card opening on its heroes). The desktop app keeps no
  legends yet. Tests: `test/legacy.test.ts`.
- **Previews:** `window.__disaster(kind)` starts a disaster (mobileBridge.ts), beside `__raid`.
- **Tactics battles (the default raid; the owner's ask, after FF Tactics):** `src/shared/sim/tactics.ts` and
  `src/renderer/tactics/tacticsView.ts` (`TacticsScene`). Every raid is fought on a board unless `s.battleStyle` is
  `'trail'` (the Town menu's Raid battles row; the tests' `plainGame` sets the trail). The board (`makeBoard`: `BOARD_W`
  x `BOARD_H` 17x14, 21x17 for a host or a crowd) is cut from the land round the gate, with **no buildings on it** (the
  owner's call): heights by ground and a stronger relief (`ROLLING`, `RELIEF`), the land's woods as cover (`COVER`), traps
  on their tiles (and off-board ones laid across the way in). **The town's edge is its wall:** one column across the
  board at the gate's row (`townWall`: the ring's wall, else the best built, else a palisade), a raised rampart the
  town's fighters stand on and raiders can't cross, with a gate two tiles wide in the middle (`TacTile.wall`, `.gate`);
  the town's towers stand on it out from the gate (`TacTile.bld`); raiders find their way round to the gate (`wayIn`, a
  distance field). **Every battle's field differs** (`lieOfTheLand`, seeded by the tick: `makeBoard(..., salt)`): rises
  and hollows, boulders nobody crosses (`block: 'rock'`, `BOULDERS`), thickets for cover (`bush`, `THICKETS`). Drawn with
  the pack's wall and gate pictures (`MapView.wallPicture`, two runs of stakes a tile so the line stands unbroken), the
  map's rock and bush props (`MapView.propKind`), and tile tops from the ground painted with the fog lifted
  (`MapView.clearGroundOf`), since the board reaches past what the town has seen. **Turns** by a CT clock (`statsOf`: speed from Dexterity or the
  raider's quickness; move 3 to 5 and jump by Dexterity and weapon); a turn is a move and an act in either order, then a
  facing; blows from the side `SIDE_MULT` and behind `BACK_MULT`, from above `HEIGHT_STEP` a step (`blowMult`); rain and
  night spoil shots (`RAIN_MISS`). **Every spell and skill has its own reach and area** (`src/shared/sim/tacticsArea.ts`,
  `areaOf`, worked out from whom its effects touch, spell or skill, an ultimate, and what its name says: one tile, a
  cross, a 3x3 or 5x5, a line out from the user (lances, bolts, charges), all round the user (whirls, cries, quakes), or
  self; a weapon art reaches as far as the weapon; `aimTiles` where it may be aimed, `areaTiles` what it touches,
  `areaLabel` for the menu). Of the 469 actives: one 153, 3x3 76, self 74, cross 74, all round 55, lines 36. An act for
  one cast over a wider area touches all in it at `SPREAD_POWER` (0.75). It is cast at a tile (`TacAct.at`, the
  `skill` order's `at`), lights its area as it falls (fx `area`), and the town picks what to cast and where by scoring
  every tile in reach (`bestCast`: foes hit, the hurt mended, a hindrance on two or more; an ultimate first). On the
  board: Attack shows the weapon's range faint (`orders.attack`); a skill shows where it may be aimed faint and, at the
  first tap, where it would fall bright ("tap again to use it"; one that falls round its user is aimed at once). Towers and engines take their own turns (`TOWER_SPEED`). Blows go through
  `defenderAttack`/`attackPerson` (the town's ground `GROUND`, the raiders' blows times `guardOf`: 0.6 for one or two
  defenders, 0.7 to four, `HOME_GUARD` past), so wounds, deaths and the recap are as in any raid. **FFT's rules:** a
  townsperson struck down has a count of `DOWN_COUNT` (3) of their turns, then is lost (the founder held at 1); a friend
  may tend them (`TENDED_HP`); a fallen raider may leave a chest (`CHEST_CHANCE`: coins, now and then a medkit); a raid with
  a chief (`chief`: a boss, the kind's leader, or a chief by name) breaks when the chief falls ("Defeat X!"); raiders come
  in waves (`WAVE_LEAST`, `WAVE_PER_FIGHTER` a fighter; "Reinforcements!"), rout at `ROUT`, and reaching the town's end
  of the board are through. **Orders:** with Auto off (`s.tacticsAuto`, the `tactics` command: auto, move, undo,
  attack, skill, tend, wait) each townsperson's turn waits (`Tactics.await`, `AWAIT_TICKS` 40 s, then the town plays
  it): Move (reach in blue), Act (Attack, Tend, the kit's skills by page with cost), Undo, Wait (an earlier next turn).
  Never in the catch-up, alone, or with the autopilot off. When the raid ends (`endRaid` → `tacticsOver`) the board stays
  up 4 s with Victory or the raiders' flight across it (`s.tacticsEnded`). **Drawn** isometric: each tile a column of
  the map's own ground, the map's trees (`propOf`), MapPeople and MapRaiders on the tiles; marks
  for reach, targets, path and rings; arrows and tower bolts as arcs; the act sheets (`actSprite`) with a ring under the
  caster; an ultimate shakes the board; numbers bounce (green for healing); night shades it. The HUD: the objective and
  conditions, the turn order down the right, the ability's name box, the banner, whose turn and the target as unit boxes,
  the orders bar, Auto and speed. Taps go through `boardPress`/`tap` in main.ts; a drag pans. Balance (16 lone towns,
  10 days): 2.33 people against the trail's 2.25. Tests: `test/tactics.test.ts`.

- **Bigger trees and bushes (the owner's complaint: "so small"):** the land's prop sets are cut larger
  (`GROW` in tools/compose-props.cjs, `PROP_GROW` in art/props.ts: trees 2x, bushes 1.7x, rocks 1.4x, plants 1.5x; the
  places and the sea set unchanged), so a tree stands two or three people tall; the tactics board divides by
  `PROP_GROW` to keep its tiles' size. A wood's cells get undergrowth too (`UNDERGROWTH`, `UNDERGROWTH_SHARE` 0.6: a
  bush or plant beside the tree; none when `calm`), and the grass a second tuft or flower on some cells. A tree with a
  townsperson, raider or traveller behind it, or a building's front, is drawn see-through (`MapView.seeThrough`, from
  main.ts per snapshot, `SEE_THROUGH` 0.42).

- **The living land (the owner's ask: "a huge fun immersive upgrade"):** renderer only, none of it on a slow phone
  (`calm`). **Wild beasts** (`map/mapWildlife.ts`, `MapWildlife`, fed by main.ts beside the birds): deer with a stag,
  boars, a fox, a squirrel, now and then a bear by day; wolves by night; camels in the desert, snow foxes in the tundra
  and winter; only wolves on the liches' and vampires' land (`wildChoices`). DawnLike's Quadraped, Dog and Rodent cells
  (`art/wildlife.png`, `tools/compose-wildlife.cjs`). They come out on the wild ground in view (never within `KEEP_OFF`
  of a building or two cells of a road: `MapView.nearBuilding`), graze, wander after their leader, and bolt from anyone
  within their `shy` reach (a deer bounding, the herd with it), fading out; none during a raid or a storm; up to `MOST`
  (9). `window.__wildlife` for previews. **Wind:** `WIND` by weather; the trees and bushes in view lean on their own beat
  with gusts running across the woods (`MapView.sway`, the sprite's skew about its foot, `SWAY_TREE`/`SWAY_BUSH`).
  **Cloud shadows** (`cloudShadows`, `CLOUDS` 3 clear / 7 cloudy, `CLOUD_DARK`) drift over the land by day in fair
  weather (`cloudLayer`, over the things). **Falling leaves** (`fallingLeaves`, `LEAF_RATE`, `LEAF_TINTS`): blossom in
  spring, a few in summer, many in autumn, dead ones on blighted land, from the trees in view, spinning down with the
  wind and lying a while. **Autumn colours:** the broadleaf trees and bushes turn gold, orange, rust or half-turned
  (`autumnTextures` in art/props.ts, `TURNS`; the evergreens in `art/propEvergreen.json`, written by
  compose-props.cjs, keep their green). A look missing its skin colour no longer throws in `hkLayers` (`rgb` in
  hkFolk.ts: an envoy's once stopped the map's frame loop). Test: `test/wildlife.test.ts`.

- **Deep winter and tracks in the land (the owner's ask: a gigantic overhaul):** renderer only, the rules pure in
  `src/renderer/map/ice.ts` (`freezes`, `iceAt`, `trackGround`, `trackLife`, `breathShows`). In winter narrow water
  (`ICE_NARROW`: a river, a stream, a pond) freezes over (groundArt.ts: pale ice bright at its banks, clear black patches,
  forking cracks, drifts and glints, `paintIce`); water wide both ways (the sea) stays open; fish don't leap and rain
  doesn't ring on ice (mapWater.ts), and iced water is silent in the soundscape. **Footprints** (`map/mapTracks.ts`,
  `MapTracks` in `under`, fed by main.ts each snapshot with the townsfolk, travellers, raiders and the wild beasts'
  `walkers()`): a boot print left and right every `STRIDE`, turned along the way walked (paws for beasts), lasting 90 s
  in snow (25 while more falls), 12 in sand, 40 in the rain's mud, never on roads or rock; up to `PRINTS_MOST`.
  **Breath** shows as a puff drifting up from each head in winter, the tundra and autumn's small hours (never the dead or
  machines). Steps in snow and mud are heard (`crunch`, `squelch` cues in ambience.ts). None of it on a slow phone.
  `window.__tracks`, `window.__centre(x, y)` for previews. Test: `test/winter.test.ts`.
- **The town's animals (the owner's ask: something massive):** `src/renderer/map/pets.ts` (pure: `petsOf(home,
  people)`: by the home's id, `DOG_SHARE` a dog, `CAT_SHARE` a cat, `HEN_SHARE` two to four hens with now and then a
  rooster, each named; the liches and the Court keep only black cats, the machines nothing; `petLine` for the card) and
  `map/mapPets.ts` (`MapPets`, in `things`, fed by main.ts each snapshot with the homes people sleep in, who's about and
  the raiders; DawnLike's Dog, Cat and Avian cells appended to `art/wildlife.png` from column `PET_COL` 14 by
  tools/compose-wildlife.cjs). A dog lazes by its door, noses about, trots at the heels of the people of its house when
  they pass (`follow`), sleeps by the door at night and runs out barking at raiders ("Woof!", "Grrr!"); a cat washes on
  the doorstep, strolls, prowls further by night and bolts from a dog ("Hsss!"); hens peck about the yard, scatter from
  feet and go to roost at dusk. Tap one (`Hover` kind `pet`) for its name and what it's doing, and **Scratch behind the
  ears** (a happy hop and a heart). Barks, mews and clucks are heard (ambience.ts cues). Shown on a slow phone too,
  without the floating words. `window.__pets` for previews.
- **Weather seen from above:** `src/renderer/map/mapSky.ts` (`skyFor`, pure: fog in fog weather and thin mist on spring
  and autumn mornings; a sandstorm in the desert's cloud, rain and storms; a blizzard when a third of the winter's snow
  spells blow up (`spell`) or a storm comes to the cold; heat haze over the desert's clear summer noons). `MapSky`: fog
  banks drifting on the land (in MapView's `over`) and a pale cast, an ochre cast with sand streaks and tumbling dust
  clouds, a white cast with snow driven sideways, shimmering bands; each eases in over some seconds. The wind howls
  with them (ambience). `window.__sky.force` holds one for previews. Tests: `test/pets.test.ts`.
- **The Dragon (the owner's ask: something massive):** `src/shared/sim/dragon.ts` (`dragonTick` from sim.ts, every
  tick for its flight and hourly for the rest; the autopilot on, `s.dragons !== false`). Each game seed picks a fixed
  arrival day from `DRAGON_FIRST_DAY` (20) through `DRAGON_LAST_DAY` (100); once that day is reached and
  `DRAGON_PEOPLE` (6) grown-ups are at home, a dragon comes (`dragonArrivalDay`, `summonDragon`; `dragonFor` the land: the
  Rimewyrm on the tundra, the Ashen Wyrm in the desert, else Vermithrax the Red; `s.dragon`, `DragonState`). **Omens:**
  `OMEN_FLIGHTS` (3) high flights `OMEN_HOURS` apart, its vast shadow sweeping the land. **The demand:** it lands on the
  hill and asks tribute (`tributeOf`: a share of the treasury and the town's size, `RAISE` more each time paid), a
  prompt of kind `dragon` in the event box: pay, give half the herds, or refuse (left alone: paid if the treasury can,
  else the herds, else refused; `answerDragon` from `answerPrompt`). Paid, it comes back in `RETURN_DAYS`. **Wrath:**
  refused, every `WRATH_HOURS` it makes a pass low over the town (`Flight`, `PASS_TICKS`): at its middle (`pass`) it sets
  one or two roofs under its line alight, snatches a beast from a pen, and burns whoever is out of doors within
  `BURN_REACH` cells (`BURN_CHANCE`, `BURN_KILLS` dead, else a burn wound); every defence engine (`ENGINE_MULT` its blow)
  and everyone with a bow (`ARCHER_BASE` + level) strike back (`volley`); wounded to `FLEE_AT` it flies off for good
  (`driven`, a morale mark). After `PASSES_THEN_ASK` passes it asks again. **The lair:** `dragon:lair` on the Expedition
  Board from the demand on (`dragonDestination`, type `clear`: the dragon and two hatchlings); a party that wins there
  (`dragonHome`, from `comeHome`) slays it: the hoard (`HOARD`, `HOARD_COINS` to the party), Dragonslayer titles,
  renown to the venues, a morale mark. Drawn by `src/renderer/map/mapDragon.ts` (`MapDragon`, from
  `snapshot.dragon`: on a pass the wyvern sheet flying low over the roofs, turned to its way (`creatureFlip`), tinted by
  which dragon, its shadow racing below, a stream of fire (additive embers) poured down over the middle of the run; on
  an omen its shadow only), and a roar (ambience.ts `roar` cue) as each flight begins. `window.__dragon(kind?)` summons
  one (previews). Tests: `test/dragon.test.ts`. (The snapshot's planned party no longer throws when someone in it has
  died since it was planned: `partyView`.)
- **The wide land (the owner's ask: a much larger map):** `LAND_W`/`LAND_H` are 192 (four times the old 96x96, `OLD`).
  **The home vale is the land a seed always had:** `makeLand` samples its noise, traces the river, lays the shore,
  the mountain's foot and the pools over the old box about the camp first and in the old order, so everything within
  `VALE_R` (40) of the camp is as before (the tests and the balance hold); beyond it the land is cut into **named
  regions** (`src/shared/sim/landRegions.ts`: `layRegions` puts eight countries in a ring round the vale, every kind
  once: `oldwood`, `fen`, `barrens`, `meadows`, `lake`, `highlands`, `heath` and one more; `REGION_DEFS`: each a wild
  share, multipliers on the biome's mix of wild kinds, rich soil for the meadows, a lake at a lake's heart (an oasis
  in the desert), the finds it favours, and name pools with desert and tundra spellings; names by the seed: "the Grey
  Barrens", "Larksmeadow", "Stillmere"). Each region ranks its own cells for its wild share (`rankIn`), so it has
  exactly that much wild wherever the broad noise lies; `regionAt` finds a cell's region (the vale by plain distance,
  its rim and the other borders warped by noise); `LandMap.regions` and `seedHash` are saved (an older, smaller land
  has none: `regionOfCell` gives null). **Living on it:** `OPEN_MAX` 86 (the known land may spread over most of it);
  a town ranges for a missing material only to `OPEN_FAR_BASE` (40) + `OPEN_FAR_PER_PERSON` (3) a grown-up
  (`openLand`: a lone founder once opened it all and walked a day for a log); `PLACE_COUNT` 32 places out to
  `PLACE_FAR` 88, each region favouring its own (`REGION_DEFS.places`: lairs in the old wood, veins in the barrens,
  caves in the highlands, bones in the fen, carts and ruins on the meadows), and a find is named with its region
  ("Old ruins found in the Grey Barrens, to the north-west"; `inRegion`); strangers come and go at the fog's edge on
  the camp's row (`edgeXY`), not the map's far edge. **Seeing it:** a **minimap** (`src/renderer/map/minimap.ts`,
  `Minimap`, a canvas in the strip's top-right corner, under the phone's clock bar: the ground in its colours, the
  fog, buildings, people white, raiders red, places gold, the view framed; tap to look there; × hides it and the
  phone's ☰ menu has "Minimap: on/off" (the owner's ask: the Map button that once took the corner was missed;
  `window.__minimap.shown`, read by mobile.ts), kept in `littletown.minimap`), and a **region caption** (`#region-name`, main.ts: the name of
  the region under the middle of the view, shown a few seconds as the view crosses into it); a cell's tap card names
  its region. Tests: `test/land.test.ts` (the wide land).
- **The news bubble (the owner's ask: no feed over the town; a bubble at the right, opened to review and act, the
  news told apart by colour as RimWorld's letters are):** `src/renderer/mobile/notices.ts`. The pure part:
  `situationNotices(snapshot)` (what is going on now: a raid, a war host, a doom, parties out, places found, the last
  raid's report, the last answer's outcome, a question waiting), `journalNotices(entries, snapshot)` (the Journal's
  latest lines, `CHATTER` left out, each with who or what it is about: `aboutOf`), each with a stable `key` and a
  `Tone` (`toneOf`: **red** threats and losses, **gold** what wants the player (a question, a stranger at the gate, a
  caravan, a quest, a place found, an outcome), **blue** the rest), and `worst`. `startNotices` puts `#notice-bubble`
  on the page (right edge, mid-height: clear of the minimap and the strip's pop-ups; the count of keys not yet looked
  at, coloured by the worst of them, pulsing red; hidden when there's nothing new, in a menu, a battle or an event) and
  `#notice-sheet` (full screen: every notice, the new ones bright, its tone down the left, a picture from the strip's
  `__picture`, and a button that acts: Watch a party, Trips, the raid report (`__showRecap`), Show them/it on the map
  (`__showOnMap`), a question's card on the town; The Chronicle at the foot). Closing marks everything shown as read
  (`littletown.noticesRead`). The old `feed.ts`, its grip (`#map-grip`, `littletown.mapShare`) and `townShare` are gone:
  upright, the map has the whole room under the title bar. Tests: `test/notices.test.ts`.
- **A button pass (the owner's ask: every button checked):** a Playwright crawler clicked every button of every menu,
  sub-tab and view (about 500), the clock bar, the tap cards, the event box, both battle bars, the fight screen, the
  venue windows and the New Town wizard, watching for commands, redraws and errors. Found and fixed: the minimap's ×
  hid the map on pointer-down and the Map tab under it took the tap's click (hide on click now); a feed row's "Show it
  on the map" for a building no longer standing did nothing (now the button only comes when the thing is on the map:
  `onMap`); the Stores' kind chips (Weapons, Armour...) didn't redraw (`invTab` is in `craftingKey`); a tapped skill, spell or
  trait on the Townsfolk inspect page opened no card for the same reason (`chosenSkill` is in `townsfolkKey`).
- **Ten lands (the owner's ask: more and more diverse biomes, with the asset packs behind each; the game is played
  upright on the phone, so only that layout is checked):** `src/shared/data/biomes.ts` has six more biomes beside
  the forest, desert, tundra and coast: the **fenlands** (`swamp`: marsh and black pools, a broad river banked in
  marsh, mist of a morning, rich foraging, fevers; crocodiles, slimes and the swamp's crawlers), the **jungle** (dense
  wood and rich soil, everything grows; apes, cats, satyrs, the swamp's things too), the **highlands** (crag, scree
  and hill, a cold land; cave things and eagles, riders and wild dogs), the **ashlands** (open ground is cinders
  (`open: 'sand'` in a grey palette), lava-rock, a red sky, dust and haze; fire and the charred dead, meteors and ash
  winters), the **steppe** (open grass, a dry land with dust storms; lions, hyenas and jackals, horse-riders, more
  caravans) and the **taiga** (pine and snow; wolves, bears and the beasts of the snow). A `BiomeDef` now carries
  what the land is made of (`open`, `wildShare`, `river` width, `banks`: `makeLand` reads them where it once asked
  "is it the desert"), climate flags (`cold`, `dry`, `hot`, `wet`: the renderer reads them through `biomeById` for
  snow and breath, dust and dry trees, heat haze, morning mist and the ambience, so a new land needs no new switch),
  its menagerie `habitats` (the lairs' and its own raids' creatures: `placeHabitats`), its fight-scene `scenes` swaps
  (`sceneFor`), its ground `look` (`BIOME_LOOKS` in map/groundArt.ts: the patches and plain colours of each kind,
  and the ashlands' own sand and rock) and its wild `props` sets. **Fights everywhere look like the land:** four new
  scenes `fen`, `jungle`, `ashland` and `steppe` (data/scenes.ts, painted recipes in art/fightBackdrop.ts) with their
  own packs' backdrops (the forests and the jungle battleground, the wastelands and the fire sky, the meadows and the
  open plains), so the four lands' parties fight in new places. **Creatures by land:** the menagerie's swamp and fire
  creatures left the general raid pool for the fens' (`m_fen`: fens, coast, jungle), the ashlands' (`m_ash`) and the
  crags' (`m_crag`: cave and sky, highlands) own raids, the ice's reach the taiga and highlands and the dunes' the
  steppe; the lions, wild dogs, crocodiles, satyrs and steppe riders range over the lands that suit them; each land's
  lairs hold its own beasts (`BIOME_BEASTS`). Region names take each land's spellings (`alt` in landRegions.ts); the
  dragon of the taiga is the Rimewyrm, of the ashlands the Ashen Wyrm. Tests: `test/biomes.test.ts` (each land's
  shape, raids, lairs and creatures), `test/scenes.test.ts` (every look's backdrop exists).
- **Life on the water and in the sky (the owner's ask, after the living land):** `src/renderer/map/mapWater.ts`
  (`MapWater`, fed by main.ts beside the wildlife; renderer only). Ducks (mallards, a grey duck, now and then a swan
  pair) paddle the rivers, lakes and shallows in view in a line astern, with a V wake, turned back at the bank and
  hurrying off from anyone within `DUCK_SHY`; by day, never in winter or the tundra or a storm (`DUCKS_MOST` 7). Fish
  leap from the water with a splash ring at each end (`FISH_EVERY`). Rain and storms ring the water (`RINGS_MOST`).
  In a storm lightning strikes every `STRIKE_EVERY` (5 to 14) s: a jagged forked bolt to a point on the land (in
  `over`), a ring where it lands, and the screen lit with a double flicker (`flash`, in `map.root`). When the rain
  clears by day a faint rainbow arches over the view for `RAINBOW_SECONDS` (75). The birds and fish are DawnLike's,
  appended to `art/wildlife.png` (columns 9 to 13, `tools/compose-wildlife.cjs`). `window.__water` (`strike()`,
  `showRainbow()`) for previews. On a slow phone (`calm`) only the flash stays.

- **The soundscape (the owner's ask: "a huge update or overhaul"):** `src/renderer/ambience.ts` (`createAmbience`) makes
  the land's sound in the browser with the Web Audio API, no sound files: beds of filtered noise for the wind (swaying,
  brighter as it rises), the rain, the river or sea and the fire, and calls scheduled at random: birdsong (chirped
  sine phrases) by day, crickets, frogs, owls and wolves (a sawtooth howl with vibrato) by night; cues `chop`, `mine`,
  `build` from up to three workers in view (panned by where they stand), `thunder` a moment after each lightning flash
  (`MapWater.onStrike`), a war `horn` as a raid turns active, a duck's `quack` now and then. How loud each is comes from
  `ambientMix` (`src/renderer/ambienceMix.ts`, pure: the daylight, season, weather, biome, the shares of water and wood in
  view, the blight, a raid quietening the living things, the camp's fire in view), worked out by main.ts each snapshot.
  It plays with the music: the ♪ button ("Sound and music") turns both on; silent while the strip is hidden; the first
  touch wakes the audio where the browser holds it asleep. `window.__ambience` for previews. Test: `test/ambience.test.ts`.

- **Combat effects from the 5000 Pixel Effects pack (the owner's ask: the assets used well in fights, with a variety
  that fits, magic above all):** `tools/compose-pixelfx.cjs` (run by hand; Playwright's Chromium) packs the pack's
  every element in every shape (15 elements × 30 families: hit, burst, slash, bolt, orb, explosion, aura, sparkle,
  shield, circle, pillar, rain, vortex, wave, puff, status, debuff, spikes, spread, cross, smoke, splash, strike,
  flame, nova, gather, cut, rune, pool, glyph; and the neutral white and gold ones, 500 strips of six 32px frames)
  into `src/renderer/art/effects/pixelfx.png` (beside the page as `fx/pixelfx.png`, copied by both builds) with
  `pixelfx.json`. `src/shared/data/actFx.ts` (`actFx(id)`, pure, tested) picks each spell's and skill's effect: the
  pack's element for the game's (`PX_ELEMENT`: holy→light, nature→forest, arcane→star, time→moon, sound→crystal...)
  and the shape from what the name says (`HINTS`: a "rain" rains, a "nova" rings out, a "ward" is a bubble shield, a
  "volley" spreads) else from what it does (`shapeOf`: mends sparkle, summons open a circle, curses' arrows fall,
  single strikes are bolts, orbs or hits, strikes on all explode, wave, rain or pillar); ultimates keep the big
  Craftpix and pvfx sheets (`ULTIMATE`), a plain weapon art is a Craftpix slash. Ids are `px:<element>-<family>`;
  `SpriteFx` (town/spellLooks.ts) is the old `SheetFx` union or a `px:` id, and `sheetOf(fx)` in town/spellsView.ts
  resolves either (the fight screen, the raid map, the tactics board and the map's spells all go through it; a strip
  the atlas lacks falls back to the element's hit). `art/effects.ts`: `pixelFxFrame`, `loadPixelFx` (lazy, cut on
  first use). Test: `test/actFx.test.ts` (every act has an effect in the atlas, over 20 shapes, none dominant).
- **Class paths (the owner's ask: eight basic starting callings, a choice of two roads at every evolution, many very
  specific callings with skills of their own, and the choice put to the player):** `src/shared/data/paths.ts`
  (`PATHS`: 184 nodes; `BASE_PATHS` the eight: Fighter, Guard, Scout, Rogue, Apprentice, Acolyte, Wanderer, Minstrel;
  each forks two ways at stage 1 (level 12), 2 (30) and 3 (55): 8 → 16 → 32 → 64, and each stage-3 node has one
  ascended form (85, an ascension as before): `branchesOf`, `lineage`, `pathStage`). Every node stands on an
  **archetype** (`cls`: one of the 26 classes, which keep their gear, spells, skills, outfits, hero forms and
  attribute growth), with a name, a line of text, for the callers a `companion` (a Beastcaller's lion, a Conjurer's
  salamander: `companionOf` in sim/classes.ts, scaled by the caller's level in `classAllies` and `summonForRaid`) and
  for the Summoner line `stats` (`GLASS`: hp 0.6, power 1.7: the glass cannon). `src/shared/data/pathSkills.ts`: a
  signature skill for every node from stage 1 (112 rows, `PATH_SKILL_ROWS`), known by whoever stands on the node or
  past it (`AbilityDef.path`; `abilitiesKnown(cls, level, road)`; the ascended forms share `ASCENDANCY`); the
  Summoner line's call up elementals, demons (`brute_demon`, `red_imp`), drakes and the Behemoth. `Person.road` is
  the node (`cls` its archetype; founders keep their own lines and no road); `stageOf` is the node's stage,
  `classStat` takes the node's stats, `callingName`/`callingText` the lineage's names and text. `assignClass` picks a
  base by the skills' fit; `adoptPath` gives an older save's townsperson the node of their class at their stage.
  **Evolution:** `roadsOpen` (the level reached; the last form an ascension too), and in `classesHourly` either a
  prompt of kind `evolve` (`askEvolve`: the two roads and "Let them choose", a picture, `Prompt.roads`, the default
  after `EVOLVE_ASK_HOURS` 24; `answerEvolve` from `answerPrompt`, the outcome told in the box) or, with
  `s.evolveAsk` off or the autopilot off (the tests), their own choice (`chooseRoad`: the archetype their skills fit,
  with a whim by the seed). The Town menu's **Callings and stats** rows set it (`setAsk` command); the Townsfolk page's
  calling row shows the road so far, the node's text and the two roads next (cards; "Become X" buttons while the
  question is open: `PersonView.road`); the news bubble carries the question. Tests: `test/paths.test.ts`.
- **Stat points and Charisma (the owner's ask):** `Attrs` has `cha` (data/attributes.ts: `ATTR_ABOUT`; each class's
  share in `GROWTH`, normalised by `classAttrs`); Charisma makes what a person summons stronger (`CHA_SUMMON`, through
  `Fighter.power`, applied in the arena's `summon` and to companions), their inflicted statuses likelier and granted
  ones longer (`CHA_STATUS`, `Fighter.charm` in actions.ts). Each level brings `STAT_POINTS_PER_LEVEL` (2) points:
  `Person.attrPts` is the record of points spent (begun at the first level gained, `beginRecord`, with what came
  before spent the class's way; a townsperson without a record is reckoned as before, `virtualSpend`), `freePoints`,
  `spendPoint`, `spendByClass`, `nextByClass` in sim/attributes.ts; `statsHourly` (from classesHourly) spends them the
  class's way unless `s.statsAsk` (then only after `AUTO_SPEND_HOURS` 48 unspent, `Person.ptsSince`, so a town left
  alone still grows). The `spendStat` command (one attribute, or null for the class's way); the Character tab shows
  CHA, a + beside each attribute while points are free and "Let them choose"; the news bubble says who has points.
  `PersonView.freePts`, `Snapshot.evolveAsk`/`statsAsk`. Tests in `test/paths.test.ts`.

- **The evolution card: story, flair and class emblems (the owner's ask, after the Final Fantasy jobs and Baldur's
  Gate's class pages):** `src/shared/data/pathLore.ts` (`FORK`: each base calling's crossroads told as a scene with
  `{name}`; `LORE`: a passage for every node but the ascended, which share `ASCENDED`; `loreOf`) and
  `src/shared/data/emblems.ts` (`BASE_COLOURS` by base calling; `COMPOSITIONS`: each node's badge layered from
  several DawnLike and Magic Items cells (the owner's ask: sprites combined): `behind` a pair of one cell crossed (one
  mirrored: swords for the Fighter's roads, spears for the Guard's, arrows for the Scout's, daggers, wands, scrolls,
  branches, flutes...), `main` the calling's own device, `charge` a small thing in a corner; a part a node doesn't set
  is the nearest up its road, `null` leaves it out; `emblemOf` adds a `GEM` for a stage-3 road and the `CROWN` for an
  ascended form; the sheets `Book`, `Music` and `Money` are in `art/items` and `IconSheet`).
  `src/renderer/art/emblems.ts` paints a node's badge on a canvas (`emblemCanvas`, `paintEmblem`: a heater shield in
  the base's colours, the device by stage: plain, a chevron, a bend, a bordure, and for an ascended form a golden field
  with rays and a glow; the rim brightens by stage, pips count it; then the parts in order once their sheets have
  loaded, each with a shadow: the crossed pair at 0.7, the device at 0.46, the charge bottom-right, the gem bottom-left,
  the crown at the top). The `evolve` prompt's `story` is the fork scene; `PromptView.roads` (`roadOf` in snapshot.ts: name, role,
  text, lore and the signature skill described) feeds the event box's own layout for the kind (`eventSheet.ts`: the
  title ruled and starred, each road an illuminated `.road-card` with its emblem, name, role, lore, skill and "Walk the
  X's road", then "Let them choose"; CSS in mobile/index.html). The People page shows the emblem beside the calling
  chip and on the two road cards, with their lore (`PersonView.roadId`, `road.next[].lore`). Test in
  `test/paths.test.ts` (lore for every node, every part on its sheet, no fork's two roads composed alike).

- **Stat points follow the road chosen (the owner's ask):** `src/shared/data/pathAttrs.ts` (`LEANS`: each path node's
  lean on its archetype's growth, inherited up the road; `roadAttrs(cls, road)` the shares the points are spent by,
  `roadFavours` the two it favours most). `nextByClass`/`spendByClass`/`virtualSpend` in sim/attributes.ts spend by
  it, so a Berserker goes all strength where a Titan goes bulk, a Beastcaller more charm than a Conjurer. The
  Character tab says "Left to themselves, a Berserker puts points into Strength first, then Vitality"
  (`PersonView.favours`). Test in `test/paths.test.ts`.
- **Clothes and hair in every pose (the owner's complaint):** the Himeko pack leaves some cells of a layer blank on
  purpose (a weapon only in the poses that hold it, bangs and beards from behind, the "top" halves), but a few
  clothes and the long hair's back are blank in a pose or two as well (the second peasant dress in the punch pose,
  the long hair's rear in a side lunge, the geisha hat past the stand), so a person went bare or lost their hair for
  a moment. `hkCell` (art/hkFolk.ts) now draws such a layer's cell from the nearest pose of the same facing that has
  it (`standIn`, `STAND_IN` order; `isBlank` reads each layer's cells once); the layers meant to be sparse (`SPARSE`)
  are left as the pack drew them. `window.__hkCell` for previews.
- **The tap card on the phone** (`#inspect` in mobile/index.html) sits over the foot of the town just above the tabs;
  it was still placed above the strip's old top edge, which is the top of the screen now (a cut-off bar).

## The Conquest update (parked; the owner's ask: win the game by owning the whole map)

- **Switched off for now (0.29.0; the owner: "remove the war feature for now and we can work on it later"):**
  `CONQUEST.on` in `src/shared/data/conquest.ts` is `false`, so there is no War tab (`PANELS` in ipc.ts), no realms
  page in the New Town wizard (`STEPS` in newGamePanel.ts: six steps), no hourly conquest (`conquestHourly` in sim.ts),
  `snapshot.war` is null (so no war notices in the news bubble), and the planner builds no training grounds. The code,
  the save state (`s.conquest` is still founded) and the conquest's tests stay: each conquest test file sets
  `CONQUEST.on = true`. `test/conquestOff.test.ts` checks the game itself has it off. To bring it back, set it true.
  The realm's powers, war hosts and assaults on the Trips tab (sim/factions.ts) are not part of it and still run.

- The owner's decisions: the game is won when every province is the town's or an ally's or vassal's (the launch and
  the Great Hunt stay); battles are squads of nameless troops led by a hero of the town, in the manner of Symphony of
  War (squads as pieces on a province grid, each clash a cutaway auto-resolved in rounds); every march is the player's
  order; the founder may go to war; losses are real, heroes and the founder harder to lose for good (struck down:
  wounded, captured or killed about 60/30/10, the founder gentler); a hero's level and gear carry a squad (a capped
  hero in mythic gear with three troops beats a green one with nine); a seventh **War** tab; nothing of it touches the
  raids, trips and quests. Built in steps: (1) the world, (2) troops and squads, (3) armies on the map and the War
  tab, (4) battles, (5) the rival realms and the alliance win, (6) soak and the win screens.
- **Step 1, the world (done):** `src/shared/data/conquest.ts` (`REALMS_MIN` 2 to `REALMS_MAX` 12, `REALMS_DEFAULT` 5:
  the town and the four powers of old; `PROVINCES_PER_REALM` 6; `worldSide` 36 + 7 a realm; settlement `TIERS`,
  `FORTS`, `YIELD_BY_LAND` (a material a day by the land), `LANDMARKS` (shrine, mine, ruins, lair, crossroads,
  harbour), name pools) and `src/shared/sim/conquest/world.ts` (`makeWorld(seed, realmIds)`: an island of noise, the
  sea and the mountains by height, one of the ten lands by warmth and wet, the coast at the shore; provinces grown by
  breadth-first from seeds thrown far apart (`farApart`), one piece of ground each, the mountains claimed last and
  unclaimed islets sunk; neighbours by shared borders, islands joined to the mainland by a harbour each side of the
  shortest strait (`joinIslands`); capitals far apart (`farApartProvinces`), each realm starting with its capital and
  one neighbour (`START_PROVINCES`); `provinceYield`). `src/shared/sim/conquest/conquest.ts`: `GameState.conquest`
  (`ConquestState`: `realmIds`, the town first, then the faction ids; `holder` a realm id or null a province); the
  world is rebuilt from the seed and cached (`worldOf`), never saved. `newGame` founds it from `NewGameOptions.realms`
  (`realmCount`), with the same rival draws the realm makes (`pickRivals` in data/factions.ts, shared with `realm()`,
  which reads the conquest's realm count; the bandits take the last place from three rivals up), so a 5-realm world
  has exactly the four powers of old. The New Town wizard's sixth page picks the realms (`realmsPage`, `.realm-count`).
  Tests: `test/conquest.test.ts`. Preview: the scratch script draws a world to PNG (worlds of 2, 5 and 12 looked right).
- **Step 2, troops and squads (done):** `src/shared/data/troops.ts` (`TROOPS`: 18 kinds by age and study, militia to
  riflemen, and one of each people's own (thralls, the bone legion, the wolf pack, constructs, ironbreakers, the tide
  guard, horse archers, glamour knights, bombardiers, templars, briar wardens); each a `kind` (melee, shield, spear,
  ranged, horse, magic, healer, skirmish, beast, siege), health, blow, guard, `ranged`/`heal`/`magic`/`quick`/`drain`/
  `walls`, and a cost in coins and a material; `COUNTERS` (spears beat horse, horse rides down archers...); `LEADS` the
  kinds a hero of each fighting role may have round them, `LEADS_TOO` beasts for tamers and siege crews for engineers;
  the formation `SQUAD_SLOTS` 9 in three rows). `src/shared/sim/conquest/squads.ts`: **the hero carries the squad**
  (the owner's ask): `heroStrength(p)` is their `personFighter` health and blows against a plain soldier's
  (`TROOP_HP`, `TROOP_ATTACK`), geometric, eased by `HERO_CURVE` and weighted `HERO_WEIGHT` (a bare level-1 fighter
  about 3.5 troops' worth, a level-30 Titan in fair gear about 16, a level-60 in the best about 45, nine militia 8.3);
  `command(p)` betters every troop's worth by level, stage and Charisma (`COMMAND_*`); `leadership(p)` how many they
  may lead (`LEAD_*`: 2 at level 1, 9 by level 55); `squadStrength`. **Raising troops:** `ConquestState.recruits`
  (from the provinces held, `RECRUITS_HOME` from the town), `train` (a batch of up to `TRAIN_BATCH_MOST`, paid from the
  **war chest** `c.chest` and **war stores** `c.goods` first (the provinces' yields go there, never into the town's
  treasury or stores: the conquest leaves the town's own economy alone), then the town's; done in `TRAIN_HOURS`, half
  with a barracks), `c.troops` by kind; `UPKEEP` a soldier a day from the chest, unpaid `DESERT_SHARE` of the waiting
  troops go home. **Squads** (`Squad`: hero, nine `slots`): `formSquad`, `setSlot` (a kind the hero may lead, within
  their leadership, from the trained troops), `disbandSquad`. `conquestHourly` from sim.ts. The `conquest` command
  (train, form, slot, disband) and `snapshot.war` (`warView` in `sim/conquest/warView.ts`: provinces, realms, recruits,
  chest, goods, troops, training, squads, heroes free to lead). Tests: `test/conquestSquads.test.ts`.

- **Step 3, armies on the map and the War tab (done):** `src/shared/sim/conquest/armies.ts`. An `Army`
  (`ConquestState.armies`: a general's squad and up to `ARMY_SQUADS` 6, `at`/`going`/`arrive`/`path`, a `train` of spare
  troops) is raised at the town's capital province (`homeProvince`, `raiseArmy`; squads join and leave at home,
  `addToArmy`/`dropFromArmy`; `loadTrain` from the trained troops). **Every march is the player's order**
  (`marchArmy(s, army, province)`: the fewest legs through free or friendly land, `wayTo`; a leg takes `MARCH_HOURS` +
  `MARCH_PER_CELL` by distance, `CROSSROADS_PACE` into a crossroads; the next leg starts on arrival and the march halts
  if an enemy has taken the way); `recallArmy` is a march home. Arriving (`armiesTick`, every tick from
  `conquestHourly`) at a free province the army takes it for the town (`c.taken` the day); a lair or another realm's
  province waits for the battle (step 4). While out of the home province its heroes are **away** (`Person.away` is
  minus the army's id, as a trip's is the trip's id: every "in town" filter holds; the snapshot names the army), and
  come home with it at the land's edge. **Garrisons** (`garrison`: `n` of the train left where it stands, `c.garrisons`
  by province; `pickUp`): a province of the town's with under `GARRISON_HOLDS` soldiers and no army, past
  `REVOLT_GRACE_DAYS` since taken, may revolt and go free each day (`REVOLT_CHANCE`, `armiesDaily`, the capital never);
  soldiers afield cost `UPKEEP_AFIELD` times the upkeep. A squad in an army can't be disbanded, nor its places changed
  while afield; a squad whose hero dies dissolves, and an army with no squad left breaks up. Commands: `conquest` ops
  `raise`, `add`, `drop`, `load`, `march`, `garrison`, `pickup`, `recall`, `dismiss`. **The War tab** (`war` in
  `PANELS`, the seventh tab, ⚔; `src/renderer/panel/warPanel.ts`; sub-tabs Map, Armies, Barracks, Realms): a canvas map
  of the world fitted to the width (the lands' colours, each realm's colour over its provinces (`REALM_COLOURS`, the
  town gold), borders, capitals as squares, lairs ☠, garrisons, bare provinces a red dot, armies ⚔ with their way
  dashed; `WarView.owners` is the owner grid as a string, `ownerAt`); tap a province for its card (land, tier, fort,
  landmark, yields, garrison, armies); "Pick to march" on an army card, then the card's "March X here". The armies'
  cards (general, strength, soldiers, train; recall, garrison, pick up, add and drop squads, load the train, dismiss),
  the barracks (recruits, chest, upkeep, war stores; Train 1 / Train 3 a kind; batches), the squads (a 3x3 formation
  of selects, the hero's worth, command and lead), and the realms. Tests: `test/conquestArmies.test.ts`. Checked upright
  on the phone.

- **Step 4, battles for provinces (done):** `src/shared/sim/conquest/battles.ts` (constants in data/troops.ts). An
  army arriving at a province held against it (another realm's, or a free lair) starts a `ProvinceBattle`
  (`startBattle`; `ConquestState.battles`): each squad a piece on a `BOARD_W` x `BOARD_H` (12x8) grid, the town's from
  the west, the defenders in the east behind their fort's wall line (`WALL_X`; `walls` = the fort's level x `WALL_HP`,
  battered by siege troops' `walls` a beat (`SIEGE_PER_WALLS`); those behind it take `WALL_GUARD` of a blow; an
  attacker at the wall line assaults over it as far as a bow reaches). One side's squad acts a beat (`BEAT_TICKS`,
  2 s), then the other's, round robin (`takeBeat`): it closes `MOVE` cells on the nearest foe or, within reach (1, or
  `REACH_RANGED` with `RANGED_SHARE` of its troops ranged), clashes: every troop's blow bettered by its hero's command
  and its kind's `COUNTERS`, melee on the front row that stands, ranged on the back, the hero's own blow (`HERO_BLOW`
  of their strength) last; menders heal; the struck squad strikes back at `RIPOSTE`; a hero's health is their strength
  in plain soldiers' (`HERO_HP`). Troops die (their slots emptied for good: nameless); a squad routs at `ROUT_AT` of
  the worth it marched in with, or when its hero falls. **A hero struck down** (`heroDown`): `HERO_FATE` wounded 60% /
  captured 30% / killed 10% (the founder `FOUNDER_FATE` 80/18/2; a lair's beasts take nobody): wounded is a cut and
  30% health; **captured** is `ConquestState.captives` (ransom `RANSOM_PER_STRENGTH` x their strength, at least
  `RANSOM_LEAST`; `Person.away` is minus a million and their id; the `ransom` op pays from the chest then the treasury;
  taking the province frees them); killed is `killPerson`. The defenders (`defendersOf`): a settlement's garrison of
  `DEFENDERS_BY_TIER` squads of its realm's own troops and the `FOE_TROOPS` (levies, town guard, town archers) under
  captains whose strength grows with the paced day (`CAPTAIN_*`); a lair's master and pack of `lair_beasts`
  (`LAIR_SQUADS`). **Won:** the province is the town's (a lair `cleared`; a free lair bars `wayTo` till then), the
  heroes gain `XP_WON`; **lost:** `XP_LOST`, the army falls back to the nearest province of the town's (home at the
  last); a stand-off past `STALEMATE_TURNS` is a loss. The recap is `c.lastBattle` (`BattleRecap`: felled, lost, the
  heroes' fates, lines). Clashes are resolved at once (auto, the owner's call for now); the cutaway on the fight
  screen is not built. **Seen:** `WarView.battle` (the board, kept 6 s after the end), `.recap`, `.captives`; the War
  tab's Map draws the board as a canvas (the wall line, each squad a piece with the hero's health bar and nine troop
  pips, the struck flashing white, the routed and fallen crossed), the latest events under it, a recap card, and a
  Ransom row per captive. Tests: `test/conquestBattles.test.ts`.

- **Step 5, the rival realms and the win (done):** `src/shared/sim/conquest/rivals.ts`. The powers of the realm
  (sim/factions.ts: the same `Faction`s, troops, stances and feuds) act on the map: each day (`rivalsDaily`, from
  `conquestDaily`) a power may march one army (`RivalArmy` in `c.rivalArmies`: its strength `RIVAL_PER_TROOP` of its
  troops plus `RIVAL_PER_PROVINCE` a province; no oftener than `RIVAL_MOVE_DAYS`, on `RIVAL_MOVE_CHANCE` of the days,
  the warlike more) on a province beside its land: free ground first, a lair with `RIVAL_LAIR_STRENGTH`, a province of
  the town's when at war, another power's when the two are at feud; arriving (`rivalsTick`) it takes free ground, and a
  held province when its strength beats the defence `RIVAL_EDGE` times (`defenceOf`: the settlement's tier and walls,
  and for the town's its garrison and any army standing there, which falls back if the province falls), losing troops
  either way (`RIVAL_LOSS_PER_DEFENCE`). A destroyed power's provinces go free. Storming a power's province declares
  war on it (`startBattle` → `declareWar`); an ally's or a vassal's can't be marched on. **The win**
  (`checkConquestWin`, daily and after a battle won): every province held, by the town or a power in alliance or
  vassalage: `s.gameOver.won` with its own text (the launch and the Great Hunt stay). Seen: `WarView.rivalArmies`
  (⚔ in the realm's colour on the map with a dashed line) and `realms[].stance` (the Realms list). Tests:
  `test/conquestRivals.test.ts`.

- **Step 6, soak and tuning (done):** a 40-day soak of worlds of 2, 5 and 12 realms (the scratch `cw/soak.ts`):
  rival armies took the town's own capital province within days (the town itself!), so **no capital is taken on the
  map** but by the town's armies in battle (`rivalsDaily` skips held capitals); the start province revolted too
  readily (`REVOLT_CHANCE` 0.02, `REVOLT_GRACE_DAYS` 5); the powers spread over all the free land by day 40, so they
  move no oftener than `RIVAL_MOVE_DAYS` 5 on `RIVAL_MOVE_CHANCE` 0.35 of their days, less the more they hold
  (`RIVAL_SATED`): about 3 free provinces of 24 left at day 40 in a 5-realm world. A 40-day town costs about 70 s
  headless with the conquest on. The news bubble carries the war (`situationNotices`: a battle under way, a rival
  marching on the town's land, a captive, bare provinces, the last recap), each opening the War tab. The game-over
  card shows the conquest's win text as it does the launch's. Not built, left for later: the cutaway clash on the
  fight screen (clashes are auto, on the board), the town's armies defending a province on the board (a rival's
  attack on a province with the town's army in it is reckoned by strength), rival armies as standing pieces (a
  rival's march is resolved on arrival).

- **The War tab's art (done; the owner's complaint: the battle maps and the conquest map were basic and boring):** both
  are painted at the screen's own resolution (`devicePixels()`) from the packs, with no Pixi, by four modules.
  `src/renderer/art/warTerrain.ts`: `LAND_LOOK` (each world land's two tones, its ground patch and share, its props by
  set and kind, tufts, flowers, pebbles), `paintGround` (an ImageData fill: the lands' borders warped by noise, the sea
  shaded by its depth from the shore (`depthMap`) with foam and wave streaks, the mountains in relief with snow and
  cracks), `paintDetail` (the Path and Road pack's patches and the Fields pack's tufts through `groundDetail.ts`),
  `placeProps`/`drawProps` (the props atlases' trees, bushes, rocks, plants and bones, by the land, seeded, sorted by
  their feet). `src/renderer/art/warSprites.ts`: the images (`warImage`, loaded once; `onWarArt` tells the panel to draw
  again, rAF-debounced, through `artGen` in `warKey`), the pack buildings (`SPRITES`: the Simple Summer houses, keep,
  round castle, tent and watchtowers, the tiny-rpg-town long and gabled houses, the rocky yurt and tipi, the cave gate
  and altar, the palisade stakes, the dungeon stonework `STONE_WALL`/`STONE_GATE`, the campfire), the troops as figures
  (`TROOP_LOOKS`: every troop a Himeko look (`troopWho`: body, head, weapon, shield, pale or bone, mounted on the
  whtdragon horse), a pack hero sheet, or a beast sheet; `CAPTAIN_PACK`/`CAPTAIN_LOOK` a captain for every power;
  `drawWho`/`drawPack`/`drawBeast`/`drawTroop`/`drawCaptain`), and `REALM_COLOURS` (the town gold, then red, blue,
  violet, teal...: none near the gold). `src/renderer/panel/warMap.ts`: the world map (`worldTerrain`, cached by the
  cells and the images' readiness; `holdersLayer`: each realm's tint over its land, stronger for the town's, a dark edge
  and the realm's band along its border, a thin line between provinces, white round the tapped one; settlements by tier
  and their holder's people (`drawSettlement`: tents for the horde, the cave gate for the hold, else houses to a castle),
  landmarks, flags, garrisons, armies, a compass). `src/renderer/panel/warBoard.ts`: the battle board (`boardGround`,
  cached a battle: the land's ground, a wandering rutted track to the gate, the attackers' tents and fire at the west
  edge, the settlement's trodden cobbled ground and houses (or a lair's cave and bones) east of the wall line, the
  land's props kept off the track; `drawWall`: the palisade or the stonework, breached from the middle as the walls
  fall; `paintBoard`: each squad as its hero's figure facing the foe (a townsperson as the map dresses them, a captain,
  the lair's master) with its troops as small figures round them (the owner's ask: figures, not pips: the three rows
  along the facing, the front row nearest the foe, each row's three spread up and down the cell, `drawTroop` at 0.42 of
  a cell, the hurt faded), its health bar and count, the harm as numbers, a ring round the tapped one;
  `paintFormation`: a tapped squad's card and the Barracks' squad cards show the hero and every troop as figures in
  their three rows). Everything pixel art is drawn with smoothing off. Checked upright on the phone with the scratch
  `artshot.cjs`. Test: `test/warArt.test.ts` (every troop, land and power has a look the atlases hold). **More
  texture (the owner's ask):** `paintGround` takes `relief` (rolling ground lit from the north-west, from the slope of
  `lieOf`, a slow noise; the board 1, the map 0.5, the formation cards 0.7), `grain` (fine light and dark flecks in each
  land's `speckle` colours and clumps of shade) and `puddles` (on the board: still water with a muddy rim and a glint in
  the hollows of a land with `wet`, most in the fens, ice-pale on the tundra; `puddleAt` keeps the patches, tufts and
  props out of them). The board besides: boot prints up the track turned the way it runs, the ground trampled before
  the gate and bare along the wall's foot, the fire in a ring of ash and stones, the tents on trodden ground, the litter
  of older fights (bones, a skull, a burnt-out cart on its scorch, from the `places` and `desert` sets), a hamlet's
  furrowed plot with sprouts inside the Fields pack's rail fence (`drawFenceRun`), shadows under every building and
  the wall's shadow cast east, the settlement's cobbles greyer on the cold lands, more tufts and flowers (`more`).
  `window.__warGround(land, tier, fort, lair)` in the panel gives a land's board as a data URL (the scratch
  `groundshot.cjs` renders all ten). **The defenders fight back:** `takeBeat` in sim/conquest/battles.ts never passed the beat to the other side (`b.side` was set once),
  so the garrison only riposted and a squad held at the wall line out of its reach stood 600 turns to a "defeat";
  the sides now alternate as designed (probe: a level-24 founder's squad of nine loses to a two-squad garrison, a
  level-32 one wins).

## The townsfolk's own economy (done; the owner's direction: see PLAN.md)

- **Step 1, purses and pay (done; save version 17):** the coins are the townsfolk's; `s.coins` is the founder's
  **treasury**. `src/shared/data/economy.ts` (`GATHER_SHARE`, `BUILD_PER_HOUR`, `STUDY_PER_HOUR`, `KEEPER_CUT`,
  `TREASURY_KEEP`) and `src/shared/sim/economy.ts`: `giveCoins` (every coin into a purse goes through it, keeping
  `Person.pay`: today and yesterday), `payFromTreasury` (only from what the treasury holds above its keep),
  `accruePay` (work by the hour: `Person.owed` carries the fraction, `paidFor` names the last pay), `loadPrice`,
  `payParty` (split evenly, the odd coins to the first), `incomeOf`. Who earns what: a load brought into the stores is
  sold to the town on the spot (`'store'` in people.ts; the shop sells it on at full worth); builders and scholars by
  the hour; crafters the piece rate (`payCrafter`); keepers a cut of each sale (serveCustomer, serveGuest); a boss's
  purse, a delve's hoards and a quest's bounty go to the **party** (`finishBattle`, delves.ts, `questsDone(…, party)`).
  The flat daily wage is gone (`payWages`; `wageBill` is now a reserve estimate, `PAY_A_HEAD`); the ledger's `wages`
  line is "Pay for work". `PersonView.income`; the inspect page's purse line says what they earned today and yesterday.
  `moneyTown` (economy.ts) is true once the town has a venue or ever had coins.

- **Step 2a, building, land and rent (done):** `src/shared/sim/property.ts`. **Building is slower and needs skill:**
  `BUILD_PACE` (3) on every site; a site needs `buildSkill(def)` Construction of whoever works it
  (`BUILD_SKILL_BY_ERA` 1/8/20/35/50 by the era of what's built, a little more past `BUILD_SKILL_FREE_CELLS`), else
  `canWork` keeps them off it (the `construct` job and the task's validity); a builder's pace is `buildPower(level)`
  (0.5 + level/10: a steep curve, so skill matters). **Ownership:** `Building.owner` (a person; the treasury when left
  out). **Homes by the people:** `planHomes` (hourly, `propertyHourly` from sim.ts, money towns only): a grown-up with no
  home of their own and coins for a plot (`landPrice`: `LAND_PRICE_PER_CELL` a cell) and the materials (`materialsPrice`:
  their worth, bought from the stores) has the best home they can afford placed and owned (`findSpot` is exported from
  the planner for it); the owner works their own site for nothing and pays whoever else works on it `HIRE_PER_HOUR`
  (`accruePayFrom` in economy.ts; unpaid, nobody else takes it); `assignBeds` gives owners their own home first. The
  treasury still builds a home to rent whenever fewer than one bed is free (a newcomer only comes to a town with a bed
  free, so building to rent only when someone slept rough deadlocked a full town).
  **Rent:** at dawn (`collectRent`) everyone with a bed in a home that isn't theirs pays `rentOf` (`RENT_PER_BED` a day)
  to its owner or the treasury (ledger line `rent`, which also books land sold); short of it, `Person.debt` grows and
  `RENT_MORALE` bites. `PersonView.owns`/`.debt` on the inspect page. Tests: `test/property.test.ts`.

- **Step 2b, tax and guards (done):** `src/shared/sim/treasury.ts`. **Tax:** the Plan tab's lever (`s.tax`: `TAX` in
  data/economy.ts: low 5%, fair 15%, heavy 30% of yesterday's income, each with its morale in `mood()`; the `setTax`
  command); `collectTax` at dawn; heavy tax kept `TAX_LEAVE_DAYS` and each dawn one of the grown-ups (never the
  founder) may leave (`TAX_LEAVE_CHANCE`). **Guards:** a standing paid calling (`Person.guard`): `assignGuards` hourly
  hires the best fighter free (not a post's holder) up to `guardsWanted` (one per `GUARD_PER_PEOPLE`, one more on
  Defence or raided in the last 3 days) and what the treasury can pay a day (`GUARD_WAGE`; ledger `guards`);
  `payGuards` at dawn, and a guard unpaid `GUARD_UNPAID_DAYS` running stands down. A guard has `priorities.defend` 1
  and keeps watch by turns without a barracks (`onShift`), and goes first on the raid map (`autoPlace`'s strength).
  The Townsfolk tab's job is "Guard"; the Plan tab has the Treasury (the tax lever, the guards, the ledger with
  `tax` and `guards` lines). **Thrift:** people keep `SAVINGS_KEEP` back before buying gear or a night out, so they
  can save for land. The Townsfolk rows show each person's coins and a 🏠 for a home of their own. **Tuning:** `BUILD_PACE` 2 and `buildPower` 0.7 + level/10 (3 and 0.5 stalled a knights' town);
  the ring wall waits for `RING_MIN_PEOPLE` (4) grown-ups even when raided. Tests: `test/treasury.test.ts`.

- **Step 3, ambitions and businesses (done):** `src/shared/data/ambitions.ts` and `src/shared/sim/ambition.ts`. Every
  grown-up has an **ambition** (`AmbitionId`: farmer, crafter, keeper, adventurer, scholar, guard, homebody, wealthy;
  `ambitionOf`: their nature's lean `NATURE_AMBITION`, else their best skill, by their id; settled on
  `Person.ambition` once grown, `settleAmbitions`). It steers posts (`skillOf` in operators.ts adds `JOB_PULL` for a
  post of their ambition's skill; the treasury hires would-be guards first). **Businesses:** a venue may be owned
  (`Building.owner`); every sale goes through `takeSale`: to the owner's purse (taxed like any income) with the
  keeper's cut (`KEEPER_CUT`) paid by the owner when someone else keeps it, else to the treasury as before; its
  upgrades (extensions, levels, décor) are paid by `payForVenue` from the owner's purse above `OWNER_KEEP`
  (`venuePurse` in `planShop`). `bookTakings` keeps `b.shop.takings`; `businessPrice` is the makings and plot plus
  `BUSINESS_DAYS` of its takings (a busy shop is dear: the founder sells the town's at that price), a person's at
  `PERSON_SELLS_AT` more, and a keeper at heart never sells. `buyBusinesses` (hourly, `ambitionHourly`): keepers then
  the would-be rich buy the dearest they can afford, one sale an hour, and keep it themselves unless they hold
  another post (else the keeper stays on as their hand). **Retiring:** `homeFromTrip` (from the party's homecoming)
  counts `Person.trips`; an adventurer `RETIRE_TRIPS` trips in with `RETIRE_COINS` settles down as a keeper. The
  inspect page names the ambition; the venue window says who owns it, its worth and yesterday's takings. Tests:
  `test/ambition.test.ts`.
- **Step 4, relationships that bite** (`data/social.ts`, `sim/social.ts`): **enemies** at `ENEMY` (-60) or below
  (`enemiesOf`) never go in one party and, near each other, may come to blows (`brawl`: `BRAWL_CHANCE` an hour within
  `BRAWL_NEAR`, `BRAWL_HURT` of their health, never to the ground, and `Person.sore` for a day: a mood line);
  the **devoted** at `DEVOTED` (80) or above, or partners (`devotedOf`), go where the other goes and grieve
  `DEVOTED_GRIEF` times as long. The inspect page's relations line names both (`PersonView.enemies`, `.devoted`).
- **Step 5, parties that form themselves** (`data/parties.ts`, `sim/parties.ts`; the owner's decision: a veto and a
  bounty for the player, nothing to pick). `partiesHourly` (from sim.ts; the autopilot on, `SET_OUT_FROM` to
  `SET_OUT_UNTIL`, `PARTY_GAP_HOURS` apart): `proposeParty` takes the fit (`fitToGo`: healed to `FIT_HP`, rested, fed,
  `TRIP_REST_HOURS` since their last trip came home, `Person.homeAt`) who may go (`mayGo`: not a guard, a keeper of a
  venue or healer's post, or the founder), the half of the town that may be away (`roomAway`), and the places on the
  board not forbidden nor already visited by a party (`boardDestinations`, `choosable`). Only an adventurer leads (the
  owner's call: no adventurer, no trips; and none from a town under `MIN_TOWN_FOR_TRIPS` 3 grown-ups), choosing by `pull` (a bounty, somewhere unseen, a fight); `recruit` fills the wanted roles in turn
  (`WANTS`: front, healer, damage, scout, by the calling's `ClassRole`, `partRole`) by liking, never an enemy of anyone
  going, the devoted first; the party goes only if `strengthOf` (health raised by level) beats `dangerOf` (the heaviest
  foe group, a dungeon's boss) times `DARE` (`DARE_BOLD` for a bold leader, who also goes risky). `Expedition.leader`.
  **Veto and bounty:** `s.vetoed` (`setVeto`, the `veto` command; forbidding takes its bounty back), `s.bounties`
  (`postBounty`/`withdrawBounty`, the `bounty` command: `BOUNTY_STEP` coins a step up to `BOUNTY_MOST`, set aside from
  the treasury at once, ledger line `bounties`), paid by `payBounty` (from `comeHome`) to the party if it did the job
  (`jobDone`: a dungeon cleared, a threat put down, else home unrecalled). The Expeditions tab: a Parties block
  (`snapshot.trips`: who would set out next or why nobody would, the fit, the room, the adventurers) and on each card
  Forbid/Allow and Post/Raise/Withdraw bounty in place of the old send buttons and the delvers' picker (the `sendParty`
  and `sendDelve` commands stay, for tests and previews). Tests: `test/parties.test.ts`.
- **Step 6, events with weight** (`data/eventKit.ts`, `sim/events.ts`): new effects `busy` (`busy(hours, share, text,
  anim, at)`: that share of the grown-ups, guards aside, held to one job at the town's edge or the camp: `s.busy`; in
  `chooseTask` a held person (`busyNow`) eats when hungry and otherwise toils, the `toil` task, walking to their spot
  on the line and working there with the job's animation; nothing else gets done) and `follow` (another event is put
  to the player as soon as this one is answered: `s.eventNext`, started by `maybeEvent` past the usual gap). A `later`
  inside a `chance` now works (kept with its effects on `s.eventLater`). **The fire** (`great_fire` in
  fatefulEvents.ts): cut a fireline (one roof lost, the whole town at it for a day), save the stores (three roofs, half
  the town hauling), or let it burn (even odds: it dies down with one roof, or takes four and maybe a life, and six
  hours later may reach the town: the `fire_spreads` event, never by chance: a bucket line with wounds and smoke
  deaths, houses pulled down in its path, or run for the fields and lose six roofs and likely lives). Fire spreads
  between buildings by their footprints on the land (`gap` in fire.ts, across and down: it was the old strip's tiles),
  and townsfolk fight the nearest fire by true distance. **What there is to pay with:** an event that asks for coins
  says what the treasury holds (`coinsLine`), and each answer that costs coins says how much on its button
  (`costOf`: "(20 coins)", "(about 35 coins)" for a share). Tests in `test/events.test.ts`.
- **Step 7, life's ceremonies** (`data/ceremonies.ts`, `sim/ceremonies.ts`, `ceremoniesHourly` from sim.ts; off with
  the autopilot, like events). A death is remembered with who was close (`mournFor` in `killPerson`, before the
  relations go: partner, kin, friends; `s.funeralsDue`), and at the next `GATHER_HOUR` (18) they hold a funeral at the
  graveyard or the fire for `FUNERAL_HOURS` (nobody close: the whole town buries them); `GREAT_FUNERAL_DEATHS` (3) or more since the last make it a **great
  funeral**: the whole town, `GREAT_FUNERAL_HOURS`. Afterwards those who came grieve half as hard (`FUNERAL_EASE`) and
  the town carries a mark ("Laid to rest", "We buried our dead together"). A **wedding** (`weddingFeast`, from
  `families`) is feasted that evening; the town **feasts** at midsummer (`MIDSUMMER_DAY`) and after a raid driven off
  with nothing taken (`victoryFeast` from `endRaid`), never within `FEAST_GAP_HOURS`, and only if the stores hold
  `FEAST_FOOD_DAYS` after it (`FEAST_FOOD` a head eaten; a wedding is kept regardless); at a tavern someone owns, the
  treasury pays the house `FEAST_COIN` a head (`takeSale`). A gathering is `s.gathering`; those at it (`attending`) take
  the `attend` task: they walk to their place in a ring round the spot and stand there (they still eat), and the
  Townsfolk tab says where they are. Tests: `test/ceremonies.test.ts`.
  - **Festive gatherings (the owner's ask: they only stood and bobbed):** at a feast or wedding the guests' activity is
    `dance`, at a funeral `mourn` (new `Activity` values, set by the `attend` task). The ring is roomier
    (`gatheringRadius`: a feast's grows with the guests), and every other guest dances round in it (`gatheringPlace`,
    `inRing`, `RING_SPIN`: the ring turns about once in 40 s; once there they keep to their turning place); a tavern
    feast is held on the open ground below its door. `snapshot.gathering` (kind, spot, ring, `fire` when away from the
    camp's fire). On the map (`map/dance.ts`, pure): everyone dances to one `BEAT` (420 ms): the ring skips round, the
    rest each have a move by id (`danceMove`: hop, cheer with an arm up, clap, spin through the four facings, sway),
    lifted off the ground with a squash on landing; mourners kneel (a third) or stand still turned to the middle
    (`mournStep`). Notes and hearts pop up thick and fast at a feast, none at a funeral; the speech has new topics
    `feast` and `mourn` with lines for every nature (`GATHERED` in data/natures.ts). `map/mapFestival.ts`
    (`MapFestival`, from MapView, synced by main.ts): poles round the ring with strings of fluttering pennants and a
    paper lantern on each that glows after dark, a bonfire in the middle when it isn't the camp's (the Fields pack's
    campfire), the long table laid with pots and a jar and a barrel and stools behind (the dungeon clutter), confetti
    drifting down, and after dark fireworks bursting overhead (drawn in the lights layer); at a funeral the clutter's
    candles in a ring, glowing. No confetti or fireworks on a slow phone (`calm`).
- **Step 8, art:** the windmill, the watchtower and the lookout are the Simple Summer top-down pack's windmill and timber
  watchtowers (`art/packs/su_*.png`, shrunk from the pack's vector PNGs; `PICKS` in packBuildings.ts). Since then: the
  factory (pipes, a transformer, a shuttered block and a tank), the garage (two shuttered bays), the radio tower (the
  loose objects pack's lattice pylon, `sf_pylon.png`) and the drone hub (a block with a console) are picks too, and the
  elder lodge, town hall and trophy hall have `hallVariants`: the Simple Summer stone keep for the liches and the Moon
  Pack (`KEEP_HALL`), its crystal mage tower for the alchemists, the fae and the druids (`MAGE_HALL`), its round keep for
  the merfolk (`ROUND_HALL`, `su_roundcastle.png`) and its striped tent for the nomads on the move (`TENT_HALL`,
  `su_tent.png`). The machines' halls (`MACHINE_HALL`) are put together from the futuristic objects (a transformer, the
  shuttered block with a console, a great tank); the vampires' and the dwarves' halls are rooms of their castle or hold.
  Boats stay painted (`art/boatArt.ts`): searched again, the packs have only wrecks (Seabed) and spaceships.

## Deaths made common again (the owner's call: all three levers)

- The first economy soak had 5 townsfolk deaths across all twelve towns in 15 days: towns are smaller since arrivals
  became the player's choice, and a probe showed small towns' raids (two or three beasts) downing nobody at all. The
  owner asked for all three levers. **Raids:** `RAID_BUDGET_BASE` 18 (was 12), `RAID_BUDGET_PER_DAY` 3 (was 2),
  `KILLING_BLOW` 0.38 (was 0.3), every budget times `RAID_BITE` 1.4 and every raider's blow times `RAID_FEROCITY` 1.25,
  a kidnapper's blow never kills (they want captives alive), and the two only from `RAID_BITE_FROM` (3) grown-ups (`biteOf` in raids.ts: a founder alone or with one companion meets the
  raids of old). **Parties:** `DARE` 1.15 and `DARE_BOLD` 0.8 (were 1.6 and 1.1), out at `FIT_HP` 0.75 (was 0.9).
  **Disasters:** `DOOM_FIRST_DAY` 4 (was 5), `DOOM_EVERY_DAYS` 5 to 8 (was 6 to 10), `PLAGUE_SPREAD` 0.06 (was 0.04),
  `PLAGUE_HP_PER_HOUR` 1.3 (was 1.2). Tried and dropped: bite and ferocity 1.6 (a settlers' town fell to one person), 1.4
  with a 0.45 killing blow (a settlers' town fell to two, alchemists to three, with the injuries in). Soak (15 days, 8
  towns: settlers on 4 seeds, the others 1): 0 to 4 deaths a town, about 1.5 on average, none fell below 6 people.
  **Every town has an adventurer early** (`ADVENTURER_WANTED` in data/ambitions.ts): while none is in town, the next
  grown-up whose ambition is settled takes to the road (never the founder), so a settlers' founding companion is one.
- **The care of the hurt is researched (the owner's ask):** a research effect `care` (`heal`, `bleed`, `feet` in
  `data/research.ts`; `careHeal`, `careBleed`, `careFeet` in `researchMods`) read by `knockDown` (how long the downed
  have before they bleed out) and `heal` (the healing pace, and the share of health the downed get up at) in
  `sim/health.ts`. Herbalism (+15% healing) and Physick (+25%) now do what they promised (Physick's "Faster healing" had
  no effect behind it), and six topics are new: Bonesetting and Field Dressing (Stone Age), Barber-Surgeons and
  Convalescence (Medieval), Antiseptics (Industrial), Triage (Modern). Tests: `test/care.test.ts`.

## Injuries, lasting harm, prosthetics and surgery (done; the owner's ask, after RimWorld)

- `src/shared/data/injuries.ts` and `src/shared/sim/injuries.ts`. **The body:** ten parts (`PARTS`: head, two eyes,
  torso, two arms, two hands, two legs; each a hit `weight`, the capacity it `serves`, whether it can be lost, and what
  goes with it: a hand with its arm). **Wounds** (`Person.wounds`: part, `WoundKind` cut, bite, bruise, fracture or burn,
  severity and peak): a blow that lands (`attackPerson` in raids.ts, on the town and the battle map) wounds a part
  (`woundPerson`: severity `SEVERITY_PER_SHARE` times the blow's share of their health; `woundFor` picks the kind by the
  foe: beasts bite, fire burns, heavy blows break bones, blades cut); a party's fight carries its harm home as one or two
  wounds by what they fought (`finishBattle`); an event's wound is a bruise or a cut (`minorWound`). A crushing blow
  (`LOSE_AT`, `LOSE_CHANCE`) may take a limb or an eye for good (`losePart`, `Person.lasting` kind `lost`).
  **Healing:** `injuriesHourly` (from sim.ts): each wound heals over its kind's `days`, `TENDED` (2) times as fast with a
  healer's hut, infirmary, hospital or trauma center standing and the person in town, and by the care research
  (`careHeal`); healed, a bad one may scar (`WOUNDS[k].scar` times how bad it got, less with the care research; a scar
  works at `SCAR_WORKS` and hurts `SCAR_PAIN`). **What it does** (`capacities`: sight, handling, moving, pain):
  `injuryWork` in `workFactor`, `injuryPace` on the walk (`goTo` in people.ts), `injuryFight` in `personFighter` (blows by
  handling, aim by sight), `injuryMood` in `mood()` ("In pain"). **Prosthetics** (`PROSTHETICS`: works and rank per kind
  of part; items in data/items.ts): Peg and Hook (Medieval: peg leg, hook hand, wooden arm), Prosthetics (Industrial: a
  glass eye, jointed legs, hands and arms), Bionics (Space: better than flesh). The planner orders the best it can make
  for each lost part (`prostheticsWanted`; and studies those topics +30 while anyone waits); the healer (the operator of a
  healer's hut, infirmary, hospital or trauma center) fits one in surgery on the hour (`surgery`: odds `SURGERY_BASE`
  plus `SURGERY_PER_LEVEL` a Medicine level; botched, the piece is ruined and the patient cut). A better piece replaces
  a worse. The inspect page's health card lists wounds, what's gone for good, what's fitted, and sight, hands, moving
  and pain (`PersonView.body`). Tests: `test/injuries.test.ts`.

- **Harm that shows (the owner's ask):** `PersonView.body.marks` (`bodyMarks` in snapshot.ts: each lost part bare or
  made good, by the prosthetic's rank: `patch`, `gone`, `peg`, `hook`, `wood`, `metal`, `glass`, `bionic`; and a
  `bandage` over a wound of `BANDAGE_AT` 0.25 or worse) are drawn over the side-on LPC sprite by
  `src/renderer/map/bodyMarks.ts` (`drawMarks`, in art px about the feet, mirrored with the sprite; redrawn when
  `marksKey` changes): an eye patch and strap, a peg, a jointed or bionic leg, a crutch for a leg gone, a hook, a
  wooden arm, bandages on the head, chest, arm or knee. Not over a hero, wolf, class or swimming form, nor someone
  down. Hurt legs limp (`limpDip` by `body.moving`, a dip on alternate steps).

- **Nobody starves in bed (fixed):** a companion going to bed a little peckish (0.4) woke starving with berries in
  store: bedtime came before the hunger check, and a night cost half a belly. Now hunger drains at `ASLEEP_HUNGER` (0.5)
  while asleep (`drainNeeds` in townsfolk.ts), and someone asleep under `WAKE_TO_EAT` (0.12) gets up to eat while the
  stores hold food (`chooseTask` in people.ts; eating ranks just over sleep, -2.1). A forced meal before bed was tried
  and dropped: it cost lone founders about half a person by day 10. Probe (12 lone founders, 10 days): 4.4 people
  where it was 4.1. Test: `test/hunger.test.ts`.

- **Rooms lived in (the owner's ask: a dwarves' hold felt empty, one piece a room):** `src/renderer/map/castleClutter.ts`
  dresses the hall, every room and the dug galleries of a castle or a hold with the dungeon packs' small things
  (`art/clutter/`, 48 sprites cut by hand, palette PNGs): tall things against the back wall (shelves, racks, crate
  stacks), middling ones down the sides (barrels, crates, chests, tables), small ones in the corners and along the front
  (jars, stools, books, flasks, gold), and a group or two on the open floor (`GROUPS`: a long table and stools, a desk and
  stool, a heap of crates), by what the room is (`kindOf` in `map/roomKinds.ts`: hall, home, store, study, forge, healer,
  kitchen, treasury for the seat, mine, work; `SETS`). Kept clear of each room's own piece (MapView's `occupied`: its
  painted runs of columns from `PixelArt.tops`), the doorways and the gate's carpet; placed from a stream seeded by the
  room, so it stays put. **Lights:** torches on the back walls and now and then in the galleries, braziers in the hall,
  forges, kitchens and throne room, candles in homes and studies (`art/delve/fires.png`, `art/clutter/candles.png`,
  animated), each with a warm pool on the floor that flickers (`flickerCastle`, from `renderAir`) and a glow in the
  lights layer after dark. A room's own piece is never a whole building's outside any more (`packArtIndoors` in
  packBuildings.ts: `EXTERIORS`, the trades' timber houses and shop fronts stood inside the hold). Test:
  `test/clutter.test.ts`.
- **Walls that stand up (the owner's ask):** in a castle and a hold, a room's partition has a 22 px face (`PART_FACE`,
  with a dark foot, `foot`), a doorway a lintel and shadowed opening, a run down a column a shaded east side (`sideRun`,
  `SIDE_T` 10); the curtain wall's inner face is `INNER_FACE` (26) and the hold's rock wall seen from inside a hewn face
  (`ROCK_FACE` 24, `hewn`). `wallDepth` (castleArt.ts) says how far a top wall reaches into a room, for the clutter.
- **Fields painted as farmland (the owner's ask: the pack soil looked like desert dirt):** `src/renderer/art/farmland.ts`
  (`paintFarm`): dark loam in ridges and furrows with clods, a turned-earth bank with grass creeping over it, and the crop
  along the ridges by kind and stage (wheat tufts to gold stalks with heads, round leafy vegetables and pale cabbages,
  flax in blue flower, herb clumps with blooms, orchard trees from whips to shaded round crowns in fruit; an orchard
  stands in grass). Every crop plot uses it (`farmPlot` in map/fieldArt.ts); pens keep the Fields tileset's ground.
- **Walls that hold, and a gate to the hold (the owner's ask: realistic pathing):** a castle's or a hold's walls are
  real for walking now. `castleLayout` (sim/castle.ts, cached per tick and on the rooms and `land.version`) gives each
  castle cell its region (the hall -1, each room its id, each separate run of a hold's dug galleries -2, -3...), the
  doorways between regions (`doorsOf`: one in the middle of the longest straight run of wall two regions share), and the
  gate (the cell before it and the hall's cell inside it). `castleStep` allows a step within a region or outside, between
  two regions only at their doorway, in or out only through the gate, and onto raw rock (a face being dug).
  `findPath` takes it as `PathOpts.edge` (a diagonal must pass both ways round); `pathTo` in walk.ts passes it for every
  walker, and raiders in a castle town walk by `walk` too (`moveToward` in raids.ts). The map draws the same doorways
  (`snapshot.castle.doors`, and `galleries` walled and doored like rooms), and the gate is drawn at the cell inside it
  whatever room covers it (a hold's seat is built over its hall, which hid the gate). A hold's gate is the dungeon
  pack's stone archway with its doors open (`HOLD_GATE` from `art/delve/doors.png`, 48 px), not the skull-faced cave
  gate. Tests in `test/castle.test.ts`.

- **No flicker between forms in a fight (the owner's complaint):** the fighting callings took their combat form only
  while striking or for `HERO_LINGER` after, and on the raid map a turn can come round less often than that (and a
  spell or skill set no blow), so a fighter flipped between townsperson and hero each turn. Now `PersonView.defending`
  (the defend task in a raid) keeps the form the whole fight (mapPeople's `inCombat`), and a cast on the battle map sets
  `p.lastBlow` so it plays the striking pose.

- **Founders pictured as the map draws them (the owner's complaint):** the New Town cards drew a founder's LPC look
  while the map always draws them in their hero form. `art/heroForms.ts` (no Pixi, so the panel can use it; re-exported
  by combatPoses.ts) holds `HERO_FORM`, `heroSheet` and `founderSheet`, which now decides a founder's form by their
  class (`CLASS_DEFS`: ranged, caster or healer role), not by stats that shift as they level; `FOUNDER_ID` (1).
  `drawFounderArt` in newGamePanel.ts draws the idle frame of that sheet (`PACK_LAYOUT`, `packUrl`) for the founder's
  base class, and the feed's and report card's person pictures (`personPicture` in main.ts) do the same for a founder.
  So does the Townsfolk tab (`picture` in townsfolkPanel.ts: the list's face and the inspect page's figure), through
  `heroImage`/`drawHeroIdle` in heroForms.ts (a hero sheet's idle frame on a plain canvas; every caller waiting on a
  sheet is told when it loads). New Town opened afresh starts at its first question (`restartNewGame`, from panel.ts
  when the shown panel changes to it); its redraws while open keep the step.

## The merfolk rework (done; the owner's request)

- **Raiders from the sea (step 1, done):** raid kinds with `fromSea` (data/raids.ts) come only to a shore town
  (`seaTown`; the pick in raids.ts filters the rest out): `tide_beasts` (squid spawn and crocodiles, from day 1),
  `sea_reavers` (the pirate pack's captain sheet as reavers, with squid spawn; bribable, after valuables) and
  `drowned_crew` (the pirate zombie as drowned sailors, Medieval on); the foes `sea_reaver`, `drowned_sailor`,
  `squid_spawn` are in bestiary.ts. Their raiders start in the deep water south of the camp (`offSea` in raids.ts,
  `SEA_OUT` cells past the known land) and never split to flank; on the battle map the trail runs from the sea
  (`seaEdge` in battle.ts) to the strand (`strandCell`: the first dry cell north of it) or the ring's gate on that side,
  found with `swim` so they come straight through the water. `RaiderView.swimming` (in the water) draws them from the
  waist up, bobbing (`waistCrop` in mapRaiders.ts). The shallows take part in the ground's wandering borders, with foam
  where they meet the strand, and the borders wander a little wider (`WARP` 15, `WARP_SCALE` 20). Test in
  `test/sea.test.ts`.
- **Piers and seabed dressing (step 2, done):** in a shore town a road runs out over the water as a pier
  (`connectRoad` in sim/buildings.ts lays road on wet cells, with `PIER_COST` 2.5 a cell so piers stay short; a road
  already bridges water for walking, `stepCost`), drawn as the Bridges pack's wooden planks with their rails
  (`drawPier` in art/groundDetail.ts: `roads/pier_v.png`, `pier_h.png`, across when the road runs across). A finished
  building whose front stands in the water is dressed with three of the Seabed set's corals, shells, crabs and weed at
  its foot (`SEA_DRESS` in mapView.ts; the set is loaded for the merfolk's look and the town redrawn when it comes).
- **Trips under the waves (step 3, done):** a shore town's outdoor fight scenes take `SEA_LOOKS` (data/scenes.ts: the
  underwater backdrops, and the ocean ones under a sky pack; `lookFor(..., sea)`, `FightScene.update(..., sea)` from
  main.ts).
- **Merfolk on land (step 4, done):** `PersonView.mer` (`peopleOf` is merfolk, not raised): `drawFins` in
  map/bodyMarks.ts draws a crest swept back from the crown, a fanned ear fin and glints of scale in sea colours by id
  (`merColours` in art/merTail.ts, never its gold, which read as a crown), through the injury marks' overlay, so only on
  the plain LPC sprite and never in the sea.
- **Stilt homes and tide pools (step 5, done):** a merfolk home on the map (a house-shaped home before the modern age)
  is a stilt hut (`drawStilt` in art/topDown.ts, its own colours, never reclad): a round reed roof thatched in rings
  over a short wall of sea-green boards with a round-topped door and a lit porthole, on a plank deck raised on stilts,
  a net and a string of shells. On the strand, `TIDE_POOLS` (0.22) of the sand cells within two of the shallows (only a
  shore town's land has them: `nearShallows`) hold a tide pool (`tidePool` in map/groundArt.ts): clear water in a ring
  of wet rocks, sometimes with one of the Seabed set's shells or starfish in it.
- **Sea beasts (done):** a sea-shaped land seeds one **Sea Beast's Reef** (`reef` in `PLACE_DEFS`, weight 0: placed
  only by `seedPlaces` on a land with shallows, in the water south of the camp), found and fought like a beast's lair
  (`PLACE_FOES.reef`: squid spawn and crocodiles, then Squidbeard, then the Kraken), drawn as the Seabed pack's broken
  wreck (`sb_wreck.png`, half size, set down on its ring). **The Leviathan** (`leviathan` in bestiary.ts, from the
  Medieval age, `fromSea`, `leader` the Kraken of the Kraken Deep, `BOAT_ENEMIES` in data/boats.ts) comes ashore at a
  shore town with its spawn. Test in `test/sea.test.ts`.

## Polish round (0.21.0; the owner's asks)

- **The conquest map zooms (the owner's ask):** the War tab's world map (`mapCanvas` in `panel/warPanel.ts`) is a kept
  canvas (`mapEl`, reused across the menu's redraws so a gesture under way isn't broken by a battle's beat) painted
  from a view: `mapZoom` (1, fitted to the width, up to `ZOOM_MOST` 4) and `mapPan` (the top-left corner as a share of
  the world, so it holds at any width). A pinch, the wheel or the + and − buttons zoom about the fingers
  (`zoomMapAbout`); zoomed in, a drag pans (`touch-action: none` on the canvas; fitted, `pan-y`, so the page scrolls
  over it as before) and ⊡ fits the world again; a tap (no drag, no pinch) picks the province under it. The terrain and
  holdings are drawn scaled from their cached layers, the marks (settlements, armies, names) at the zoomed cell size so
  they stay sharp.
- **Badges on the Townsfolk rows (the owner's ask):** each row's face (`.folk-pic`) carries a gold number of the stat
  points they have to spend (`.folk-pts`, `PersonView.freePts`) and a violet ⬆ when an evolution waits on them
  (`.folk-evo`, `p.road.promptId`); the inspect page's card has the same as chips (`.folk-badges`: a tap opens the
  Character tab, or the calling's roads).
- **The Townsfolk page no longer flashes (the owner's complaint):** its redraw key (`townsfolkKey`) was every live
  value of everyone (doing, health, needs, skill tenths), so the whole page was rebuilt about twice a second in a town
  of fifteen. Now the key is the page's shape (who is listed, who is inspected and what they have), and the live
  details (`fillRow`: the doing and class lines, the bars, the flag, the badges; the head's counts; the visitor's wait;
  the inspected person's doing line) are patched into the rows in place by `patchTownsfolk`, which panel.ts calls on
  every snapshot that leaves the key as it was. Faces are drawn again only when their picture changes (`refreshFace`,
  `faceFrom`). The one inspected keeps a fuller key, coarsened (health and morale to 5, needs to a tenth).
- **Townsfolk jigging on the map (the owner's complaint that they flashed):** `MapPeople.spread` stepped anyone standing
  400 ms aside on rings all round, so a builder at a door was stepped up into the footprint, drawn behind the building
  and lost, then dealt a new place; and every pause in a walk got a sidestep. Now `STILL_AFTER` is 1200 ms and
  `ASIDE` is the lower half-circle only (beside and below, the sides first). Trees going see-through
  (`MapView.seeThrough`) ease their alpha over a few snapshots instead of snapping. (Probed with a per-render sampler
  of every sprite's texture, visibility and scale: no look swapped mid-frame; the walk, work and dance poses are the
  pack's own cells.)
- **Hair that slipped between poses (the owner's complaint):** measured against the bodies, the Himeko hair layers sit
  on the head to the pixel in every pose and colour but two things: the pack has no men's hair, only bangs, which
  stay at the cell's middle in the two side lunges (every tool swing and blow) while the head moves, and leave a man
  bald behind the fringe and from the back; and the white long hair and pigtails are drawn 10px toward the middle in
  those lunges. Now men wear the women's cuts (`hkLayers`: the pixie, the bob for a shaggy style, the long hair for a
  long one; a close crop stays shaven; beards as before), and `NUDGE` in hkFolk.ts moves a cell the pack drew out of
  place (`hkCell` draws it offset). The scratch measurement scripts decode the palette PNGs in plain node.
- **The evening at the tavern (the owner's ask: townsfolk go for a drink to let off steam at the end of the day):**
  `src/shared/sim/nightOut.ts`. At `TAVERN_HOUR` (20, from wages.ts) with a tavern open, `nightOut` picks who goes
  (`s.nightOut`: the tavern, `ids`, `until` after `DRINK_HOURS` 2, `served`): grown-ups at home with coins above their
  keep, rested enough, not the keeper, a guard on watch, the hurt, the sick, the dead or machines, nor anyone at a
  gathering or the town's work; each nature more or less often (`DRINK_LEAN`, a roll by the day; up to `DRINKERS_MOST`
  12). They take the `drink` task (people.ts: ranked after a meal or sleep, before any work; `drinking` holds it), walk
  to the tavern's door and go in for the evening (`Activity` `drink`; `indoors` in the snapshot, so they leave the map),
  and `drinkAt` on arrival buys the best drink they can afford for a local's price from the house (`takeSale`: the
  owner's purse, the keeper's cut) and lifts their spirits (`TAVERN_NIGHT`; half with nothing on tap). The tavern's
  window lists them under Guests and draws them in the room as the map dresses them (`ShopView.locals`, `hkWhoById`);
  the Journal says who went. The old instant night out (a purchase at eight with nobody moving) is gone. Tests:
  `test/nightOut.test.ts`.
- **The ring wall cuts its way through (the owner's ask):** the trees and rocks on a ring piece's cell are marked for
  gathering all at once (`RING_CLEAR` 24, `Ring.clearing`), ahead of the planner's material marks and over its cap
  (`planGathering`), and whoever gathers takes them as if `RING_CLEAR_PULL` (12) cells nearer (`bestGatherTile`), so
  the wall's line is cleared and its planned pieces follow. They used to wait on the room the materials' marks left,
  four at a time, and nearer marks were always taken first. Besides, a planned piece laid after the first pass (on a
  cell cleared or freed later) was refused by `placeBlueprint` whenever the build queue was full, which with the
  ring's own sections in work was nearly always: a planned piece takes no slot now (`placeBlueprint(..., planned)`),
  and `planBuilding` gives the ring its turn (`ringTurn`: the planned pieces laid, the line's cells marked; no section
  released without room) even on a pass with the queue full, which used to return before it.

- **Nobody is stepped aside in a raid (the owner: the flashing was in the raid too):** `MapPeople.spread` leaves
  everyone where the fight put them while `raid` is set (the main map in an active raid, and the tactics board's own
  people view always): on the board the tiles lie closer than a step aside, so the fighters were dealt places and
  re-dealt them every quarter second.
- **Reading at the desk (the owner's ask):** a researcher holds the pack's book open and reads (`TOOL.research` in
  hkFolk.ts: the `book01` layer; `hkPose` `READ`: the second punch pose, where the pack draws the book open in both
  hands before them), lowered for a moment every few seconds to turn a page (by their id); a reader turned away held
  it over their head, so they read facing us (mapPeople's `hkTexture`).
- **Rivers on the raid board are fords (the owner's complaint: nobody could cross):** `fords` in tactics.ts, from
  `makeBoard`: water within `FORD_DEPTH` (2) tiles of a bank becomes `shallows` on the board, which anyone may stand
  on (two moves a tile, lying low: the banks strike down into it); only wide water (a lake's middle, the sea) stays
  deep. The town's wall still leaves the river a gap, as the ring does on the land. Test in `test/tactics.test.ts`.

## The wall's purpose (0.23.0; the owner's asks)

- **Grates where the ring meets water (the owner: "a wall with a built-in grate for the water to flow through"):** five
  more ring pieces in `data/buildings.ts` (`palisade_grate`, `stone_grate`, `brick_grate`, `concrete_grate`,
  `force_grate`: `BuildingDef.onWater`, a piece that stands only on wet cells (`canPlace`), chained in `UPGRADES`;
  `GRATE_OF` and `isGrate` in ringWall.ts, counted among the ring's pieces). `missingPieces` wants one on every wet
  ring cell in a river or a stream (`riverCell`: the water through the cell narrower than `GRATE_WATER_MOST` (7) along
  one axis, so a river the ring crosses and a stream the ring runs down both get them); the sea and a lake (wide both
  ways) are left open as before. Drawn from DawnLike's fence runs (`art/packs/dl_fence.png`: wooden bars for the
  palisade, iron for the stone wall, pale steel for concrete; brick and force graded), turned to stand down a column;
  a pick's join pictures now take its grade (a lich town's palisade runs were drawn ungraded beside its graded posts).
  On the tactics board a water tile in the wall's column is a grate tile once the town has built one (block `wall`,
  nobody stands on it), else the gap it always was. **Gates on all four sides** (the owner: "so travelers can wander
  in"): `gateCells` puts one on the camp's row to the west and east and on the camp's column to the north and south,
  each moved along its side up to `GATE_SEEK` (6) cells to stand on dry ground (a gate that still can't stand leaves
  its cells to the wall or a grate); the road crossings as before. Tests in `test/ringWall.test.ts`.
- **Night prowlers (the owner: "give purpose to the palisade... thieves, creatures, enemies might sneak in at night to
  steal goods or people"):** `src/shared/sim/prowlers.ts`, hourly from sim.ts beside the lurkers. While the ring
  isn't standing all round, or there is none (`ringGap`: the share of the ring's cells with no piece standing; a
  castle, the hold and the horde have none), each night hour (`PROWL_FROM` 22 to `PROWL_UNTIL` 5) from day
  `PROWL_FIRST_DAY` (2) in a town of `PROWL_PEOPLE` (3) grown-ups or more there is `PROWL_PER_NIGHT_HOUR` (1/36) times the gap of a prowl, never within
  `PROWL_GAP_HOURS` (36) of the last (`s.lastProwl`): a raid begun inside the town with no warning
  (`startRaid(..., inside)`) at a cell of the ring with nothing standing on it (`wayIn`), else at the town's edge on
  the camp's row. Who comes is by the age and the land (`prowlKind`; the raid kinds `prowl_*` in data/raids.ts, weight
  0): a rival tribe's sneak-thieves or wolves in the Stone Age, night thieves (valuables, a captive now and then),
  slavers (kidnap) or beasts after; wild dogs in the dry and cold lands. Its budget is `PROWL_BUDGET_SHARE` (0.55) of a
  raid's. The recap tells it ("came in by night, where nothing stood to stop them"). Off with the autopilot (the
  tests' plainGame). Tests: `test/prowlers.test.ts`.
- **Squads fill their own ranks (the owner: "the hero gets to auto add people to their squad when forming, but I can
  over rule it if I want"):** `fillSquad` in sim/conquest/squads.ts, run by `formSquad` (unless `auto` is false) and
  by the War tab's **Fill the ranks** button (the `conquest` command's `fill` op): the empty places in `FILL_ORDER`
  (the front row from its middle, then the back, then the middle), each with the kind that suits its row best
  (`ROW_KINDS`: shields, melee and spears in front; spears, melee and skirmishers in the middle; ranged, magic, healers
  and siege crews behind) among those the hero may lead and the town has trained, the worthier of a kind first, up to
  the hero's leadership; the places already set are kept, and the formation's selects change any of them. Test in
  `test/conquestSquads.test.ts`.

## Mood and play (0.24.0; the owner's asks)

- **Places of leisure (the owner: "recreation things for the townsfolk to do, to help boost mood"):**
  `src/shared/data/recreation.ts`: six buildings merged into BUILDINGS, cheap and early to grand (`village_green` from
  the start, `quoits_pitch` with Woodcutting, `sparring_yard` with Spear Hunting, `fishing_jetty` with Fish Traps (a
  `shore` building: `canPlace` wants water beside it, and `findSpot` puts it there like the boatyard), `pleasure_garden`
  with Masonry, `bandstand` with Market Charters), each with a small `morale` while it stands, and `LEISURE`: what is
  done there (`activity`: dance, play, spar, fish, stroll, or `watch` indoors; the theatre, bathhouse and cinema are
  visited too), how many at once, how long, the lift (`fun`) and its words. `src/shared/sim/leisure.ts`: `wantsRelax`
  (by day, fed and rested, free of the town's business and the watch; spirits under `RELAX_BELOW` (55) take a break
  before the day's work, anyone with nothing to do takes one instead of wandering; never within `RELAX_GAP_HOURS` of
  the last (`Person.relaxedAt`; `RELAX_IDLE_GAP_HOURS` for the idle), never more than `RELAX_SHARE` (a third) of the
  grown-ups at once; children where `children` play), the `relax` task in people.ts (to a spot of their own on the
  ground, `relaxSpot`; a stroll moves between them; indoors for the theatre), and `finishRelax`: `fun` to the morale at
  once and half of it for a day as `Person.fun` (in `mood()`), a bout in the yard a little melee (`SPAR_XP`), an hour
  on the jetty `CATCH_CHANCE` of a fish into the stores. New `Activity` values `spar` (the weapon swung: `WORK_SWING`),
  `play` (a throw now and then: `hkPose` `playing`), `fish` (the staff as a rod: `TOOL.fish`), `stroll`, `watch`
  (indoors). Pictures laid from the Fields and Village packs' small things (`PICKS`: the signpost for the green's pole
  with logs for benches, the rack and a post for the yard, the bridge planks for the jetty, rails and a peg for the
  pitch, beds, a bench and lamps for the garden, a tent and benches for the bandstand). The Townsfolk tab says
  "Playing on the green", "At the play"... (`LEISURE[].doing`). Tests: `test/leisure.test.ts`.
- **Mood drives what the town builds (the owner's ask):** a night out of a bed weighs heavier each night running
  (`Person.roughNights`, set in `doSleep`; `mood()`: the ground `GROUND_MORALE` (-6) and `ROUGH_PER_NIGHT` (3) more a
  night up to `ROUGH_NIGHTS_MOST` (4), "Slept on the ground (4 nights)"; a bedroll `ROUGH_BEDROLL_PER_NIGHT`). The
  planner's `Needs` carry `spirits` (`spiritsOf`: the grown-ups' mean morale) and `roughSleepers`: someone who slept
  out with no bed to spare has a home wished for first, whatever the pace of food and homes (`wishes`); spirits under
  `LOW_SPIRITS` (50) in a town of `LEISURE_PEOPLE` (3) grown-ups have the best comfort or place of leisure wished for
  before the workshops, and `topicScore` favours the topics that open one (+14, else +3). A hamlet under three never
  builds a place of leisure unasked (a roof comes first: 'lone-7' lost a person to a green and the games on it).
  Tests in `test/leisure.test.ts`.

## Visitors on the road (0.25.0; the owner's ask)

- **Visiting bands (the owner: "caravans who trade, travellers passing through, bandits trying to sneak in to attack
  from the inside or refugees looking for aid and some rest"):** `src/shared/data/bands.ts` and
  `src/shared/sim/bands.ts` (`bandsTick` every tick from sim.ts, after the shop). A band is a few strangers walking the
  land together (`Traveller.band`: the shop's loop leaves them alone, the map draws them like any traveller) and its
  state (`Band` in state.ts, `s.bands`: where they stop, `phase` coming, staying or leaving, `until`). A trade caravan's
  merchants come in with its **wagon** (the Village pack's cart rolling behind the lead merchant: `Band.wagon`,
  `snapshot.wagons`, `map/mapWagons.ts`) when the market's caravan arrives (`s.lastCaravanBand`) and stay till it
  leaves; besides, each hour from day `BAND_FIRST_DAY` (2) with no other band in town there is `BAND_HOURLY` (1/28) of
  one (`BAND_WEIGHTS`): **travellers** come in one side, rest at the tavern (else the market, the shop or the fire) for
  `PASS_HOURS` and go out the far side; **bandits in disguise** (from day `BANDITS_FROM_DAY` 4 in a town of
  `BANDITS_PEOPLE` 4) pass for travellers, loiter, and strike in the small hours (`strikeAt`, `STRIKE_FROM` 23 to
  `STRIKE_UNTIL` 3): a raid begun where they stand (`band_bandits` in data/raids.ts, weight 0; `startRaid(..., inside)`,
  `BANDIT_BUDGET_SHARE` of a raid's budget), unless a guard on watch sees through them first (`seenThrough`:
  `CATCH_BASE` + `CATCH_PER_LEVEL` a level of their best fighting skill each hour; then they strike at once, in the
  open); **refugees** (never to a town of `noWanderers`) camp just outside the town's edge and ask: a prompt of kind
  `refugees` (`askRefugees`: the beds free and the food in store, a story and a picture for the event box) with
  `REFUGEE_OPTIONS`: take them in (as many as the town's size allows join, `townFull`; `s.lastVisit` set), give food
  and rest (`REFUGEE_FOOD` a head from the stores; they rest `REFUGEE_REST_HOURS` and go on) or turn them away; each
  moves the town's reputation (`REFUGEE_REPUTATION`); unanswered after `REFUGEE_WAIT_HOURS`, they're fed if the stores
  hold a day a head, else turned away (`answerRefugees`, routed from roadEvents.ts). In a raid everyone but the bandits
  hurries on. The tap card says what a band's member is doing ("Trading at the market", "Camped at the gate, hoping
  for aid", "Resting a while": `travellerDoing` in main.ts from `TravellerView.band`/`bandPhase`). Off with the
  autopilot (the tests' plainGame; the tests spawn bands with `spawnBand`). Tests: `test/bands.test.ts`.

## Every province fought for, and march reports (0.26.0; the owner's ask)

- **Free ground is fought for** (the owner: "even an empty area on the war map should have a battle to capture it"):
  an army arriving at any province not the town's starts a battle (`arrive` in sim/conquest/armies.ts), free ground
  too. `defendersOf` (battles.ts) raises free ground's own: its folk under a headman where it has a settlement (two
  squads from a town up), else outlaws or the land's beasts; `FREE_FILL` (3) troops plus its tier and the days, a
  captain at `FREE_CAPTAIN` (0.55) of a realm captain's strength, and no walls. Won, it's the town's ("X is won"); a
  lair is cleared as before. The board draws them (`freeFigure` in warBoard.ts: a wolf or bear for beasts, the
  Brotherhood's captain for outlaws, the settlers' for folk; `BattleView.lair`). A march through free land fights at
  every province on the way and goes on after each battle won (`goOn`, also from `armiesTick` once the battle closes).
- **March reports** (the owner: "a recap to show what happens on a march"): `src/shared/sim/conquest/marches.ts`.
  Every march keeps a log on the army (`Army.march`, `MarchLog`: `beginMarch` from `marchArmy`; `noteMarch` for each
  province passed, `noteBattle` from `endBattle`: won or beaten, troops lost and foes felled, the heroes' fates,
  provinces taken). When it ends (`endMarch`: arrived, home, halted when the way is shut, beaten back, broken up) it
  becomes a `MarchRecap` (`ConquestState.marches`, the latest `MARCHES_KEPT` 8), a Journal line, and a `debrief`
  prompt "The march of X" in the event box with the whole story and a picture (`MARCH_REPORT_HOURS` 8). The War tab
  has **March reports** under Armies (the latest open, tap another for its lines; `WarView.marches`), each army card
  the march under way (`ArmyView.march`: battles won, taken, the latest line), and the news bubble a notice for the
  latest (`march:` in notices.ts). Tests: `test/conquestMarches.test.ts`, `test/conquestArmies.test.ts`.

## Room to grow, and sites cleared first (0.27.0; the owner's asks)

- **The ring wall stands further out** (the owner: "a little further out on the first ring, and the rings after it
  further as well"): `RING_MIN` 8 (was 6), `RING_PAD` 4 (was 3), `RING_STEP` 5 (was 4) in sim/ringWall.ts, so a first
  ring stands about 15 cells from the camp where it stood 12, and each wider ring steps out 5 at a time.
  `RING_CLEAR_PULL` is 20 (was 12), so the line's trees and rocks are still taken first from that far.
- **The wall shaped to the land** (the owner: "push past the river and be built on the other side rather than right
  down the middle; the walls don't need to be a square, any shape that gets the wall up faster without obstacles; still
  a gate on each side"): `shapeRing` (ringWall.ts) starts from the box (`wantRect`, still the ring's `rect`, which
  decides when a wider ring is wanted) and pushes every stretch of the line that runs along a river (a run of at least
  `PUSH_ALONG` (5) river cells on it) out a cell at a time till it stands past the far bank, at most `PUSH_MOST` (8)
  beyond the box; a river that only crosses the line keeps its grates; holes are filled. The line is `Ring.line`
  (`LineCell`: x, y and the `side` it faces: n, s, w, e; `lineOf` gives an older ring its box's edge). Everything that
  walked the box's edge walks the line: `missingPieces`, the gates (`gateCells(s, line)`: one where the camp's row
  meets the line west and east and its column north and south, moved along that side's run to stand on dry ground
  with both cells on it; and where roads cross), `gateAt`/`gateTurned`/`sideOn` by the ring, `ringGate` by side, the
  land opened to the line's furthest cell, and `ringGap` in prowlers.ts. Test: the river test in
  `test/ringWall.test.ts` (no run of river cells on the line; this seed's own east river pushed past).
- **Blueprints over trees and rocks** (the owner: "the town can place them over trees and rocks and the townsfolk
  would prioritize removing them, similar to the wall blueprint"): `findSpot` (planner.ts) looks over the wild too
  (`spiralSpot`/`fits` option `wild`: `wildToClear` in land.ts, a wood, rocks, a marsh or scrub, never a cell whose
  pool holds ore, gold or gems), each wild cell counting `WILD_SPOT_COST` (1.5) against a spot, so open ground near by
  still comes first but the town no longer walks far out to avoid a wood. `placeBlueprint(..., overWild)` lays it
  (`canPlace`'s `overWild`; the planner, the townsfolk's own homes, events and the shrine pass it), clears any wild
  cell with nothing left on it, marks the rest to gather and sets `Building.overgrown` (`overgrownCells`,
  `refreshOvergrown`; `cellCleared` from `clearCell` in people.ts). While overgrown: nobody builds it (`canWork` in
  property.ts), people walk into it (`blockedBy` in walk.ts) to fell the trees, its cells are taken ahead of other
  marked cells as the ring's are (`bestGatherTile`), and the planner keeps them marked over its cap
  (`planGathering`). Deliveries go on meanwhile. The tap card says "Clearing the ground first". Test:
  `test/siteClearing.test.ts`.

## Streets, weapons in hand, and hostiles on the land (0.28.0; the owner's asks)

- **Streets are built (the owner: "the town streets shouldn't just show up, they should be built, like the palisade,
  a stretch put up as a blueprint and built when they have time; streets where they walk a lot; a bridge across a
  river; a path to every gate"):** `src/shared/sim/streets.ts`. A street is planned first (`LandMap.plannedRoads`, a
  '#' string like `roads`; `planRoad`, `isPlannedRoad` in land.ts: `fits` refuses a planned cell, `roadDistance` counts
  it, `canPlace` refuses it but for gates): `connectRoad` → `layStreet` (buildings.ts: the way to the nearest street,
  `nearestStreet`, through gates, river water at `BRIDGE_COST` 4, `PIER_COST` in a sea town), the worn footpaths that
  join the streets (`planStreets` daily at hour 6: `STREET_WEAR`, `STREETS_A_DAY`, within `STREET_REACH`), and the way
  to each of the ring's gates and `GATE_PATH_OUT` beyond (`gatePaths`, hourly). Planned cells are drawn as a ghost
  (`drawMarks` in mapView.ts: a pale bed with dashed edges, planks over water) and laid a cell at a time (the `pave`
  task in people.ts, spare-time work, and in a town of `SMALL_TOWN` (3) or fewer before study: `researchCanWait` asks
  `paveReady`), out from the streets already down (`nextPave`), `PAVE_SECONDS` (15) a cell, a bridge `BRIDGE_SECONDS`
  (60) and `BRIDGE_WOOD` (2). The founding's streets are laid at once (`layAll`). The tap card says "Laying a street" /
  "Building a bridge". Tests: `test/streets.test.ts`.
- **Every gate in the first blueprint (the owner's ask):** a ring piece over a wild cell is laid as an overgrown planned
  piece (`missingPieces` returns `wild`), so the north, south, east and west gates show from the start; its cells are
  cleared ahead of the rest (`RING_CLEAR`).
- **Troops need somewhere to train (the owner's ask):** `src/shared/data/training.ts` (`TRAINING_BUILDINGS`: drill
  yard, archery range, kennels, arcane academy, siege workshop; `trainedAt(troop)`: magic at the academy, ranged at the
  range, horse at the stable, beasts at the kennels, healers at a healer's hut or better, siege at the workshop, the
  rest at a drill yard or barracks). `canRaise` (sim/conquest/squads.ts) refuses a kind without its building ("needs a
  Drill Yard or a Barracks"). The planner leaves them alone below `WAR_PEOPLE` (6) grown-ups.
- **Spending their own stat points, remembered (the owner's ask):** `Person.autoStats` (the `autoStats` command; the
  Character tab's checkbox "They spend their own points", `PersonView.autoStats`): `statsHourly` spends theirs the
  class's way whatever the town's setting; "Let them choose" sets it too.
- **The passing trader walks through (the owner's ask):** a purchase from a traveller is told with their name ("Bought
  X from Wren, a tinker passing through"), and the news bubble's row shows them on the map (`__showOnMap({ traveller })`
  in main.ts); travellers already walk in one side and out the other.
- **Raise a party from a quest card (fixed):** hunt, saga and quest cards have "Raise a party…" (`raiseFor` in
  expeditionsPanel.ts).
- **A calling's weapon in hand (the owner: "in order to use skills or attack in certain ways they need their weapon:
  an archer can't attack without a bow; the town should get its weapons early"):** `src/shared/data/armed.ts`
  (`armedForSkills`: casters and healers need nothing; a ranged calling needs a ranged weapon; the rest any weapon, but
  the monk, shapeshifter and dancer, who fight bare: `fightsBare`). `kitOf` (actions.ts) leaves a calling's skills out
  without it (spells stay); `personFighter` shoots only with a ranged weapon (a caster casts), and bare hands hit at
  `UNARMED_MULT` (0.6); `weaponRange` gives a shooter with no ranged weapon their melee reach. The planner orders a
  weapon each unarmed calling can use (`planCrafting` step 2b: one order at a time, only while food lasts 2 days), and
  the throwing stick needs no study. Tests in `test/weapons.test.ts`.
- **Traps out on the field (the owner: "randomly placed in the raids so they get used, not by the gates where the
  raiders never make it"):** on the tactics board every trap is laid on a random free tile from `TRAP_FIELD_FROM` (3)
  columns in from the raiders' edge to `TRAP_FIELD_TO` (3) short of the wall, the middle rows likelier (`layTraps`,
  seeded by the battle); on the trail, at a random point `TRAP_ALONG_FROM` (0.2) to `TRAP_ALONG_TO` (0.7) of its lane.
  Test in `test/tactics.test.ts`.
- **Hostiles roaming the land (the owner: "wild animals, roaming dead, bandits... to attack the townsfolk if they're
  walking through; this would help make the walls more necessary; guards patrol the nearby terrain; if an area is
  unsafe, less travellers come; a fight happens, the FF type, not the raid battle"):** `src/shared/data/roamers.ts` and
  `src/shared/sim/roamers.ts` (`roamersTick` every tick from sim.ts). Each hour from day `ROAM_FIRST_DAY` in a town of
  `ROAM_PEOPLE` (3) grown-ups (a lone founder caught bled out: half of eight lone towns were lost) a band may come out
  (`ROAM_HOURLY` 0.04, up to `ROAMERS_LEAST` + one a `ROAMERS_PER` grown-ups, `ROAMERS_MOST`) `SPAWN_BEYOND` cells past
  the town's edge (`s.roamers`, `Roamer`): wild beasts (the land's own, `BIOME_BEASTS`, else `ROAMER_GROUPS` by age),
  the restless dead by night (they crumble at dawn but on a lich's or vampire's land), bandits from day
  `BANDITS_ROAM_FROM`. It wanders about where it came out (`WANDER_PACE`), and anyone out in the open within `SEE_CELLS`
  is run down (`CHASE_PACE` 5.5 px a tick, people walk 4.8); a finished ring wall shelters everyone inside it, and with
  none the camp shelters by day only, to `DAY_KEEP_OFF` inside the town's edge (`sheltered`). Caught within `CATCH_PX`,
  a **skirmish** (`Skirmish`, `s.skirmishes`; `startSkirmish`): the one caught and anyone within `HELP_CELLS`, guards
  first, up to `SKIRMISH_MOST`, fight it on the FF screen (`startBattle`/`stepBattle`; `Person.skirmish` holds them,
  standing in `fight`; the fight is shaped as a trip, `Skirmish.e`, dest `wild:<kind>` (`wildDestination`, "the wilds"),
  so `s.watching` and the fight screen take it: `skirmishTrip`). Ended, its harm, wounds and experience go back as a
  trip's do and the result is the victory window; won, its loot goes to the stores; lost, each who went down dies at
  `ROAM_KILLS`. Either way the band is gone (it fights once). **Guards** on watch go after a band within `PATROL_REACH`
  of the town's edge (`roamerToHunt`, the patrol task's `band`) and take it on when they reach it (`guardEngages`).
  **Travellers** come `roadSafety` times as often (1 / (1 + `ROAM_DETER` a band within `UNSAFE_CELLS`): `travellerRate`
  in origin.ts and the visiting bands' chance). Seen: `snapshot.roamers` (`RoamerView`) drawn by a second `MapRaiders`
  (`roamerFigures` in main.ts: a figure a foe, `ROAMER_IDS` a band), a tap card (what it is, who it's after, Watch the
  fight), a person's card in a fight ("Watch the fight"), and the news bubble (`skirmish:` red with Watch; `roamers:`
  gold). Soak (12 days, 2 towns each of knights, vampires, druids, dwarves): 1 to 3 fights in the towns of 3 or more,
  no deaths on the land, deaths 19 against main's 17. Tests: `test/roamers.test.ts`.

## The lively town (0.30.0; the owner's ask: the town to look alive)

Twenty-three things to watch, mostly renderer-only and off on a slow phone (`calm`). Tests: `test/lively.test.ts`.
`window.__keepQuality = true` keeps a headless preview at full quality (it otherwise drops to `calm` and most of this
goes); `window.__cry`, `__graves`, `__traffic` (skiffs, carts, the ground's weather) are for previews too.

- **People at work.** A heavy load (`HAUL_LEAST` 4) goes in a wheelbarrow pushed ahead, heaped in the load's colour
  (`map/haul.ts`, the Glassblower pack's barrow). More mood icons from the 5000 Pixel Effects pack (`emote_alarm`,
  `lost`, `grief`, `think`, `proud`; `emoteFor` in mapPeople.ts: alarm in a raid or just struck, grief while
  `PersonView.grieving`, thinking at the desk, proud after a level, lost when idle long). Workshops at work show it
  (`snapshot.workingAt`; `map/workFx.ts`, looks by station in `map/workLooks.ts`: sparks and a glow at a forge, embers,
  steam, bubbles, sawdust, threads, glints at a study, blue arcs at the late works) and builders throw up dust and chips.
  **Pastimes** (`sim/pastimes.ts`, only where an idle wander goes): children play by each other (and every other one
  flies a kite on a fair day), elders sit by the fire (activity `sit`, the kneel pose), a couple walks out together
  from `STROLL_FROM` (17), and on **market day** (`marketOn`: one day in `MARKET_EVERY` 7, 9 to 16, three grown-ups)
  everyone idle browses the square (`marketSquare`) while stalls stand there (`map/mapMarket.ts`: the Glassblower
  awnings tinted, goods, cries). The **town crier** (the best talker about) calls `snapshot.news` (the latest milestone
  of `NEWS_HOURS` 4) for 6.5 s in every 20. The pens' grazers go out to a pasture below the pen by day in fair weather
  and walk home (`MapHerds.grazing`; no pasture over a building).
- **The town over time.** `Building.builtAt` and `.scorched`; `art/weathered.ts` paints moss, ivy and grime by age
  (`ageStage` in `art/wear.ts`: 6, 15, 30 days), soot for `SCORCH_DAYS` (3) after a fire, cracks and gaps on a wall at
  `damageStage`. A fallen raider leaves debris (`markDebris` in state.ts: a blade, a shield, arrows, bones;
  `DEBRIS_LASTS` a day; `map/battleDebris.ts`, DawnLike's item cells). A headstone for each of the fallen
  (`map/mapGraves.ts`: beside the graveyard, else south-west of the camp, fresh earth and flowers for 3 days; tap for
  who lies there). Doors dressed for the season (`map/seasonDecor.ts`, `decorRules.ts`: a plant, gourds and a sheaf, a
  lantern and a wreath).
- **Light and sky.** Street lamps every `LAMP_EVERY` road cells by the age (`map/streetLamps.ts`, `lampRules.ts`: a
  torch, the Village pack's lantern post, iron, electric), lit one after another out from the fire as dusk falls
  (`lampLit`). Cast shadows that swing with the sun (`art/sun.ts` `sunAt`, MapView `setSun`/`castShadow`: the picture
  in black laid before the building, skewed west in the morning; people's shadows lean too, `sunLean`). Lit windows
  spill a warm pool before the door. Stars over the dark beyond the known land, shooting stars and the cold lands'
  aurora (`map/nightSky.ts`, in the lights layer), and the moon's phase on the clock (`MOON_GLYPHS` in hud.ts).
- **Land and water.** `map/groundWeather.ts` (`groundRules.ts`): gusts as pale bands over the grass, puddles on the
  roads and grass as the ground gets wet (`wetnessStep`: soaked in `SOAK_HOURS`, dry in `DRY_HOURS`), snow settling on
  autumn's last afternoon and melting through spring's first day (`snowCover`). Reflections at the water's edge
  (`map/reflections.ts`: trees, bushes, rocks and people mirrored, never on ice). Boats of the age along the rivers
  (`map/mapSkiffs.ts`, the painted boats), horse-drawn carts along the roads (`map/roadTraffic.ts`,
  `trafficRules.ts`).
- **Presentation.** A big moment (`cinema/moments.ts` `momentOf`: a new age, a wedding, a birth, the founder's death,
  the dragon, a rebirth) letterboxes the town with a title card (`cinema/cinema.ts`, `#cinema` in index.html) and "Show
  me"; the camera never moves on its own. The news page is dressed for the age (`NEWS_TITLES` in notices.ts:
  Tales by the Fire, The Crier's Scroll, The Town Gazette, The Evening Bulletin, Holo-Feed; `#notice-sheet[data-era]`).
  A soft vignette darkens the view's corners (`VIGNETTE` in mapView.ts). (Blurring the far parts was left out: too dear
  on a phone.)

## The Calamity and monster nests (0.31.0; the owner's pick of the content updates, first of nine)

- **Monster nests** (`data/nests.ts`, `sim/nests.ts`): goblin warrens, spider dens and restless barrows come up on the
  land (from day `NEST_FIRST_DAY`, `NEST_DAILY` a morning at `NEST_HOUR`, `NEST_NEAR`..`NEST_FAR` cells out, at most
  `NESTS_MOST` plus one a Calamity stage; the kind by the ground, the origin and the Calamity). Each is a place
  (`PlaceKind` `nest`, `MapPlace.nest`: `NestState` kind, level, born, grew, raided), found when the known land reaches
  it or when its raiders are tracked home (`findNest`). It grows a level every `growDays` (sooner as the Calamity
  rises) up to `NEST_MAX_LEVEL` 5, its foes `NEST_DEFS[k].foes[level-1]` (the warren's master is Gnasher the Goblin
  King, the den's the Brood Mother (`NEST_ENEMIES`, the menagerie's giant spider grown huge), the barrow's the Barrow
  Wight); its creatures come out to prowl between it and the town (`spawnRoamerAt` in roamers.ts, a band of kind `nest`
  with its `name`: "goblins"), and from level `NEST_RAID_LEVEL` 3 it raids (`NEST_RAIDS`, `nest_*`, never rolled;
  `nestRaid`). On the board (`placeDestination`'s nest branch: "Spider Den, grown 3 to the north"); cleared, its hoard
  times its level, coins, and the Calamity's dread falls (`nestCleared`; `s.nestsCleared`). Only with the autopilot on.
- **The blight** (`sim/blight.ts`, kept apart so farming and regrowth needn't import the raids): round every nest
  (`nestBlight(level)` cells) and the Calamity's heart (its `scar`). Blighted fields grow at `BLIGHT_CROPS` (half),
  nothing regrows there (regrow.ts), and a ward stone within `WARD_REACH` keeps it off. `snapshot.blight`.
- **The Calamity** (`data/calamity.ts`, `sim/calamity.ts`): one a town, by the seed (`calamityKindOf`): the Ashen
  Tyrant, the Grey Rot or the Sleeper Below, each with its heart, omens, stage tellings, army (`CALAMITY_RAIDS`), avatar
  (`CALAMITY_ENEMIES`: 1100 to 1400 health, kits, trophies in `CALAMITY_TROPHIES`), heart guard and cult. `s.calamity`
  (`CalamityState`) wakes on day `CALAMITY_WAKES` (6). Each morning at `CALAMITY_HOUR` its **dread** (0 to 100) rises
  `dreadToday`: `DREAD_PER_DAY` + `DREAD_PER_NEST_LEVEL` a nest level − `WARD_DREAD` a ward stone. Stages by dread
  (`STAGE_AT`, `stageOfDread`): 1 omens (an omen most nights at `OMEN_HOUR`, a small chill), 2 the spreading (its heart
  goes on the board as `calamity:heart`, `heartDestination`; the scar grows `SCAR_PER_DAY`; the town raises ward stones,
  `WARD_BUILDING`, one a stage up to `WARDS_MOST`, left out of the planner's own loop by `NEVER`), 3 the cults (the
  unhappy are lured, `Person.cultist`; hidden cultists set fires, rob the treasury or hold rites; found out on
  `FOUND_CHANCE` a day, more with guards, and cast out), 4 the armies (`ARMY_DAILY` raids, `Raid.calamity` 'army'),
  5 the last siege (warned `SIEGE_WARNING_HOURS`, then a host of `SIEGE_SIZE` led by the avatar: `startRaid` with
  `host`). `calamityRaidOver` (from `endRaid`): the avatar down, the game is won (`s.gameOver.won`); else
  `SIEGE_RUIN` buildings burn, the dread falls to `SIEGE_LOST_DREAD`, and the third siege lost ends the town. Every
  stage is told in the event box (a `debrief` prompt with a picture). Clearing a nest takes `NEST_CLEARED_DREAD` + a
  level off; the heart `HEART_DREAD`, halving the scar, and it lies quiet `HEART_QUIET_DAYS`. Ten choice events
  (`data/calamityEvents.ts`, passages in `calamityMore.ts`, pictures in `PICTURE_OF`) come from their stage on; the new
  event effect `dread` moves it.
- **Seen:** the nests from the packs (`art/nests/`: the cave entrance, the webbed cocoon, the skull door; bigger as they
  grow) through `syncPlaces`; the blight as a dark-violet stain with the Undead pack's withered things in it and the
  heart as the dark totem with skulls and a pulsing glow (`map/mapBlight.ts`, `MapView.syncBlight`); nests violet and
  the heart on the minimap; **The Calamity** card on the Trips tab's Places (a dread bar, the stage, what's next, the
  latest omen, the heart's card; `snapshot.calamity`, `CalamityView`); a tile on the Town overview; the news bubble
  (the stage, red from the armies; the siege). Tests: `test/calamity.test.ts`.
- **Tuning:** a grown nest's raid comes in place of a raid already due within `NEST_RAID_DUE` hours (`scheduleNextRaid`
  after it), and so does an army's, so they don't pile on; adventurers are drawn to nests (`PULL_NEST` + `PULL_NEST_LEVEL`
  a level) and the heart (`PULL_HEART`) in parties.ts. The four new bosses each carry a unique (the Brood Stinger,
  Ashbringer, the Grey Harvest, Dreamshard). Soak (24 days, 2 towns each, people/deaths, main's in brackets): settlers
  7/4 (6/8), 3/6 (8/3); knights 12/6 (12/1), 3/7 (3/4); vampires 7/6 (4/7), 4/11 (9/4); 2 to 7 nests a town, knights
  and vampires clearing most of theirs, dread 3 to 18 by day 24 (the spreading around day 30 and on, sooner with nests
  left to grow).

## Cutscenes (0.32.0; the owner's ask: watched or skipped, full scripts, camera angles, humour throughout)

- **The scripts** (`src/shared/data/cutscenes.ts`, `CUTSCENES`): sixteen scenes on a 320x180 stage (`STAGE_W`,
  `STAGE_H`, the feet on `FEET`): the founding, the Calamity's three wakings (`wakeSceneOf`) and each stage
  (`STAGE_SCENES`), the last siege won or lost, its heart broken, the first nest found and burned, the dragon come and
  slain, a saga's triumph. A scene has a `cast` (roles filled from the town: founder, hero, wit, worrier, elder; the
  `avatar`, the `dragon`, or `foe:<enemy id>`) and `shots`: a backdrop (`look`, a painted backdrop id or `town`), a
  camera (`cam` on an actor or a point, zoom, tilt, eased toward `to` over the shot), acts (walk, enter, exit, face,
  pose), effects (shake, flash, lightning, fades, red, darken, rumble, glow), a spell sheet bursting (`burst`), a caption
  and lines (`{hero}`, `{Town}`, `{CALAMITY}` filled by `fillLine`). The humour carries the game's running jokes: Duchess
  the goat, the worrier's lists, the hero's speeches, villains with staffing problems. Every new big moment wants a
  script here.
- **The sim** (`src/shared/sim/cutscenes.ts`): `queueScene(s, id, opts)` casts it from the town as it is (`castFor`:
  names, looks and gear kept on `SceneRun`) and holds the event box's telling as its `fallback`; `s.scenes` waiting (at
  most `SCENES_WAITING`), `s.scenesSeen` to watch again (`SCENES_KEPT`). Watch (`watchScene`, the `scene` command) pauses
  the town; done or skipped (`endScene`) it goes on; skipped, or left `SCENE_WAIT_HOURS`, the telling comes instead.
  Keys are `s.nextSceneKey` (never `s.nextId`: taking ids shifted every later person and changed how lone towns grew).
  Queued by calamity.ts (`tell(..., scene)`), nests.ts (`nestScene`), dragon.ts, sagas.ts, and the founding at the
  first hour (sim.ts).
- **The player** (`src/renderer/cutscene/`): `sceneClock.ts` (pure: beats by line, `actorsAt`, `cameraAt`, `next` for
  a tap) and `cutsceneView.ts` (`CutsceneScene`: the backdrop's layers and the ground strip, townsfolk in Himeko dress,
  foes from their sheets, bursts, veils; letterbox bars with the caption, the speaker and the typed line; tap to finish
  a line or go on, Skip ▸▸). The strip offers it (`#scene-offer`, Watch / Skip) unless a battle, fight or question has
  the screen; playing, it hides the strip's other cards (`body.scene-on`) and the phone page its title bar, tabs and
  bubble (`body.scene`). Upright the picture is a near-square band (`UPRIGHT_FRAME`). The Chronicle's **Scenes** tab
  lists those seen with Watch again. `window.__cutscene(id, vars, foes)` queues one (previews). Tests:
  `test/cutscenes.test.ts`.

## The Deep (0.33.0; the owner's pick of the content updates, the third)

- **The data** (`src/shared/data/deep.ts`): the topic Delving (Medieval, after Mining; the planner scores it +30 at five
  people; Mining is a Medieval topic too, so a town gets to it some way into the age) and the **Shaft to the Deep** (`SHAFT`, a WORKPLACE in data/crops.ts with `SHAFT_WORKERS`; built by the
  planner's "learned to build it" loop). Five levels (`DEEP_LEVELS`: the Burrows, the Old Tunnels, the Glowing Lake, the
  Crystal Halls, the Abyss), each `DEEP_W` x `DEEP_H` (24x16) cells: the ore in its rock (`ores`, richer the deeper:
  coal, copper and tin, iron, silver, sulphur, gold, gems, rare minerals), its pockets (`pockets`: lakes, fungus grottos,
  ruins, crystal geodes, bones), how `hard` it digs, how much each cell `stir`s up, its `caveIn` odds, what climbs up out
  of it (`DEEP_RAIDS`, from the menagerie's creatures of its habitats and tiers: `habitatRaid` in data/menagerie.ts) and
  its `look`.
- **The sim** (`src/shared/sim/deep.ts`): `s.deep` (`DeepState`: the levels, the `stir`, the finds) begins once a shaft
  stands (`deepOf`). `makeLevel(seed, depth)`: rock with ore in veins, the pockets as blobs, the way up (`^`) in the
  middle of the top edge in a dug chamber. The shaft's miners take the ordinary `mine` task (with `cell` and `depth` on
  it); `workMine` in farming.ts hands a shaft to `workDeep`: each load is a cell carved out (`digDeep`): the cell from
  `deepTarget` (a pocket beside the tunnels first, then a winding way toward `deepGoal`, the nearest pocket not yet
  broken into, keeping to a tunnel's width), its stone and ore into their hands; a fungus grotto becomes a farm (`f`:
  `FUNGUS_FOOD` vegetables at `DEEP_DAWN`), a lake reached gives `LAKE_FISH` fish a dawn, a ruin coins and study on the
  topic being learned, a geode gems, bones bone. After `OPEN_AFTER` cells the way down (`>`) is found and the next level
  made; the miners always work the deepest level with rock to dig (`workingLevel`). Each cell may bring the roof down
  (`caveIn`: `CAVE_IN_KILLS` dead, else a broken bone). The stir settles `STIR_SETTLES` an hour; past `RISE_AT`, never
  within `RISE_GAP_HOURS`, something climbs up the shaft (`rise`: a raid of the working level's kind begun at the shaft).
  The scenes `deep_breakthrough` and `deep_abyss` (data/cutscenes.ts) are queued at the first breakthrough and on
  reaching the Abyss. Only the shaft's work and the hour touch it, so towns without one run as before; rolls are the
  seed's own. Miners digging below are off the map (`indoors` in the snapshot).
- **Seen** (`snapshot.deep`, `DeepSummary`; `snapshot.deepView`, `DeepView`, while `s.watchingDeep`, the `watchDeep`
  command): the shaft's tap card has **Go down into the Deep**, and the Town overview a tile for it.
  `src/renderer/deep/deepArt.ts` paints a level on one canvas (the rock in relief in the level's colours, lit rock faces
  over the tunnels, the earthen floor, still water, the fungus farms' glowing floor, ore glinting in the rock beside the
  tunnels, the unreached rock lost in the dark: `seenCells`). `src/renderer/deep/deepView.ts` (`DeepScene`) lays the cave
  pack's things on it (`art/deep/`: mushrooms on the grottos, crystals, the ruins' gates and statues, bones, boulders, the
  bonfire in the first chamber, the gate of the way down), torches along the tunnels with pools of light, and the
  miners in Himeko dress at their rock swinging picks with dust where they strike; the camera frames what's been dug and
  a drag looks along it (upright it fills the height). Its HUD (`#deep-hud`): ▲ ▼ between the levels, ✕ back up, the
  diggers, how far to the way down, a bar of the stir, the latest finds (a column down the right held sideways). The
  phone counts it as a full-screen view (`watchOn` in mobile.ts), and the strip's own cards stand aside
  (`body.deep-on`). Tests: `test/deep.test.ts`.

## Daughter villages (0.34.0; the owner's pick of the content updates, the fourth)

- **The data** (`src/shared/data/villages.ts`): when a town founds one (from day `VILLAGE_FROM_DAY` 10, with
  `VILLAGE_PEOPLE` 9 grown-ups at home, or `VILLAGE_PEOPLE_AT_SIZE` 7 at the player's chosen size (a probe's towns
  peaked at 9 grown-ups by day 25, so 16 never came); `VILLAGE_GAP_DAYS`
  apart, at most `VILLAGES_MOST` 3), how many go (`SETTLERS`), where (`VILLAGE_DIST` cells out), the loyalty numbers,
  carts, help in raids, being beset, weddings, the rebels' raid (`REBEL_RAID`, merged into RAID_KINDS) and the militia it
  sends by age (`MILITIA_BY_ERA`).
- **The sim** (`src/shared/sim/villages.ts`, `villagesHourly` from sim.ts; off with the autopilot, so the tests' plainGame
  never sees one):
  - **The parting:** at `VILLAGE_HOUR` a restless sort (`pickSettlers`: never the founder, a guard or a post's keeper;
    their partner and children go too) asks to go and found a village at `villageSpot` (firm ground, clear of the town
    and the other villages, some of each kind of land round it): a prompt of kind `village` (`Prompt.village`, about
    `parting`) with a story and picture: bless them (`BLESSING` and food from the stores, loyalty `LOYALTY_START.blessed`),
    let them go, or forbid it (they stay sore, or 4 in 10 go anyway, thinking ill of the town). `foundVillage` takes
    them out of `s.people` into `Village.folk`, widens the known land to it, clears its plots and plans a road to the
    town's streets (`layStreet`, for the townsfolk to lay); the cutscene `village_founded` tells it.
  - **A village** (`s.villages`, `Village`): its named folk, a head count (`pop`), a leader, its plots (`layPlots`: a fire,
    homes of the age (`HOME_BY_ERA`) and fields round it, more as it grows), what it has made (`goods`), its loyalty and
    news. Each morning it grows (`VILLAGE_GROWTH`), works its land (`makesOf`: the ground round it, `GROUND_MAKES`), and its
    loyalty drifts `LOYALTY_DRIFT` of the way to its leader's nature's rest (`LOYALTY_REST_BY_NATURE`) plus the tax's pull
    (`TAX_LOYALTY`): heavy tax under a proud leader settles it near nothing and it breaks away (`REBEL_AT`); a kindly one
    only sours. Nothing of the town's is built within `VILLAGE_KEEP` of it (`canPlace`).
  - **Carts:** with `CART_LOAD` made, a cart sets out by day (`spawnVillageCart` in bands.ts: a band of kind `village`
    with its wagon, `Band.village`/`home`) to the market (else the tavern), where `cartArrives` gives its load as tithe
    (loyalty at `TITHE_AT` or more) or sells it at `WORTH_SHARE` of its worth (the treasury short: it goes home full,
    loyalty down), then goes home down its road.
  - **Weddings** (`WED_DAILY`): a single of the town's and one of the village's; the villager moves in when there's a bed
    (with a wedding feast), else the townsperson moves out.
  - **Raids on the town:** a loyal village (`HELP_AT`, `HELP_FOLK` people) sends `HELP_SENT` militia as allies on
    `HELP_CHANCE` of raids (`villageAllies`, from `startRaid`).
  - **Beset** (`BESET_DAILY`, more as it grows): a prompt (about `beset`): send `HELPERS` fighters (away for `HELP_HOURS`,
    `Person.away` = -(3,000,000 + the village's id); each may come home hurt or not at all), pay sellswords
    (`SELLSWORDS_COINS`), or leave them to it (`BESET_LOSS` of its people, loyalty `REFUSED_LOYALTY`).
  - **Broken away:** a rebel village sends no carts or help and raids the town (`REBEL_RAID_DAILY`); gifts count half;
    at `RECONCILE_AT` it comes back, or a party sent to bring it to heel (the destination `village:<id>`,
    `villageDestination`, on the board, `villageHome` from comeHome) wins it back with a tribute.
  - **The player:** `giftVillage` (the `giftVillage` command: `GIFT_COINS` from the treasury, `GIFT_LOYALTY`).
- **Seen:** `snapshot.villages` (`VillageView`) and `snapshot.villageBuildings` (its plots as `Building`s with ids below
  zero: `villageBuildings`) drawn by the map with the town's own (main.ts merges them into `syncBuildings`); its folk walk
  between its houses by day (`villagerFigures` in main.ts). Tapping a village (or one of its folk) gives its card (hover
  kind `village`): The villages…, Send a gift. The Town menu's **Villages** tab (`panel/villagesPanel.ts`): a card each
  (tier and people, leader and nature, a loyalty bar from the middle, beset, helpers, a cart on the road; Show on the
  map, Send a gift; tapped: founded, makes, waiting to send, its carts, its folk, its news). The strip opens that tab by
  writing `littletown.subtab.build` (the panel frame hears it through the `storage` event in subtabs.ts). The minimap
  shows its plots; the news bubble a red notice for a village broken away. Tests: `test/villages.test.ts`.

## Town politics and law (0.35.0; the owner's pick of the content updates, the fifth)

- **The data** (`src/shared/data/politics.ts`): four blocs (`BLOCS`, `BLOC_DEFS`: the guilds, the devout, the soldiers,
  the commons), seven laws (`LAWS`: curfew, conscription, the temple tithe, a market charter, poor relief, harsh law, a
  day of rest; each with a `stance` per bloc), and the numbers for satisfaction, the council, crime, trials, strikes and
  revolt.
- **The sim** (`src/shared/sim/politics.ts`, `politicsHourly` from sim.ts, off with the autopilot; `s.politics`,
  `PoliticsState`):
  - **Blocs:** `blocOf` sorts every grown-up but the founder (guards, adventurers and fighting callings the soldiers; the
    pious and scholars the devout; crafters, keepers, the would-be rich and venue owners the guilds; the rest the
    commons). Each dawn a bloc's satisfaction drifts `SAT_DRIFT` toward `targetOf`: `SAT_BASE`, `LAW_PULL` a law in force
    it's for or against, the tax (`TAX_PULL`), its own concerns (the commons food and poverty, the soldiers the recent
    dead and the guards, the devout the gods' favour and a place of worship, the guilds the shops' takings) and its
    members' spirits (`MORALE_PULL`). A member feels it (`blocMood` in townsfolk.ts `mood`: "The commons are angry").
  - **The laws at work** (`dailyLaws`): conscription a little melee for all, the temple tithe coins to the gods' favour,
    the market charter a fee from each venue, poor relief coins to the poor, a day of rest a morale mark every seventh
    day; a curfew halves crime and keeps everyone from the tavern (`nightOut`); harsh law cuts crime and hardens the
    sentences.
  - **The council** (`council`, every `COUNCIL_EVERY_DAYS` at `COUNCIL_HOUR`, from day `COUNCIL_FROM_DAY` with
    `COUNCIL_PEOPLE` grown-ups): the unhappiest bloc's `proposalOf` (repeal the law it hates, else pass one it wants,
    else lower the tax) is voted by every grown-up's bloc (`callVote`); a prompt of kind `council` (`Prompt.politics`
    'vote'): let it stand, or overrule it (`OVERRULE_COST` off the side that won).
  - **Crime** (`crime`, at `CRIME_HOUR`, from `CRIME_PEOPLE` grown-ups): `CRIME_BASE` raised by the poor and the unhappy,
    cut by guards, a curfew and harsh law; the culprit weighted to the unhappy, the poor and the greedy sort; theft,
    assault, vandalism or (against an enemy) murder. Caught (`CAUGHT_*`, more with guards), a **trial** (`trial`, a
    prompt of kind `trial`): pardon, fine, the stocks, exile, and for murder the rope; each sentence moves the blocs
    (`SENTENCE_PULL`); the default by the crime and harsh law.
  - **Unrest** (`unrest`, at noon): a bloc under `STRIKE_AT` strikes (`s.politics.strike`, `STRIKE_HOURS`): its members
    take the `protest` task (people.ts: gathered before the seat, `protestSpot`, activity `protest`, no work done); a
    town whose members' satisfaction is under `REVOLT_AT` overall, or a bloc under `REVOLT_BLOC_AT` that has struck,
    **rises**: a prompt of kind `revolt`: give way (its hated laws repealed, the tax low), put it down (the soldiers and
    guards against the crowd: wounds, deaths, the ringleader exiled) or step down (`s.mainId` passes to the bloc's most
    persuasive).
- **Seen:** `snapshot.politics` (`PoliticsView`). The Town menu's **Council** tab (`panel/politicsPanel.ts`): each bloc
  (members, a satisfaction bar, what it would call for; tapped: who they are, where it's heading, its members), the laws
  (in force or not, who's for and against), and the log of votes, crimes, trials, strikes and revolts. The event box
  shows the votes, trials and revolts; on the map strikers shake their fists before the seat (the `play` pose) and
  shout (speech topic `protest`, a line for every nature); the news bubble a red notice for a strike. Tests:
  `test/politics.test.ts`.

## Portals to other worlds (0.36.0; the owner's pick of the content updates, the sixth)

- **The data** (`src/shared/data/portals.ts`): the topic Planar Lore (Medieval, after The Arcane Arts; the planner
  scores it +18 at six people), the **Portal Arch** (`PORTAL_ARCH`, built by the planner's "learned to build it" loop)
  and the **Planar Rift** (`PORTAL_RIFT`, `never` built: it tears open by itself). Three realms (`REALM_DEFS`): the
  **Feywild** (time runs strangely), the **Underworld** (drains the living; riches doubled), the **Elemental Planes**
  (burns and frostbite), each with its rule line, telling, painted backdrop, menagerie habitats, a boss at its heart
  (the Frost Archmage, the Lich Lord, the Iron Colossus), site names, loot, a heart's hoard and the raid of what comes
  out (`PORTAL_RAIDS`, `portal_*`, weight 0).
- **The sim** (`src/shared/sim/portals.ts`, `portalsHourly` from sim.ts, autopilot on): a finished arch with no realm
  opens one not yet open (the seed's order: `openPortal`, a `debrief` telling with the backdrop); from day
  `RIFT_FROM_DAY` (12), `RIFT_DAILY` a morning while none stands, a rift tears open on open ground onto another
  (`tearRift`). `s.portals` (`Portal`: realm, building, rift, the sites, stir, calm, a log). `makeSites` lays `SITES`
  (7) from the seed: names, places on the realm's map, creatures of its habitats by `SITE_TIERS`, the boss at the last.
  The next unexplored site is a `clear` trip on the board (`portal:<realm>`, `portalDestination`, in
  `boardDestinations` and the snapshot's destinations), which the parties choose for themselves. Home (`portalHome`,
  from `comeHome`): won, the site is explored, its loot and coins come home (doubled in the Underworld, the heart's
  hoard on top and coins thrice); each trip stirs the realm `STIR_PER_TRIP`. The rule falls on whoever went: the
  Feywild moves their `grownAt` by `FAE_AGE` days, may bless a skill (`FAE_BLESS`) or keep one (`FAE_STAYS`, never the
  founder); the Underworld drains `UNDER_DRAIN` of their health and may keep one (`UNDER_KEEPS`; the undying are
  spared); the Elemental Planes burn or frostbite (`ELEM_HURT`). The stir settles `STIR_SETTLES` a morning (a rift
  stirs a little on its own); past `RISE_AT`, never within `RISE_GAP_DAYS`, things come out of the portal (`risePortal`:
  a raid begun at it). The heart broken, the realm is calm: no more stir, nothing more to explore.
- **Seen:** the arch is the cave pack's horned gate between two crystals, the rift its summoning circle
  (`PICKS` in packBuildings.ts), with a violet glow after dark (`PORTALS` in mapView.ts). Its tap card has **Look
  through into X** (the `watchPortal` command, `s.watchingPortal`, `snapshot.portalView`; `snapshot.portals` the
  summaries), and the Town overview a tile per realm. `src/renderer/portal/portalView.ts` (`PortalScene`, a DOM page
  with a 2D canvas, `#portal-view`, `body.portal-on`): the realm's backdrop drifting behind a dark veil, the sites along
  a dashed winding way (the deep art's gates, ruins, statues, crystals, mushrooms by realm), the explored lit in the
  realm's colour, the next pulsing, the heart bigger; a bar with ✕, and a window (below upright, on the right sideways)
  with the rule, how far explored, who's there now, the stir and the latest lines. The phone page counts it as a
  full-screen view (`below` in mobile.ts). Tests: `test/portals.test.ts`.

## Inside every building (0.37.0; the owner's pick of the content updates, the seventh)

- **The sim** (`src/shared/sim/interiors.ts`; it changes nothing in the town, looking is all): `hasInside` (homes,
  workshops, studies, healers', temples, barracks, stores, the seat; never fields, pens, walls, gates, traps, the fire,
  the shaft, the prisons, the venues, which have their own windows), `insideOf(s, p)` (who is inside which building
  and where: asleep in their bed (`bed`), working an order at its station (`station`), studying at a desk (`desk`),
  watching a play (`floor`), eating at the stores (`table`), and at home of an idle hour: a child about the floor, a
  grown-up at the table by day and by the hearth of an evening), `lookInside` (the `lookInside` command,
  `s.lookingInside`) and `interiorView` (`snapshot.interior`, `InteriorView`: the building, its footprint, beds, who's
  inside and where, who lives or works there but is out and what they're at, the orders being made and the topic
  studied, its owner, night).
- **Seen:** a finished building's tap card has **Look inside** (main.ts). `src/renderer/interior/interiorView.ts`
  (`InteriorScene`, a DOM page with a 2D canvas, `#interior-view`, `body.interior-on`): the room seen from above, sized
  by the footprint (`cols`, `rows`), its back wall the Glassblower pack's stone with a window every third tile
  (`art/interior/walls.png`), its floor the pack's planks (the dungeon pack's flagstones for a forge, temple, hall or
  barracks: `Layout.stone`), furnished by what it is (`layout`, by `kindOf` in map/roomKinds.ts plus `temple` and
  `barracks`: beds along the walls, a table and chairs and a rug at home; shelves of books and desks in a study; the
  animated furnace (`art/interior/forge.png`) and racks in a forge or an oven in a kitchen; potions and sickbeds at the
  healer's; crates and barrels in a store; a throne and a long table in a hall; pews and an altar cross in a temple;
  cots and weapon racks in a barracks; benches and stools in a workshop) from DawnLike's decor cells
  (`art/interior/decor.png`) and the clutter, a brazier (`art/delve/fires.png`) where there's a hearth, a warm pool
  of light by the fire and night's dark over the room. Whoever is inside is drawn as the map dresses them (hkFolk):
  asleep with their head on the pillow and a z drifting up, working at the station facing it, reading at the desk,
  sitting by the hearth or the table, a child playing about the floor. A bar names the room with ✕; a window (below
  upright, on the right sideways) lists the owner, beds, what's being made or studied, who's in and at what, and who's
  out. The phone counts it as a full-screen view (`below` in mobile.ts). Tests: `test/interiors.test.ts`.

## Schools, apprenticeships and family trees (0.38.0; the owner's pick of the content updates, the eighth)

- **The data** (`src/shared/data/lineage.ts`): the lesson and apprenticeship hours, what they're worth at coming of age,
  what's inherited, the renown that makes a line famous.
- **The sim** (`src/shared/sim/lineage.ts`):
  - **Lessons:** a child at home takes the `lesson` task from `LESSON_FROM` to `LESSON_UNTIL` (`childTask`, from
    `chooseTask` in people.ts): to the school, else a study (the elder lodge, a library: `lessonPlace`), else round the
    fire with the elders, sat before the door reading (`lessonSpot`, activity `research`). Each hour counts
    (`Person.schooled`, `SCHOOL_PACE` at a school; `lineageHourly`).
  - **Apprenticeship:** from `APPRENTICE_FROM_SHARE` of the way through childhood a child is apprenticed (`apprentice`):
    their trade is a parent's best skill (else their passion), their master the best grown-up at it (`Person.trade`,
    `Person.master`); from `APPRENTICE_FROM` to `APPRENTICE_UNTIL` they take the `apprentice` task: at the master's
    elbow, doing as they do (the master's work animation). Each hour counts (`Person.apprenticed`).
  - **Coming of age** (`comeOfAge`, from `growUp` in social.ts; the notice says what they came of age with): a level of
    learning for every `LESSON_HOURS_PER_LEVEL` (research, social, their passion; at most `LESSON_LEVELS_MOST`), the trade
    a level for every `APPRENTICE_HOURS_PER_LEVEL` up to `APPRENTICE_SHARE` of the master's level (and a passion for it),
    each parent's traits on `INHERIT_TRAIT` (up to two), a parent's nature on `INHERIT_NATURE`, and the family's grudges
    (`INHERITED_GRUDGE` toward each parent's enemy, half toward their children).
  - **The record** (`s.kin`, `KinRecord`: name, parents, born, died and how, black sheep, calling, level, titles, foes
    felled): a child and both parents go in at birth (`recordBirth`), a death is marked (`recordDeath`, from
    `killPerson`), a culprit brought to trial is the family's black sheep (`blackSheep`, from `trial` in politics.ts); kept
    to `KIN_MOST`. **Inheritance** (`inherit`): a death passes their buildings and purse to the eldest grown child at
    home, else their partner, else a child (`heirOfEstate`), with a notice; with nobody, the buildings to the town.
  - **The lines** (`familiesView`, `snapshot.families`, `FamilyLine`): each founder with children (not one who married
    into a line) and their descendants by generation, those who married in beside their partner; renown (`lineRenown`:
    titles, foes felled, levels, less the black sheep), famous at `FAMOUS_AT`.
- **Seen:** the People menu's **Families** tab (`panel/familyPanel.ts`): a card a line (★ when famous, the living and
  the generations, its renown and black sheep); tapped, its tree: a row a generation, a chip a member (the dead with ✝,
  children small with their master, a black sheep ⚑ with a red border), lines drawn from parents to children in SVG; a
  living member opens their page. Children at lessons read before the school's door; apprentices work beside their
  masters on the map; a lesson in a building shows them at the desks inside it (sim/interiors.ts). Prisoners have their
  own sub-tab now. Tests: `test/lineage.test.ts`.

## A real trade economy (0.39.0; the owner's pick of the content updates, the ninth)

- **Prices** (`src/shared/data/markets.ts`, `src/shared/sim/markets.ts`; the price itself in `sim/prices.ts`, `priceOf`,
  kept free of heavy imports): once a market stall or a trading post stands (`marketOf`, `s.market`, `MarketState`; the yard is `marketStall`) every good has a price
  index (`price`, 1 = its `WORTH`). Each morning at `MARKET_HOUR` (`movePrices`) it drifts `PRICE_DRIFT` to a target:
  supply (`flow`: coins' worth the town sold, `noteFlow`, from the caravans' deals, the shop's sales and the wagons,
  halved each morning: `FLOW_WORTH` moves it a step, `FLOW_LEAST`..`FLOW_MOST`), war (`ARMS` dearer `WAR_ARMS` and food
  `WAR_FOOD` for every power at war with the town, a feud half), the season (`WINTER_FOOD`, `HARVEST_FOOD`) and any
  swing; noise `PRICE_NOISE`, bounds `PRICE_LEAST`..`PRICE_MOST`. The caravans' offers and `goodDeal`, the shop's
  material sales and upsells and its buying from travellers all go by `priceOf`.
- **Booms, shortages, gluts, crashes** (`swings`): on `SWING_DAILY` of mornings (at most `SWINGS_MOST`) a good the market
  deals in (`dealtIn`) swings by `SWING_MULT` for `SWING_DAYS`, with the news of why (`SWING_WHY` by `goodKind`, filled
  with a known power's name); a bad season (winter, or a war on) makes food shortages `BAD_SEASON` times likelier.
- **The trade house and its routes:** each power known and not at war (`routeState`; the player may close one, the
  `tradeRoute` command) is a route to its stronghold on the world map (`roadHours` by distance, `HOURS_PER_100`). It
  sells its own goods cheap (`makesOf`: `FACTION_GOODS`, `MAKES_PRICE`) and pays well for three it wants (`wantsOf`, by
  the seed, `WANTS_PRICE`), the more the further away (`DISTANCE_PREMIUM`), less a `TOLL` without a treaty
  (`sellPrice`, `buyPrice`; the house's haggling on both). At `SEND_HOUR` (`sendWagons`) the house sends a wagon down
  each open route it may run (`HOUSE_TIERS[].routes`, the best margins first): the goods the town can spare
  (`GOODS_KEEP`, `FOOD_KEEP`) that fetch `SEND_MARGIN` more there, up to the tier's load, and a stake of the treasury
  (`STAKE_SHARE`, `STAKE_MOST`; ledger line `trade`). There (`sellThere`) it sells, then buys what the town is short of
  (`SHORT`) or what's `BUY_MARGIN` cheaper; home (`comeHome`) it may have been robbed (`ROBBED` + `ROBBED_PER_DISTANCE`,
  half with two guards or an ally), and unloads at the stall (what won't fit sold off). A wagon reaching a power at war
  is seized. The run's profit (`settle`) goes to the route and the house's **standing**: Peddlers, Traders (150),
  Merchant House (600), Trade League (1800), **Merchant Power** (4500): more routes, bigger loads, haggling, loans; a
  merchant power is told in the event box with a morale mark, and its treaty partners warm `PARTNER_GOODWILL` a day.
- **Loans and going bust:** short of a stake worth `STAKE_LEAST`, a house of Traders or better borrows its tier's `loan`
  (`LOAN_INTEREST`, due in `LOAN_DAYS`); each morning `loans` pays it back when the treasury holds it; due and unpaid,
  or `LOSSES_CALL` losing runs in a row with it out, the house **goes bust** (`goBust`): the treasury and then the
  stores (dearest first) seized for the debt, standing back to nothing, routes shut `BUST_DAYS`, `BUST_MORALE`, and the
  tale in the event box.
- **Seen:** the Market menu's **Prices** tab (`panel/marketsPanel.ts`: the swings as cards, a grid of today's prices
  with arrows, dear and cheap marked) and **Trade house** tab (the tier and the next, the loan, a bust; a card each
  route, its wagon on the road, Close/Open the route; the ledger of runs); the Trips tab's world map draws the open
  routes faint gold and the wagons (🛒) along them (`WorldView.routes`, march kind `wagon`); the news bubble has a red
  notice for a loan falling due and a bust; the Treasury's ledger has the trade house's line. Only with the autopilot
  on (the tests' plainGame never trades). Tests: `test/markets.test.ts`.

## The peoples made deeper (the owner's ask: the thinner origins brought up to the deep ones)

Each people's own system runs itself (the autopilot on) and is shown on the Town menu's **Our ways** tab
(`panel/heritagePanel.ts`, `snapshot.heritage` from `sim/heritage.ts`); tales go to the event box through
`sim/telling.ts` (`tellStory`, a `debrief` prompt with a backdrop picked by its words).

- **The druids' living grove** (`data/grove.ts`, `sim/grove.ts`, `s.grove`): the grove's favour (−100..100) moves
  each morning (`GROVE_HOUR`, `groveMorning`): forest felled costs it (`noteFelled` from regrow.ts `noteCleared`;
  `FELL_ALLOWANCE` a day forgiven, the rest `FELL_FAVOUR` each up to `FELL_MOST`: the ring wall's clearing bites slowly),
  the wild grown back gives it (`noteRegrown`), and the druids tend `TEND_CELLS` felled cells on (their regrowth
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
- **The timelapse (the owner's pick; removed in 0.60.0, see "Catch-up without recaps"):** `src/renderer/timelapse.ts`. Each day at noon the strip takes a picture of the
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
  **The time away replayed (removed in 0.60.0, see "Catch-up without recaps"):** `src/shared/replay.ts` and `GameLoop.sampler` keep a frame each game hour of the
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

## Catch-up without recaps (0.60.0; the owner's ask)
- **No return recap or time-lapse:** `shared/gameLoop.ts` catches the town up in ordinary slices without sampling replay frames. The phone applies snapshots directly; it does not play a time-away replay, show an away report card, or create a journal recap. `snapshot.ts` also hides older away-report entries from saves made before this change.
- **No town timelapse:** removed daily screenshot capture and the Chronicle tab; returning to play no longer extracts or stores map images.
- Offline progress itself still runs, including its existing cap and raid/event handling. Version: 0.60.0.

## The townsfolk name their settlement (0.61.0; the owner's ask)
- **A vote on day 15:** `sim/settlementName.ts` builds ballot names from the biome, origin and recent town events. Each resident casts a seeded vote; the winning name is saved in `GameState.townName` and shown in the phone title and desktop ticker. Old saves keep their origin name until the vote. The vote is deterministic across saves.
- Version: 0.61.0.

## One coordinated wall project (0.62.0; the owner's ask)
- **The wall builds as one project:** `sim/ringWall.ts` releases every cleared section into work together and gathers materials for the whole planned ring. The cell pieces remain separate internally for pathing, combat damage and joined wall art. The old ring still stays until every section of the new ring is complete.
- Version: 0.62.0.

## Fine map zoom control (0.63.0; the owner's ask)
- **The phone menu's zoom can be set precisely:** a range control replaces the old 20% jumps with one-percent steps and shows the current value. The map previews smoothly while the slider moves, then redraws sharply when released. Pinch zoom remains available; one button restores the default zoom (`mobile/mobile.ts`, `mobile/index.html`).
- Version: 0.63.0.

## Longer seasons and calmer pacing (0.64.0; the owner's asks)
- **Ten-day seasons:** `DAYS_PER_SEASON` in `sim/time.ts` is now 10, so season and year labels follow the longer calendar.
- **Two days of offline progress:** `MAX_OFFLINE_MS` in `sim/offline.ts` is 48 minutes of simulated play time (two 24-minute game days); the existing away-time slowdown and event/raid gates still apply.
- **Fewer interruptions:** ordinary raids use a 72-hour base interval with a 48-hour minimum and 12-hour jitter (`data/raids.ts`). War, zombie, Deep Freeze and Rat Plague waves are no more frequent than every 48 game hours (`data/doom.ts`). Disasters now recur every 10–15 days, and choice events are spaced 72–120 hours apart.
- Version: 0.64.0.

## Origin signatures at the start (0.65.0; the owner's ask)
- **A distinct first study for every origin:** each town starts with its first origin-only heritage topic already learned. This makes its heritage lane visible as a learned starting point and applies its small matching bonus from the first day. The New Town feature list names the starting tradition (data/origins.ts); the six-step origin lines remain in data/research.ts.
- Version: 0.65.0.

## Origin honours, wall silhouettes, and construction crews (0.66.0; the owner's asks)
- **Plague is rarer:** the disaster weight is lowered while the existing warning, spread, and treatment rules remain in place (`data/doom.ts`).
- **Names earned by deeds:** residents earn a first and higher title for kills or expedition service; each origin has its own title names, and saved titles remain optional for older towns (`sim/annals.ts`).
- **Origin-shaped walls:** each origin's palisade gains a distinct crest and construction pattern in the town view (`renderer/art/originStyles.ts`).
- **Victory music:** a successful expedition fight switches briefly to its own triumphant score before the town's regular mood resumes (`renderer/musicMood.ts`, `musicScore.ts`).
- **Builders need room at the site:** workers claim separate open cells beside a blueprint; the available crew size follows the footprint, with larger buildings offering more spaces (`sim/people.ts`, `sim/state.ts`).
- Version: 0.66.0.

## Smooth zoom, and research shaped for each people (the owner's asks)
- **Zoom that keeps up (the owner: "sluggish and choppy"):** `layout()` in `mobile/mobile.ts` no longer snaps the strip's
  scale to whole screen pixels per art pixel unless the zoom is within `SNAP_NEAR` (4%) of one (halves below two): it
  used to jump between a few steps, so most of a pinch, and most of the zoom slider, did nothing and then leapt. While
  two fingers are down the canvas follows them once a frame (`showPinch`, on `requestAnimationFrame`), grows about the
  point first pressed and moves with the fingers, so a pinch pans too; the strip stops drawing meanwhile and holds the
  snapshots that arrive (`__pinching` in main.ts: the ticker stopped, `heldSnap` applied on release; the quality watcher
  forgives the pause, `resumedAt`), and on release `__zoomAbout(mx, my, from, to, nx, ny)` puts what was under the
  fingers where they lifted.
- **Research for each people (the owner's ask: shared research shaped per origin):** `src/shared/data/originResearch.ts`
  (`ORIGIN_RESEARCH`): for every people but the settlers, its own names for the shared topics (`names`, 30 to 50 each:
  the robots' Herbalism is Lubricants, the liches' Foraging Grave Robbing, the orcs' Archery Shooty Bows) and for the
  tree's lanes (`lanes`: the liches' Necromancy, the dwarves' The Forge...), a study pace by lane (`pace`: the liches
  0.6 on the occult and 1.4 on farming, the dwarves 0.75 on building and the forge, the knights 0.75 on war...;
  `studyPace`, multiplied into the topic's time in people.ts and the panel's estimates; the heritage lines and the
  settlers as before), and topics a people never studies (`forgone`: the dead and the machines leave out Family Life,
  Schooling and the crops' refinements, `UNDYING_FORGO`), which `prereqsMet` refuses and counts as met where another
  topic needs them. `topicName`/`laneName` are used wherever a topic is named (the tech tree and its card, the queue,
  "Research complete", the townsfolk's doings, the chronicle, the building and item cards; `ResearchView.origin`). A
  topic's card says what it's known as elsewhere and whether the people take to it or find it foreign. Test:
  `test/originResearch.test.ts`.

## The wall raised as one construction (0.67.0; the owner's ask: "a single construction, not one section at a time")
- **Every section in work at once:** `planRing` (sim/ringWall.ts) puts every laid piece clear of trees and rocks into
  work in the same pass; only pieces whose ground is still being cleared stay `planned`. `RING_AT_ONCE`, `RING_SPARE`
  and `RING_GATHER_AHEAD` are gone. The wall still never takes the wood another site waits on: `haulOrder` (people.ts,
  now exported) serves the town's other sites before any ring piece. `ringWants` adds the overgrown pieces' makings to
  the demand (the rest are counted with every site in work).
- **One figure for the whole wall:** `ringProgress` (sections standing of all, and the share of the work done, each
  section weighed by its build time), `snapshot.wall`; a piece's tap card reads "The town's wall, built as one: N of M
  sections standing (P%)" (main.ts). The pieces stay separate cells for pathing, damage and the joined art. Test in
  `test/ringWall.test.ts`.

## Review after the outside changes (0.68.0)

- **The suite was red on main** (17 tests): the changes from 0.60.0 to 0.67.0 were merged without running `npm test`.
  Each was looked at; the code was right and the tests had the old rules in them, but for two real fixes below.
  - Wave gaps (doom.test, freeze.test, ratplague.test) now read `WAR_RAID_EVERY_HOURS`, `ZOMBIE_WAVE_HOURS`,
    `FREEZE_WAVE_HOURS`, `RAT_WAVE_HOURS`; the away cap test (save.test) allows two days and expects no away report.
  - Seasons (farming.test, fields.test, livestock.test) are reckoned by `DAYS_PER_SEASON`, never "day 9 is winter".
  - Starting heritage (founding.test, heritage.test): a settlers' town starts with Homesteading; the druids' next study
    is Wild Speech.
  - The wall tests (ringWall.test) were rewritten with the wall raised as one construction (0.67.0, above).
  - The lone town (planner.test) is seed `lone-6`: 8 lone towns average 2.5 people at day 10 with builders' spots
    against 2.4 before, so `lone-8` reaching 2 was the seed's luck.
  - A lich town may sow one field once it has an inn (undead.test checks that rule, not the settlers' count).
  - The rain test's helper (innerLife.test `weatherTick`) found rain at one hour and set the clock to another.
- **Midsummer and midwinter are mid-season again:** `MIDSUMMER_DAY` (data/ceremonies.ts) and `CHRONICLE_DAY`
  (sim/annals.ts) are `Math.ceil(DAYS_PER_SEASON / 2)`; they were day 2, the season's start once seasons grew to ten days.
- **The news bubble clears the clock bar:** at its new top-left place (`#notice-bubble` in mobile/index.html) it sat on
  the strip's clock bar and hid the day, upright and sideways; it now stands just below it.
- Checked and fine: castle and hold rooms still get built with the builders' spots (probe: vampires and dwarves as many
  rooms by day 8 as before), the starting heritage topics all exist, and `Person.origin` set for a town's own people
  (makePerson) is read as "of the town" everywhere it was read as "a stranger".

## Smooth zoom (0.69.0; the owner's complaint: "sluggish and choppy")
- **Zoom that keeps up:** `layout()` in `mobile/mobile.ts` no longer snaps the strip's scale to whole screen pixels per
  art pixel unless the zoom is within `SNAP_NEAR` (4%) of one (halves below two): it used to jump between a few steps,
  so most of a pinch, and most of the zoom slider, did nothing and then leapt. While two fingers are down the canvas
  follows them once a frame (`showPinch`, on `requestAnimationFrame`), grows about the point first pressed and moves
  with the fingers, so a pinch pans too; the strip stops drawing meanwhile and holds the snapshots that arrive
  (`__pinching` in main.ts: the ticker stopped, `heldSnap` applied on release; the quality watcher forgives the pause,
  `resumedAt`), and on release `__zoomAbout(mx, my, from, to, nx, ny)` puts what was under the fingers where they lifted.

## Raids and deeds (the owner's asks; branch claude/raids-and-deeds)
- **Titles from deeds:** `data/deeds.ts` (`DEED_TITLES`: a ladder of titles each for raids defended, buildings raised,
  pieces made, lives tended, topics learned, bosses felled, dungeons cleared, sagas ended) and `sim/deeds.ts`
  (`addDeed`, counted on `Person.deeds`; `awardDeedTitles` hourly from `annalsHourly`, beside the origin titles for
  kills and trips). Counted where each happens: a site finished (everyone building it), `finishPiece`, `doTend` and
  surgery, a topic learned, a boss's last blow (`credit` in raidRecap.ts) or a party's boss, a delve cleared, a saga's
  hero, and everyone who stood and lived in a raid not pillaged. `PersonView.deeds`; the People row shows the latest
  title, the Background tab every title and each deed with how far to the next. Test: `test/deeds.test.ts`.
- **The ring's shape by people:** `data/ringShapes.ts` (`RING_SHAPE_OF`, `RING_SHAPE_NAMES`); `shapeTest` in
  sim/ringWall.ts lays the shape over the ring's box (settlers' square, knights' star fort, the round ring of the
  nomads and the pack, octagon, honeycomb, coffin, winding grove, scalloped shell, petals, jagged camp, terraces),
  a straight run `GATE_FLAT` either side of each side's middle for the gates, and `TOWN_KEEP` round every building
  taken back in; then the river push as before. The wall's tap card names its shape (`snapshot.wall.shape`). Tests in
  `test/ringWall.test.ts`.
- **A fight on screen holds the game:** `fightOnScreen` (sim/raidWait.ts: a raid's battle or board, or a watched
  fight). `GameLoop` stands still while the page is hidden (`hidden`, set by mobileBridge.ts) and plays no time away
  for it; `holdForFight` (from sim.ts) holds every question's clock but the raid's own; `snapshot.fightOn`. Nothing
  pops up over it: the event box, the strip's question card, the cutscene offer and the toasts wait (the last
  `HELD_TOASTS` shown after); the recap waits for the board to close. Test: `test/fightHold.test.ts`.
- **The flashier raid screen:** `battle/juice.ts` (`BattleJuice`: impacts from the 5000 Pixel Effects pack, popping
  numbers, trauma shake, kill and combo callouts, sliding banners, the victory's rays, sparkles and confetti; rules in
  `battle/juiceRules.ts`). The tactics board feeds it its hits, kills, banners and ultimates, and draws the unit boxes'
  bars each frame with a draining ghost (`drawBars`); the trail battle's juice is fed by main.ts (`juiceTrail`, from
  snapshot diffs; the recap waits `VICTORY_MS`). The bars over heads (mapPeople, mapRaiders) have ghosts and a flash
  too. The minimap stands aside on a board or a watched fight (`body.board-on`). Test: `test/juice.test.ts`.
- **Victory music:** the `victory` mood for a raid driven off as well as won, and the board's win the moment it comes;
  a second victory piece (`walls_held`).

## Fixes, second batch (the owner's asks)

- **Walkers keep apart:** `MapPeople.walkAside` (map/mapPeople.ts): a walker is eased aside of anyone within
  `WALK_SPACE` (26 px), mostly across their way (`WALK_ACROSS`), at most `WALK_ASIDE_MOST` (14 px) and only a little up
  the map; worked from where they truly are every `SPREAD_EVERY` and eased in (`ASIDE_EASE`), so nobody jigs. Drawing
  only; nothing in a raid.
- **Every fight starts at 1×:** `fightOn` (sim/battle.ts: a raid's battle or tactics board, or a watched party's or
  skirmish's fight) and `fightSpeedTick` (each tick from sim.ts) put `s.battleSpeed` back to 1 as a fight comes on
  screen; `battleSpeedNow` uses it for watched fights too. The FF screen has its own speed button under the ✕
  (`#fight-speed`, `snapshot.fightSpeed`). `window.__skirmish(group)` starts a watched skirmish (previews). Test:
  `test/fightSpeed.test.ts`.
- **The fight banner at the top:** `#fight-banner` stands under the progress bars (`top: 36px`), clear of the fighters.
- **Lights at the gates first:** `gateLightCells` (sim/lighting.ts): at each finished gate of the ring wall a light
  just inside (the side nearest the camp) and one just outside (every gate's inside before any outside), placed first by
  `outdoorCells` within the town's `want` (counted as lit before the rest are chosen) and marked `Torch.gate`; the lamplighter (`lightToFeed`) feeds
  a gate's light before any other. Test in `test/lighting.test.ts`.
- **Events that fit the town:** `src/shared/data/eventFit.ts`: events about hunger and food (`FOOD_EVENTS`), sickness
  (`SICK_EVENTS`) and drink (`DRINK_EVENTS`) need someone living (`living`: not the raised dead, a lich or a machine,
  as `tireless`); weddings, births and birthdays (`KIN_EVENTS`) two grown-ups of the living (`couples`). `fitEvents`
  joins that to each listed event's `when` as EVENTS is put together (data/events.ts), so a lich or machine town never
  meets them. A new event about any of these goes in its list. Test: `test/eventFit.test.ts` (and any event whose
  words speak of hunger must be listed or named as someone else's hunger).

## Evolutions that matter (the owner's asks: origin roads, founders evolving, a big jump at each)

- **Each evolution is a big jump** (`data/levels.ts`): `evolveSteps(p)` is `EVOLVE_STEPS` [0, 1, 2, 3.2, 5] at their
  stage (none without a calling), times `ORIGIN_EVOLVE` (1.25) on a people's own road and `FOUNDER_EVOLVE` (1.5) on a
  founder's line. Each step adds `EVOLVE_HP` (12%) to health (`hpMult`), `EVOLVE_POWER` (10%) to blows, spell power
  and what they summon (`levelPower`), and `EVOLVE_ATTRS` (3) to every attribute and as many again to the two their road
  favours (`attributesOf`, through `roadFavours`). A people's own road also grows its class edge by `ORIGIN_EDGE` (1.2,
  in `classStat`).
- **Every people has a road of its own** (`data/originPaths.ts`, `ORIGIN_ROADS`): a third choice at the first
  evolution (level 12; the owner's call, it was the second), beside the shared stage-1 calling that suits it (`from`;
  the road branches from that calling's base), then straight on through stage 2, a stage-3 calling (`high`, from
  `HIGH`: the Warden of the March, Lord of the Ossuary, Warboss...) and the ascended form:
  the settlers' Militia Captain (beside the Knight), the liches' Grave Cantor (Occultist), the druids' Oakheart, the
  Court's Thrall-Lord and the orcs' Nob (Berserker), the pack's Moonhowler (Ranger), the machines' Servitor Prime and
  the alchemists' Transmuter (Tinker), the dwarves' Hearthguard (Sentinel), the merfolk's Tidecaller (Summoner), the
  nomads' Horse Archer (Archer), the fae's Glamour Weaver (Bard), the knights' Knight of the Order (Knight). Each node
  has its name, text, lore (`PathNode.lore`), signature skill (merged into `PATH_ABILITIES`), lean (merged into
  `LEANS`) and emblem (merged into `COMPOSITIONS`). In data/paths.ts they are `ORIGIN_PATHS` (`PathNode.origin`),
  in `PATH_BY_ID` but not `PATHS` (the shared tree) nor `branchesOf` from a shared node; `roadsFrom(id, origin)` gives
  a person's roads, which `roadsOpen(p, s)` uses (their people: `p.origin`, else the town's). `chooseRoad` leans a
  little to their people's road; the evolution card says it is theirs alone.
- **Founders evolve by choice** (`data/founderLines.ts`: the founders' table moved here from founderClasses.ts, which
  re-exports it, and `FOUNDER_ROADS`: for each of the 39 founders a road of their own at each of the first three
  evolutions, a name and line each, and a `bent` of stats). `FOUNDER_PATHS` in data/paths.ts is a tree a founder
  (`f_<id>`, then `_o` for the line's own stage or `_a` for the road of their own at each fork, `_x` the last stage,
  always the line's: 23 nodes a founder; `founderRoot`). A founder stands on it (`p.road`, set by `makeFounder`; an
  older save's by `adoptFounderRoad`, the line's own node of their stage) and is asked at each evolution like anyone
  (`FOUNDER_FORK` in pathLore.ts). `classStat` reads the node's stats on a founder's line (the line's signature, or
  with the bent); `callingName` names the road taken and the line's own stages to come; the emblem is the founder's
  violet and gold with their base calling's device, a different charge for the road of their own.
- Probe (20 days, two towns each of settlers, knights, vampires and orcs, nobody answering): 50 alive and 13 dead
  against main's 47 and 14; founders evolve about day 15 to 20, two or three townsfolk a town by day 20.
- Tests: `test/evolutions.test.ts`.

## Research picked by hand, and the seat that opens each age (the owner's asks)

- **Picking research:** `pickResearch` in sim/research.ts (the `queueResearch` command from the player; the planner
  still calls `queueResearch` the function). A pick goes in `ResearchState.picked` and to the front of the queue, its
  queued prerequisites picked with it (`orderQueue`: picks first, each after its own picked prerequisites); with the
  queue full, the town's own choices go from the back; full of picks, it's refused. `moveResearch` (the `moveResearch`
  command, `dir` -1 or 1) reorders the picks, never ahead of a prerequisite. `cancelResearch(..., byHand)` (the player's
  Remove) puts the topic and what depends on it in `shelved`, which the planner's `planResearch` skips while it has
  anything else; picking it again takes it off. `tidyPicks` drops finished picks. With no picks the planner runs as
  before. The Studies tab: queue rows say "your pick" (✋) or "the town's choice", with ▲ ▼ for picks, Pick for the
  town's, Remove for both; a topic's card has **✋ Pick: study this first**; picked nodes in the tree are blue
  (`.tn.picked`). `ResearchView.picked`/`.shelved`. Test: `test/researchPicks.test.ts`.
- **The seat opens each age's studies:** a topic of an era needs the seat (data/seats.ts) at that era's stage
  (`seatNeeded`: Stone Age 1, Medieval 2...; `prereqsMet`/`canQueue` take the stage as `seat`, from `seatStageNow`:
  the seat's stage, one less while it's being rebuilt; undefined, no gate, with no seat or `unlockAll`). The planner's
  `planSeat` now runs before the full-build-queue check, `canUpgrade` lets a seat over the slot limit, haulers serve
  the seat first (`haulOrder`), and a town with no seat (an older save) lays its first (open towns only). Shown: a
  dashed 🏛 node in the tree, a line on the Studies tab and on each topic's card (`ResearchView.seat`), the seat's tap
  card and its building card ("Opens studies").
- **Building wishes:** `sim/pins.ts` (`s.pins`, `Pin`: def, when pinned, the blueprint laid, what it waits on;
  `PINS_MOST` 5). The `pinBuilding` command (`def`, `on`; `setPin`, refused by `pinRefusal`: unknown, the seat and
  `never` buildings, walls and gates (the ring's), not learned, already pinned, too many; the refusal goes to the
  Journal). The planner's `planPins` (planner.ts, right after the seat, before the town's own wishes) lays each pin in
  the order pinned once a build slot is free, its makings can be had and there's a spot (`findSpot`, `roomSpot` in a
  castle), noting what holds it back on `Pin.why`; its cost is in the planner's demand meanwhile, so the town gathers
  for it, and its blueprint is never set aside (`pinned` in `shelveStalled`). `tendPins`: when it stands the Journal
  says "Your wish is built", a lost site or one not started in `PIN_WAIT_HOURS` (72) is told and dropped. The Building
  book's cards have **📌 Build this next** / **📌 Pinned: unpin**, and "Your wishes" lists them with Unpin
  (`snapshot.pins`). Test: `test/pins.test.ts`.

## The Quests tab and bonded parties (the owner's asks: "rework the whole Trips menu, maybe call it the Quests tab"; parties of friends that bond)
- **The Quests tab:** the panel id stays `expeditions` (saves, the desktop app); its label is Quests (`PANELS` in
  ipc.ts; the notices, tips and the Town overview's tile say Quests). Sub-tabs (`GROUPS.expeditions` in subtabs.ts):
  **Out now** (tiles at a glance: parties out, quests accepted and offered, companies, each a tap to its tab; the next
  party forming; a compact card a party out: a bar, who leads, home in, Watch; Recall in its details), the boats and the
  Calamity; **Quests** (accepted first, then the board's offers, the sagas, the quest log: `questLog` split out of
  questBoardPanel.ts); **Places** (the world map, the land's places, the pack, the destinations as compact cards: a row
  of chips (`.dest-chip`: threats, a party there, bounty, quest, forbidden, unexplored, cleared, purse) and one button,
  Send a party…; bounties and Forbid/Allow are in the card's details (`tripControls`); locked ones are a short list
  under "Not yet reachable"); **Companies**; **Realm**; **Treasures** (the guild forge, the uniques). The per-people
  tab names in theme.ts (Sorties, Raids) are kept.
- **Bonded parties** (`src/shared/data/companies.ts`, `src/shared/sim/companies.ts`): `companyHome` (from `comeHome`
  in expeditions.ts) counts each party home toward a bond between those of no company who went (`s.fellows`, by their
  ids); the same few out and back `BOND_TRIPS` (2) times become a **company** (`s.companies`, `Company`: name, members
  living and dead, formed, trips, wins, deeds; `s.nextCompany`), named by the seed (`nameCompany`: `NAME_ADJ`,
  `NAME_NOUN`, the people's own words `ORIGIN_NOUN`, the leader's name or the place of its first deed). A trip with two
  or more of a company counts as its trip (a deed, a win when `jobDone`), and whoever went with them joins while there's
  room (`COMPANY_MOST` 6). Fewer than `BOND_LEAST` alive and it breaks up (`tidyCompanies`), remembered till
  `COMPANIES_KEPT` push it out. They go out together again: `recruit` (sim/parties.ts) adds `RECRUIT_COMPANY` for a
  member of the same company as one going, and a leader with company home and fit leads sooner (`LEAD_COMPANY`).
  Friendship counts more in recruiting (`RECRUIT_OPINION` 1/8, was 1/20). `snapshot.companies` (`CompanyView`) feeds
  the Companies tab (members as chips, the dead ✝; tapped: formed, trips, members with calling and level, deeds) and
  names a company on its party's Out now card. Tests: `test/companies.test.ts`.

## Fixes, third batch (the owner's asks)

- **No roads through the ring wall but at its gates:** `ringWallCells`/`wallOnly` in sim/ringWall.ts (every cell of
  the ring's line but the gates' covers, and any gate standing there). `layStreet` never plans or paths over one,
  `planStreets`, `gatePaths`' way out and `squareRoads` skip them, and `pave` drops a planned street there; a road laid
  over a broken or missing piece kept the wall from being raised again (`canPlace`: "A road runs here").
  `liftRoadsOffWall` (hourly from `streetsHourly`, autopilot or not) lifts roads and planned streets an older town laid
  there, so the wall is wanted again. Test: `test/ringRoads.test.ts`.
- **A plain return (the owner: no recaps or time-lapse, a fast start, only the important things):** while the time
  away is caught up the strip isn't drawn (main.ts `catchUpSnap`: the ticker stopped, a dark "Catching up on your
  town…" screen with a bar, `renderer/awayCard.ts` `createCatchingUp`), and `GameLoop` runs `CATCH_UP_SLICE_MS` (200)
  slices back to back and sends a snapshot only every `CATCH_UP_SNAP_MS` (400). Done, the town is drawn from where it
  stands with nothing since popping up (no toasts, buzzes or sounds; raids fought meanwhile are marked seen,
  `raidRecap.seenNow`), and one card, **While you were away** (`createAwayCard`, `#away-card`), lists what mattered:
  `src/shared/sim/awaySummary.ts` (`awayBefore` before the catch-up, `awayWatch` after each batch since only the last
  raid recap stays, `awaySummary` after: the dead and how, those who left, each raid and how it ended, births and
  newcomers by name, a new age, treasures won, places found, a question waiting), on the last snapshot as
  `snapshot.away`; nothing important, no card. A scene waits to be offered until the card is closed. Measured on a
  day-12 knights' town, six hours away (two days' cap), headless: caught up 31 s after load where it was 36 s at
  desktop speed, 138 s where it was 157 s at a quarter of the speed (about a phone). The sim itself is now most of it (about 0.6 ms a tick, pathfinding a
  third): `findPath` is the next lever. Test: `test/awaySummary.test.ts`.
- **Back to the town:** a ⌂ button at the strip's bottom-right (`#centre-town`, main.ts) centres the camera on the
  camp; hidden in battles, on the board and in scenes.

## Guilds and squads (the owner's ask: the town forms its own guilds to fill a role it lacks)

- `src/shared/data/guilds.ts` and `src/shared/sim/guilds.ts` (`guildsHourly` from sim.ts at `GUILD_HOUR` 17; autopilot
  on; its own side stream `${seed}:guilds:${tick}`). Seven roles (`GUILD_ROLES`: wardens (defence), menders (healing),
  rangers (scouting and hunting), crafters, merchants, scholars, and the elite squad), each with the skills that fit
  someone (`fitFor`), the bloc that favours it and its perk. From day `GUILD_FROM_DAY` (5) in a town of `GUILD_PEOPLE`
  (4) grown-ups, no oftener than `GUILD_GAP_DAYS` (4) and at most one guild per `GUILD_PER_PEOPLE` (4) grown-ups, the
  town fills the role it lacks most (`needOf`: raids and the dead for wardens, the hurt and sick for menders, places
  and roaming bands for rangers, the craft queue, the venues, the research queue; the elite only in a town of
  `ELITE_PEOPLE` (6) raided lately, from fighters of `ELITE_LEVEL`), if `MEMBERS_LEAST` fit (`lacking`): either the fittest
  starts it, or (`COUNCIL_SHARE` 0.4, while the council sits) the council votes on it by bloc (sim/politics.ts
  `blocOf`). The town names it (`guildName`: `ORIGIN_WORDS` per people, darker for the elite: "The Black Knives", or
  "The Wardens of <town name>"), and the founding (or the vote that failed) is told in the event box (`tellStory`).
  Daily the ranks are kept (the dead dropped, a new leader, those who fit join up to `MEMBERS_MOST` 6, `ELITE_MOST` 4;
  the elite may call people from another guild; an empty guild disbands). `s.guilds` (`Guild` in sim/guildPerks.ts),
  `s.lastGuild`. **Perks** (sim/guildPerks.ts, read by raids.ts, health.ts and townsfolk.ts): wardens' blows
  `WARDEN_FIGHT` 1.15 and the elite's `ELITE_FIGHT` 1.3 in raids (`guildFight`), the hurt mend `MENDER_CARE` 1.25 faster
  while a menders' guild stands (`guildCare`), crafters and scholars at their own work `GUILD_WORK` 1.2 (`guildWork`),
  the rangers' daily haul of meat and hide, the merchants' dues to the treasury (ledger `trade`), and every member
  `MEMBER_MORALE` spirits (`guildMood`). Seen on the People menu's **Guilds** tab (`panel/guildPanel.ts`,
  `snapshot.guilds`, `GuildView`). Tests: `test/guilds.test.ts`.
- **The founder's edicts (the owner's ask):** on the Council tab each law's card opens on **Proclaim / Repeal by
  edict** and **Call a vote**, each paid for in coins (`EDICT_COINS` 40 from the treasury) or in standing (every bloc
  `EDICT_STANDING` 6 less content); the `edict` command (op `proclaim`, `repeal` or `vote`, the law, `pay`), checked by
  `edictCheck` and done by `issueEdict` in sim/politics.ts. A law proclaimed or repealed takes effect at once and moves
  each bloc `EDICT_SWAY` (6) the way its stance on the law goes (then the law's own pull, as for any law in force); a
  vote is the council's usual vote (`callVote` with no bloc: "<founder> called for..."). The next edict waits
  `EDICT_COOLDOWN_DAYS` (3: `PoliticsState.lastEdict`, `edictWait`, `PoliticsView.edictWait`). The council still
  governs itself the rest of the time. Tests: `test/edicts.test.ts`.

## The phone made smoother (the owner's ask: the same engine, TypeScript and PixiJS, running better)

- **Measured on a late-game town** (`test/fixtures/late-town.json.gz`: knights, day 33, 37 people, 281 buildings;
  `node tools/perf-sim.mjs [ticks]` gives a tick's step, its snapshot, the delta and its copy against the whole
  snapshot's, and the two days' catch-up). Desktop numbers, main → this work: snapshot 7.2 → 3.1 ms a tick; copying it
  between threads 21 ms (1 MB) → 0.3 ms (about 24 KB); catch-up of two days away 127.5 → 38 s (the end state the same to the byte).
- **The sim runs in a Web Worker on the phone** (`src/shared/simHost.ts`, started by `src/renderer/mobile/simWorker.ts`,
  built into `out/web/simWorker.js`): the game loop, the catch-up and the away card's summary, the autosave's writing
  out (the page stores the text: localStorage stays the page's), the alerts' look ahead and booking on the way out, new
  towns and legends, the journal, raid skip and battle speed (commands), and pausing while hidden. Messages: `ToHost`
  in, `FromHost` out; questions with an `id` get a `reply`. `mobileBridge.ts` is the page's side; a browser without
  workers loads the same file as a script (`__simHost`), and `?inpage` forces that. The preview hooks (`__raid`,
  `__saga`..., `__game.sim.step(n)`, `__game.snapshot()`) are messages now. The desktop app is as it was.
- **Snapshots go as what changed** (`src/shared/snapDelta.ts`: `SnapDiffer` in the worker, `SnapAssembler` in the page):
  each part compared by its JSON, a part that is the very same object taken as unchanged but looked into again every
  `RECHECK` deltas; the lists in `LISTS` (people, buildings, travellers...) thing by thing and field by field; the land's
  fields when they change, its pools and footpath wear every `POOLS_EVERY` deltas or when its version moves. Unchanged
  parts keep the same object on the page, and the page's `land` is one object changed in place, as the renderer had it.
- **Cheaper snapshots:** a person's slower parts (skills, kit, story, ties, mood's reasons...: `personSlow` in
  snapshot.ts) are worked out every `PERSON_SLOW_EVERY` (10) ticks, staggered by id; where they stand and what they're at
  (`personFast`) every tick. Any command (`viewsChanged`, from `Sim.apply`) has everything worked out afresh at once, so
  a button's change shows straight away. Politics and hunts likewise (`brief`).
- **Faster paths** (`findPath` in land.ts, the same paths as before): buffers kept between searches and marked by a
  generation; a heap in typed arrays with the same order of swaps; each cell's cost asked once a search and read from a
  grid of road and ground costs kept while the land's cells and roads are the same (`costGrid`); a goal shut in where the
  start isn't is found by flooding out from it (`SHUT_IN_MOST`) and answered at once (half the catch-up's searches were
  walkers heading somewhere they couldn't reach, each looking at 12 000 cells twice). A search from inside another's
  callbacks has buffers of its own.
- **Hitches fixed:** planning a street asked every building of every cell it looked at (317 ms): `builtOnIndex` in
  buildings.ts; a builder's spot looked at every footprint for every site for everyone idle: the cells indexed once
  (`coverOf` in people.ts); who rides in a raid sorted the town for each defender (`mountedNow`).
- **Deterministic as before:** end-state hashes match main on four seeds, a day of the fixture, and its two days'
  catch-up. Tests: `test/snapDelta.test.ts` (a snapshot put back together from deltas is the snapshot; the host starts,
  answers and saves; the path search).
- **The news bubble after time away** (the owner's ask: it counted every Journal line of the absence): closing the "While
  you were away" card (`createAwayCard`'s callback in main.ts) tells the page (`littletown:away-seen`, with the last
  Journal line's id), and `readAbsence` in mobile/notices.ts marks everything up to it read. Test in
  `test/notices.test.ts`.

## Developer upkeep: a short CLAUDE.md and a faster test run

- **CLAUDE.md is a working guide** (about 25 KB, was 470 KB): the opening sections as they were, with steps 4 and 6 of
  "How to work" changed, and **The systems** at the end, an index of every system: its main files and the
  HISTORY.md headings to grep. The whole record of what was built moved unchanged to `docs/HISTORY.md`. New build
  notes go in `docs/notes/<branch-topic>.md`, one file a branch, so agents working at once never edit the same file;
  the coordinator folds them into HISTORY.md (and a line into the index) when it merges.
- **The test runner** (`test.mjs`): bundles as before, then runs a process a job, `availableParallelism()` at once
  (`TEST_JOBS` to change it), the slowest jobs first. A file with a test that took `SPLIT_MS` (2.5 s) or more last
  time is split: each slow test runs alone (`--test-name-pattern=^name$`) and the rest of the file in one more process
  (`--test-skip-pattern` for each slow one), so a file of three long simulations no longer holds up the end. A test
  renamed or added simply runs with the rest of its file; a split job that matches nothing is fine. The times (each
  file's, and each top-level test's from the TAP report) go to `out/test-times.json` after a run where everything
  passed, seeded from the committed `test/times.json` (`npm test -- --save-times` rewrites it). `npm test -- castle
  ringWall` runs only the files whose names contain one of the words (bundled into `out/test-some`). The output: a
  line a job, a failing job's whole TAP report, the five slowest files, then `# files`, `# tests`, `# suites`,
  `# pass`, `# fail`, `# cancelled`, `# skipped`, `# todo`, `# duration_ms`; the exit code is 1 if anything failed
  (or a process died before reporting, counted as a failure).
- **Timings** (the cloud's 4 cores): `npm test` took 5 min 4 s before; the new runner takes about 4 min 27 s (965
  tests, all passing). That is close to the floor here: the tests are about 940 s of work on 4 cores. The critical
  path is now the slowest single test (undead.test.ts's lich-farming test, about 2 min, four towns simulated), not a
  whole file, so machines with more cores gain more. Profiling a long town run: about a fifth of the sim's time is
  `scanWild` in planner.ts (the open land's pools scanned and sorted afresh each tick that the planner's `needs`
  is asked for); caching it across ticks would speed up every test and the phone, but every place that changes a
  pool would have to bump `land.version`, so it was left for a change of its own.

## Legends across towns (the owner's ask), and the desktop app brought up to the phone

### Legends across towns
Built on "Dynasties and legacy" (sim/legacy.ts, renderer/legends.ts, panel/legendsPanel.ts).

- **The legend carries more** (`Legend` in sim/legacy.ts, all optional, so older legends read as before):
  - `parent` (the legend this town's founder came of) and `forebears` (the line's founders before it, oldest first);
  - the town's name (`town`);
  - each hero's `cause` of death (from `s.fallen`);
  - the heirloom's `heirloomCarried` (generations), `heirloomGrade` and `cursed`.
  - The line's own heirloom is chosen first while the town still has it.
- **The Hall of Legends** (the Chronicle's Legends tab) is laid out in three parts:
  - **Our line**: this town's forebears, spirits, heirloom and old town (`snapshot.ancestry`, `ancestryView`).
  - **Lines of descent**: `linesOf` threads the legends by `parent` into chains of founders. A town whose parent is no
    longer kept still names its founders. The chain is drawn as `.legend-chain`.
  - **Every town**: newest first. The device now remembers 120 towns (`LEGENDS_MOST`; it was 40).
- **A descendant's town** carries its forebears as data from the founding: `foundAncestry` in sim/ancestors.ts, called
  by `inherit`, sets `s.ancestry` (`Ancestry`). Nothing reads the device's legends again, so the sim stays
  deterministic. Rolls come from the legend's id and the seed, or the side stream `${seed}:ancestors:${tick}`.
  Everything runs only with the autopilot on (`ancestorsHourly`, from sim.ts).
- **Spirits:** of a night (`VISIT_HOUR` 22, from day `VISIT_FROM_DAY`, `VISIT_GAP_DAYS` apart, `VISIT_CHANCE`) one of
  the old founder, its heroes or the line's older founders may come to the fire.
  - The first visit asks how the town honours them. It is a `ways` prompt, system `legacy`, answered by
    `answerLegacy` through heritage.ts:
    - a feast: food, a morale mark, and greater blessings after;
    - counsel: the current topic advanced;
    - rest: they come half as often.
  - The first visit also shows the way to the old place.
  - Later visits bless: the hurt mended (`BLESS_MEND`), a skill taught, or a morale mark.
  - In a raid not begun inside, a spirit may stand with the town (`ancestorAllies` from raids.ts: `ancestor_shade`
    allies; `ALLY_CHANCE`, more once the old place is laid to rest).
- **The heirloom** comes down at +1 for each generation that has carried it (`setHeirloomQ`; `MAX_PLUS` caps it).
  - A fresh heirloom is cursed on `CURSE_CHANCE`, by the legend's id, so it is the same every time. One carried before
    keeps its curse.
  - At `CURSE_HOUR` the curse may bite its bearer (`heirloomBearer`): a wound, or a sore mood.
- **The old town comes back:**
  - **A town that fell** lies in ruins on the new land. **One that stood** has its founder's barrow there.
    - Either way it is a `MapPlace` of kind `ruin` with `old: true`, laid by `layOldPlace`, `OLD_PLACE_NEAR`..`FAR`
      cells out on dry ground.
    - Its foes are restless shades (more for a town that lost many), or barrow guards, led by `old_champion` (the
      shade of its greatest).
    - It is found as the known land reaches it, or by the first spirit's visit (`oldPlaceFound`). Its destination is
      named and described by `oldPlaceDestination`.
    - Cleared by a party (`oldPlaceCleared`), its dead are laid to rest: coins to the treasury, the curse lifted, the
      heirloom +1, a morale mark, and the spirits closer.
  - **A town that stood** is also **the Old House**, a power of the realm (`old_house` in `FACTION_DEFS`, `kin: true`).
    - It is never drawn as a rival (`pickRivals`), and is added by `addOldHouse` only where `s.ancestry.oldTown` is
      `'power'`.
    - It is known from the founding, starting at `HOUSE_START`. Its goodwill rests `HOUSE_WARMTH` warmer, and the
      Realm card says why.
    - Its armies are of its people (`oldHouseRaid`).
    - At noon (`HOUSE_HOUR`, `HOUSE_GAP_DAYS` apart) it sends a gift, or one of the old town's living heroes rides over
      to teach.
    - In treaty or warm, its riders come to raids (`house_rider`, `HOUSE_ALLY_CHANCE`).
  - The ordinary diplomacy (envoys, treaties, war) applies to it as to any power.
- **Foes and friends:** `LEGEND_ENEMIES` in data/legends.ts, merged into `ENEMIES`. They are the Himeko ghost tinted,
  the skeleton warrior, and the Craftpix knight.
- **New Town:** the founder's line hint says what a descendant brings.
- Tests: `test/ancestors.test.ts`.

### The desktop app brought up to the phone
- **Legends:** kept in `<userData>/legends.json`, which is `%APPDATA%\Little Town\legends.json`, beside the saves
  (main/legends.ts: `readLegendsFile`, `keepLegendFile`, `legendById`).
  - A new town makes the old one a legend and inherits from the chosen heir, as on the phone.
  - The panels ask for them over the bridge (`Bridge.getLegends`, `IPC.getLegends`; `primeLegends` in
    renderer/legends.ts, redrawn when they arrive; `legendsVersion` is in the journal's and New Town's keys).
- **The sim off the main process:** main/simThread.ts runs the phone's host (shared/simHost.ts) in a Node
  `worker_threads` thread. It handles the game loop, the catch-up, the autosave's text, the alerts' look ahead, and
  new towns with legends.
  - main/simClient.ts (`SimClient`, no Electron) talks to it: commands, `saveText`, `journal`, `newTown`, `hide`
    (save and book the alerts before quitting), `restart` on a new town, and `whole()` for `getSnapshot`.
  - The host takes `seed`/`biome` at init (`--seed=`, `--biome=`), `hidden` with `book: false` (a fullscreen app
    hiding the strip saves without booking alerts), and `speed` (the tray's debug speed). It now always answers a
    booking (`booked` with none).
  - Should the thread fail before its first word, the game runs in the main process instead (`spawnSim`).
  - `out/simThread.js` is unpacked from the archive (`asarUnpack`).
- **Snapshots as what changed:** main keeps the whole snapshot (`SnapAssembler`) and sends each window the delta
  (`IPC.snapDelta`).
  - A window that has just opened, was hidden or reloaded gets the whole one first (`synced`, `SnapAssembler.seed`).
  - The page puts them back together (renderer/deltaBridge.ts `withDeltas`, used by the strip and the panels). A delta
    with nothing to build on asks for the whole one again (`IPC.snapResync`).
  - The preload's own `onSnapshot` does the same in its world, as a fallback.
  - The snapshot used to be copied to each window whole, ten times a second.
- **Cheap fixes:** the tray has Music volume and Sound effects volume (0 to 100%) and Show minimap. A minimap hidden
  with its × could never come back on the desktop.
- **Still phone-only** (left as they are):
  - tips (mobile/tips.ts);
  - the news bubble and its read marks (mobile/notices.ts);
  - the full-screen event box (eventSheet.ts; the desktop uses the strip's question card);
  - pinch zoom and the zoom slider (the desktop draws at 1, wheel only);
  - vibration;
  - the inspect card (the desktop has tooltips and the action bar);
  - the screen wake lock;
  - the debug `__raid`/`__saga` hooks (they're host messages; the tray doesn't offer them).
- Tests: `test/desktop.test.ts`.

# Seasonal festivals (the owner's ask: a DLC-sized update)

Every people (all 13 origins) keeps a festival each season, so each town has four a year of its own. The town runs
them itself; there is nothing for the player to do.

- **The calendar** (`src/shared/data/festivals.ts`, `FESTIVALS`: 52, `festivalFor(origin, season)`): each has a name,
  lore, what the town is doing at it (`doing`), a food and a ware made for it, its god (`Domain`), a boon (a lever
  and its multiplier), a decor kit (`DecorKit`), its pennant colours and lantern, and a song (`FestivalSong`: name,
  mode, tempo, metre, lead, drums). It falls on `FESTIVAL_DAY` (7) of its season; the town makes ready `PREP_DAYS` (3)
  before; it begins at `FESTIVAL_HOUR` (17) for `FESTIVAL_HOURS` (4), and may be put off by a raid or a funeral up to
  `FESTIVAL_LATEST` (21), else it's missed.
- **Foods and wares** (`FESTIVAL_ITEMS`, merged into `ITEMS`; ids `fest_<id>_food` and `fest_<id>_ware`): made at the
  campfire with no study, from cheap makings of each people's own (blood for the Court, fish and kelp for the merfolk,
  bone for the liches...). How many: `FOOD_LEAST`/`WARE_LEAST` plus one per `PER_PEOPLE` grown-ups, up to `MAKE_MOST`.
- **The sim** (`src/shared/sim/festivals.ts`, `festivalsHourly` from sim.ts after the ceremonies; autopilot only;
  `s.festival` the run, `s.festivalLog` the last 16 outcomes; optional fields, no save bump):
  - **Making ready:** from the first prep morning the food and ware are ordered at the fire (`orderMakings`, topped up
    each morning at 6; the planner gathers their makings like any order's). They go to the head of the craft queue,
    over its limits: with a full queue a shore town's festivals were once bare.
  - **Visitors:** on the day at 9 a travellers band comes in for it (`spawnBand(..., note)`, a side stream
    `${seed}:festivals:${tick}`, from `VISIT_PEOPLE` grown-ups) and the roads are busier (`travellers` mark `VISIT_MULT`).
  - **Held** (`hold`): needs `FESTIVAL_FOOD_DAYS` (2) of food left after `FESTIVAL_FOOD` a head (only the living eat:
    a lich or machine town never skips). The food is shared and the wares sold to the visitors (`WARE_PRICE` x the
    age's purse each, ledger `events`); the whole town gathers round the fire (gathering kind `festival`, with
    `gathering.festival` its id; `festive` in ceremonies.ts, so everyone dances).
  - **Over** (`festivalOver`, from `endGathering`): a morale mark (`FESTIVAL_MARK`), its boon for `BOON_HOURS`, its god's
    favour `FESTIVAL_FAVOUR` (sim/faith.ts), all scaled by how ready it was (the share of food and ware made).
  - **Skipped for want of food:** `SKIPPED_MARK` on the town and `SKIPPED_FAVOUR` off its god; the orders are dropped.
  - `ceremonies.ts` exports `gather`, `here`, `foodDays`, `eatFeast` for it.
- **Festival-only choice events** (`src/shared/data/festivalEvents.ts`, `FESTIVAL_EVENTS`, passages in
  `festivalMore.ts`, pictures in `PICTURE_OF`): four for any town and one for each people, `FESTIVAL_EVENT_WEIGHT`
  (25), coming only while a festival is being made ready or is today. `EVENTS` is now 553.
- **On the map** (`map/mapFestival.ts`): `sync(gathering, prep)`. From the first prep day the poles, pennants and
  lanterns go up round the fire in the festival's colours with its kit's things round them (`KITS`: the packs' plants
  and fruit, candelabra, skulls and bones, the grove's trees, corals and shells, crystals, gold and shields, the totem
  and flags, flasks, ash pits); at the festival the feast's table, confetti and fireworks besides, in its colours.
  `snapshot.festivals.on` gives the spot. The crier calls it (the Journal's key line).
- **Its music** (`renderer/musicScore.ts`): `festivalPiece('fest:<id>')` makes each festival's song from its mode,
  tempo, metre, lead and drums, the key and chord plans by its id; `pieceById`; the mood `festival` (`musicMood.ts`)
  and `music.update(on, mood, song)` play it over and over while the town is gathered. A fanfare as it starts (sfx.ts).
- **Seen:** the Chronicle's **Festivals** tab (`panel/festivalsPanel.ts`, `snapshot.festivals`: `festivalsView`):
  what's next (days till it, when making ready starts, the food and ware made of what's wanted) and the year's four,
  each opening on its lore, food, ware, god, song and boon, with how it went last time.
- **Previews:** `window.__festival('prep' | 'hold')` on the phone page (`previewFestival`: held now, with food enough).
- Tests: `test/festivals.test.ts`. Probe (28 days, one seed each, autopilot): settlers, knights, vampires, liches,
  merfolk, orcs and machines held the festivals they reached, mostly fully ready (one settlers' autumn festival missed).
  People at day 28 against main on the same seeds: knights 10 (5), merfolk 4 (2), orcs 14 (3), settlers 3 (4),
  vampires 9 (7): single seeds, so noisy, but no sign of harm. Checked on the phone upright (393x852) and sideways (852x393).

## The skies (the owner's ask: a DLC-sized update)

Airships from the Industrial age, sky pirates, and flying creatures hunting the town. Modelled on the boats.
`src/shared/data/skies.ts` (the data) and `src/shared/sim/skies.ts` (the rules); every roll is the skies' own side
stream (`${seed}:skies:...`), and the places in the sky have no side drawn at founding (`destSides` skips `bySky`), so a
town without airships plays out as before (checked: fresh towns byte-identical to main through day 4.5).

- **The fleet:** `AIRSHIPS` (dirigible from Aeronautics, zeppelin from Rigid Airships, both Industrial; sky cruiser
  from Air Cruisers, Modern; sky frigate from Skyships, Space; `SKY_TOPICS` in the logistics branch, the planner scores
  them +20 at six people, +8 more on Growth or Trade): crew, `speed` (a trip's legs divided by it), `hull`, `cargo` (on
  top of the party's packs), `guns` (the share of a sky fight's foes driven off before it comes to blows). The **Airship
  Mast** (`AIRSHIP_MAST`, station `airship_mast`) builds them as crafting orders (`airship_<kind>`, `ItemDef.airship`);
  finished, `launchAirship` puts her in `s.airships` (`Airship`: kind, name from `AIRSHIP_NAMES` in turn, hull, away)
  and breaks up the worst past `AIRSHIPS_MOST` (3). Mended `SKY_REPAIR_SHARE` a dawn for a unit of steel or cloth; she
  flies only above `AIRWORTHY` (half).
- **The plan** (`planAirships`, hourly from `skiesHourly`, autopilot on): a mast once Aeronautics is learned and the
  town has 4 grown-ups (`findSpot`), then an airship, a second at 10 grown-ups, a better kind as each age brings one;
  one order at a time, only with the makings and 4 spare.
- **Flying anywhere:** `fliesWith` (every trip but the full moon's hunt and a fight on the land) takes the best free
  airship that seats the party; `sendExpedition` prefers her to a boat (`Expedition.airship`, `boardAirship`), the trip's
  legs go `flySpeed` times faster, and her hold adds to `partyCarry`. Four places only she reaches (`SKY_PLACES`,
  `Destination.bySky`, on the world map at `SKY_SPOTS`): the Cloud Isles (harpies), Gale's Roost (the sky pirates'
  harbour: Captain Hesper Gale, `captain_gale`, a boss with a kit, a relic trophy `gale_storm_saber` and the unique
  Cloudpiercer), the Roc's Eyrie (the Roc) and the Storm Crown (the Thunderbird, Modern). An island takes an airship
  when no boat is free. `canSend`, `mostFor` and the parties' `choosable` know all this.
- **Aloft** (`skyHour`, each hour out and back): a storm (`SKY_STORM_HOURLY` by season, `SKY_STORM_HURT`; a bad one
  may throw someone out, `THROWN`, who dies unless they catch a line, `CAUGHT_A_LINE`), guns from a power at war with the
  town (`FLAK_HOURLY` a power, `FLAK_HURT`), sky pirates (`SKY_PIRATE_HOURLY`, `SKY_PIRATE_GROUP` by age) or flyers
  (`FLYER_HOURLY`, `SKY_FLYERS`), fought on the FF screen with the skies' own stream. Her hull gone, `crash`: she's lost
  (`s.skies.lost`), the loot with her, each aboard dies at `CRASH_KILLS` (0.45), and the rest walk home from where she
  came down (`Expedition.crashed`). Nobody left alive, she never comes home (`airshipLost`).
- **Sky pirates** (`skyPiratesHourly`): a town that flies, or any town from the Modern age (`piratesMayCome`), from
  paced day `SKY_RAID_FROM_DAY`, never within `SKY_RAID_GAP_DAYS` of the last, and only in place of a raid due within
  `SKY_RAID_DUE` hours (like a nest's raid). Their ship is seen (`seePirates`: `s.skies.pirates`, a red notice) and
  `SKY_WARNING_HOURS` later they slide down their ropes into the middle of the town by the stores (`dropIn`:
  `startRaid(..., inside)` with `SKY_RAIDS` by the age, weight 0, `SKY_RAID_SHARE` (0.7) of a raid's budget): walls don't stop
  them. Gale's Roost cleared (`airshipHome` with the job done), they keep away `ROOST_QUIET_DAYS` (`s.skies.quietUntil`).
- **Hunters from the sky** (`skyHuntersHourly`, from day `SKY_HUNT_FIRST_DAY` 5 in a town of `SKY_HUNT_PEOPLE` 4, on
  `SKY_HUNT_HOURLY` 0.006 an hour, more in the highlands, one at a time): a roaming band with `Roamer.flying`
  (`SKY_HUNTERS` by age, birds by day and bats by night, from the menagerie). `moveFlyer` in sim/roamers.ts: it flies in
  from beyond the known land at full speed, circles over the town, and stoops on someone out in the open
  (`SKY_SEE_CELLS`); walls are no cover, only a roof (at a desk, at work at a station, and those indoors the prey leave
  out). Caught, a skirmish on the FF screen as with any band. The town shoots back (`skyVolley`, every `VOLLEY_TICKS`):
  each defence engine and each grown-up with a bow, gun, wand or staff within `VOLLEY_CELLS` hits on `VOLLEY_HIT`, a
  hit `VOLLEY_HURT`; at `FLEE_AT` it flies off, at 1 it falls and its carcass comes in. Guards don't chase it on foot.
  The land's bands count without the flyers, so their own spawning is as before.
- **Seen:** `snapshot.airships` (each with a `leg` while she's leaving or coming home over the town), `snapshot.mast`
  (its footprint), `snapshot.skyPirates` (coming, or over the raid), `RoamerView.flying/height/hurt`,
  `ExpeditionView.airship/crashed`, `DestinationView.bySky/airship` (`airshipLine`). `src/renderer/art/airshipArt.ts`:
  the steampunk cityscape pack's great airship (`art/skies/airship.png`) recoloured by a ramp per kind and for the
  pirates (black and plum), and the enemy spaceship pack's fifth ship for the sky frigate (`art/skies/skyfrigate.png`).
  `src/renderer/map/mapAirships.ts` (`MapAirships`): moored with her nose at the mast's head, flying out and home over
  the town, the pirates' ship coming in and hanging over the raid with its ropes down, each with a shadow on the land.
  The mast is a pick of the futuristic pack (the lattice pylon, a gas tank, a console and a box). A flying hunter is
  drawn lifted over its spot (`RaiderView.aloft` in mapRaiders.ts, its shadow on the ground, its bar the town's
  shooting). A watched voyage (`FightScene`) shows a sky backdrop (`SKY_LOOKS`: the cloud and cloudscape packs) and her
  gondola under the party (`aloft`, `showHull`). The Quests tab lists the airships, the mast's tap card who's moored,
  the news bubble the pirates coming and a hunter overhead. Inventory icons `airship_*` in customIcons.ts.
- `window.__skies('airship' | 'fly' | 'pirates' | 'hunter')` on the phone page for previews (`sim/skiesPreview.ts`).
- Tests: `test/skies.test.ts`.

# The monster ranch, and tournaments in the arena

Two DLC-sized features (the owner's asks). Both run only with the autopilot on, use their own side streams
(`${seed}:ranch:...`, `${seed}:arena:...`), and keep their state in new optional fields (`s.ranch`, `s.arena`): no save
version bump.

## The monster ranch

`src/shared/data/ranch.ts` (numbers, traits, names) and `src/shared/sim/ranch.ts` (rules). `s.ranch` (`RanchState`:
`beasts`, counts of `bred`, `sold`, `died`, `lost`, a `log`).

- **Where beasts come from:** a beast a Beast Tamer won over (data/taming.ts) and still standing when the raid ends is
  brought home (`ranchRaidOver`, from raids.ts `endRaid`); with a ranch standing and a Beastmaster (or a Beast Tamer)
  at home, a beast left down on the field may be roped and brought in (`CATCH_DOWNED`). No bosses.
- **The building:** the Beast Ranch (`RANCH_BUILDING`, 4x3, Domestication, merged into BUILDINGS; in the planner's
  `NEVER` and the castle's `OUTSIDE`). The town lays one itself (`buildRanch`) once it holds a beast (or has a Beast
  Tamer) and `RANCH_PEOPLE` grown-ups, or at `RANCH_PEOPLE_UNASKED` (6) with none, for its Beastmaster to catch beasts, and a second (`RANCHES_MOST`) when the first is full. Each holds `RANCH_ROOM`
  (6); without one the town keeps `LOOSE_ROOM` (2) tethered by the fire. Pack picture: the Village pack's awning as a
  shelter, the Fields pack's rails, the Medieval Field Work pack's hay, a bucket for the trough (`PICKS.beast_ranch`).
- **The Beastmaster:** an operator role (`OPERATORS.beast_ranch`, skill Animals). Trains every beast each morning
  (`TRAIN_XP`, more by Animals and the Gentle trait; levels to `BEAST_LEVEL_MOST`, each `PER_LEVEL` stronger), tends
  the sick (`TEND_CURE`), mends the hurt faster and catches beasts on the field. Breeding and training count as the
  deed `beasts` (titles Friend of Beasts, Beastmaster, Lord of the Menagerie).
- **The morning** (`ranchHourly` at `RANCH_HOUR` 7; jobs are set afresh every hour): fed from the stores (`feedOf` by
  tier; grazers (`GRAZERS`) grain and greens first, the rest meat and fish; `HUNGRY_FLEE` days unfed and it breaks out);
  mending, old age (`lifespanOf` by tier, old from `OLD_SHARE`, `OLD_DEATH`), sickness (`SICK_*`: more when hungry or
  crowded; deadly untended); breeding (a grown, fed male and female of one kind: `BREED_DAILY`; the cub takes each
  parent's trait at `INHERIT`, a new one at `MUTATE`, up to `TRAITS_MOST`; `gen` counts the generations); the work's
  haul; and selling (over room, or the stores under `SELL_FOOD_DAYS` of food, the least worth first; the old at 90% of
  their span for half; ledger line `ranch`).
- **Traits** (`BEAST_TRAITS`): strong, hardy, swift, fierce, keen-nosed, gentle, fertile, long-lived, and the bad ones
  sickly and skittish, each a multiplier on blows, health, the hunt, the haul, training, breeding, lifespan or sickness.
- **Jobs** (`setJobs`): a rideable beast (`RIDEABLE`, tier 1.5 or more) becomes a mount for a fighter (guards first);
  the fiercest meat-eaters guard (a third of the herd, every Fierce one) and fight beside the town in every raid
  (`ranchAllies`, from `startRaid`; `Raider.ranch`; struck down, it's hurt, or dies at 25%); the rest hunt (meat, a
  hide now and then, `HUNT_HURT`) or, grazers, haul (wood or stone). A rider strikes harder in raids (`mountFight`, in
  raids.ts `defenderAttack` and the mages' fire beside `guildFight`: `rideFight` by the mount's tier).
- **The player:** the `ranch` command: `op: 'name'` (any name up to 24 letters; `named`) or `op: 'keep'` (never sold).
- **Seen:** `snapshot.ranch` (`RanchView`) on the Market menu's **Ranch** tab (`panel/ranchPanel.ts`: a card a beast,
  health bar, traits as chips (the bad ones red), tapped: where it came from, its parents and generation, lifespan, diet,
  level, arena record, worth, a name box, Keep / Allow its sale). `snapshot.ranchPens` (`beastHome`: each beast's pen
  rectangle in world px) drives `ranchFigures` in main.ts: a third `MapRaiders` (`penned`) draws each beast from its
  creature sheet ambling between spots in its pen (by its id and the clock, `PEN_STEP_MS`).

## Tournaments and the arena

`src/shared/data/arena.ts` and `src/shared/sim/arena.ts`. `s.arena` (`ArenaState`: the season, its `ladder`, the
`card`, the `bout`, `past` bouts, `champions`, `renown`, who `rested` when).

- **The building:** the Arena (`ARENA_BUILDING`, 5x4, Spear Hunting), laid by the town itself (`buildArena`) at
  `ARENA_PEOPLE` (7) grown-ups with half as much again of its makings in store. Its job is the Arena Master
  (`OPERATORS.arena`, Social: a bigger gate). Pack picture: a ring of the Village pack's palisade stakes round trodden
  sand, logs for benches, a weapon rack, lanterns and the sword sign at the gate.
- **The season** (`arenaHourly`): the first `SEASON_DAYS` (6) days of spring, summer and autumn. At `CARD_HOUR` (noon)
  a bout is posted (`postCard`): every other day a grown, fit ranch beast if there is one, else one of the town's
  fighters (rested `REST_DAYS`, fit, at home; never the founder; the keenest by level, ambition and skill), against a
  visiting champion: a troop of a power the town knows (its raid kind's non-beast foes, named "Varn the Red of The Red
  Brotherhood") or a wanderer of the road (`WANDERERS`); a beast against a beast-keeper's beast of a near tier. The
  visitor is scaled to `MATCH_LEAST`..`MATCH_MOST` of the town fighter's might, so bouts are close. Not on a knights'
  tournament day.
- **The book:** the odds from the match (`odds`, paid less `HOUSE_CUT`, `PAYS_LEAST`..`PAYS_MOST`). Townsfolk bet as
  the card goes up (`townsfolkBet`: by nature, `BET_LEAN`; a share of their purse over `BET_KEEP`; most back the town,
  the greedy the favourite). The player bets from the treasury until the bout (`arenaBet`, the `arenaBet` command:
  `PLAYER_BETS` steps, replacing any bet, 0 takes it back). A bout called off returns every bet.
- **The bout** (`startBout` at `BOUT_HOUR` 17): shaped as a trip (`e.dest` `arena:<id>`, `arenaDestination`, scenery
  `arena` → the ruins scene), fought by the expeditions' turn-based fight (`startBattle`/`stepBattle`, the beast as a
  party fighter, `beastFighter`). The fighter is away in the ring (`ARENA_AWAY`; the snapshot says "the arena").
  Watchable: `s.watching` the bout's id (ids from `BOUT_IDS`, apart from the town's own), found by `arenaTrip` in the
  watch command, the snapshot's `watch`, `fightOn` and `fightOnScreen`. Each side yields under `YIELD`; only one struck
  down outright may die (`ARENA_DEATH`, `BEAST_DEATH`, `VISITOR_DEATH`), so deaths are real but rare.
- **The end** (`endBout`): harm and wounds carried back, experience (melee or ranged by the blows), the victory window
  (`e.result`, kept `BOUT_LINGER` ticks), purses (`PURSE`, `LOSER_PURSE`; a beast's to the treasury), the deed `bouts`
  (titles the Brawler, Gladiator, Champion of the Sand), the book settled, the gate (`GATE_BASE` + a grown-up's share,
  the Arena Master's Social, renown; ledger line `arena`), renown (`RENOWN_WIN`/`RENOWN_LOSS` up to `RENOWN_MOST`, added
  to every venue's attractiveness in shop.ts, fading out of season), travellers drawn in for the evening, and the ladder
  (`WIN_POINTS`, `KO_POINTS`). The season's last bout is the final: `crown` gives the top of the ladder the crown (a
  townsperson the title Champion of the Arena and `CROWN_PRIZE`; a beast a crown on its record; a visitor takes it
  home), told in the event box.
- **The knights' tournament** (sim/chivalry.ts `tourney`) is not duplicated: its jousts count on the arena's ladder and
  fill its gate when the town has an arena (`noteJousts`).
- **Seen:** `snapshot.arena` (`ArenaView`) on the People menu's **Arena** tab (`panel/arenaPanel.ts`: the season and
  renown; the bout under way with Watch; tonight's card with the odds, the townsfolk's bets and the treasury's bet
  buttons; the Standings table; past bouts; the champions). The news bubble has a gold notice for the card (to the
  Arena tab) and for the bout under way (Watch).

## Balance

- The planner's research scoring gives +4 a building a topic opens; the ranch and the arena are left out of it
  (`SELF_BUILT` in planner.ts), so towns study as before. Soak (25 days, settlers twice, knights, druids, werewolves,
  orcs): every town that never built either plays out to the person as on main; the orc town built both and ran its
  bouts with the same people and deaths as on main.

## Fixed on the way

- The roaming bands' map view (`roamers` in main.ts) was updated every snapshot but never rendered, so bands on the land
  were never drawn; `roamers.render` (and the ranch's `penned.render`) are now called each frame.

Tests: `test/ranch.test.ts`, `test/arena.test.ts`.

## Catch-up speed, round two (the coordinator's ask: two days away was still a long wait)

The fixture's two days away (`node tools/perf-sim.mjs` on `test/fixtures/late-town.json.gz`) take 26.5 s where main
takes 54.1 s on the same machine (the cloud box, about 1.4 times slower than the desktop the last pass measured on: so
about 38 → 19 s there). Nothing about how a town plays changed: `node tools/sim-hash.mjs [days] [fixture|hash-a..d]`
hashes the saved end state of the fixture's catch-up and of four new towns run six days (settlers, knights, vampires,
dwarves); all five match main's to the byte. Every speed-up is a cache or a cheaper way to the same answer:

- **Paths.** `sim/walk.ts`: the cells built on (`solidCells`) are kept while the buildings stand as they were (a
  9-field signature a building), not gathered for every search. Ways found are remembered (`foundBefore`/`noteFound`)
  with the box of cells their search looked at (`PathOpts.reach`, filled by `findPath`); when the land, roads or
  buildings change, only the ways whose box holds a changed cell are forgotten (`foundNow` diffs the cells and roads
  strings and the built-on sets; a castle change forgets all; more than `CHANGED_MOST` cells, all). A goal on ground
  the walker can't reach without fording isn't searched for over every cell first: `mayReach` in `sim/land.ts` labels
  the passable cells four ways (the same as eight ways with no corner-cutting) and joins the cells of `through`
  (`landPieces`, kept per cells, roads and built-on set); a way then found by fording rests on the whole land. The A*
  loop asks each side's cost once and has its heuristic inline: the same pushes and pops.
- **The planner.** `sourceable` answers are kept within a planning pass (`sourced`: the tick, land version, open land,
  research known, age, buildings count and the shop); the open cells nearest first are worked out once for the camp
  and the open land (`nearestOrder`), so `scanWild` no longer sorts every pass (the coordinator's `scanWild` lead,
  without caching across ticks: pools change without a version bump in places, so the per-tick list stays, only
  cheaper); `wildHolds` gathers the materials in one pass; `missingPieces` (the ring) indexes the cells built on once.
- **The townsfolk.** `buildingById` (state.ts: an index of the buildings list, checked on every use); `assignBeds`
  looks for homes only when someone has no bed; the sites are gathered once a tick for everyone choosing work
  (`blueprintsNow` in people.ts) and the builders at each site once a look (`buildersAt`, `buildSpot` without the
  strings); `maxHp` is kept per person while what it rests on is the same; `capacities` (injuries.ts) reads the
  wounds and lasting harm once, not once a body part; `lessonPlace` in one look.
- **Mood.** What's alike for everyone (`TownMood`: the fire, the circle, the school, the best comfort, a vampire or the
  dead in town, who has a child, who owns a venue) is worked out once a tick for all the townsfolk's moods.
- **The rest.** The shop's arrivals ask whether anyone is due before looking for the venue and its keeper, and the
  venues are found in one look (`venueKey`); roaming bands look how far before whether under cover, and step on the
  cells built on through `builtOnNow` (buildings.ts); `craftSlots` counts stations through a set; the tactics board
  reads its units' ids once (`idOfKey`) and passes over units with no statuses.
- **The phone starts it sooner.** `mobile/boot.ts` (built to `out/web/boot.js`, loaded in the page's head) starts the
  sim worker and sends it the saved town before the page's 2 MB script has loaded, keeping what it says meanwhile;
  `startGame` in mobileBridge.ts takes the worker over (`window.__simBoot`). The host tidies the alert settings itself
  (`cleanAlerts` in simHost.ts's `init`). Without workers, or with `?inpage`, the page starts the game as before.

## The war engines and the boats from the packs

The packs were searched for every painted piece. Two had a fit: the **cannon** is the Pixel Dungeon Props pack's cannon
on its carriage (`art/packs/dp_cannon.png`), the machines' **sentry bot** the Robot Warfare pack's Scarab
(`art/packs/rw_scarab.png`), both `PICKS` in packBuildings.ts (credited in CREDITS.md; `test/packCoverage.test.ts`'s
`PAINTED` lists them no more). Still painted, since no pack has them: the ballista, catapult, flame turret, mortar
pit, launch site, tide-pool trap and acid sprayer, and the boats (`art/boatArt.ts`: the only boats in the packs are the
Seabed pack's wrecks; the tropical city pack's log trough could pass for a dugout but is smooth vector art, not pixels).

## Balance soak, button pass and first-hour clarity

A soak of every origin, a second pass over every menu on the phone, and a few first-hour labels. Small fixes only.

**The soak tool.** `tools/soak.ts` (run: `node tools/soak.mjs [days] [seeds] [origin,origin...]`, or `node tools/soak.mjs fixture [days] [seeds]` for the
late fixture) runs towns with the autopilot on and prints people, the lowest head-count, deaths (`s.fallen`) and wipes. `SKY=none|ship` forces the fixture into the
Industrial age (with a zeppelin); `CAUSES=1` tallies the causes of death; `TIMELINE=1` prints a town every 5 days. A won game carries on (the Grail ends the fixture).
Build once and run the `.cjs` copies side by side: parallel `node tools/soak.mjs` runs overwrite `out/soak.cjs`.

**What the soak found (20 days, 3 seeds each):** no origin dies out except one lone-founder wipe, no origin goes untouched at 40 days.
Settlers 3.0 people (deaths 0.7), lich 20, druid 4.3 (one wipe), vampire 3.3 (3.0 deaths), werewolf 7, robot 31 (6.7 deaths), dwarves 5 (0.3), merfolk 4.7, nomads
60 (3.3), fae 13, alchemists 6 (0.0; 4.5 deaths by day 40), knights 7.7, orcs 6.3. The fixture over 10 days: 46 people, 4 deaths.

**Fixes:**
- *A lone leader is not sent to a duel by default* (`risingEnvoyText`, `sim/risingPowers.ts`): the Shogunate's challenge defaulted to "accept" at even odds, and in a
  one-person town a loss ended the run (druid soak, day 18). The default is now "refuse" when the champion is the leader and no heir would be left (`heirOf`).
- *A party that cleared the Calamity's heart crashed the sim on its next tick* (`destinationOf` returned nothing once `heartCleared` shut the heart): `destinationOf`
  now asks `heartDestination(s, true)` for a party already out; the board still lists the heart only while it is open. Found by the 40-day dwarf soak.
- *A tap on a slow view seemed to do nothing for up to five seconds* (the trade house's "Close the route", the ranch, the arena, guilds...): `slow()` in
  `sim/snapshot.ts` now also drops its cache when a command comes in (`viewsChanged`, as `brief()` already did).

**Buttons (phone, 393x852 and 852x393, every Town/People/Studies/Market/Quests/Chronicle tab on the late fixture):** the Jobs table was cut off at the right with
no hint (`priorityGrid`: it now scrolls sideways under sticky names, with a "Swipe the table sideways" hint on phones); the guild member chips ran off the card
(`.guild-chips` wraps); a place's long threat chip ran off the screen (`.dest-chip` wraps). No dead tab was found; the buttons that looked inert were toggles
already on, or opened a card outside the menu.

**First hour:** the news bubble says "news" under its number; the welcome tip names the bubble and the speed controls; new tips `sendparty` (day 2, three people),
`food` (stores under a day) and `beds` (more people than beds) in `mobile/tips.ts`. No new controls.

**Sky pirates (0.7 of a raid's budget, unsoaked until now):** on the fixture forced into the Industrial age with a zeppelin, 6 seeds over 10 days ended 45.2 people
and 6.0 deaths against 46.0 and 4.0 without the ship: the cost is the airship's own crashes (`died when the Cloud Dancer came down` x2), about 2% of the
population, not 14%. Pirates did not raid in any of those runs, and 3 seeds over 30 days gave identical results at `SKY_RAID_SHARE` 0.7 and 1.0, so the cut has no
effect in a town whose ship has been lost (the ship was already gone by day 20 in the seed checked); nothing was changed. If flying is still thought too costly, the cheap lever is to fly only for sky-only places and long trips.

## The clock bar on the phone: People, Beds and coins taken out

The strip's clock bar (the gold bar at the top of the town on the phone) ran off the right edge on an upright
phone, so the People, Beds and coins figures at its end sat off-screen and the bar scrolled sideways. The owner's
ask: take that information out of the bar. The bar now holds the clock, Pause, speed, music, the raid and
bleeding and hunger badges, and Food. Nothing else changed.

- **The file:** `src/renderer/hud.ts`. The `stock` span (the figures' text was `People n · Beds n · ● n coins`) is
  gone from the clock bar and from its `append`, and so is the text code that filled it.
- **The CSS:** `src/renderer/index.html`, the `#clock .stock` rule, removed.
- **The tip:** `src/renderer/mobile/tips.ts`, the `beds` tip ("People and beds") pointed at the figures at the top.
  It now points to the Town menu's Overview tab (`panel: 'build'`, `tab: 'Overview'`), where the People tile shows
  people against beds.
- **Unchanged:** the Food figure stays in the bar. The `food` tip still says "The Food figure at the top", which is
  still true. The `snap.housing`, `snap.coins` and `snap.shop` fields are still read by the menus, so the snapshot
  keeps them.

## Wagon trains (settlers grow faster)

Settlers' towns sat at 1 to 4 people through day 40: the only ways in were wanderers (at most one asking a week, `VISIT_GAP_HOURS`, and rarely) and births. Now every `WAGON_EVERY`th (2nd) claim staked (`stakeClaim`, every `CLAIM_DAYS`) sends a wagon of new settlers up the road (`FrontierState.wagons`, at most `WAGONS_WAITING` 3 waiting). On a frontier morning (`wagon()` in `sim/frontier.ts`, called from `frontierHourly`) a waiting wagon rolls in when the town has a free bed (`housingCapacity`), is not full (`townFull`) and holds `WAGON_FOOD` (1.5) days of food a head (`foodPerHead`). A household of one, or two with chance `WAGON_PAIR` (0.25), joins without a question (`joinOrigin`, `assignBeds`, `equipAll`); types from `WAGON_TYPES`. The rolls use their own side stream (`roll(s, 'wagon')`). `FrontierState.arrived` counts them. Settlers only, autopilot only; nothing else about the wanderer rules changed, and no one is made safer. Adds to "The settlers' frontier" in HISTORY.md. Test: `test/frontier.test.ts`.

## Solid mountains

The owner's ask: the mountain's rock is solid. Nobody walks on it (couriers, caravans, travellers, townsfolk, raiders, the
envoy), and a hold's rooms are dug from the doorway inward, by diggers standing on open or already-dug ground. This
changes the "The dwarves' hold" and "Walls that hold" sections of HISTORY.md (a room was carved whole when laid).

- **Rock was already `Infinity` in `stepCost`** (`sim/land.ts`); the holes were the goal cell (`findPath` always allows
  the goal, so a face to cut or a room's middle put the walker *in* the rock), the straight-line fallback of
  `walk` when no way is found, an edge spawn on a spur of rock, and the envoy / courier riding straight.
- **`standFor(m, from, to)` (`sim/walk.ts`):** a goal inside rock is moved to the open or dug ground beside it (the side
  nearest the walker, four sides before corners, else the nearest open cell within 8). `walk` and `pathTo` both apply it.
- **`straightShort`:** with no way found a walker goes straight at the goal only as far as the first cell of rock.
- **Digging a room (`sim/castle.ts`):** `placeBlueprint` and `upgrade` no longer carve a hold's room. `digOrder(s, rect)`
  lists the rock left in a room: it begins at the cell of rock a walker can step into through the castle's walls
  (`castleStep`, so through a doorway) nearest the camp, then spreads cell by cell through the footprint (breadth-first,
  ties by row and column). `digRoom(s, b, progress)` cuts as many cells as the build's progress is of the whole (all at 1);
  the `build` task calls it every tick. `digStand` is the cell a digger stands on: open or dug ground beside the next
  cell to cut, reached through the walls.
- **`buildSpot` / `goToB` (`sim/people.ts`):** for a hold's room still being cut, builders and haulers go to `digStand`
  (a done room or the hall may be stood in); other builders' spots never lie on rock. A room with no rock left falls back
  to the old spots.
- **Arrivals:** `edgeXY` (`sim/state.ts`) moves an edge spot on rock to the nearest open cell with a way to the camp
  (`openEdge`, remembered while the land's cells are the same); band members strung out behind the first stay off rock
  (`strung`, `sim/bands.ts`); the wagon doesn't roll onto rock (`rollWagon`); the envoy rider (`sim/factions.ts`
  `envoyTick`) now `walk`s instead of riding straight. The renderer's couriers (`map/mapCourier.ts`) never start on rock
  or water and try bearings all the way round the fog's edge for a way in (no straight-in fallback any more).
- **Caches:** `walk.ts`'s failed and found-ways caches are keyed on `land.cells` and forget only the ways whose
  searches looked at a changed cell, so a dug cell (it changes the string) clears exactly the ways that saw it.
- Tests: `test/solidMountain.test.ts` (paths never cross rock, a face is worked from beside it, sealed goals stop at the
  rock, edge spots, a courier from the walled-in north, dig order from the doorway, a 5-day hold run with nobody on
  rock); `test/castle.test.ts` (room ground cut as it is built, not when laid). `tools/probe-mountain.mjs` scans a
  dwarves town for anything standing on rock.

### Hallways (the dwarves' hold as a dug network)

The owner's ask: hallways for the rooms to sprout off, like a real mountain town. A change to "The dwarves' hold" /
"The castle as one body of rooms" in HISTORY.md: a hold's rooms used to join any cell of the castle (the hall, a room,
a gallery dug for ore).

- **`hold_hallway`** (`data/buildings.ts` `HOLD_HALLWAY`, dwarves only, 2 wide and 4 deep, 3 stone, 30 s): a castle
  room that is only a passage. It is cut like any room (the dig above) and drawn as bare floor: the dungeon pack's
  flagstones under every room (`castleArt.ts`), no furniture (`mapView.ts` `hallBare`; `test/packCoverage` skips it).
- **The rule (`sim/castle.ts` `hallCells`, used by `canPlace` and the planner's `roomSpot`):** a hold's new room, hallway
  or not, must share a wall with the entrance hall or a hallway, never with another room or a gallery. New rooms carry
  `halled`; `offHall` in `castleLayout` drops the doorway between a `halled` room and any room that isn't the hall, a
  hallway or the seat (the seat's hall lies over the entrance hall's cells), so a room opens only onto a hall.
- **Older saves:** rooms already built stay as they are (no `halled` flag, their doorways kept). A hold with no hallway
  that `hallSpot` can't cut one for (its hall walled in on every side) still grows rooms the old way.
- **The planner (`sim/planner.ts`):** `hallSpot(s)` (cached by building count, land version and open radius): the main
  hallway runs north into the rock from the middle of the entrance hall's top wall (`trunkSite`, kept clear of rooms
  till it's cut), up to three lengths deep; then side halls branch off it and off one another, nearest the camp first.
  `tryHall` cuts the main one once three rooms stand, and another whenever a room finds no hallway frontage; one at a
  time. Hallways sit within the known land, so a long trunk waits for the land to open.
- Test: `test/solidMountain.test.ts` ("every new room of a hold opens off the entrance hall or a hallway, and the
  hallways join the entrance"). `tools/hold-map.mjs [days]` prints a hold as a map.
- Soak (dwarves, 20 days, 6 seeds): people 4.2 before, 4.0 with solid rock and hallways (3.8 with solid rock alone),
  one town of six lost its last founder to lightning on day 20. Settlers, orcs and knights (2 seeds) unchanged.

## Walls and doors stand taller than the townsfolk

The owner: "The walls and doors are too short for the height of the townsfolk." A townsperson is drawn 48 px tall
(`HK_K` in `map/mapPeople.ts`; founders 55, children 34); the castle's partitions were 22 px of face and their doorways
15 px high, the curtain wall 16 to 26, the gate 32. Renderer only: the sim and its hashes are unchanged
(`node tools/sim-hash.mjs` matches main).

- `map/castleArt.ts` (the vampires' castle and the dwarves' hold): `TALL` = 64 is how far a wall face stands above its
  foot, `DOOR_H` = 54 and `DOOR` = 24 the doorway in a partition, `TALL_S` = 44 the south wall (the town is seen over
  it, so it stands lower and the hall stays in view). The pieces are drawn taller *upward* from the same foot: their
  zIndex and the footprint are as before, so paths, doorways, `wallDepth` and the clutter placement don't move. A wall
  down a column is its top shown `TALL` above the foot with the wall's end below it. Gates (castle, side gates, the
  hold's carved gate) are drawn `TALL` square (the pack's arch, doubled-ish), opening about 52 px. `TOWER_H` (keepArt)
  58 to 96 so the towers stay above the walls.
- Tall walls would hide the rooms behind them, so `CastleDrawing.walls` lists them and `MapView.seeThrough` draws a
  wall at `WALL_SEE_THROUGH` (0.3) alpha while a person's feet are behind it (eased, like the trees).
- `map/packBuildings.ts`: the ring wall's stone, brick, concrete and force tiers (`STONE_WALL`, stacked crops of the
  dungeon pack's tile) are 80 px tall (were 48, a person's height); their gates are drawn with `GATE_OVER` = 14 px of
  overhang, 1.9 times as big (opening about 28 to 54 px).
- Not changed (baked pack sprites): ordinary buildings' doors (cottage, row house, house3/4 trades 0.35 to 0.5 of a
  person; tavern, inn 0.5 to 0.6; lean-to, hide tent 0.25 to 0.3), the palisade gate's door leaf (30 px) and the single
  palisade posts (32 px), the painted homes' arches (11 to 16 px), the merfolk huts. Fixing these needs redrawn doors
  in `packDressing`.

## Fight bars, labelled

The side-view fight HUD (`fight/fightHud.ts`, CSS in `index.html`) reads clearer. Renderer only; the sim and snapshot
are unchanged (`FighterView` already carried `hp`/`maxHp`). Changes the "Watching a party's fights" HUD.

- Party rows: a short labelled `Turn` gauge beside the name (26px); under it a long `HP` bar with `hp/max` over it
  (green, amber under a quarter, red when down); then `MP`, `SP` and `Limit` bars side by side, each named.
- Foes: each kind's row has a life bar with numbers on it (the kind's living foes added together, "×3" in the
  name) and the short `Turn` gauge. Past three kinds (`.ff-foes.crowd`) rows go one line each (name, bar) and the
  foes' turn gauge is hidden to keep the window short.
- Helpers `turnGauge` and `meter` in `fightHud.ts`; classes `.ff-meter`, `.ff-gauge`, `.ff-lab`, `.ff-turnwrap`.
- Preview: `__skirmish(...)` (main's debug hook) starts a watched skirmish.

## The living wilderness (claude/wilderness; the owner's ask)

The land beyond the town is an ecosystem. Everything runs only with the autopilot on, on its own side stream
(`${seed}:wild:...`), and lives in the optional `GameState.wild` (older saves just seed it on their first autopilot hour).
No manual controls.

**Herds and predators** (`sim/wild.ts`, `data/wild.ts`). `wildHourly(s)` (called from `sim.ts` after `nestsHourly`)
seeds `HERD_TARGET` herds (deer and boar; camels in the desert, boar in swamp and jungle: `BIOME_GAME`) between
`HERD_NEAR` and `HERD_FAR` cells of the camp, and `PACK_TARGET` predator packs (`BIOME_PREDATORS`: wolves, bears,
lions, wild dogs). A herd has a summer ground (`ax,ay`) and a winter ground (`bx,by`): it grazes, walks to the winter
ground in autumn and back in spring (`MIGRATE_STEP` cells an hour), breeds in spring and summer (`BIRTH_RATE`, thinned
towards the herd's cap) and dies back in the cold (`DEATH_RATE`). Herds keep `HERD_KEEP_OFF` cells from the town. A herd
under two head scatters. In spring, each day, a missing herd drifts in from beyond `HERD_FAR`. A pack follows the nearest
herd and kills now and then (`KILL_CHANCE`); hunger rises `HUNGER_RATE` an hour and a kill takes `KILL_RELIEF` off. A
pack past `HUNGRY_AT` with no game within 30 cells (or starving) walks to the town's edge, and there `strike`s: a
small roaming band (`spawnRoamerAt`, group from `packFoes`, no raid budget) goes out at whoever is on the land, and
it may take up to `PEN_TAKE` animals from a pen nothing shelters. Like the roamers it waits for `ROAM_FIRST_DAY` and
`ROAM_PEOPLE`, never comes in a raid, and rests `PACK_REST_DAYS` after. This is added to the bands that already roam
(`roamersHourly` is unchanged): the land is no safer than before.

**Hunting tracks real prey.** `huntFactors(s)` reads the nearest herd's distance from the camp: past `HUNT_NEAR`
cells the yield of a `type: 'hunt'` expedition falls (down to `HUNT_YIELD_MIN`), the road is longer (outTicks,
up to `HUNT_TRAVEL_MAX`) and the odds of a fight on arrival and ambush rise (`HUNT_RISK_PER_CELL`, up to
`HUNT_RISK_MAX`). Every `HUNT_UNITS_PER_HEAD` units the hunters bring in, a head falls from the nearest herd
(`huntedUnit`, from `expeditions.ts`'s work phase). Hunted out near town, the herds are further off and the hunting poorer;
left alone they breed back and drift in. `parties.ts` `pull` favours hunts while the game is near and looks elsewhere
when it is thin. A town without `s.wild` hunts as before.

**Forests that live.** Daily (06:00) `spreadWoods` turns open grass with at least three woodland neighbours into young
woods (half the usual pool): `SPREAD_PER_DAY` by season (none in winter), never over the town, a road, a worn path, a
regrowing cell or the blight, and never past `WOOD_CAP` times the woods the land began with (`Wild.woodBase`), so
woodcutters' clearings let it spread again.

**Wildfires in dry summers.** `dryYear(s)` is `DRY_YEAR` of the years (by seed and year) and every drought; in a dry
summer, with no disaster on, `wildfireStart` lights a woodland wildfire at `DRY_FIRE_HOURLY` an hour through the
existing disaster (`disasters.ts`). The day's wind (`Wild.wind`, turned a little each day by `WIND_TURN`) rides on the
fire (`Disaster.wind`): a fire spreads `1 + 0.9 cos(angle to the wind)` times as readily downwind (floor 0.1), and
likewise for buildings the fire catches (`fireSpread` in `disasters.ts`, then `fire.ts` `setFire`). A dry fire (`Disaster.dry`) also crosses grass (0.8) and
fields' soil (0.5). Burnt woods are marked `LandMap.rich` and come back after `RICH_DAYS` with `RICH_POOL` times the
pool (`regrow.ts`). The old (wind-less, forest-only) fires of `disasters.ts` behave as before.

**Rivers that move** (`sim/rivers.ts`). When a flood ends, `maybeShiftRiver` (`RIVER_SHIFT_CHANCE`, rare) may cut a new
channel `RIVER_SHIFT` cells to one side over a 15-cell stretch near the town; the old bed turns to fertile silt with an
oxbow pond left in the middle. Fields and huts in the way are lost (`demolish`), road and planned-street cells under it
go (so a bridge there is lost; the streets replan). It never crosses the camp, the seat, the ring wall's rect, a place
or a mountain, loses at most six buildings, and is tried on a copy: it is made only if everything the camp could walk to
before is still reachable (`reach`). People and herds standing in the new water are set on the bank.

**Seen.** `Snapshot.wild` (`wildView`: herds, packs, wind in px) feeds `map/mapWildlife.ts`, which draws the herd
members around each sim herd from the existing wildlife atlas (the DawnLike critters cut by
`tools/compose-wildlife.cjs`), and the packs.

Tests: `test/wild.test.ts` (seeding, migration, overhunting and recovery, a hungry pack's band, woods spreading, fire
downwind and through dry grass, richer regrowth, a river move keeping the land walkable).

## Walls sort by their foot on the cell edge

The owner: "The walk paths are overlapped by the walls, so when a townsfolk walks by a wall, they look like they're
walking on the wall." Renderer only; the sim and its hashes are unchanged. Changes the "Walls and doors stand taller
than the townsfolk" section.

What was wrong: a castle or hold wall's foot (its zIndex, the line people sort against) was not on the cell edge. The
curtain wall's inside face hung 26 px into the first row of the hall, a partition's 22 px into the room below, the south
wall's 16 px out over the ground (and so tied exactly with a walker's feet one row below it). Townsfolk walk the row's
centre (16 px in), so a person in the first row beside a wall was drawn *behind* its foot, hidden or, with the fade,
a ghost on its face. The fade also fired for anyone near a column wall's tall sprite, even someone beside it.

- `map/castleArt.ts`: `FOOT` = 4. Every horizontal wall piece, gate (castle, side, hold) and tower now stands with its
  zIndex on the cell edge (`py + FOOT`; the south wall and gates `py + CELL + FOOT`; towers `cy + 6`). Heights
  (`TALL`, `TALL_S`, `TOWER_H`, door sizes) are as before, so the pieces are the same size and sit higher by the old
  face depth. Someone in the row beside a wall is drawn in front of it, someone in the row behind is behind it.
  `wallDepth` (clutter) is unchanged, so rooms keep a clear aisle under their top wall.
- The outer north wall and the hold's north rock are no longer in `CastleDrawing.walls`: only the outside lies behind
  them, so they never fade (people there are simply hidden, as behind any wall).
- `map/mapView.ts` `seeThrough`: a column wall (`texture.width <= CELL / 2`) fades only for someone in its own strip
  and north of its row; others as before (north of the foot, within the piece's width).
- Not changed: ring-wall stone tiers (a building, `zIndex` = its bottom row, already in front of anyone south of it),
  people, raiders, animals, pets, props (all sort by their feet).
- Preview: `__game` saves made with `paused: true` and people placed along both sides of walls and the gates.

## One bar per foe

The side-view fight HUD (`fight/fightHud.ts`, CSS in `index.html`) now gives every living foe its own row, where
"Fight bars, labelled" gave each kind one summed bar ("Wolf ×3"). Renderer only; the sim and snapshot are unchanged
(each `FighterView` already carries its own `hp`, `maxHp` and `atb`). Changes the foes' part of "Fight bars, labelled".

- Each row: the foe's name, its short `Turn` gauge (`atb`, "Next turn"), then its own life bar with `hp/max` over it.
  A foe that has fallen has no row.
- Numbering: a kind with more than one foe is numbered by its place in the battle (Wolf 1, Wolf 2, ...), counting the
  fallen too, so a number stays with its foe as the others fall. A lone foe keeps its plain name.
- Tiers, by the number of living foes on screen (`foes.classList`, set in `update()`):
  - up to three: the stacked layout (name and turn gauge over the bar), as before;
  - more than three (`.ff-foes.crowd`): one line each (name, turn gauge, bar);
  - more than six (`.ff-foes.tight`): smaller text, no turn gauge (`display: none`), thinner bars (7px) with smaller numbers;
  - more than ten (`.ff-foes.packed`): `max-height: 36vh` and `overflow-y: auto`, so the list scrolls inside its window
    and the window never grows past the fight log's and the fighters' room.
- The wave line ("Wave 2 of 3", assaults) stays at the top of the list and isn't counted as a foe.
- Key names: `foeRows`, `foeCount`, `kinds` and `seen` (numbering) in `fightHud.ts`; `.ff-foes.crowd`, `.ff-foes.tight`
  and `.ff-foes.packed` in `index.html`.

## Generations and dynasties (the owner's ask: a long game should read as a family saga)

New state `s.dynasty` (`DynastyState`, optional, so old saves load; nothing is made until a dawn with the autopilot on).
Files: `sim/dynasty.ts` (rules and `dynastyView`), `data/dynasty.ts` (every number and the lean tables), the Families tab
(`renderer/panel/familyPanel.ts`), test `test/dynasty.test.ts`. `dynastyHourly` runs once a day at 05:00 from `sim.ts`
(after `politicsHourly`), autopilot only, on its own side stream `${seed}:dynasty:${tick}` (upbringing: `${seed}:dynasty:up:${id}`).
It never draws from the town's stream.

**Houses.** A house is a family line of `sim/lineage.ts`: `lineGroups(s)` (split out of `familiesView`, reads the record
only) gives each line's root and generations; `housesOf` maps every person to their root; `houseName` is "House of <root>".
Someone with no line yet (a lone founder) is their own root.

**Upbringing** (`leansOf`, `applyUpbringing`, called from `comeOfAge`). Each dawn every child in town is noted
(`Rearing`: raids lived through, hungry days = a quarter of the town under 0.3 food, trade days = yesterday's trade, shop,
goods and realm income against `TRADE_DAY_COINS`). At coming of age the strength (0..1) of four leans, `fight`, `farm`,
`trade`, `magic` (`LEAN_DEFS`), comes from that plus the parents' callings (a martial class role, a caster/healer role,
a bard or dancer or social 8+ or a shop owner, a druid or farming 6+; a parent counts for 0.5 x 0.6, so two make 0.6). The
top two leans of at least `LEAN_LEAST` add skill levels (rounded from the table x strength), a passion at 0.5+, and the
top one may turn the nature (chance strength x `NATURE_LEAN`, to one of the lean's own natures). Skills feed classes
(`classPull`) and attributes (`ATTR_PER_SKILL`), so callings and stats follow without touching either. The children also
inherit their house's feuds (-30 to the other house's grown-ups) and the favour of its bonds (+`BOND_NEWCOMER`).

**Feuds** (`Feud`, `startFeud`, `feudFrom`). A murder, assault or theft between two families (from `politics.ts crime`,
after the victim is picked) or a jilting (`jilt`: an unmarried partner leaves for someone they are warmer to) starts one;
at most `FEUD_MOST` live. The two houses' grown-ups sour by `FEUD_START` at once and by `FEUD_PRESSURE` each dawn (partners
excepted), so they reach ENEMY, brawl (`brawl` in social.ts is now exported) and are never sent on trips together. Each dawn a
hot feud may add an incident (chance heat / `FEUD_INCIDENT_DIV`): a brawl, sabotage (damage to the other's building, else
a coin theft) or a refusal to work (a sulk breakdown). A feud ends by a marriage across it, a shared ordeal (a raid
both houses fought, or a famine), or the council (any council meeting, `COUNCIL_END` each); peace leaves a thin bond.
**Bonds** (`Bond`): each raid fought side by side adds `BOND_RAID` between the houses of the top four fighters (from
`s.raidRecap.rows`); at `BOND_DECLARED` it is told and members warm to each other daily (`BOND_WARM`).

**The ruling house** (`RulingHouse`). Begins as the leader's (`s.mainId`); `strengthOf` sums levels, titles x5, foes felled,
coin, land, the leader's 12, less black sheep, debt and (for the ruling house) a crisis (-30%, 15 days) or scandal (-15,
20 days), and a little remembered renown of its dead. Stage: `rising` while young or still setting peaks, `declining`
below `DECLINE_BELOW` of its peak, else `peak` (changes at most every 4 days, each told). A house with 2+ grown-ups at
`RISE_MARGIN` x the ruler's strength (and at least `RISE_LEAST`) for `RISE_DAYS` days takes the seat (told "by its wealth",
"by force of arms" or "by the weight of its name in council"; the cast-down are sore for two days, the town dips); a house
with no living member dies out and the seat goes to the leader's line, else the strongest. `Reign`s are kept in `past`.
It does NOT change `s.mainId` (the player's founder). `dynastyDeath` (from `killPerson`, after `recordDeath`): the heir
(`heirOfHouse`) dying starts the crisis and a town-wide morale mark; the head dying names the successor.
`dynastyScandal` (from `blackSheep`) counts too.

**Heirlooms** (`Heirloom`). A unique, or Epic+ piece, worn by a family member becomes their house's (max `HEIRLOOMS_MOST`);
`s.ancestry.heirloom` brings its carried generations and curse into the story. On the holder's death at home it passes to
the heir (`heirOfEstate`; a child's goes to the chest); on the road it is lost with them. Out of the family's hands or gone
from the town for `HEIRLOOM_MISSING_DAYS` it is lost: the house is sore three days and the story says so; found again, it
says that too. Raids the holder fights add lines to its story.

**Views.** `snapshot.dynasty` (`DynastyView`, slow) -> the Families tab: a ruling-house card (stage, strength, head, heir,
crisis; tap for past reigns and the log), a feuds-and-friendships card, a card per heirloom (tap for the story), and
tags on each family card (crown, crossed swords, heart, diamond). The year's chronicle (`annals.ts writeChronicle`) gets
`dynastyYearLines`. Notices that matter are key journal entries.

Changes to existing systems: `HISTORY.md` "Schools, apprenticeships and family trees" - `comeOfAge` ends with
`applyUpbringing`, `familiesView` is built on `lineGroups`; "Town politics and law" - `crime` calls `feudFrom`.

## Game speed ×5 and ×10

The clock bar's speed button (`hud.ts`) now cycles 1× → 2× → 3× → 5× → 10× → 1× (phone and desktop share it).
`GAME_SPEEDS` in `sim/battle.ts` lists the town's speeds (`BATTLE_SPEEDS` stays 1-3); `setGameSpeed` and the
`gameSpeed` command check (`commands.ts`) accept only those, so an old or odd saved `gameSpeed` falls back to 1×.
Fights already start at 1× (`fightSpeedTick` sets `battleSpeed` to 1 when one opens, and `battleSpeedNow` uses
`battleSpeed` while a fight is on), so a fight drops the pace from the town's ×10 to ×1 and the town's speed is
untouched and carries on after it. Raid-skip is unchanged. Nothing in the sim step changed.

`Sim.advance(ms, maxTicks, budgetMs)` takes a wall-clock budget; `GameLoop.pump` gives it `FRAME_BUDGET_MS` (40 ms).
Ticks that don't fit stay owed (capped at `maxTicks` worth) and are run on the next pumps, so input and drawing stay
responsive. The speed button is 34px wide (`index.html`) so "10×" fits.

## Thinner castle and hold walls

The castle's and the hold's walls are drawn thinner, so less of each room is hidden behind them and the floor under
each room's top wall (the space furniture and people are placed in) is larger. Only the drawing changes; the sim is the
same.

The file is `src/renderer/map/castleArt.ts`. The wall thicknesses and faces, in px:

| Constant | Was | Now | What it is |
|---|---|---|---|
| `PART_T` | 6 | 4 | a partition's walk (its top) |
| `PART_FACE` | 22 | 10 | a partition's face, seen from the room below |
| `WALL_T` | 8 | 4 | the curtain wall's walk |
| `INNER_FACE` | 26 | 10 | the curtain wall's face seen from inside |
| `ROCK_T` | 12 | 6 | a hold's rock band and side wall |
| `ROCK_FACE` | 24 | 12 | a hold's hewn rock face |
| `SIDE_T` | 10 | 6 | a partition's side run (down a column) |
| `OUTER_SIDE_T` | 10 | 6 | the curtain wall's west and east runs |

`wallDepth(mountain, outside)` (the depth a wall takes into a room, read by `map/castleClutter.ts` as `topWall`):
- partition: 28 → 14
- curtain wall from inside: 40 → 20
- hold's rock: 36 → 18

Unchanged on purpose: `TALL` (64) and `TALL_S` (44), so wall heights stay the same; `FOOT` (4) and the sort order from
0.94.0; `DOOR` and `DOOR_H`, so doorways are the same clear opening; `MERLON` (6), which the battlements in
`map/keepArt.ts` also use.

The wall picture still rises `TALL` above its foot, so a wall still covers the room behind it by the same height. What
is smaller is the depth the walls take across the room, and the thickness of the walk and face.

## The Great Enemy (the owner's ask: one slow-building villain a town, a long arc for a game meant to last months)

- **The data** (`src/shared/data/greatEnemy.ts`): six Enemies (`GREAT_ENEMIES`, `EnemyKind`), each a person-like foe with
  a name, a seat on the world map (`SEAT_SPOTS`), a goal, a way of fighting, three lieutenants (`Lieutenant`: an enemy
  id, a name, the outpost it holds and its guard), an army (`GREAT_ENEMY_RAIDS`, merged into RAID_KINDS, weight 0: never
  rolled), a seat guard, omens, dreams, a stranger's warning, travellers lost, its agents' disguise, each stage's
  telling, its tribute demand, a picture, a backdrop, a colour for the world map, and a relic:
  - **tower**: Malgrith the Tower Lord, the Black Tower of Vorn (storm-mages, fallen knights, demons; Isolde the Ember
    Witch, Gorrath the Gate Warden, the Black Seneschal).
  - **brood**: Sarnath, Mother of Wyrms, the Smoking Peaks (drakes and wyrmlings; Vyrax the Drake Lord, the Wyrm
    Priest, Ossk, Warden of the Clutch).
  - **plague**: the Pale Prophet, the Bell Fen (the risen flock, plague rats, cultists; the Rat Mother, Old Toller the
    Bell Ringer, the Mourner).
  - **engine**: the Engine Mind, the Clockwork Deep (golems, sentries, drones; Unit Foreman, Blade Unit Seven, Gunner
    Prime).
  - **drowned**: the Drowned King, the Sunken Throne (drowned sailors, squid-kin, coral golems; Admiral Kell, the Tide
    Witch, the Deep Maw). A shore town's only (`enemyFit`: the coast biome or a sea town).
  - **undying**: Kharzul the Undying, the Field of Spears (bone legions, death knights, wraith archers; the Bone Marshal,
    Ser Hollow, the Gravecaller).
  The 24 foes (`GREAT_ENEMY_FOES`, merged into ENEMIES): the Enemies 1500 to 1800 health (deadlier than the Calamity's
  avatars), their lieutenants 540 to 780, every one a boss with a kit; all drawn from pack sheets already in the game
  (`packSheets.ts`: lightning_mage, wyvern, ninja_monk, robot_destroyer, pirate_zombie, samurai_commander for the
  Enemies; fire_wizard, hk_demon, knight_3, drakes, shaman_king, the DawnLike drakes and sea dragon, gorgon_2,
  hk_zombie_brute, hk_mummy, hk_juggernaut, robot_swordsman, robot_infantry, pirate_leader, squidman, skeleton_spearman,
  knight_2, champ_necromancer for the lieutenants), recoloured by `look`. No new sprite was copied in. Relics
  (`GREAT_ENEMY_TROPHIES`, merged into ITEMS: the Iron Crown of Vorn, the Heart of the Brood, the Bell of Stillness, the
  Engine Core, the Coral Crown, Kharzul's Banner); unique weapons (`GREAT_ENEMY_UNIQUES`, folded into data/uniques.ts'
  rows: one each Enemy, one shared by its three lieutenants). The **Victory Monument** (`MONUMENT_BUILDING`,
  `victory_monument`, in BUILDINGS; the planner's `NEVER`; drawn with the cave statue in map/packBuildings.ts).
- **Choosing** (`sim/greatEnemy.ts`): on day `ENEMY_CHOSEN_DAY` (2) at `ENEMY_HOUR` (9), `chooseEnemy` draws a kind
  weighted by `enemyFit(kind, biome, origin, shore, calamity)` from its own side stream (`${seed}:enemy:kind`). The
  drowned king only by the sea; the brood in the high, cold and burnt lands; the plague cult in fens, jungle and forest;
  the engine mind for the machines, alchemists and dwarves and in the wastes; the undying on the steppe and ashlands.
  Never a second dark lord or rot beside the town's Calamity (the tyrant halves the tower and all but rules out the
  undying; the rot rules out the plague), and seldom the undying for a lich town.
- **The arc** (`s.greatEnemy`, `GreatEnemyState`; `greatEnemyHourly` from sim.ts after the Calamity): each morning its
  **plan** grows by `pace / DANGER_PACE`, a paced day (`paceDay`), and the stages come at `PLAN_AT` (omens 5, stirring
  15, march 32, siege 52 paced days: with nothing for or against it, game days 13, 38, 80 and 130; at about two and a
  half game days a real day of play, about 5, 15, 32 and 52 real days). `paceToday`: 1, plus `OUTPOST_HASTE` (0.2) for
  each outpost still standing (ignoring it speeds it), less `COUNTER_TOPICS` for each known (scouting, writing,
  fortification, oral tradition, physick) and `FAITH_SLOW` when the gods' favour sums past `FAITH_FAVOUR` with a shrine,
  temple or cathedral standing; held between `PACE_LEAST` and `PACE_MOST`.
  - **Omens**: an omen on a night (`OMEN_NIGHTLY` at `OMEN_HOUR`, a morale chill), and with it a dream (`e.dream`) that
    about half the town writes in their diaries the next day (sim/diary.ts `dreamOf`, "Last night I dreamed..."); a
    traveller lost now and then (`MISSING_DAILY`); a stranger's warning once (`WARNING_DAILY`, a told prompt), which
    reveals the seat; else the scouts find it (`SEAT_FOUND_DAILY`, more with Scouting and each mapped region).
  - **Stirring**: the seat is found if it wasn't; its three outposts go on the board (`enemy:<kind>:out<i>`); its blight
    creeps onto the town's land (`e.creep`, a cell at the land's edge toward its seat, `CREEP_PER_DAY` up to
    `CREEP_MOST`, a source in sim/blight.ts `blightSources`: fields grow slower, ward stones keep it off); its agents
    among the visitors (`AGENT_DAILY`: a fire, a theft or a killing, unless the watch unmasks them, more often with
    guards); raids bearing its mark (`MARK_CHANCE`, its army in place of a raid due within a day, `Raid.enemy` 'mark');
    every `FALL_EVERY_DAYS` a power of the realm falls to it (`powerFalls`, up to `POWERS_FALL_MOST`: an ally of the town
    razed, any other at war with the town at -100, `e.thralls`; freed at the peace); the Monster Hunters' Guild posts a
    purse on each lieutenant (`GUILD_PURSE`, into `s.bounties`, so the parties are drawn and paid by the usual bounty).
  - **The march**: every `HOST_EVERY_DAYS` a living lieutenant leads a host (`startRaid` with `host`: `HOST_SHARE` of the
    raid budget, `HOST_MOST` foes and one more for each `HOST_PER_GROWN` grown-ups at home up to `HOST_CAP`, staying
    `HOST_HOURS` to fight (an ordinary raid's three hours ran out mid-board and they routed on the clock), a siege engine from the Medieval age, the lieutenant at its head: `Raid.enemy`
    'host', `enemyLt`); every `TRIBUTE_EVERY_DAYS` it demands tribute (a prompt of kind `enemy`, `answerEnemy` from
    roadEvents.ts: `tributeOf`, half as much again each time; paid, the plan slips `TRIBUTE_SETBACK`; refused, it hastens
    `REFUSED_HASTE` and a host comes the next morning; left unanswered, the town pays only if it holds twice the sum).
  - **The last siege**: warned `SIEGE_WARNING_HOURS` (36) ahead, then `startSiege`: its army at `SIEGE_SHARE` of the
    budget (more for each living lieutenant), up to `SIEGE_SIZE` plus `SIEGE_PER_LIEUTENANT` a living lieutenant plus one for each `SIEGE_PER_GROWN` grown-ups (at
    most `SIEGE_CAP`), staying `SIEGE_HOURS`, two siege engines, the
    Enemy at its head and its living lieutenants beside it (`Raid.enemy` 'siege'). `greatEnemyRaidOver` (from raids.ts
    `endRaid`): any lieutenant down in one of its raids is slain; the Enemy down is the **peace** (`victory`: stage
    `peace`, its relic in the stores, the monument raised at once (or a blueprint over the wild), the town titled "the
    Bane of ..." and its hardest hitter (the raid's tally, else the best fighter) given "...'s Bane", the thralls freed,
    the blight gone, `PEACE_MORALE` for `PEACE_DAYS`; the town goes on). Lost, it is a sack: `SIEGE_BURN` buildings
    burn, `SACK_SLAIN` of the townsfolk are cut down (never the founder), the plan falls back to `SIEGE_REGROUP` short;
    the `SIEGES_TO_FALL`th (second) lost is the end of the town (`s.gameOver`, stage `fallen`).
- **The town fights back**: `PULL_OUTPOST` draws the town's own parties to the outposts (sim/parties.ts `pull`), never
  to the seat (`choosable` leaves `isEnemySeat` out: that's for the player's expeditions). An outpost cleared
  (`enemyPlaceCleared`, from sim/expeditions.ts as a place is cleared) slays its lieutenant (`slayLieutenant`:
  `LIEUTENANT_SETBACK` paced days off the plan, a morale lift, a scene). The seat (`enemy:<kind>:seat`, `seatOpen` once
  found, quiet `SEAT_QUIET_DAYS` after a strike) holds its seat guard doubled while a lieutenant lives (a win sets the
  plan back `SEAT_SETBACK`), and the Enemy itself once they are all dead (a win there is the peace, early).
- **Legends across towns**: simHost.ts puts `enemyLegend` on the legend as a town ends (`Legend & { enemy }`: its kind,
  name and fate), and a descendant's town whose forebears it broke meets the same Enemy (`inheritEnemy`:
  `e.vengeance`, told at the omens). The Hall of Legends card says who slew or broke the town (legendsPanel.ts).
- **Seen**: the Trips tab's Out now has **The Great Enemy** (expeditionsPanel.ts `greatEnemySection`, in `GROUPS`): its
  stage, the plan as a bar toward the siege, what's next and when, the latest omen, its lieutenants, the powers fallen
  to it, More (goal, way, seat, pace, sieges lost, title, slayer, the story so far, the arc), and its places' cards. The
  world map (worldMapView.ts) shows its seat once found (☠, tap to pick it when open), its outposts (⚑, ✕ slain) and its
  shadow spreading from the seat as the plan grows (`.map-spread`, its colour). A Town overview tile; the news bubble's
  standing notice from the stirring (red from the march, the siege's count-down) and its lines' tones (notices.ts); the
  yearly chronicle tells its turns (annals.ts, from `e.log`). Eight scenes (`data/greatEnemyScenes.ts`, merged into
  CUTSCENES: `enemy_omens`, `enemy_stirring`, `enemy_march`, `enemy_siege`, `enemy_lieutenant`, `enemy_victory`,
  `enemy_repelled`, `enemy_fallen`), the Enemy cast as `foe:{enemy}`.
- **Previews**: `__enemy(stage, kind)` in the phone page's console (mobileBridge.ts, simHost.ts `DEBUG`, `forceEnemy`)
  brings it straight to omens, stirring, march or the siege (which comes within the hour).
- Only with the autopilot on; every roll is its own side stream (`${seed}:enemy:...`). Optional state (`s.greatEnemy`,
  `Raid.enemy`, `Raid.enemyLt`); an older save's Enemy is chosen on its next morning and starts from nothing. Tests:
  `test/greatEnemy.test.ts`.
- **Soaks and probes** (main 0.93, 40 days, 3 towns each, people/deaths/wiped, main's in brackets): settlers 8.0/8.7/1
  (9.7/6.7/1), knights 14.7/3.7/0 (15.0/4.0/0), orcs 11.3/4.7/0 (10.0/5.3/0). A 160-day settlers town: omens day 16,
  stirring day 46, the march day 99, its three lieutenants slain (one at its shrine by a party, two leading hosts),
  tribute refused five times, the plan at 49.3 of 52 on day 161 (the siege about day 168), 171 dead in all. Forced on
  the late fixture (37 people), a siege of 57 cost 9 and 10 lives (the sack's 7 among them); the town's tactics board
  kills few of the town in any raid, as before.

## Battle maps: varied boards, terrain rules, shots in the air

Changes the HISTORY.md sections "Tactics battles", "Weapon range" and "Combat effects" (the raid board, shooters, the
fight screens' arrows).

**The board is laid per battle** (`makeBoard` in `sim/tactics.ts`, pieces in `sim/tacticsTerrain.ts`). After the land's
own ground, the old lumps and boulders (`lieOfTheLand`) and a new `easeRelief` (no step over `CLIMB_MAX` 2 left by the
relief), `layTerrain` strews the field (columns 2 to the wall less 2) from a **side stream**
`new Rng(hashSeed(`${seed}:board:${tick}:${attempt}`))`; the town's stream is never drawn on. What and how much comes
from the land's `LOOKS[biome]` (copses, hills, outcrops, thickets, logs, pond and stream odds) plus the share of the
board the land itself makes wooded, hilly or wet. Pieces: **hills** (a flat top `HILL_RISE` 3 over flattened ground, a
ramp two tiles wide up one side in steps of one, a cliff on every other side: `TacTile.hill` `'top'`/`'ramp'`), **copses**
(`tree`), **boulder outcrops** (`block: 'rock'`), **thickets** (`bush`), **fallen logs** (`log`), a **pond** (deep middle,
shallows round it) and a **stream** across the way with one or two fords. Water laid on the field carries
`TacTile.art`, a land cell of real water whose painted ground the top borrows. `boardOk` checks every standable tile can
be walked to from the gate and back over town rules (jump 2, no deep water), none in the raiders' edge columns lost and
at most 3% strays; a layout that fails is laid again (attempt 2) and then the plain field stands. The town's own fences
and fields are already on the board as the land's painted ground; nothing extra was laid for them.

**Rules** (added to the existing ones, not beside them): `canStep` is the one step rule for `reachable` and the raiders'
`wayIn` distance field: a climb over `min(jump, CLIMB_MAX)` is a cliff (so a hill is climbed from its ramp alone, by the
town's fighters and the raiders alike, who go round), each step climbed costs `CLIMB_COST` more, a log `LOG_COST`; a drop
of more than jump + 1 is too far. `sightClear` (shooters, and single-mark spells in `bestCast` and the player's orders):
trees (2 high) and boulders (1.6) over the eye-to-mark line block a shot, hills' brows too, walls are shot over as before.
`coverChance` replaces the flat `COVER` for shots: tree 0.3, bush 0.2, log 0.2 where the target stands, +0.15 for a tree,
boulder or log beside it on the shooter's side, halved from a shooter 2+ steps above, capped 0.5 (melee keeps `COVER`
0.2 for tree and bush). `shotReach`: `HIGH_REACH` 0.7 tile a step above the mark (a hill's top reaches two further).
The defence bonus of height is the existing `blowMult` (10% a step up to three).

**Every town's raid outcomes change** (new terrain in the rules, new draws): expected. Soak figures are in the
coordinator's report.

**Shots** (renderer only; the sim resolves as before): `TacFx.shot` names what flew (`data/projectiles.ts` `shotOf`:
arrow, bolt, bullet, spear, stone, beam, ball, or `orb:<element>`), set for a shooter's blow and a tower's bolt.
`battle/projectiles.ts` `ShotPainter` flies it (stateless: age in, sprite and trail out; DawnLike `items/Ammo.png`
cells for missiles, the pixel-effects atlas `px:<element>-orb` for spells) over `flightTicks`. The tactics board
(`TacticsScene.flightOf`) delays a blow's number, its landing sheet and an area's flash until the shot arrives; a spell
at the other side flies an orb of its element (`actFx`) before its sheet plays. `fight/fightView.ts` (side view) and
`map/mapBattle.ts` use the same painter (the side view finds a plain shot's target by matching the hit's age).

**Life on the board** (`tactics/boardLife.ts`): birds (`art/birds.png`) startle from a copse when a fighter steps beside
it, trees and thickets sway, leaves (autumn, summer and spring in woodland), snow (winter or snowing), dust (desert,
steppe) or embers (ashlands) drift over, water glints, torches flicker at the gate by night, fallen logs from the wild
prop set. No new art files; sources already in `CREDITS.md`.

Tests: `test/tacticsTerrain.test.ts` (connected boards in every biome, same seed same board, hills climbed by the ramp
alone, step costs, line of sight, cover, reach, shot names). Tools: `tools/probe-board.mjs [count] [show]`.

**A stall found by the hold scenario, and fixed:** with the first rules a raider could drop three steps into a pond-bank pocket it
could not climb out of, and a defender above it could not strike down three steps: the battle stood still for days. A
cliff is now a cliff both ways (`canStep`: a step of more than `min(jump, CLIMB_MAX)` either way is refused), and a
raider still on the field `STALL_TICKS` (2 hours) past its raid's leaving time slips away (`stepTactics`). The castle test
'a Deep Hold grows its halls' now uses the seed 'hold-grows-b' (the old seed's town simply took a different course: rooms
over ten seeds were 95 on this branch against 98 on main).

## House intrigue (the owner's ask on the ruling house from 0.96.0: own the town, a mafia, bribes, blackmail and murder for the council)

Extends HISTORY.md "Generations and dynasties" and "Town politics and law". New state `s.intrigue` (`IntrigueState`, optional, so
old saves load; nothing is made until the autopilot is on and the town has `INTRIGUE_PEOPLE` grown-ups after `INTRIGUE_FROM_DAY`).
Files: `sim/intrigue.ts` (rules and `intrigueView`), `data/intrigue.ts` (every number), the Families tab
(`renderer/panel/familyPanel.ts` `intrigueBlocks`), test `test/intrigue.test.ts`. `intrigueHourly` runs once a day at 03:00
(`INTRIGUE_HOUR`, after the night's crime and before the dynasty's dawn) from `sim.ts`, on its own side stream
`${seed}:intrigue:${tick}`. It never draws from the town's stream.

**Houses own the town.** A house is a dynasty house (`housesOf`). `IntrigueState.books[root]` (`HouseBook`) is its chest (`purse`),
what it has drawn, its crimes and (maybe) its ring. `of` maps each person to their house's root (refreshed each night, so the
sums between nights are deterministic). `houseCut(s, owner, n)` is called from `property.ts collectRent` and `ambition.ts
takeSale`: `HOUSE_TITHE` (35%) of what a landlord or keeper takes in goes to their house's chest (the fraction of a coin is
carried in `book.carry`; the founder's own takings are never tithed). Each night a house whose purse is `BUY_SPARE` x a price
buys a building (`buyProperty`): the town's homes, shops, workshops and fields (not public works) at `TOWN_SELLS_AT`, or a
neighbour's in debt (`FORCED_DEBT`) at `FORCED_PRICE`, which pays off what they owed. A house holds at most `OWN_SHARE_MOST` of the
town's sellable buildings. The new owner is the house's steward (its adult with the fewest holdings, never the founder), so
rent and takings keep flowing through `houseCut`. `dynasty.ts strengthOf` adds `wealthStrength` (the purse / `WEALTH_PER_STRENGTH`,
capped), and `bestWay` counts it ("by its wealth").

**A mafia** (`Mafia`, `foundMafia`/`mafiaDay`). A house with a purse of `MAFIA_PURSE` and a hard-natured member
(`HARD_NATURES`, the boss) may turn to crime (`MAFIA_CHANCE` a night, `MAFIA_MOST` rings). It hires up to `MUSCLE_MOST` knives
(paid `MUSCLE_WAGE` a day). Each night it calls on venues: shops pay `PROTECTION_SHARE` of yesterday's takings (taverns
`TAVERN_SHARE`); a proud or stern keeper refuses (`REFUSE_CHANCE`) and gets an "accident": the shop damaged (`ACCIDENT_HP`) or a
beating (`ACCIDENT_BEAT`, and `ACCIDENT_DEADLY` of it fatal). The treasury's own venues are skimmed (`TILL_SKIM`), and with muscle
a share of yesterday's trade is smuggled off the caravans (`SMUGGLE_SHARE`). `Mafia.heat` rises with each take; the nightly
chance of being found out is `EXPOSE_BASE + heat x EXPOSE_HEAT + guards x EXPOSE_GUARD` (+ `EXPOSE_HARSH` under harsh law).
Found out (`exposeMafia`): a knife or the boss is tried (queued, see below), `ARREST_DEADLY` of the time the boss dies resisting,
two of those who paid start a feud with the house, and the ring breaks up (`BREAK_UP`) or lies low `LIE_LOW_DAYS`.

**Taking the council.** The four blocs' speakers (`speakers`: the best-spoken member of each) are the council's seats. A scheming
house (`scheme`: `SCHEME_CHANCE` a night with `SCHEME_PURSE` or a ring, `SCHEME_GAP_DAYS` between, at most two a night) picks a
rival speaker and a method by what it has: a **bribe** (`BRIBE_COST`; the taker's nature decides, an honest one throws the purse
back in public), **blackmail** (needs a secret: `secretsAbout` = a crime nobody saw (`hideCrime`, from `politics.ts crime`), a big
debt, a lover; a target that fights back airs the secret and names the blackmailer, and `CORNERED_KILLS` of the time kills them),
**fear** (a ring's muscle; a beaten target who talks names the men) or **murder**. A successful hold (`Hold`, `HOLD_DAYS`) makes
`politics.ts callVote` call `swingVote`: the held speaker's own vote goes and the house's position counts `SEAT_VOTES`
(`housePosition`: a ring wants harsh law and curfew gone and the tax low, other houses follow their head's bloc). A house with
more than half the seats is whispered of. `Method` weights are in `METHOD_WEIGHT`.

**Murder** (`houseMurder`, `Plot`). A hard house with a ring or a hot feud may have a rival speaker or the ruling house's heir
killed (never when `recentKill`). The knife (a hired man, else the schemer) succeeds at `MURDER_SUCCESS` less a guard's bite; a
failed knife dies (`KNIFE_FALLS`) or is taken and may name its master (`KNIFE_NAMES`). A clean job (`ACCIDENT_SHARE`) is an
"accident" (`ACCIDENTS`); otherwise a knife in the dark, and the house may pin it on a patsy (`FRAME_CHANCE`: an enemy of the dead,
else the poorest hand; the patsy is tried for it). Each night a hidden plot is found out with `UNCOVER_BASE + guards x UNCOVER_GUARD`
(`uncover`): the patsy is cleared, the real culprit is tried, a feud starts (`startFeud`, heat 60), the house is shamed (a morale
mark), and the wronged house may swear revenge (`REVENGE_CHANCE`; `revengeDay` strikes openly some days later, which is itself a
murder to be tried). A house with `BANISH_AT` known crimes has its head run out of town (`banishIfEnough`).

**Trials.** The court takes one case at a time (`politics.ts trial` leaves a pending prompt alone), so intrigue queues its
trials in `IntrigueState.trials` and `drainTrials` calls them when it is free. A trial of a house member goes through `trial` ->
`blackSheep` -> `dynastyScandal`, so the ruling house's scandal works as before.

**The owner's rule: the leader never changes by intrigue.** `slay` is the only place intrigue kills, and refuses `s.mainId`; the
founder is also excluded from every target, culprit, patsy, steward, muscle and boss pool. A takeover of the ruling house
(dynasty.ts) still does not change `s.mainId`. Jilting is untouched.

**Visible.** Whispers (`Whisper`, `whisper`) hint at hidden deeds as non-key news; what comes to light is a key news item and goes in
`IntrigueState.log`, which `dynastyYearLines` adds to the year's chronicle (`intrigueYearLines`). `snapshot.intrigue`
(`IntrigueView`, slow) -> the Families tab: a card per rich or guilty house (holdings, chest, council seats, known ring,
known crimes on tap, a whispered rumour while nothing is proved) and a Whispers card. The People panel's key
(`townsfolkPanel.ts`) includes it.

Not done / for the coordinator: the gossip lines (`sim/gossip.ts READS`) don't yet read the whispers (that file belongs to the
town-culture chat); a `rumour` kind there could read `Folk say ...` / `They say ...` notices. `diary.ts` could call
`secretsAbout` so a diary hints at a secret a person keeps.

## The carts face the way they go

Renderer fix only; the sim is unchanged. The owner saw a horse-drawn cart with the cart out in front of the horse.

The Village pack's `cart.png` (48x26) has its shafts on its left and its wheel on the right, so it is drawn facing
left. The horse sheet's left row faces left and its right row faces right (`creatureFrame`), so the horse needed no
change. The two places that flip the cart had the sign backwards: it was flipped the wrong way for the direction of
travel, so the shafts pointed away from the horse or the lead.

- `src/renderer/map/roadTraffic.ts` (`RoadTraffic.render`): the carter's horse sits ahead of the cart (`x + dir * 14`)
  and the cart trails (`x - dir * 12`). The cart is now flipped with `scale.set(-dir, 1)` so its shafts point at the
  horse.
- `src/renderer/map/mapWagons.ts` (`MapWagons.update`): a caravan's wagon trails the lead merchant (`bands.ts`
  `rollWagon`). It is now flipped with `w.dir > 0 ? -SCALE : SCALE`, so its shafts point at the lead.

The couriers (`mapCourier.ts`) and the people's horses (`mapPeople.ts`) draw no cart, so they were not changed.

## Fights that move (fight-anim)

Extends HISTORY.md "Watching a party's fights", "Combat actions", "The flashier raid screen". Renderer only: the sim and
snapshot are unchanged (`tools/sim-hash.mjs` matches main).

**What was weak (before).** Looked at with `__skirmish` and a raid at 393x852 and 852x393: a blow was a 10 px step
for 6 ticks and a pose swap, so no wind-up and no recoil; the struck one only turned red for 3 ticks; a foe's death was
a 2 second fade to nothing and a townsperson just lay on the hurt frame; nothing flinched when a friend fell; idle
figures stood dead still; a close blow's number, flash and spark came the instant the blow began, before any lunge could
land; all motion stepped at the sim's 10 Hz.

**What it does now.** All of it is code-tweened *motion* of the packs' own frames (no new art, nothing to credit):

- `fight/fightMotion.ts` (pure, no Pixi; `test/fightMotion.test.ts`): `motionOf` turns a fighter's tick counts (since its
  action, since it was hit, down) into an offset, a lean, a squash, a flash and the corpse's alpha. A close blow:
  wind-up (step back, lean) ticks 0-1.5, lunge to its peak at `MELEE_LAND` (3), back in place by `LUNGE_TICKS` (9). A
  bow or spell: a draw (lean back, rise) then a kick as it's loosed. Struck: white flash on the first 2 ticks, red tint
  after, a knock-back away from the striker that settles over `RECOIL_TICKS` (7), a squash; a blow worth `HEAVY` (25%) of
  max health knocks harder. Down: a 2-tick hold (the death registers), then a topple away from the foes over
  `FALL_TICKS` (6) and lying; a long low body (wolf, boar: width over 1.1 x height) flattens instead. Idle: a breath and a
  weight shift, out of step by ref. A friend falling: a flinch back and dip for 6 ticks. A won fight: the party hops.
- `TickClock` smooths the sim's whole-tick counters into fractions of a tick from the wall-clock time they last changed
  and an average of how long ticks have taken, so motion is 60 fps smooth and runs at the battle speed (a faster speed
  plays it faster; it never outlasts the turn, since a new action just restarts it).
- `fight/fightView.ts`: the above applied through `moveSprite` (squash and lean about the feet). Close blows (plain ones
  by matching the striker's `sinceAction` to a foe's `sinceHit`, as `plainShots` does; skills that strike foes up close)
  make their number, flinch, spark and spell effect wait `MELEE_LAND` ticks for the lunge to land, using the existing
  `Flight` machinery. A cast gathers a glow of the spell's colour round the caster. Heavy blows pop a larger gold
  number and shake the screen a little (`hitAt`/`hitK`, smaller than an ultimate's shake); a townsperson falling shakes
  it and blinks the screen red. Numbers arc up and away from the striker. Foe corpses stay (alpha dims to 0.45 and holds,
  `corpseAlpha`) instead of vanishing; the party's lie solid. Packs' own death rows are played through, not shown at
  their end (`creatureFrame`'s new `dying` argument, `HeroState.sinceDown`, the LPC hurt row stepped by the fall).
- `map/mapRaiders.ts` (also the tactics board's raiders) and `map/mapPeople.ts` (the people of the map and the board):
  the same vocabulary at 0.6 of the size (`MOTION_K`): lunge and recoil, flash, topple, dimmed corpse (raiders). People on
  the map get only the lunge/recoil offset, not a topple (their marks and props hang off their position).

Not done / design calls: a real slow-motion "pause" on a townsperson's death is not possible without the sim (the
renderer cannot stop the ticks), so it is a 2-tick hold on the hit frame, a red blink and a shake. A guard stance when a
foe approaches is not drawn (the sim has no approach: foes stand in place); the victory hop is the end-of-fight pose.

## The Calamity is the Great Enemy's stirring

Changes "The Calamity" and the great-enemy note (0.99.0) in `docs/HISTORY.md`: the two arcs are one now. The Calamity is
no longer a villain with a clock, a dread of its own, armies and a siege; it is the Enemy's stirring made manifest, and
the Enemy's **plan** (`GreatEnemyState.plan`, paced days, `PLAN_AT` in `data/greatEnemy.ts`) drives it.

- **Which Calamity.** `ENEMY_CALAMITY` (`data/calamity.ts`): tower and undying bring the tyrant, plague and drowned the
  rot, brood and engine the sleeper. `enemyFit` no longer looks at the Calamity (there is only one villain to avoid
  doubling), and `calamityKindOf`, `CALAMITY_WAKES` and the daily dread are gone.
- **When it acts** (`CALAMITY_AT`, plan days): it wakes far off at 10 (the omens; the wake cutscene plays, now naming
  the Enemy), its heart opens on the board and its scar spreads at 20 (`calamity_spreading`), its cult takes root at 26
  (`calamity_cults`); the march (4) and the last siege (5) are the Enemy's own stages, told by the Enemy's scenes.
  `calamitySync` (wake, stages, told once, one Chronicle line each) and `calamityDaily` (scar, wards, cult deeds) are called
  from `enemyDaily` in `sim/greatEnemy.ts`; `forceEnemy` syncs too. `calamityHourly`, `calamityRaidOver`, the Calamity's
  own armies, siege, `STAGE_AT`/`stageOfDread`, `SIEGES_TO_FALL` and its omen roll are removed.
- **Omens.** `omen()` in `greatEnemy.ts` takes `CALAMITY_OMEN_SHARE` (0.4) of its signs from the Calamity's own lines
  (side stream `enemy:omen-calamity`, so the Enemy's own omen draws are untouched), "An omen of the Ashen Tower: a grey
  mould crept over the bread."
- **The heart.** Still `calamity:heart` on the board, but it is the Enemy's forward seat, kept by one of its
  lieutenants (`keeperOf`, by seed). Clearing it sets the plan back `HEART_SETBACK` (5 plan days, a little under a
  slain lieutenant's 6), halves the scar and closes the heart for `HEART_QUIET_DAYS`; the stage does not change and the
  story goes on. Nests left on the land quicken the plan (`NEST_HASTE` per nest level, via `calamityPace` in
  `paceToday`), ward stones slow it (`WARD_SLOW`); a nest burned out (`nestCleared`) and a "dread" event effect move the
  plan through `shiftDread`/`shiftPlan` (never into the siege on their own; frozen once the siege is warned).
- **The end.** The Enemy's peace is the win: `victory()` calls `calamityLifts` (the blight lifts, the cult scatters,
  `beaten` set). The Enemy's two lost sieges end the town (`SIEGES_TO_FALL` 2) and tribute is paid only when the treasury
  holds twice the sum, both as the Enemy already had them.
- **State.** `CalamityState` keeps `kind`, `stage`, `heart`, `scar`, `heartCleared`, `omen`; `dread` is now the plan's
  share of the way to the siege (0 to 100, for the menus). New optional `driven`; `siegeAt`/`lost` kept optional for old
  saves. `Raid.calamity` is old-save only.
- **Old saves.** `bindCalamity` (`greatEnemy.ts`, run from `greatEnemyHourly` for a Calamity without `driven`): the dread
  becomes plan days (dread/100 x `PLAN_AT.siege`, never lowering the Enemy's own), the Enemy's stage is passed quietly,
  sieges lost carry over (capped at one under the fall), a pending siege or a siege/army raid already on the land becomes the
  Enemy's (`r.enemy`), and the old avatars still count as the siege's leader when they fall. The Calamity's kind becomes the
  Enemy's. No save-version bump.
- **Menus.** One card: the Trips tab's separate "The Calamity" section and the overview tile are gone; the Enemy's card
  carries the Calamity's stage, nests, wards, cult, forward seat, blight, and the heart destination card.
  `calamityView` gained `enemy` and `keeper`. The news bubble's Calamity items are folded into the Enemy's.
- **Tests.** `test/calamity.test.ts` (rewritten: arc, pace, heart setback, no second scheduler, finale, old saves),
  `test/greatEnemy.test.ts`, `test/cutscenes.test.ts`.

## Seafaring and islands (claude/seafaring; the owner's request)

The sea made a real place, on top of "Boats" and "The merfolk's shore" (HISTORY.md; boats, fishing and island trips
were already there). Autopilot only, on a side stream (`hashSeed(`${seed}:sea:${tick}:...`)`); `sim/seafaring.ts`
(`seafaringHourly`, called after `boatsHourly`) and `data/seafaring.ts`.

- **Harbour** (`HARBOUR` in BUILDINGS, shore, research `shipwrighting`): planned by the town (`planHarbour`) once it has
  a boatyard, a boat, 8 grown folk and the makings. Berths +2 (`fleetMost`), catch x1.5, squalls and the night monster
  x0.5/x0.6. Boats moor at it (`quay`, the snapshot's `mooring`). **Galleon** (`GALLEON`, research `galleons`).
- **Fishing:** `catchFactor`: the season's shoal (`SHOALS`; inshore for dugout/longboat, deep for carrack and up, wrong
  ground x0.6), harbour, merfolk escort. A squall that batters a fishing boat can sink her (`squallSinks`: hull under
  30%, else 12%); 2-3 townsfolk aboard drown (swimmers rarely). Catch kept in `s.sea` (`SeaBook`).
- **Ships age:** `Boat.built`; past 24 days the hull wears daily; a worn-out boat at home is broken up.
- **Monster:** by night from day 12 a serpent/kraken mauls or sinks a moored boat (x0.3 for merfolk). `sea_serpent`
  joins the medieval `SEA_FOES`.
- **Wrecks** (`washUp`, from any sinking and `wreck`): timber/cloth on the beach, sometimes castaways (a `refugees`
  band). Autumn/winter drift wrecks.
- **Pirates:** `SEA_RAID_KIND` (`sea_raiders`, in RAID_KINDS, never random) landed by `pirates()` every 9-16 days
  from day 8, medieval on, budget x0.7, raiders placed on the nearest beach (`beachNear`), `Raid.landing`. Pushes
  `nextRaidTick` out a day.
- **Isles:** `SEA_ISLES` (Herring Isle fishing, Ember Isle volcano, the Wreck Isle haunted, the Tidewrights' Isle trade
  with another people), merged via boats.ts `ISLANDS`/`ISLAND_SPOTS`. Gull Rocks is the bird-rock. Expeditions use the
  existing picker.
- **Colonies** (`s.colonies`, `Colony`): a town of 12+ (merfolk 7) founds one from day 20 (merfolk 9) on an isle in
  `COLONY_ISLES`; folk leave the town like a village's; goods sail home every 3 days in a free boat (storm risk);
  loyalty drifts, pirates raid, below 12 it breaks away. Max 2 (merfolk 3).
- **Merfolk:** start with a dugout, fish with no yard, monsters x0.3, a leviathan escort sometimes boosts the catch,
  and the Tide Clan claims isles for other towns on a fixed day 22-70 per seed (`claimDay`); never in a merfolk town.
- **Seen:** snapshot `seafaring` (`harbourReport`); Harbour tab in the Market menu, sailing boats and wakes
  (`map/mapBoats.ts`), sea lanes/colony flags/claim rings on the world map.
- Tests: `test/seafaring.test.ts`.

## Town personality and culture

Over months the town grows its own customs, drawn from what happened to it, and it shows. Autopilot only; own side
stream ('culture'); nothing drawn from the town's stream; no manual controls.

- **Files:** `src/shared/data/culture.ts` (20 traits, `CULTURE_TRAITS`, dishes merged into `ITEMS` as `CULTURE_ITEMS`),
  `src/shared/sim/culture.ts` (`cultureHourly`, `cultureDaily`, `readSignals`, `fashionName`, `cultureView`),
  `src/renderer/panel/culturePanel.ts` (the Chronicle's **Culture** tab), `test/culture.test.ts`.
- **Earning:** once a day (hour 5) the town's history is read as 16 signals (hunger, plague, raidWon, raidLost, peace,
  sea, trade, deaths, disaster, plenty, learning, festive, elders, justice, war, births). A trait's strength is
  `strength * DECAY (0.96) + weight * signal`, capped at `STRENGTH_MOST` 40. It is taken up at `WIN` 12, let go below
  `LOSE` 5; the town holds `HELD_MOST` 5, and a newcomer must beat the weakest by `DISPLACE` 4. Old fallen are read from
  `s.fallen` by the last key seen (`CultureState.seen`), raids from `s.yearRaids` deltas.
- **Showing:** a custom on day `CUSTOM_DAY` 2 of the trait's season at `CUSTOM_HOUR` 18 (the dish `cult_<id>_dish` is
  ordered at the fire on the season's first days; eaten at the custom; morale mark `CUSTOM_MARK` + `DISH_MARK` with the
  dish made); sayings (`CultureView.sayings`, read by `speech.ts` `setTownSayings`, `SAYING_SHARE` 0.35 of lines);
  a pennant colour at every gathering (`setCultureColour` in `mapFestival.ts`); three props of a festival kit by the camp
  (`MapFestival.syncProp`); the festival song takes the strongest trait's mode and lead (`setCultureMotif` in
  `musicScore.ts`); visitors' remarks as journal lines every `REMARK_DAYS` 6 while a band is by.
- **Names:** `fashionName` (called by `social.ts` `welcomeChild`) gives `FASHION_SHARE` 0.6 of children a name from the
  fallen, from heroes, or from the pantheon, by the strongest held trait with a fashion. The base name still comes from
  the town's stream, so nothing else shifts. The tavern's sign (the strongest trait's `sign`) shows only on the card.
- **State:** optional `GameState.culture` (`CultureState`). Absent in old saves; created on first use.

## Sea art from the packs and phone checks of the sea (claude/sea-art; changes "Seafaring and islands")

Renderer only; the sim is untouched (`tools/sim-hash.mjs` matches main).

- **Searched** every pack in `../chronos-assets` for ships, boats, sails, docks, piers, anchors and wrecks. No pack has a
  working boat: the Seabed pack's `Ship1`/`Ship2` are wrecks (already used: `packs/sb_wreck.png`) and its anchor is a
  seabed prop; the underwater and ocean packs are backgrounds; the pirate pack is characters; the tropical city pack is
  vector only. So `art/boatArt.ts` (the seven boats, their wakes in `map/mapBoats.ts`) and the boat icons in
  `art/customIcons.ts` stay painted.
- **Already pack art:** the harbour building (`packBuildings.ts` `harbour`: the Bridges pack's pier planks, crates, barrels
  and a lantern).
- **Swapped:** the war map's Harbour landmark (`panel/warMap.ts` `drawLandmark`) was a jetty of code-drawn rects; it is now
  three of the Bridges pack's pier planks (`SPRITES.pier` in `art/warSprites.ts`, `roads/pier_v.png`, credited already).
- **World map sea lanes** (`panel/panel.html` `.map-route.sea-lane`): the dotted line was lost on the map's own blue; now
  brighter, 3px, with a dark halo.
- **Phone checks** (393x852 and 852x393, Chromium): the map with a harbour, moored and sailing boats; the Harbour tab;
  the world map (lanes, colony flag); the Great Enemy card and its stage sheets for all six kinds. Nothing clipped or
  overlapping in the Harbour tab, the card or the sheets. Left alone: the world map's "The Far Isles" label (in the map
  picture) sits under the Far Isles scouting dot, and sideways the map is small (height-capped) so labels there crowd.

## Merfolk tails, the right way round (renderer only; changes "The merfolk's shore" and "Watching a party's fights")

- **Map bug:** `art/merTail.ts` draws the tail pointing right. `map/mapPeople.ts` flipped it when the swimmer faced
  *left*, so the tail pointed the way they were going, ahead of the body. It now points right when they face left and
  is flipped when they face right: it trails behind in both directions.
- **Side-view fight:** `FightScene.update(..., sea, mers)` (fight/fightView.ts) sets `wet` when the trip's look is an
  underwater or ocean backdrop and the party is not aboard a boat or aloft; `mers` is the set of person ids that are
  merfolk (`PersonView.mer`, built in main.ts from the snapshot, so no snapshot or sim change). In `pose()`, a merfolk
  party member in a wet fight is cut at the waist (`HK_WAIST` .67 for the Himeko doll, `WAIST` for the old LPC figure)
  and given a tail (`finTail`): the tail is a child of the figure's sprite, so the lunge, recoil, squash, hurt and
  fall in `moveSprite` carry it along. The tail trails away from the foes (right for the party). A downed merfolk
  uses the standing frame and the motion's topple, as a lying frame can't be cut at the waist. Dry fights keep legs.
- Not changed: the march between fights, and raid battles (tactics board), still draw legs. Preview: `window.__look`
  = `underwater_1` forces a wet fight.

## Guild icons

Each guild has a small round badge (DawnLike item glyph on a coloured token) shown by its members' names, so you can see who has joined which guild. Renderer only: the sim and snapshot are unchanged (a person's guilds are found from `snapshot.guilds`).

- `src/shared/data/guildEmblems.ts` (`GUILD_EMBLEMS`): one glyph and two colours per `GuildRole`. wardens Shield 4, menders Potion 0, rangers Ammo 8 (a bow), crafters Tool 9, merchants Money 0 (coins), scholars Book 40, elite ShortWep 1 (a dark blade).
- `src/renderer/art/guildMarks.ts`: `guildsOf(s, personId)`, `guildBadge(role, size, title)` (canvas), `guildMark(s, personId)` (the first guild's badge; its tooltip names all of them).
- Shown in: the People list rows (after the people mark), the inspect card (a line naming every guild, leader starred), the map tap card (`overlayUi.ts`, `createPersonCard.show(..., guilds)`), and the Guilds tab (`panel/guildPanel.ts`: badge on each guild card and on each member chip; leader starred). Membership was already in the People panel key.
- Not done: the fight HUD and Chronicle show names without a person id, so they cannot map to a guild without a sim change.
- Art is from DawnLike sheets already in `src/renderer/art/items` and credited.

## A skirmish with nobody left (a crash fix)

A land skirmish (`sim/roamers.ts`) whose party was all gone by the end (dead, or gone from the land) crashed the
closing notice: `names(members)` read the last name of an empty list. The helper is now `skirmishNames`, exported, and
reads "Nobody" for an empty party. Found by the Underdark chat's 40-day settlers soak (seed 2, day 32). Test in
`test/roamers.test.ts`.

## Town alignment (good and evil, with a bar)

One score, -100 (wicked) to +100 (radiant), `s.align` (optional; `AlignState`). Files: `sim/alignment.ts`, `data/alignment.ts`
(constants, bands, `ORIGIN_HOME`, law/sentence weights), `data/eventAlign.ts` (a weight -4..+4 for every answer of every
choice event, in option order), `data/alignEvents.ts` (five events that only come past a threshold).

- **What moves it:** the answer to a choice event (`alignAnswered`, weight x `POINTS_PER_WEIGHT` 4; called in `answerEvent`);
  once a day the leader's and the townsfolk's natures (`leaderLean`, `NATURE_LEAN`); laws passed or repealed (`LAW_ALIGN`),
  sentences told in the trial log (`SENTENCE_ALIGN`: hanged -10, pardoned +3), sacrifices in `s.fallen` (`DEED_ALIGN`), raiders
  taken alive (+0.8 each), hungry prisoners (-0.4 a day each). The watchers read state (they don't edit politics.ts or
  prisoners.ts). Other systems call `alignPush(s, delta, why)`; not yet called by the Great Enemy tribute, deals or dynasty
  conduct (those files belong to other chats).
- **Drift:** `DRIFT_PER_HOUR` 0.002 of the way back to the people's home (`ORIGIN_HOME`; vampires -45, liches -50, knights +40,
  druids +35, orcs -15...). Runs hourly from `Sim.step` after `maybeEvent`, autopilot only.
- **Recommendation:** `recommend(s, def)` scores each answer by weight x the town's lean (alignment + leader/folk nature) plus
  `worth()` (a rough value of its effects, food counted heavier when stores are thin). `Prompt.recommended` / `why` ->
  `PromptView`. With the autopilot on the card's `defaultOption` is the recommendation, so a timed-out card takes it
  (autopilot off keeps the event's own default). Shown as a star on the answer and a line under the answers
  (`mobile/eventSheet.ts`, `.event-advice` in `mobile/index.html`; the desktop prompt card marks it too).
- **Shows:** `alignBar` (`panel/alignBar.ts`) in the Town overview and under Direction in the Plan tab; the page sky is tinted
  and a soft edge vignette laid (`#align-cast`, `mobile.ts`; never over the middle); `moodOf` gets `align` (<= -45 dark music,
  >= 60 heroic). `snapshot.align` = `alignView`.
- **Unlocks (daily, side stream `align`):** good (>= 35) pilgrims join, reputation creeps up; evil (<= -35) the Hand pays the
  treasury, reputation creeps down. `raidAlignMult`: raids 0.9x (<= -35), 0.8x (<= -60) for fear; 1.1x at >= 60 (the dark hunts
  the light). Events: `pilgrims_come`, `holy_order` (>= 60), `thieves_offer`, `dark_bargain`, `foes_treat` (<= -60).
- **Cost:** spirits +2 for the good, -3 for an evil town whose people are not dark by nature (`alignMood`, `driftMorale`).
- **Chronicle:** swings of 2+ points are logged (`a.log`), a band change is a news item, and the year's chronicle gets a line
  (`alignmentYearLines`, hooked in `annals.ts`).
- Changes `data/events.ts` (EVENTS now 558) and `raidBudget`.

### The extras (second axis, the Enemy, visitors, titles, arcs)

- **Order to chaos:** `s.align.order` (-100..100), its own home per people (`ORIGIN_ORDER_HOME`), `orderPush`, weights per answer in
  `data/eventOrder.ts` (and `ALIGN_EVENT_ORDER` for the alignment events). Moved by laws (`LAW_ORDER`), sentences, intrigue crimes,
  houses at feud, the leader's and folk's natures (`ORDER_LEAN`). It tilts the recommendation too. Orderly (>= 35): work x1.03, watch
  x1.05; unruly (<= -35): work x0.97, fighting x1.05, travellers x1.1 (daily marks, `marks`). Two bars in the Town overview (`panel/alignBar.ts`);
  the Direction block no longer repeats it.
- **Inputs read from state:** intrigue crimes (`CRIME_ALIGN`), Great Enemy tribute paid (-2) or refused (+2), the ruling house's scandal,
  charity in famine (poor relief while the stores run low +1 a day, else -0.3). For the trade chat: broken deals call
  `alignPush(s, -3, 'A broken deal')` (and `orderPush(s, -2, ...)`).
- **The Great Enemy (hooks in `greatEnemy.ts`, each marked "alignment hook"):** `paceToday` adds `alignEnemyPace` (a good town draws its hate:
  +0.08 at 35, +0.15 at 60); `warnSiege` first calls `alignPact`: a town at -35 or below is offered terms as a prompt (`kind: 'ways'`,
  `ways.system = 'align'`, answered in `roadEvents.answerPrompt` -> `answerAlignPrompt`): a pact (40 days, 4% of the treasury a day), service as its
  lieutenant (90 days, 8% a day, a grown-up taken every 12 days, never the founder, raids x0.7), or refuse (the siege goes on). While a pact stands
  `enemyDaily` sends no host and asks no tribute (`alignPacted`).
- **Visitors and terms:** `alignArrivalMult` (wanderers x1.2/1.4 for good, x0.85/0.7 for dark), `alignArrival` (kind/pious nature for a good
  town's wanderers, greedy/stern/proud for a dark one's: `maybeArrive`); daily 'prices' (x1.05 / x0.95) and 'travellers' marks.
  Refugees and paladins as separate types are not added (no such types exist).
- **The title:** `titleOf` ("the Merciful", "the Just", "the Cruel", "the Dread", "the Steadfast"...); `snapshot.townTitle` shows on the phone
  page's header; `titledName` is carried by the legend (`legacy.ts` `town`) and the year's chronicle line.
- **Falls and redemptions:** the score is sampled every ten days; from >= 20 to <= -35 inside 60 days is `fall_reckoning` (then `fall_exodus`),
  from <= -20 to >= 35 is `redemption_penance` (then `redemption_shadow`): once each, put as an ordinary event (never by chance, `when: () => false`).
- **Cast:** `MapView.setCast` tints the venues' banners (gold / dim violet), `StreetLamps.setCast` the lamp glow; both pack sprites tinted, no new art.
- Preview helpers: `__align(score, order)` and `__event(id)` in the phone page's console (`simHost` DEBUG).

## Trade empire (the owner's ask: growing rich is a way to survive, beside arms)

Under the **Trade** direction a town with a trade house (`marketOf(s)`, sim/markets.ts) grows a merchant empire on the
world map, and spends its coin on safety. New files: `src/shared/data/tradeEmpire.ts` (all the numbers),
`src/shared/sim/tradeEmpire.ts` (the rules, `s.empire`), `src/renderer/panel/empirePanel.ts` (the Market menu's **Trade
empire** tab), `test/tradeEmpire.test.ts`. Only with the autopilot on, and the posts, caravans, deals and tribute start
only under `s.direction === 'trade'`; a town on any other direction is byte-for-byte unchanged (`tools/sim-hash.mjs` is
identical). Side stream `new Rng(hashSeed(`${seed}:empire:${tick}:<salt>`))`, never the town's. `s.empire` is optional.

- **Trading posts** (`foundPost`, `Post`): at `EMPIRE_HOUR` a day, if the town has a stall, coin (`POST_COINS` plus the
  treasury's keep), goods (`POST_GOODS`), and `POST_FOLK` adults to spare (`HOME_FOLK_LEAST` kept at home), it founds a post
  at the best far market (`sitesOf`): the world map's regions once scouted (`REGION_SITES`; the two island ones need a shore
  town or a boat, `canSail`) and the strongholds of known powers not at war (`power:<id>`, goods by `makesOf`/`wantsOf`).
  The folk who go are townspeople with `Person.away = EMPIRE_AWAY` (-4000201; the snapshot says "on the trade roads"). Posts
  allowed: `POSTS_BASE` + the trade house's tier + a charter. At the turn of each season (`reckon`) a post pays
  `site.base` x level x called-bonus x monopoly, plus the cuts (`POST_CUT` of each sale at its market) its caravans
  earned; levels at `POST_LEVELS`. Posts are lost (`losePost`) to bandits (`POST_RAIDED` x danger, halved with 2 guards or
  hired swords), to the war (`POST_WAR`, or at once at a power gone to war), to a power's decree (`POST_DECREE` when a
  power's attitude is sour or the town's monopoly sours it; not under its protection); the folk die (`POST_FOLK_DIE`, a third
  of it for a decree) or walk home hurt; the site is shut to the town for `LOST_SITE_DAYS`.
- **Caravans and ships** (`dispatch`, `launch`, `onTheRoad`, `EmpireCaravan`): at `CARAVAN_HOUR`, up to 1 + house tier
  caravans (`caravansAllowed`), the town sets one out on the circuit home - one or two posts - home that earns most an
  hour (`plan`: carries the stores' spare that fetch `CARGO_MARGIN` more at a stop, sells there, buys the post's cheap
  goods with 70% of the purse, brings home what did not sell). Sea posts make it a ship. `DRIVERS` townspeople go with it
  (paid `DRIVER_PAY`). Danger per leg (`legRisk`): `ROAD_LOST` per 100 px x the site's danger, x`WAR_ROADS` in a war,
  x`SEA_STORM` for a ship, x`SAFE_GUARDS` with 2 guards, hired swords or an ally, x`CHARTER_SAFER`, x`PROTECT_SAFER`. The dice
  are cast at departure (`fate`): **lost** (the goods and purse are gone for good; each driver dies on `DRIVER_DIE`, the rest
  walk home hurt; a fortune lost is told in the event box) or **robbed** (`ROBBED_TAKE` of what comes home, from markets.ts).
  A caravan home deposits at the stores, pays coin to the treasury (ledger line `trade`) and moves prices (`noteFlow`).
- **Guilds and deals** (`offerDeal`, `dealsDaily`, `Deal`): every `DEAL_EVERY_DAYS`, with a post, standing above
  `STANDING_FLOOR` and fewer than `DEALS_MOST`, a merchant guild (`GUILDS`) offers one the town takes on its own:
  a **monopoly** on a good it has plenty of (a boom swing on the price through `s.market.swings`, posts x`MONOPOLY_POSTS`,
  the town must keep `MONOPOLY_KEEP` in store; the other powers resent it, `MONOPOLY_RESENT` at once and 1 per 3 days); a
  **charter** for `CHARTER_FEE` (one more post, safer roads); a **loan** (`LOAN_PER_TIER` x tier, `LOAN_INTEREST`, repaid
  from the treasury a day before it falls due). Kept: standing +`KEPT_STANDING`; broken (short of the monopoly good
  `MONOPOLY_SHORT_DAYS` running, or a loan unpaid: the richest post is attached): `BROKEN_STANDING`. `richTown`: a rich
  town (`RICH_COINS`, more for each) draws a merchant to settle now and then (`newcomer`, up to `SETTLERS_MOST`).
- **Money buys safety** (`empireTick` from sim.ts right after `maybeStartRaid`, `safety`, `wages`): a raid of people (a kind
  that steals or is bribable, not a host, calamity, saga or hunters) in its warning phase is **bought off** (`payTribute`:
  `TRIBUTE_BASE` + `TRIBUTE_PER_RAIDER` each, x(1 + `TRIBUTE_RISE` per tribute paid; eases one a season), never over
  `TRIBUTE_SHARE` of the purse; the council's pride refuses `TRIBUTE_PRIDE` of the time and fights). **Mercenaries**
  (soldiers and archers as allied raiders, like the grove's guardians) are hired each `MERC_DAYS` for `MERC_FEE` a head and
  `MERC_WAGE` a day, count 2 + tier + posts/2, and the fallen are not replaced; unpaid they leave. A **power's protection**
  (`PROTECT_FEE` x tier, `PROTECT_DAYS`): safer roads and posts, cheaper tribute, goodwill. No raids.ts or factions.ts edits.
- **Seen**: the world map (Trips tab) draws posts (⌂, ⚓ for sea posts, bolder as they grow) with a gold road home and the
  caravans (🐪) and ships (⛵) moving along the leg they are on (`WorldView.posts`, march kinds `caravan`/`ship`, from
  `empireOnMap` in worldLife.ts); the Market menu's **Trade empire** tab (`snapshot.empire`, `empireView`): posts, caravans out,
  deals, safety bought, takings, totals and a ledger; big deals and losses go to the journal (key notices) and the event box.
- **Also**: the year's chronicle gains the empire's lines (`sim/empireYear.ts`, called from annals.ts `writeChronicle`); `tools/soak.ts` takes
  `DIRECTION=trade`, `EMPIRE=1` (per-seed people and the empire's totals; `2` adds its ledger) and `SEEDOFF=n`.
- **Probes**: `tools/sim-hash.mjs` identical to main (the default direction never touches the empire). 40-day soak of settlers, dwarves,
  knights (2 seeds): identical to main without a direction; with Trade, settlers and knights identical (no region mapped or power met
  yet, little coin: the empire sleeps), dwarves 3.5 -> 5.5 people, 8 -> 5.5 deaths (hired swords). Late-town fixture, Trade, 20 days,
  8 seeds: 1-2 posts founded, 2-9 caravans each (200-640 coins made), one caravan lost, deaths 13.3 -> 10.7, people 51.3 -> 46.8.

## A broken deal weighs on the town's alignment

The trade empire's `breach` (`sim/tradeEmpire.ts`, `dealsDaily`) now calls `alignPush(s, -3, 'A broken deal')` and
`orderPush(s, -2, 'A broken deal')` from `sim/alignment.ts`, the hook the alignment work asked for. Only towns under the
Trade direction with a deal to break are touched.

## The odds weighed, mercy or slaughter, skip at the alarm (the owner's ask)

The owner's report: the order that hunts the undead (the Monster Hunters' Guild, `hunters`: four hunters, a day after
a day, against a monster town of twenty) is wiped. Changes the HISTORY.md sections "Raids bite again", "Skip a raid to its recap" and "A recap after
every raid"; builds on "The realm" (war hosts).

**The odds weighed** (`sim/raidOdds.ts`, constants `ODDS_*` in `data/raids.ts`). When a raid's warning is up
(`updateRaid`, warning to active) `weighArrival` compares the attackers' might with the town's in one measure: a fighter
is worth the square root of its health times its damage a second (`raidPower`: the raiders' own `might` counted;
`townPower`: every grown-up on their feet and in town, walls and engines each adding at most `ODDS_WALL_SHARE` (half) of
the fighters' worth, and the town's allies in the raid). Under `ODDS_TURN` (0.5) a band of people (raid kinds, rival
peoples' raids, war hosts, pirates, the Hunter's Guild: anything that isn't wild beasts, the Great Enemy or a saga's
raid) doesn't attack: it holds at the edge (`Raid.parley`, the prompt below) and, answered, turns back (`turnBack`: the
raid ends at once with a recap, "turned back at the sight of your walls"). A band that turns back
gathers until its next coming would be a fair fight (`ODDS_FAIR` 0.7 of the town's might, at most `ODDS_GATHER_CAP` 3
times as big and tough): `raidOdds.extra` holds it in steps of `ODDS_GATHER_STEP`, and `gatherRaid` (called from
`startRaid`) makes the next band of people that much tougher and bigger (`gatherOf`; more raiders by copies, a host only
tougher). The Guild's turned-back hunters also leave `guildTarget` unset (it comes again with the day's next raid).
`raidOdds.streak` counts the turnings-back in a row: after `ODDS_GATHER_MAX` (3) they come whatever the odds; a weighed
band that goes in resets both. A war host that turns back is
reported by `hostOver` as withdrawing (no loss of attitude). Only with the autopilot on.

**Mercy or slaughter.** The same question ("Let them go" / "Hunt them down", a `raid` prompt, `ODDS_ASK_HOURS` to answer)
is put when the band is outmatched at the edge (`Raid.parley`) and when a fight is won: `askMercy`, once the battle on
the trail or board is over, every raider alive is fleeing, at least `MERCY_MIN_RAIDERS` came and one has fallen
(`Raid.mercyAsk`; the fleeing raiders wait, cornered, while it is open: `heldForMercy`). `answerOdds`:
- **Let them go** (`Raid.mercy = 'spared'`): the power they came from warms (`standWith` in factions.ts,
  `MERCY_STANDING`), `raidOdds.spared`++, alignment good (the Guild's anger `s.guild` falls `GUILD_MERCY`, a hunt raises it). At the edge they turn back (above).
- **Hunt them down** (`'hunted'`): their power cools (`SLAUGHTER_STANDING`), alignment evil, and fleeing raiders are run
  down (`huntDown`: `HUNT_CHANCE` a tick, nearest able grown-up credited, `HUNT_XP` melee experience, loot as for any
  fallen raider). At the edge they stay and fight. `oddsOver` (from `endRaid`): a raider got away, or by chance
  `GRUDGE_CHANCE`, leaves a grudge (`raidOdds.grudge`: kind and a day `GRUDGE_DAYS` ahead) and `ripeGrudge` (from
  `maybeStartRaid`) makes the next raid of that kind come, `GRUDGE_BIGGER` (1.5) times the size. A host's survivors leave none.
- **Unanswered:** the prompt's default is chosen by `lean`: the leader's nature (kind, cheerful, jolly, pious, dreamy,
  shy lean to mercy; stern, grumpy, bold, proud, greedy, gloomy to the hunt), what the town has done before
  (`raidOdds.spared/hunted`) and the alignment tally. **Alignment hook:** `alignHook` in raidOdds.ts only keeps
  `raidOdds.align`; replace its body with `alignPush(s, 'good' | 'evil', n)` when sim/alignment.ts lands.
- The recap names it: `RaidRecap.mercy` ('turned', 'spared', 'hunted') and a story line ("You let the survivors go.", "You
  hunted them down.", "One got away, and will remember.").

**Skip the battle at the alarm.** The raid warning prompt (`startRaid`) has one more option, last: "Skip the battle"
(`Raid.skipIt`). `skipRaidsTick` skips a raid with it as soon as it turns active, by the existing skip (the same ticks run
flat out with the town on auto: `raidSkip.ts`), so a skipped raid has the same deaths, experience, loot, injuries and
recap as one watched on auto: tested on the plain field, the trail and the board. The default answer is still "Sound the
alarm".

**State.** `GameState.raidOdds?` (`extra`, `streak`, `turned`, `spared`, `hunted`, `grudge`, `align`) and `Raid.parley`, `weighed`,
`mercyAsk`, `mercy`, `skipIt`, `turned`; all optional, older saves unchanged. Draws nothing from the town's stream: the
side stream `${seed}:odds:${tick}:...` (`sideRng`).

**Tests:** `test/raidOdds.test.ts` (four knights against twenty turn back and come back bigger; a fair band attacks; no
autopilot, no weighing; mercy; slaughter; a broken band run down for experience, one let go not; a grudge brings a bigger
raid; skip equals watch on the field, the trail and the board). `test/tactics.test.ts` boardNow(manual) sets
`raidOdds.extra = 3` so two bandits against four trained fighters still come on to the board.

**Tools:** `tools/soak-raids.mjs [days] [origin...]` (raids met, fought, turned back, deaths; `ODDS=1` logs each raid's
odds at its arrival; origin `fixture` is the mature town).

**Soak (40 days, `tools/soak-raids.mjs`; before then after).** raids met / fought / raid deaths / people at the end:
lich a 61/34/4/25 then 61/29/4/27 (11 turned back, 14 spared); lich b 68/34/5/39 then 66/31/7/34 (6 turned back, 9
spared); knights a 28/28/4/7 then 30/30/2/15 (2 hunted); knights b 10/10/2/7 unchanged; settlers b 30/30/9/8 unchanged;
settlers a 39/38/10/19 then 23/21/15/0 (one band turned back, and the town's later luck shifted: that town died).
The Hunter's Guild's daily four against a lich town were the case that turned back. The mature fixture town (34 people,
20 days) had no outmatched raid: 23 raids, 16 deaths, either way. `tools/sim-hash.mjs`: all five hashes unchanged (the six-day
towns meet no outmatched band; a raid prompt now carries "Skip the battle", which changes a saved town only while a
raid warning is open).

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

**The night** (`night`, hours `NIGHT_FROM`..`NIGHT_TO`, from paced day `DANGER_DAY` 3 and a town of `DANGER_PEOPLE` 6):
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

## Crocodiles stand on the ground (a floating-sprite fix)

The owner's report: every crocodile floated. Its sheet (`art/creatures/crocodiles.png`, whtdragon's MV sheet) has
96-pixel frames, and the side-facing rows hold a thin flat crocodile in the middle of the frame (rows 33 to 47), so
with the frame's bottom edge treated as its feet it hung half a frame above the ground. Changes the HISTORY.md sections
"Watching a party's fights" and "The bestiary".

- `art/creatureSheets.ts`: the `crocodiles` sheet now says where its art is, `top: 0.34` (for the health bar) and
  `feet: 0.5` (its belly).
- The fight screen (`fight/fightView.ts`), the expedition pane (`town/expeditionPane.ts`) and cutscenes
  (`cutscene/cutsceneView.ts`) placed every creature's frame with its bottom edge on the ground, ignoring the sheet's
  `feet` line that the raid map (`map/mapRaiders.ts`) already honoured. They now use `creatureFeet(sheet)` too, so the
  other sheets with a feet line (the tomes, the mimic, the goblin, the slime, the demons and blood monsters) also stand
  where they should in those views. Renderer only: the sim hashes are unchanged.

# Fixes 5 (branch claude/fixes-5)

Eight owner-approved fixes and small rules. Sim hashes (`node tools/sim-hash.mjs`): only item 4 changes them (see there);
everything else leaves them as on main. New state is optional, new randomness is on side streams.

## 1. An outmatched band may demand a toll or probe a weak spot (changes HISTORY "The odds weighed")

Besides turning back, a band of people that holds at the edge outmatched (`weighArrival`, sim/raidOdds.ts) now rolls
`outmatchedPlan` on the side stream `odds:<tick>:plan`: `'turn'` (as before: the mercy question, the next band bigger),
`'toll'` or `'probe'`. The chances (data/raids.ts `ODDS_TOLL_CHANCE` 0.3, `ODDS_PROBE_CHANCE` 0.25) are scaled by the
kind: a bribable kind asks a toll twice as often, one that steals or burns probes twice as often, a lord's army (a kind with
a `leader`) tolls more and probes less. Never a war host (an army) or the Guild's hunters.

- **Toll** (`askToll`, `payToll`): `tollFor` asks `TOLL_COINS_SHARE` (12%, at least `TOLL_MIN_COINS` 10) of a purse of at
  least twice that, else `TOLL_FOOD_SHARE` (15%) of the food held; a town with neither just gets the usual turn-back. A raid
  prompt with `['Pay the toll', 'Refuse the toll']` (`Raid.toll` holds the demand, `Raid.parley` the prompt). The default
  answer, if nobody picks, follows the leader's nature through `lean` (the mercy question's) and the treasury: pay if the
  leader leans gentle and the purse holds `TOLL_AFFORD` (3) times the toll, else refuse. Paid: they go, the raid ends
  with recap `mercy: 'toll'` ("demanded a toll of N coins to leave the town alone. You paid it, and they went."), and the
  gathering resets (`extra`, `streak` to 0, `raidOdds.tolls` counts). Refused (or not payable by then): they turn back as
  before, and the next comes bigger.
- **Probe** (`turnBack(s, r, 'probe')`, `planProbe`, `oddsHourly`): they turn back (the usual gathering, recap
  `mercy: 'probe'`, story "A few hung back in the dark, looking for a weak spot."), and `raidOdds.probe`
  (`{ kind, at, goal, n }`) waits for 2 in the morning (`PROBE_HOUR`). `oddsHourly` (called from sim.ts beside
  `boatsHourly`, autopilot only, not during a raid) resolves it: the watch catches it at `PROBE_CATCH` 0.3 plus 0.1 a guard and
  0.1 a watchtower (15% to 85%): "caught, driven off with nothing" (`raidOdds.caught`); otherwise a `burn` goal sets one
  flammable building alight (`fire.ts setFire`), else it steals `PROBE_TAKE` (6) a head (2 to 3 heads, `PROBE_PARTY`) of the
  most valuable good in the stores (`LOOT_VALUE`). Told in the news.
- Types: `RaidRecap.mercy` gains `'toll' | 'probe'`, `Raid.toll`, `GameState.raidOdds` gains `tolls`, `probes`, `caught`,
  `probe`. Tests: test/raidOdds.test.ts (toll paid and refused, the default, the probe and the catch).

## 2. Hunted war hosts leave a grudge (changes HISTORY "The odds weighed")

A host's band that the town hunted down (`r.mercy === 'hunted'`) and that lost someone to flight (or on the side-stream
chance `GRUDGE_CHANCE`) now leaves `Faction.grudge` on its power (`oddsOver`, sim/raidOdds.ts), with the recap line "the next
host will come bigger". The next `musterHost` (sim/factions.ts) takes it: the host is `HOST_GRUDGE_BIGGER` (1.35) times bigger,
up to that times `HOST_MOST`, the muster notice says "come to settle a grudge", and the flag is spent. Other bands keep
the town's own `raidOdds.grudge`. Test: test/raidOdds.test.ts.

## 3. Trade direction drives scouting (changes HISTORY "Scouting" / "Trade empire")

Under `s.direction === 'trade'`, for a region still to scout (a `scout` destination not in `s.scouted`), the parties
(sim/parties.ts, data/parties.ts): `tradeScout` adds `PULL_TRADE_SCOUT` (5) to the place's pull, `partyGapHours` is
`TRADE_SCOUT_GAP_HOURS` (5) not `PARTY_GAP_HOURS` (8) while one is choosable (sooner), and `dares` takes an `ease` of
`TRADE_SCOUT_DARE` (0.85) for that trip's danger bar (further afield). Nothing under any other direction. Test:
test/parties.test.ts.

## 4. Alignment drifts toward neutral (changes HISTORY "A town's alignment")

The slow hourly drift (`alignmentHourly`, sim/alignment.ts) pulls the bar toward 0, at the same rate
(`DRIFT_PER_HOUR`), not toward the people's `homeOf` (which stays the starting point, the mood's reference and what the
Our ways card shows). The bar for a knights town (home 40) now sinks back; a vampire town's (-45) rises. The order axis still
drifts toward its own home. **This is the only change that moves the sim hashes**: fixture, knights, vampire and dwarves
change (their homes aren't 0); settlers (home 0) is identical. Checked by reverting just this line: all hashes then match main.
Test: test/alignment.test.ts.

## 5. The Drowned King's anger and the pirates (changes HISTORY "Seafaring")

`kingAnger(s)` (sim/seafaring.ts, constants in data/seafaring.ts): 0 unless the Great Enemy is the Drowned King and still
standing; else his plan's share of the siege (`PLAN_AT.siege`) plus `KING_REFUSED` 0.12 for each tribute refused less 0.12 for each paid,
less `KING_EASED` 0.3 for `KING_EASE_DAYS` (8) after a tribute paid, clamped to 0..1. In `pirates`, the gap to the next crew is cut
by up to `KING_GAP_CUT` (40%) and the crew is swollen by up to `KING_BUDGET_MORE` (+50%): tougher and more of them, past the
usual raid size cap (`swellCrew`, as `gatherRaid` does), with no number drawn (the town's stream is untouched; anger 0 is
byte-for-byte as before). Test: test/seafaring.test.ts.

## 6. Merfolk on the raid board show tails in water (changes HISTORY "The merfolk rework", "Merfolk tails")

Renderer only. The top-down board (tactics/tacticsView.ts) passed `swimming: false` for every townsperson. A merfolk
(`PersonView.mer`) standing on a `water` or `shallows` tile now draws as `swimming` (cut at the waist, the map's tail
trailing behind); on land, legs and fins as before. The map's own raid battle (map/mapBattle.ts) draws its people with
`MapPeople`, which already reads `swimming` from the snapshot (`wetAt`), so nothing changed there. Not previewed on a live
water board (none was to hand); typecheck and the build pass.

## 7. Guild badges in the fight HUD and the Chronicle (changes HISTORY "Guild icons")

Renderer only: the HUD had the ids (a fighter's `ref`, an expedition member's `id`) all along, and the snapshot already has
`guilds`, so no sim or snapshot change was needed. `FightHud.update(v, speed, guilds)` (fight/fightHud.ts) shows the first
guild's badge (`guildMark`) beside the name on the party's rows, the trip's member list and the victory screen's rows.
The Chronicle's Heroes tab (`renderHeroes(a, guildMark)`) shows it by "The famous" (the living; panel.ts passes it and
adds the famous' guilds to the journal's redraw key). **Not done:** the fallen. People leave their guild when they die, and
nothing records the guild on the `Fallen` entry; a badge there needs a `guild` field written at death (a sim change, so the
hashes would move). Also not done: the raid battle bar's chips and the raid recap's rows. Not previewed with a guild in a
fight; typecheck and build pass.

## 8. House doors a person fits through (changes HISTORY "Walls and doors stand taller than the townsfolk")

Renderer only (map/packBuildings.ts `HOME_DOORS`, `homeDoorTexture`, in `packDressing`). The homes' pack pictures
(cottage, row houses, lean-to, hide tent, longhouse, apartments) have no door, or one 0.25 to 0.6 of a person tall. Each
home in the timber look now has a door hung over its front (a share of the width: the middle, or two for the row houses
and apartments), `HOME_DOOR_H` 44 px against a person's 48: cut from the dungeon pack's wooden door (`art/delve/doors.png`, already
in the repo and credited), its arch kept and the planks drawn down to the sill, in a dark frame. Previewed at 393x852 and
852x393 on a 30-day town (longhouse and lean-tos); the cottage and row house were not in it, the same code places them.
Workshops, shops, taverns and the nomad looks are as before.

## The night watch (the owner's ask: "to combat the parties coming in at night, I'd like to have guards patrol or post up at gates at night")

Changes HISTORY "Night prowlers" (a prowl met at the wall is smaller), "The odds weighed" / the probe (a watchman at the way in
may meet it), "Visiting bands" (disguised bandits seen through), "Town jobs" / guards (the roster beside the hired guards) and
"Lights at the gates first" (the gate lamp helps the watch). The hired guards already kept shifts, walked the wall with torches
and stood sentry on the gates (`onShift`, `wallWalk`, `gatePost` in sim/people.ts); this sets who is on the watch by the
danger and makes the watch bite.

**The roster** (`src/shared/sim/nightWatch.ts`, `nightWatchHourly` hourly from sim.ts beside `oddsHourly`, autopilot only).
At noon (`nightIndex` turns over then) the town sets the watch for the coming night, in `s.watch` (`{ night, ids, alert?,
spotted?, caught?, missed? }`, all optional). The hired guards on the night shift (odd ids) keep it as before; besides them
`watchWanted` posts townsfolk, so a town with no guard hired is covered too: `max(1, hired night guards) + danger(s)`,
at most a third of the grown-ups, less the hired. `danger` is one for each of a prowl lately (`s.lastProwl`), a probe waiting or
sneaks met lately (`watch.alert`), a raid lately, a ring wall not yet standing all round, and two on the Defence direction
(`WATCH_DANGER_DAYS` 4). Never under `WATCH_LEAST_PEOPLE` (4) grown-ups, in a castle/hold/horde town (`ringTown`), or the
founder. Candidates are grown-ups at home on their feet, not running a station, defend not off, the better fighters first, and
they keep the watch `WATCH_STINT` (3) nights running, then the next in turn.

**On the beat.** `onShift` is true for a roster member in the watch hours (`WATCH_FROM` 19 to `WATCH_UNTIL` 6: `onNightWatch`);
`chooseTask` gives them (and a hired guard on the night shift) a `patrol` task before their own work (`patrolTask`, the old defend-job branch pulled out): after a
band near the town, else up on a gate (`gatePost`), else with no wall standing half of the watch holds the camp's edge, one
on each side (`edgePost`, a patrol task with `hold: true` so they stand there), else the wall walk or the long way round. They
are seen with a torch at night as every guard on shift is (`onWatch`, lightMap). Roster members sleep by day, 8 to 16
(townsfolk.ts `nightWatch`; the hired guards had it already, once the ring stands: `gateSentry.test.ts` holds that, so before a wall the roster, not the hired guards, keeps the night; `wantsToWake` also gets the watch up for its hours once rested to `WATCH_WAKE_REST` 0.3), so they are up for it and are off day work meanwhile. The tap card
says "On the night watch" (or ", at a gate") by night, "On patrol" otherwise (snapshot.ts).

**The watch bites.** `spotAt(s, at, rng)`: the watchmen on patrol within `WATCH_SPOT_RANGE` (10) cells of the way in each have
`WATCH_SPOT_BASE` 0.3 + 0.008 a fighting level (+0.15 for a sentry up on a gate), at most 0.7 each, combined, times the moon
(`moonLight`: `WATCH_DARK` 0.7 on the new moon, `WATCH_BRIGHT` 1.15 on the full), times `WATCH_LAMP` 1.25 with a lit lamp
within 5 cells (the gate lamps), at most `WATCH_SPOT_MOST` 0.95. A long wall with two guards has blind stretches: out of sight
nothing is seen.
- A **prowl** (sim/prowlers.ts): spotted, the raid is begun at the gap as before but with `WATCH_CAUGHT_SHARE` (0.5) of the
  budget (`caughtBudget`): the watch meets them at the wall, the alarm is raised, the news names the watchman. Not spotted,
  as before.
- A **probe** (sim/raidOdds.ts `oddsHourly`): first `watchMeetsProbe` picks the way in (a gate, else a gap, else the town's
  edge, on the watch stream) and rolls `spotAt`; spotted, the few sneaks (`probe.n`, the kind's cheapest foe each) are a small
  inside raid at the gate and the probe is over. Otherwise the old proxy (`PROBE_CATCH*`, guards and towers) and the
  steal/burn go on.
- **Disguised bandits** (sim/bands.ts `seenThrough`): the watch is the guards and the roster; the raid begun where they stand is
  marked as the watch's (`watchSawBandits`).
The raid carries `Raid.watched` ("at the east gate") and `Raid.watchers`; the recap gains `RaidRecap.watched` and a line
("The night watch spotted them ..."). When the raid is won (`raidRecap` calls `watchWon`): the news "The night watch caught the
night thieves at the east gate", `s.watch.caught`, `yearRaids.watched` (the chronicle says "The night watch caught sneaks N
times"), and each watchman who was in the fight earns the deed `watched` (titles the Watchful, Nightwarden, Warden of the
Dark: data/deeds.ts) and `WATCH_XP` (5) in their fighting skill. A raid got away from with loot is not counted. Watchmen are hurt
or killed in the fight as any defender is.

**Shown.** The Plan tab's Guards section gains a line (`watchLine`: how many are on the night watch, more while the nights
are dangerous, how often it has caught sneaks; `s.guards.watch`, in the panel's key).

**Rules kept.** Own side stream `new Rng(hashSeed(`${s.seed}:watch:${s.tick}:<tag>`))` (`watchRng`); nothing drawn from the
town's stream except by `startRaid` when a watched raid starts. Autopilot only. New fields optional (`GameState.watch`,
`Raid.watched/watchers`, `RaidRecap.watched`, `yearRaids.watched`, task `hold`). Tests: `test/nightWatch.test.ts`.

## Religion and the gods made real (the DLC)

Changes "Gods and faith" (sim/faith.ts and data/gods.ts are unchanged; this sits on top of them). Also touches "Town politics
and law" (a heresy trial), "Step 7, life's ceremonies" (the priest at funerals) and "Town alignment" (cruel and merciful rites).

- **The data** (`src/shared/data/religion.ts`): the `Creed` (a `Domain`, `'none'` or `'cult'`), the natures that keep faith
  hard (`ZEALOUS`), drift from it (`DOUBTING`) and turn heretic (`HERETICAL`), `ZEAL_START` per nature and `NONE_SHARE`;
  the numbers for followers, priests, feast days (`FEAST_DAYS` 3, 5, 7, 9 of each season, in `DOMAINS` order), each god's
  nature (`NATURE_ACTS`), omens (`OMEN_AT` -25, `OMENS`), the greater wraths (`GREAT_WRATH_AT` -60, `GREAT_WRATH_CHANCE` 0.3,
  `CURSED_ROTS`, `PLAGUE_SHARE`, `STORM_STRIKES`, `STORM_KILLS`), miracles (`MIRACLE_AT` 60, `MIRACLE_GAP_DAYS` 10,
  `SPARE_CHANCE`, `STORM_CHANCE`, `FAMINE_AT`, `UNSPARED`), the rival cult (`CULT_PEOPLE` 7, `CULT_CHANCE`, `CULT_RECRUIT`,
  `DENOUNCE_CHANCE`, `CULT_NAMES`, `ORIGIN_CULT`), the pilgrimage (`PILGRIM_EVERY_DAYS` 18, `HOLY_PLACES` per people,
  `PILGRIM_RELIC`), the diary lines (`FAITH_LINES`) and two buildings never in the building book (`RELIGION_BUILDINGS`:
  `god_idol`, `cult_altar`), merged into `BUILDINGS`.
- **The sim** (`src/shared/sim/religion.ts`, `religionHourly` and `religionTick` from sim.ts right after `faithHourly`;
  autopilot only; rolls from the side stream `${seed}:religion:${tick}:<what>`, never the town's; `s.religion`,
  `ReligionState`; `Person.creed` and `Person.zeal`, all optional):
  - **Creeds** (`creedOf`, kept from the first dawn; `pickCreed` is pure, by the seed and id: the god of what they're best
    at, or by chance, or none; a child takes a parent's; `seenCreed` for the menus, which never sets it). Each dawn zeal
    drifts `ZEAL_DRIFT` toward the nature's, a rite day lifts it `ZEAL_RITE`; the doubting low in zeal lapse
    (`LAPSE_CHANCE`), the godless may find the best pleased god (`CONVERT_CHANCE`). `isZealot`: zeal 80+ and a zealous nature.
  - **Favour at dawn** (`dawn`): every god asks `DEMAND_PER_HEAD` (0.6) a head a day, at most `DEMAND_MOST` (16), so a
    big town's neglected gods sour; followers add `FOLLOWER_FAVOUR` x zeal/50 each, a god nobody at home follows loses
    `UNFOLLOWED` (5) (the demand and that start only once there's a place of worship: before it, faith.ts's own `NEGLECT`
    is enough for a camp), idols add `IDOL_FAVOUR`, cultists cost every god `CULT_FAVOUR`, and `actsInNature`: the harvest god likes
    `harvestFullDays` of food and hates every starving mouth, the hearth god a happy town (and a glum one), the war god a raid
    driven off or pillaged (each `raidRecap` once), the sky god every party out. The rope angers the hearth god at once
    (`hearthHanging`, in `deathSeen`).
  - **The priests**: whoever holds a wayside shrine, temple or cathedral (new `OPERATORS` rows: Priest, High Priest,
    Social). At dawn (`FAITH_HOUR` for `PRIEST_HOURS`) the priest takes the new task `officiate` (people.ts, `priestDuty`,
    `altarSpot`; activity `pray`), and the least pleased god gets `PRIEST_RITE` + `PRIEST_PER_LEVEL` a Social level
    (`priestRite`). A god's feast day kept with a priest (`feastDay`): `FEAST_KEPT`, food from its offerings laid out, a
    morale mark; the war god's feast in a blood town (`BLOOD_RITES`: vampires, orcs, liches) is a blood offering
    (`alignPush` -2, `orderPush` +1), the hearth god's gives alms to the poor (`alignPush` +1). Without a priest it passes
    unkept (`FEAST_MISSED`; never in a camp with no altar). The priest says the words at a funeral (`funeralRites`: grief x `FUNERAL_RITES_EASE`), blesses
    the defenders when raiders are sighted (`blessRaid`: a `fight` mark `RAID_BLESSING`, more with the war god pleased, to the
    raid's end) and every party setting out (`blessTrips`: a lift `ROAD_BLESSING`).
  - **Omens and the greater wraths**: a god at `OMEN_AT` sends an omen ("An omen: ...", every `OMEN_GAP_DAYS`); only after
    one, at `GREAT_WRATH_AT`, its greater wrath (`greatWrath`; neither in a camp under `GREAT_WRATH_PEOPLE` (5), and the
    harvest god's never on a town already starving): the harvest god curses the harvest (`CURSED_ROTS` of the food in
    store above `CURSE_SPARES_DAYS` of it, crops x0.5 three days), the hearth god sends a plague (`PLAGUE_SHARE` sicken, the frailest dies), the war
    god sends wolves (a raid, `raidBudget`), the sky god a great storm (`STORM_STRIKES` bolts: roofs fired, people burned or
    killed). It spends `GREAT_WRATH_SPENDS`; the god's followers lose `ZEAL_WRATH` and `SCHISM_SHARE` of them turn to the
    best pleased god (a schism).
  - **Miracles** (`miracle`; one in `MIRACLE_GAP_DAYS`): a hearth god at `MIRACLE_AT` may spare someone dying in town
    (`deathSeen`, hooked in `killPerson` after the phoenix feather; never old age, the rope, exile or a sacrifice:
    `UNSPARED`); a sky god may scatter a raid on its way with a storm (`STORM_SCATTERS` of the raiders gone, the rest hurt;
    a line added to the raid's recap story via `recapNote`); a harvest god at `FAMINE_AT` may fill a starving town's granary
    (`famineBroken`, `FAMINE_DAYS` of grain). Each is a key notice (the news bubble), a sign, converts the godless
    (`MIRACLE_CONVERTS`), and raises an idol (`raiseIdol`, at most `IDOLS_MOST`). The year's chronicle names them
    (`religionYearLines` in annals.ts).
  - **The rival cult** (`cultDawn`): with `CULT_PEOPLE` grown-ups, `CULT_CHANCE` a day (more as gods sour), a heretical
    soul low in zeal and spirits founds the cult of a name (`ORIGIN_CULT` or `CULT_NAMES`); its black altar is set up
    (`cult_altar`); the town is asked (a `ways` prompt, system `religion`, answered by `answerReligion` through heritage.ts):
    root it out (a heresy trial for its leader, `orderPush` +2), let it be (`tolerated`), or hear it out (every god -8, some
    join, `alignPush` -1, `orderPush` -3). It recruits the low (`CULT_RECRUIT`); zealots denounce its members
    (`DENOUNCE_CHANCE`, a heresy trial); every `CULT_RITE_DAYS` at 23:00 its dark rite (`cultNight`: every god -3,
    `alignPush` -3, `orderPush` -2), with three or more a chance of a sacrifice (a townsperson killed, then their leader
    tried for murder). With no members left it ends and its altar comes down.
  - **The heresy trial** (sim/politics.ts `trial`, data/politics.ts `CrimeKind` gains `'heresy'`, never rolled as a crime):
    pardon, the stocks, exile or the rope; its own telling.
  - **Pilgrimage** (`pilgrimage`, at 09:00): once a temple or cathedral stands and the town has `PILGRIM_PEOPLE`, every
    `PILGRIM_EVERY_DAYS` the priest leads the most zealous (`PILGRIM_PARTY`) to the people's holy place (`pilgrimDestination`,
    id `pilgrim:<origin>`, a gather trip with bandits on the road; expeditions.ts `destinationOf`). Home (`pilgrimHome`,
    from expeditions.ts): every god `PILGRIM_FAVOUR`, the pilgrims' zeal and spirits up, `PILGRIM_RELIC` a Phoenix Feather.
- **Words**: the diary has a line on their faith (`faithDiaryLine`, `DiaryFacts.faith`); the town's talk reads miracles,
  heresy trials, the cult, converts, the wraths and the pilgrims (new `GossipKind`s and their sayings and replies).
- **Seen**: `snapshot.religion` (`ReligionView`) and `PersonView.creed` ("Follows Ceres (a zealot)", on the person's page).
  The Town menu's Faith tab (`panel/faithPanel.ts`): each god's card has its followers and feast day (tap: more); new
  sections **The faithful** (the priests, the godless and zealots, the cult, the pilgrims, the latest of the faith's news)
  and **Miracles** (both in `GROUPS`). `faithKey` joins the Town panel's redraw key (the Faith tab never redrew before).
- **Art**: the idol is the Forest Objects pack's idol tree (`art/packs/tree_idol.png`), also the druids' and the fae's
  wayside shrine; the cult's altar the Cave Objects pack's horned totem (`art/packs/cult_totem.png`). CREDITS.md.
- Tests: `test/religion.test.ts`.

## Balance pass 3 (claude/balance-3)

Six items, measured first. Tools written for it (all under `tools/`, each with a `.mjs` wrapper like `soak.mjs`):
`raid-bite` (per raid: how it ended on the board, townsfolk lost, stores taken, fires; `BITE_LOG=1` lists each raid),
`arc` (the Great Enemy + Calamity arc on a strong town: the fixture with its folk at level 40 and armed, the Enemy forced
into its omens and its plan run faster by `PLAN_BOOST` a day; `ARC_SAVE=<file>` writes the town as the Enemy marches),
`siege` (that saved town with the last siege forced, logged every half hour), `trade-births` (couples split by the trade
roads), and `PERSEED=1` on `soak` (each seed's people, not just the mean). All numbers are 40-day soaks on 6 seeds unless
said.

### 1. Raids bite (changes "Tactics battles", "Raids bite again", "Tower-defence raids")

What the numbers showed (3 seeds, 40 days): about 0.06 to 0.10 townsfolk lost per raid on a new town, 0.35 on the fixture;
the big raids ended on the clock far short of a result ("rival lich x33": 6 killed, the rest left at the three-hour mark).
**The cause is the clock, not the sheltering.** Board turns come one at a time, about 11 ticks each, so a board of 100 units
gives each unit one turn every two game hours: raiders spent the first seven hours walking in. A forced siege on a strong
63-person town (57 raiders, the Pale Prophet at 6816 hp): nothing fell for eleven hours, the 12-hour clock ended it with
the Enemy at full health, and the town "lost" a siege it was winning. (Scaling every raid's clock by its board size was
tried: raids then ran 13 to 17 hours, there were half as many of them in 40 days, and deaths per raid did not move, so it
was dropped for the siege rule below.) Three rules (`sim/tactics.ts`, `sim/raids.ts`):

- **A raid that is winning presses on.** At the clock, `raidersWinning` (the raiders' health left, waiting ones too, at
  `PRESS_RATIO` (2) times the town's standing fighters' or more, and the town has `PRESS_FIGHTERS` (6)) adds an hour, at
  most `PRESS_MAX` (2) times (`Tactics.pressed`). One that is losing routs on the clock as before. Towns of fewer than six
  fighters keep the old mercy: with no such gate, a founding town's first weeks (a few folk and a bear that wins) took
  settlers from 9.8 to 4.7 people and vampires from 4.0 to 2.5.
- **The Enemy's last siege is fought out.** While the field is held, a `Raid.enemy === 'siege'` has no clock (up to
  `SIEGE_MAX_HOURS` 72 from its arrival), or its leader, who comes on last, is never struck at. The same forced siege now
  ends at +44 hours with the Enemy dead and 62 of 63 alive (`tools/siege.mjs`).
- **Some of the sheltering are always caught out** (`caughtOut`, `CAUGHT_OUT` 0.1): a fixed share of the grown, not
  fighting folk (by a hash of seed, raid and person: no stream drawn) never get under a roof while the raid is in town
  (`people.ts` shelter task leaves them `idle`, so `exposed` finds them). Raiders in town already took stores, burnt
  buildings and downed fighters; they now have more to reach.

Measured (final rules; `raid-bite`, 3 seeds): townsfolk lost a raid, settlers 0.10 -> 0.07, knights 0.06 -> 0.14, orcs 0.09 ->
0.08 (no change that a few seeds can show: small towns are left alone on purpose); the fixture (2 seeds) 0.35 -> 0.49, 57 -> 68
raids, 58 -> 66 people. The 40-day soaks (6 seeds, mean people at day 40 / deaths), main -> now: settlers 9.8/6.5 -> 8.8/8.2,
knights 15.0/5.0 -> 9.5/6.2, orcs 12.8/6.8 -> 11.8/6.7, vampires 4.0/5.3 -> 5.7/5.8, merfolk 9.5/4.2 -> 8.8/9.2. (A later run
with every raid's clock scaled to its board: settlers 7.5, orcs 9.7, knights 10.2, vampires 5.2.)

**Knobs for the owner:** `PRESS_RATIO`, `PRESS_MAX`, `PRESS_FIGHTERS`, `CAUGHT_OUT`. The first, harsher try (ratio 1, 5
presses, 20% caught out, no size gate) put settlers at 0.23 deaths a raid and 2.7 people.

### 2. Orc and knight soaks: chance across seeds, not a rule (no change)

Bisected by switching systems off (6 seeds): orcs on main 12.8 people (per seed spread 1 to 23, standard error about 2.7),
with the wild (herds, predators, nests) off 9.3; knights on main 15.0, with dynasties, intrigue and ancestors off 12.3.
Neither goes up when the system is off, and a single people's seeds range from 1 to 18: the 14 -> 7 and 10 -> 7 were the
spread of 3 seeds. Nothing softened.

### 3. Staff away at trading posts (changes "Trade empire")

Measured with `trade-births` on the fixture under Trade: about 21% of married-couple time was a couple split by the road
(one partner away on the trade roads). `families` (`sim/social.ts`) only looks at pairs who are both in town, so each split
couple had no children; and `launch` always took the two lowest ids, repeatedly. Fixed in `sim/tradeEmpire.ts`: `sparest`
chooses post staff and caravan drivers from those with no partner at home first, then a whole couple together, a half couple
only to make up the number. (Hauling: an away adult is one fewer carrier, held to `HOME_FOLK_LEAST` 7 at home: by design.)
Under the final rule the split share fell to 14.2% (one seed, 25 days). The "4.5 fewer people" itself is within the noise of 3 seeds (fixture on Trade, base 60.0, empire fix alone 54.0, per seed
72/62/46 against 47/65/50). Tests in `test/tradeEmpire.test.ts`.

### 4. Alignment drift for the dark peoples (changes "Town alignment" and the "Alignment drifts toward neutral" note)

Vampires with the drift toward 0: 4.0 people; with it toward their home point (-45): 6.3 (same 6 seeds). Real, if modest.
`driftTargetOf` (`data/alignment.ts`): a people whose home point is `DARK_HOME` (-15) or darker (vampires, liches, orcs)
drifts back toward its own home; every other people toward neutral as before (knights, druids, settlers...). The rate
(`DRIFT_PER_HOUR`) is unchanged and slow. Test updated in `test/alignment.test.ts` (a vampire town at home stays there, and
drifts back to it from a kinder bar).

### 5. The merfolk soak (changes "The merfolk rework")

Per seed, people at day 40: 16, 2, 14, 7, 2, 16. Not drownings (1 death of 25), not pirates (1): the Tide Clan began with
**two** founders (the other peoples with one companion have a third from wanderers; merfolk travellers come by ship), and
the first death (a saga's lost boy, a tornado, a cave bear) left a town of two that never grew: buildings jumped to 100+ by
day 10 in the seeds that kept three, and stayed at 20 in the others. `origins.ts`: the Tide Clan now starts with a gatherer
and a hunter. Test in `test/origins.test.ts`. The lowest town of the six at day 40 was 2 or 1 people on main (low 1.7 on
average); with three founders it is low 2.7, and every seed ends at 2 or more, but the spread is still wide (6, 2, 13, 6, 18, 8
against 16, 2, 14, 7, 2, 16: standard deviation 5.6 against 6.4), and deaths a town doubled (4.2 -> 9.2: more folk to lose, and
the raid rules above). The seed that stays at 2 loses its founders to a cave bear in the first fortnight. Not steady yet: the
early game of a tiny town is the noise, and a wanderer's arrival needs the player's leave (the owner's rule).

### 6. The Enemy + Calamity arc on a strong town

`arc`: the fixture levelled and armed (37 folk, growing to 90), the plan run at +0.8 a day. The stages fire in order:
Enemy omens, Calamity stage 1, Enemy stirring, Calamity 2, Calamity 3, Enemy march with Calamity 4, hosts every 6 days,
siege with Calamity 5 (dread 100). Found and fixed: the siege clock above (a 90-person town lost both sieges and the game:
the first lost 22 people to the sack, the second ended it); "The last siege comes in 0 hours" (a forced siege's
`siegeIn`) now reads "at the gate now" (`notices.ts`, `expeditionsPanel.ts`).

### Hashes (`tools/sim-hash.mjs`, 6 days)

Main: fixture `1e25ceb1a860`, settlers `5f599c1ea736`, knights `ec655be1e4fb`, vampire `e4c201102006`, dwarves `f1e18b031a22`.
Now: fixture `28a5ceb44ec7`, vampire `a650f5c6bf2e`; settlers, knights and dwarves unchanged. The fixture changes because its
catch-up week has tactics raids (the pressing and caught-out rules; reverting `raids.ts`, `tactics.ts` and `people.ts` returns
the old hash, and `tradeEmpire.ts` and `sim.ts` alone do not move it); the vampire's changes with its alignment drift.

## Battle items in the townsfolk's pouches (the owner's ask: "carry battle items in their own inventory too and use them in battle: potions, or special items to help with the fight")

Each grown-up with a calling carries a small **pouch** (`Person.kit?: string[]`, item ids), and uses what is in it as an
action in any fight. New files: `data/kitItems.ts` (the items), `sim/kit.ts` (hand-out, planner demand, raider potions),
`sim/kitFight.ts` (the choice in a fight), `test/kit.test.ts`.

- **The items** (`KIT_ITEMS`, merged into `ITEMS` as `KIT_RECIPES`, slot null, crafted like any stock item): Healing Potion
  (40% of health) and Greater Healing Potion (75%) at the apothecary (`physick`, the greater also `glassblowing`); Mana
  Draught (60% of the mana pool; `physick` + `arcane_arts`) and Antidote (clears poison, burn and bleed) at the apothecary;
  Smoke Bomb (`invisible` 8 s) and Oil Flask (fire blow + burn) at the kiln; Throwing Knife and Whetstone (`berserk` 30 s)
  at the smithy (`iron_working`); Ward Charm (`protect` 45 s) at the bone carver's; Combat Stim (haste 25 s and 30% health)
  at the pharmacy (`trauma_surgery`). `use` is `heal | mana | cure | escape | throw | buff`; `KIT_FX` is what the fight views
  draw for each. Icons are cells of DawnLike's Potion sheet (and its ShortWep, Rock and Amulet sheets): already credited.
- **Room:** `kitCap(p)` = `KIT_BASE` (2) + one per 15 levels + one for a pack on the back, at most `KIT_MOST` (6).
- **Hand-out** (`restockKits`, hourly in `sim.ts` after `hourlyItems`, autopilot only): the stores' battle items go into the
  pouches of those with a calling, defenders first, then the main character, then by melee/ranged skill (casters a point
  up), one item a person a round for three rounds, each person's `WISHES` in order (casters: `CASTER_WISHES`, draughts
  first). No manual controls.
- **Orders** (`planCrafting` step 4a in `planner.ts`): one order at a time while the town has two days' food, of the most
  wanted kit item the town has the station, research and makings for (`kitNeed`: 0 once the stores and pouches hold one
  more than the people who'd carry it; heal 10, mana 8, cure 6, escape 5, buff 4, throw 3); otherwise it gathers for it.
- **In a fight** (`useKitItem` from `takeTurn` in `actions.ts`, so the expedition/skirmish/delve fight, the raid map and the
  tactics board all use it): `Combatant.bag` is the pouch (the party fight's `Fighter.bag` is a copy that `keepBag` writes
  back in `expeditions.ts` and `roamers.ts`; the raid map's and the board's stand-ins hold the person's own array).
  `pickKitItem`: a potion under `HEAL_BELOW` (0.5) of health (the smallest that mends 60% of what is missing, else the
  strongest); an antidote while poisoned, burning or bleeding; a draught when the caster has less mana than their cheapest
  spell or under `DRY_SHARE` (0.3); smoke under `ESCAPE_BELOW` (0.3) with foes about; a charm, whetstone or stim at the
  start (a status they don't have yet); a thrown knife or flask `THROW_CHANCE` (0.5) of turns, and only one that hits at
  least `THROW_BEATS` (1.2) times as hard as their own blow. **A drink or a buff is a quick action** (`useKitItem` returns
  `'quick'`: they still act that turn); a throw takes the turn (`'turn'`). **No drink or smoke when one blow of theirs would
  end the fight** (one foe left at or under their average hit). The item is taken from the pouch, applied through the same
  engine as a skill (`useItemAction`, `ActMeta.item`), and logged by name so the views show it like a spell (`actLooks.ts`,
  `fightView.ts` and `actFx.ts` look the name up in `KIT_BY_ID`/`KIT_FX`).
- **Side stream:** the only draw is `new Rng(hashSeed(`kit:${tick}:${who}:${bagSize}`))` (the arena has no town seed), and
  the town's stream is never touched; the fight's own stream is drawn from only when an item is used.
- **Raider loot:** `raiderPotions` (at the end of a raid, `raids.ts`): each fallen raider of the people kinds
  (`natureOf` = person) has `RAIDER_POTION` (0.12) of leaving a potion (a fifth of them Greater), into the stores.
- **The card** lists the pouch: `PersonView.pouch`/`pouchCap`, a line in the top block of the person's card in the Townsfolk tab (in its key).
- Not done (design calls): buying them in the shop with a person's own coins; raiders drinking their potions in the fight.

**Later tuning (the same branch).** A drink or a start-of-fight buff is a quick action: the fighter still strikes that
turn (`useKitItem` returns `'quick'`); only a thrown item takes the turn. A throw is used only when it would hit for at
least `THROW_BEATS` (1.2) of the thrower's own blow (`THROW_CHANCE` 0.5). Nobody drinks or throws smoke when one blow of
theirs would end the fight. The Pouch line moved into the top block of the person card so it shows at 393x852. The
first soaks' extra deaths were seed noise against a moving main: re-run on one base, settlers over 8 seeds ended with
more people and fewer deaths than main. Not done, by choice: buying kit in the shop with one's own coins, and raiders
drinking their potions (they only drop them).

## Magic as a system of the town

Magic was only a set of combat actions (data/spells.ts). Now it's a system of the town too: the land has leylines, the
town gathers mana from them, studies seven schools, its casters learn spells by study and practice, and it works rites
that help it in and out of fights. Magic also bites: miscasts, madness, wild-magic surges, tears into other worlds and
cursed things. Only with the autopilot on, and only once the town has learned **Leyline Lore**. Its rolls are its own
side stream (`${seed}:magic:${tick}`), never the town's.

- **The data** (`src/shared/data/magic.ts`):
  - **Topics** (`MAGIC_TOPICS`, merged into `TOPICS` in research.ts):
    - Leyline Lore (`ley_lore`, Medieval, after The Arcane Arts) opens the **Mage Tower** (`mage_tower`) and the
      **Arcane Library** (`arcane_library`); both are in `MAGIC_BUILDINGS`, merged into `BUILDINGS`.
    - Seven schools come after it (`SCHOOLS`, `school_<id>`): Evocation, Abjuration, Restoration, Divination,
      Transmutation, Conjuration (after Transmutation) and The Forbidden Arts (Occult, after Conjuration).
    - The planner weighs them with `magicTopicWorth`: the lore +26 at six people, a school +12, the war schools +10 more
      once raided. This is a one-line hook in planner.ts `topicScore`.
  - **Spells by school:** each school teaches a list of the existing spells (`SCHOOL_SPELLS`) to any caster who studies
    it.
  - **Items** (`MAGIC_ITEMS` and `MAGIC_UNIQUES`, merged into `ITEMS`; the stations `mage_tower` and `arcane_library` are
    added to `Station`):
    - A tome per school (`tome_<school>`, made at the library). Kept in the stores, it makes study of its school
      `STUDY_TOME` faster.
    - Three **foci** (`FOCI`: Apprentice's Focus, Ley Crystal, Runed Orb; charms, made at the tower).
    - Three **enchanted** charms (`ENCHANTED`: the Leyheart, the Mantle of Stars, the Ring of Quiet Mending) and three
      **cursed** ones (`CURSED`: the Ashen Grimoire, the Hollow Crown, the Bloodstone). These are one-of-a-kind relics.
  - **Each people's flavour** (`FLAVOURS`): what they call mana (grave-essence, the green, aether, glamour, quintessence,
    moonlight...), how fast they gather it, the schools they're good at (`FAVOURED` 1.3: rites stronger, study quicker),
    a school they shun (the druids and the knights the Forbidden Arts), what their animated servants are (skeletal
    thralls, clockwork drones, homunculi, pixies...), how much the Blood Rite weighs on them (`bloodGuilt`: the liches and
    the Court 0.3), and the Moon Pack's mana at night (`night` 1.8).
- **The leylines** (`leyOf`, `leyAt` in `src/shared/sim/magic.ts`):
  - `LEY_LINES` (3) straight lines across the land from the seed. The first passes within `LEY_NEAR_CAMP` (18) cells of
    the camp.
  - Each is felt `LEY_HALF` (6) cells either side, with wells where they cross (`WELL_R` 8, `WELL_POWER` 1.5).
  - The whole is scaled by the biome (`LEY_BIOME`: the ashlands 1.4, the desert 0.8).
  - Cached by seed and land.
- **Mana** (`magicHourly`, hourly from sim.ts after portals):
  - Each finished tower gives `TOWER_MANA` (3) × (`TOWER_BASE` 0.4 + the ley under it) an hour, and each caster at home
    gives `CASTER_MANA` (0.25).
  - The store is capped at `MANA_CAP` 30, +60 a tower, +30 a library.
  - The town lays its first tower itself on the strongest ley near the camp (`placeTower`); the library is the planner's
    "learned to build it". Neither is laid before the town has `TOWER_PEOPLE` (6) grown-ups and a spare build slot (a
    one-line hook in planner.ts's "learned to build it" loop): a hamlet's stone goes on homes first.
- **Study** (`studyHourly`):
  - Each caster at home (`castsSpells`: data/spells.ts `SPELLCASTERS`) studies the most advanced spell of the town's
    schools they can reach (`nextStudy`: up to `STUDY_AHEAD` (5) levels past their own) and don't know.
  - A spell takes `STUDY_PER_LEVEL` (4) hours a level. Study is ×2 at the library (×1.4 at the tower), quicker with the
    tome, by Intellect (`STUDY_INT`), and for a favoured school.
  - The Forbidden Arts tempt only a witch, a necromancer, the half-mad, or a people that favours them.
  - Learned spells are `Person.arcana.spells` (`Arcana`: also the study in hand, practice, madness, rites, miscasts).
    They go into the fight's kit: `readySpells(cls, level, studied)` and `kitOf` in actions.ts.
  - A focus or a magic charm adds its `power` to the kit's spell power (`kitOf`). Foci go to casters who have none
    (`focusCasters`), and `canWear` keeps them out of anyone else's hands (classes.ts).
  - The library writes each school's tome once, and the tower makes foci while a caster lacks one (`wantTomes`, through
    `queueCraft`).
  - A caster with `MASTER_SPELLS` (10) learned makes their masterwork once: an enchanted charm (`masterworks`).
- **The rites** (`RITES`, `RITE_ORDER`; `ritesHourly`, one an hour):
  - Each hour the town casts the first rite it wants that it has the mana and a caster for. The caster is the one best
    at that school (`riteCaster`).
  - A rite's strength (`potency`) is +`POTENCY_PER_SPELL` (0.15) per spell of its school the caster knows, ×1.3 if the
    school is favoured.
  - **The Great Ward** (Abjuration, 25 mana): a raid on its way loses `WARD_SAP` (0.15 × potency, at most 0.4) of every
    raider's health.
  - **Firestorm** (Evocation): `STORM_HITS` (3) raiders burned for `STORM_BURN` (0.35) of their health × potency, never
    below 1 health (it scorches; the raid must still be fought).
  - **Foresight** (Divination): a raid seen coming arrives `FORESIGHT_HOURS` (2) later. With no raid on, it tells the
    next raid within `OMEN_HOURS` (12).
  - **Rite of Mending** (Restoration): up to `MEND_MOST` (6) of the downed, hurt and sick: the downed stop bleeding, the
    hurt get back `MEND_SHARE` (0.4) of their health, and the sick are eased.
  - **Breaking of Curses** (Abjuration): a cursed charm worn is broken.
  - **Rain-calling** (Transmutation): ends a drought, or puts out a wildfire, within the hour.
  - **Enchanting the Tools** (Transmutation): all work is `ENCHANT_WORK` (1.12) faster for `ENCHANT_HOURS` (24). This is
    a one-line hook in townsfolk.ts `workFactor`.
  - **Scrying** (Divination): maps the nearest unmapped region of the world map.
  - **Animation** (Conjuration): a servant, up to `SERVANTS_MOST` (2) + one per tower. Each eats `SERVANT_UPKEEP` (0.6)
    mana an hour and fetches wood and stone. Starved, one turns on someone (`SERVANT_TURNS`, a share of their health)
    and is gone.
  - **The Blood Rite** (Forbidden, below `BLOOD_WHEN` of the cap): bleeds a prisoner dry, else a townsperson
    (`BLOOD_TAKES`; it may kill), for `BLOOD_MANA` (45). It is only cast with a prisoner to bleed, or in a town of
    `TOWER_PEOPLE` grown-ups. It may leave a cursed charm behind.
  - Alignment: rites push `alignPush`/`orderPush` (the Blood Rite −3 and −0.5 order, scaled by `bloodGuilt`; Mending
    +0.5; the Ward +0.3 order). A mad mage cast out costs −1, and one who kills −2.
- **What it costs:**
  - **Wild magic.** Every rite stirs the wild magic (`flux`: `FLUX_PER_MANA` per mana spent). It settles
    (`FLUX_SETTLES`), and a tower on a line stronger than 1 stirs it a little (`FLUX_LEY`).
  - **Miscasts.** The chance is `danger` × (1 + 2 × flux) × (1 − mastery) × (1 − a focus's steadiness) × (1 +
    madness). Mastery is practice/(practice + `MASTERY_HALF`), at most 0.8. The outcomes (`MISCAST_ODDS`):
    - a backlash burn (`BACKLASH` 0.45 of their health);
    - madness (+`MAD_MISCAST` 0.35);
    - death ("torn apart by a miscast"; never the founder);
    - the spell running wild (+0.35 flux);
    - a tear into another world (`tearRift` in sim/portals.ts), else a surge.
  - **Madness.** It grows with Forbidden rites (`MAD_FORBIDDEN`), high wild magic (`MAD_FLUX`) and cursed charms, and
    settles slowly (`MAD_SETTLES`). Past `MAD_AT` the mage is put to the town (`askMadness`: a `ways` prompt, system
    'magic', answered by `answerMagic` through heritage.ts `answerWays`). The answers:
    - lock them in the tower for `LOCK_DAYS` (5), which is the default;
    - let them work on: `MAD_TURNS` (0.35) they kill someone;
    - send them away (never offered for the founder).
  - **Surges.** Past `SURGE_AT` (1) the wild magic surges (`surge`), then falls back to `SURGE_LEAVES`:
    - buildings near the tower catch fire (`SURGE_FIRES`);
    - people within `SURGE_R` (14) cells are burned (`SURGE_WOUNDS`) or killed (`SURGE_KILLS`);
    - a grey pox may break out (`SURGE_PLAGUE`: the plague doom with 2 to 4 sick);
    - a tear may open (`SURGE_TEAR`);
    - a cursed charm may be left behind (`SURGE_CURSE`).
  - **Cursed charms** drain their bearer (`CURSE_DRAIN`) and add to their madness (`CURSE_MADNESS`) every hour, until a
    ward-wright breaks them.
- **Saves:** `GameState.magic?` (`MagicState`) and `Person.arcana?` (`Arcana`) are optional. Older saves start
  without them.
- **Seen:**
  - **Map marks:** the rites play on the map as `magic:<rite>` spells (`castSpellFx`). `LOOKS` in town/spellLooks.ts
    gives each school its pixel-effects strip (`SCHOOLS[].fx`), plus `magic:surge`, `magic:miscast` and `magic:mad`.
    Their names come from `spellName` in snapshot.ts (`MAGIC_FX_NAMES`).
  - **Snapshot:** `snapshot.magic` (`MagicView`: mana, cap, the wild magic, the schools, the casters, the rites, the
    counts, the log, the leylines and towers), and `PersonView.arcana` (`arcanaView`, in the fight view's cache).
  - **The Magic tab** in the Town menu (`renderer/panel/magicPanel.ts`, `magicSection`; `GROUPS` 'Magic'). It shows the
    mana and wild-magic bars, the schools, the casters (study and mind bars) and the rites. Its key is folded into
    `heritageKey`.
  - **The Townsfolk page:** a caster's **Spellbook** (every spell, 📖 for those learned by study, mastery, rites,
    madness, what they study).
  - **The leylines on the map:** they glow after dark (`renderer/map/mapLeylines.ts`, `MapLeylines` in the map's
    additive lights layer, so not by day), with wells and towers brighter and a slow pulse. They're synced from main.ts
    (`syncLeylines`).
  - **Building art:**
    - The tower is the Simple Summer pack's Magic Stone Tower (`art/packs/su_stonetower.png`), with a lamp on its
      crystal.
    - The library is laid from the Dungeon Props sheet already in the game (`dprops.png`: the glass jar, the shelves of
      tomes and potions, two reading tables).
  - **The fight screen** (fightView.ts) no longer paints its cast and impact circles. A cast plays the pixel-effects
    atlas's `<element>-gather` strip round the caster (`PX_ELEMENT`).
- **Tests:** `test/magic.test.ts`, `test/mana.test.ts`.

- **Changes other systems** (all small hooks):
  - "Turn-based fights where stats matter": `readySpells` and `kitOf` take studied spells and a focus's power; mana is
    kept between fights.
  - "Tactics battles" and "Tower-defence raids": spells cost mana there now.
  - "Class paths" (`canWear`).
  - "Combat effects" (the fight screen's cast).

### Mana that runs out (the owner's ask: "casters can just cast all they want; a mana bar under the health bar")

- **Why it felt free:** only an expedition's fight gave its fighters a pool (combat.ts `personFighter`). The raid's
  tactics board and its trail built their townsfolk without one, and `canPay` (actions.ts) lets a fighter with no pool
  cast anything. On the board, too, the player's order (`tacticsOrder` 'skill') never asked about the cost.
- **The pool** (`src/shared/sim/mana.ts`):
  - Who has one: a calling that casts, or anyone who has learned spells by study (`hasMana`).
  - Its size is `maxManaOf` (Intellect and Wisdom), widened by a focus or a magic charm (`FOCUS_MANA` 1.5 × its spell
    power: a Ley Crystal +30%).
  - It's kept on the person between fights (`Person.mana`, left out while full; `manaNow`, `setMana`).
- **Charged in every fight:**
  - **Expeditions:** a fight starts from what's left (`personFighter` `mp: manaNow(p)`) and writes it back at the end
    (expeditions.ts `finishBattle`).
  - **The tactics board and the trail:** the townsfolk's combatants read and charge the person's own pool (getters on
    `asPerson` in tactics.ts, `mapArena` in battle.ts).
  - **The player's orders on the board:** they can't pick a spell they can't pay for (the 'skill' order, and the menu's
    `ready`).
  - **Falling back:** a caster without the mana strikes instead.
- **Coming back:**
  - In a fight, `manaRegenOf` each turn (`manaTurn`: at each turn on the board, each action on the trail).
  - Out of a fight, `MANA_REST` (0.12) of the pool an hour, times (1 + the leyline's strength where they stand)
    (`manaRest`, from `manaHourly` in sim/magic.ts). This runs every hour whether or not the autopilot is on, like
    healing.
  - Potions are left to the battle-items chat.
- **Seen:**
  - `PersonView.mana` ([now, most], a fast field of the snapshot; null without a pool).
  - A thin blue bar under the health bar over people on the map in a raid (mapPeople.ts `hpBar`).
  - Under each unit box's health bar on the tactics board, with "MP n/m" beside HP (`TacUnitView.mp`/`mpMax`,
    tacticsView.ts `drawBars`).
  - On the Townsfolk page's "Health and spirits" (`manaBar`).
  - The side-view fight's HUD already had its MP meter under each party member's health (fightHud.ts); foes have no pool.

## Balance pass 4 (claude/balance-4)

Measured on main 0.120.0, 40-day soaks, 6 seeds each, religion on against off (a throwaway switch that turned the whole layer
off; removed again, nothing of it is in the branch). Mean people at day 40 / deaths.

### 1. Religion's soak swings were seed spread (no change; checks "Religion and the gods made real")

| people | religion off | religion on |
|---|---|---|
| liches | 26.0 / 8.2 | 28.7 / 11.7 |
| nomads | 84.5 / 29.3 | 81.5 / 32.7 |
| fae | 17.0 / 11.7 (1 of 6 starved out) | 23.0 / 9.3 |
| alchemists | 7.3 / 6.2 | 8.2 / 5.8 |
| dwarves | 6.7 / 4.7 (0 of 6 wiped) | 6.0 / 4.7 (1 of 6 wiped) |

Per-seed spread is 20 to 40 percent of the mean (liches 20 to 43, nomads 61 to 100, fae 7 to 37), so the earlier 3-seed jumps
(liches 18 -> 31, nomads 85 -> 63, fae 29 -> 23, alchemists 6 -> 9) are noise: with religion off the means are the same size
and in the same order. No mechanic was softened. The liches do not grow from religion: off 26.0, on 28.7, inside one standard
error (about 3). The undead are `tireless`, so the hearth god's plague (`greatWrath`) can only sicken the living few of a lich
town; it is not free favour, since favour only moves through followers, demands, rites and acts in nature.
The one dwarf town that ends is seed 5 with religion on (8 people with it off). Traced: a camp of 2 to 4 people for 22 days,
five of them starving together on days 23 to 26 before any greater wrath (only omens came, and the harvest god was at -17 when
the hunger began; his lesser wrath at -40 came after). Religion did not start it; the off run took another road.

### 2. Greater wraths no longer chain (changes "Religion and the gods made real", the greater wraths)

Before, one wrath a dawn at most, but the next god could strike the next day: a plague, a cursed harvest and a storm in one
week was possible. Now `WRATH_GAP_DAYS` (5, `data/religion.ts`) must pass since the last greater wrath of any god
(`ReligionState.lastWrath`, optional, set in `afterWrath`; `wrathReady`, checked in `dawn`). Within the gap the angry gods
still send omens. Test: `greater wraths never chain` in `test/religion.test.ts` (all four gods at -90 for 78 days: every
wrath at least five days from the last; it fails with the gate removed, "days 3 and 4 too close").

### 3. Alchemists' baseline for the magic merge

Main 0.120.0, alchemists, 6 seeds: 8.2 people, low 1.7, deaths 5.8 (per seed 7, 4, 11, 5, 15, 7); religion off 7.3 (1, 15, 7, 2,
10, 9). Religion is not what moved them: the magic chat's forced-run 12 -> 3 is a magic effect or its own seed spread, to be
judged against this baseline.

## Seasons of war with the realm (claude/seasons-of-war; the owner's ask: the Conquest reworked for a hands-off town)

Changes HISTORY "The Conquest update" (its manual half removed, its world turned back on), "The realm" (envoys answered
by the town's council, hosts by the season, the Realm's buttons gone), "The living world map" (wars keep the seasons
and take provinces) and "Memory in the town" (war memorials). The rules are in `src/shared/sim/war/` and the numbers in
`src/shared/data/war.ts`; state `GameState.war` (`WarState`, optional; an older save is given one, and a world, when
first wanted). Only with the autopilot on; the dice are the war's own side stream (`warRng`:
`${seed}:war:${tick}:<salt>`), never the town's. Tests: `test/seasonsOfWar.test.ts`.

- **The call on the old conquest.** `CONQUEST.on` is **true** again, for what remains: the world of provinces
  (`sim/conquest/world.ts`, `conquest.ts`, trimmed: the old armies' fields are kept optional for older saves and never
  read), its painted map (`panel/warMap.ts`, `art/warTerrain.ts`, `art/warSprites.ts`), the powers' border marches
  (`sim/conquest/rivals.ts`: now only in the marching seasons; a town province's defence is a share of the town's might,
  `TOWN_LAND_GUARD`, more under Defence, `DEFENCE_GUARD`; `powersOnMap` takes in powers that came to hold land
  later), the win by every province held by the town or a friend (`checkConquestWin`), and the New Town page for how
  many realms share the world. **Deleted**, as manual controls a self-running town has no use for: the town's armies,
  squads, troop training, province battles, captives and march reports (`sim/conquest/armies.ts`, `squads.ts`,
  `battles.ts`, `marches.ts`, `warView.ts`, `panel/warBoard.ts`, the `conquest` command) with their four test files
  (`conquestArmies`, `conquestBattles`, `conquestMarches`, `conquestSquads`), and `test/conquestOff.test.ts` (it
  checked the feature was parked; its successor is the first test in seasonsOfWar.test.ts). The training grounds
  (`data/training.ts`) are never built. The data of `data/troops.ts` stays (the map's figures and the border marches'
  numbers).
- **The seasons** (`warSeason`, `SEASON_OF_WAR`): spring and summer `march`, autumn `harvest`, winter `hold`.
  - Hosts against the town (sim/factions.ts `factionsDaily`, by `hostOdds`): the chance x`MARCH_HOSTS` (1.6) in the
    marching seasons (reached between paced days `MARCH_RAMP_FROM` 6 and 16, `MARCH_RAMP_DAYS`, so a young town's first
    spring is as before), x`HARVEST_HOSTS` (0.8) in autumn (and a harvest host, `hostMustered`: half the size, no engines), none in winter, none from a power
    occupying the town. Drawn as before, so the town's dice keep their order. The rivals' ordinary raids lean the same
    way (`rivalRaidOdds` x1.4 in autumn, x0.6 in winter).
  - Wars between powers (`s.feuds`, sim/worldLife.ts): begin on `WAR_START_PLOT` (14) mornings in a hundred in autumn
    and winter, a third of that in the marching seasons (`OFF_SEASON`); end on `WAR_END_WINTER` (16) in winter, a third
    of it otherwise; up to `FEUDS_MOST` 3 at once.
- **Strikes** (`sim/war/strikes.ts`, from worldLife's realm hour): each war strikes at most every `STRIKE_GAP_DAYS` (3),
  none in winter. A strike is a `Campaign` (`s.war.campaigns`) and a `feud` march on the world map (`March.camp`). In
  the marching seasons it is aimed at a province (`strikeTarget`: one beside the attacker's land, the capital only when
  it is the last); won, the province is the attacker's (`takeProvince`), and a power whose last province falls has
  fallen (`powerFalls`: stance `destroyed`, its folk scattered, a share to the victor, `s.war.fallen`), a landless
  rising power or the old house taking up its seat. A rising power met holds no land until it raises its banners over
  free land far from the town (`claimSeat`, daily). In autumn a strike is a harvest raid (`harvestLoss`: `HARVEST_LOSS`
  of the loser's folk, half of it of its troops, no province). The loser's deserters may make for the town
  (`DESERT_CHANCE` 0.12, doubled against a power the town marched on; never to a town under `DESERT_TOWN_LEAST` 5
  grown-ups, one band every `DESERT_GAP_HOURS` 96 at most): a band of `DESERT_SHARE` of its troops (2 to `DESERT_MOST` 7,
  never more than half the town's grown-ups) of its people, no lord, `DESERT_HOURS` later (`desertersHourly`).
- **Called to arms** (`sim/war/campaigns.ts`): a power the town is allied with (or at peace or trading with at
  `CALL_WARMTH` 25), one at war with a power the town is at war with (`COMMON_FOE_WARMTH` -20), or any not at war with
  the town that it thinks `CALL_PREFER` (15) better of than its foe (down to `CALL_COLDEST` -25) may call the town to its
  strike (`callTown`, one call every `CALL_GAP_DAYS` 6; needs `FIGHTERS_LEAST` grown-ups the town could field, `fighters`;
  a call blocked by another envoy at the gate is tried again each hour for `CALL_RETRY_HOURS`): an envoy `campaign`
  (`Prompt.envoy.camp`) asking for a levy (`levyFor`: a grown-up in `LEVY_PER` 4, 3 to 8): march, send `CAMPAIGN_COIN`
  (40) instead, or stay out. The strike waits on the answer and on the party (`strikeWaits`). Marching, the campaign is
  a destination, `assault:campaign:<id>`, fought as an assault (sim/factions.ts hooks: `assaultTargets` +
  `openCampaigns`, `assaultWaves` -> `campaignWaves`: the foe's troops in waves of about `CAMPAIGN_WAVE_TROOPS`, at most
  `CAMPAIGN_WAVES_MOST` 4, its toughest troop as captain last; `leviesFor` -> `campaignLevies`: the ally's own host
  `ALLY_HOST` 5-9 beside the party; `assaultDestination`, `assaultOver` -> `campaignOver`). The council raises the
  party itself (`sendParty`: the fittest, never the founder, half the grown-ups home), unless the player raises one
  from the War tab or the muster first (noted by `campaignsHourly`). Won: spoils (`SPOILS_PER_TROOP` of the foe's
  troops, at least `SPOILS_LEAST`, times the people's `spoils`, 0.6 of it beside an ally, half for a harvest raid) and
  a load of its goods (or grain), the foe's troops cut, the ally warmer, a deed `campaigns` for each who came home
  (`DEED_TITLES`: the Veteran, Warhorse, Marshal of the Realm; beside the night watch's `watched`), the victory feast, morale; the ally's strike carried.
  Lost: grief (morale). The recap is `s.war.recap`.
- **The council** (`sim/war/council.ts`): every envoy carries its pick as `Prompt.recommended` and `why`, and as the
  default (`warAdvice`, from `envoy`; only with the autopilot on, so the realm's own tests keep their defaults).
  `callScore`: the people's lean (`WAR_WAYS[origin].join`), an alliance +3, a just cause (the foe at war with the town,
  hating it, a warmonger or oathbreaker; doubled for a `just` people, who stay out without one), the profit (an easy
  war, plunder for the wicked), the direction (Defence +1, Growth -2, Trade -2 or -1, Knowledge -1), friends on both
  sides, too few fit to fight (`FIGHTERS_LEAST`) or too strong a foe; at `JOIN_AT` (2) it marches, else coin (rich,
  allied or peaceful) or stays out. Demands (`adviseDemand`): a `proud` people pays only a power `PROUD_BOWS` (2)
  times the town's might; much the weaker
  (x1.4), or Growth/Trade at x0.9, pays; the wicked or the warband answer a weaker power with war; Knowledge talks the
  sum down to `TALKED_DOWN` (0.6). Yielding (`adviseYield`): at `YIELD_AT` (2.6) times the town's might (x1.4 under
  Defence, x0.8 under Growth/Trade), sooner with a siege lost already, never for the proud. Peace, trade, alliances,
  marriages, surrenders and the conquered by direction and alignment. **The council's own doings** (`councilDaily`):
  Growth and Trade (not a proud people) send a gift a day to one power at war with the town (each every
  `PEACE_GIFT_EVERY_DAYS`, while the treasury holds `PEACE_TREASURY` times it) and take peace when they will; Knowledge (and Defence, for alliances) seeks treaties
  where the goodwill is, and in winter brokers peace between two friends at war (`BROKER_CHANCE`); the wicked (or the
  warband) break a treaty in winter with a power `BREAK_STRONGER` weaker and `BREAK_RICH_FOLK` rich (alignment and
  order down), and in the marching seasons take the war to a weaker power (`townCampaign`: won, the province is the
  town's); the nomads ride out on autumn harvest raids (`NOMAD_RAID_CHANCE`); the machines sell arms to both sides of
  every war, `ARMS_COINS` a war a marching season. The orcs' joining spends fury (`s.horde`), the knights' just wars
  raise the Order's honour (`s.order`). The Realm's buttons (gifts, treaties, war, demands) are gone: each power's card
  says what the council would do (`FactionView.council`, `councilLine`); storming a stronghold stays (an expedition).
- **War comes home** (`sim/war/siege.ts`): a spring or summer host of a power `SIEGE_STRONG` (1.5) times the town's
  might that has sent a host before may be a siege (`SIEGE_CHANCE` 0.35: `SIEGE_BIGGER` x1.3, half again the engines,
  `w.siege`), and asks the town to yield first (an envoy `yield`, `siegeHourly`). Yielded: **occupied**
  (`w.occupation`): a garrison (`GARRISON_SHARE` of the host, to `GARRISON_MOST` 14), at peace with the occupier, no
  host from it; each morning (`occupationDaily`) `OCCUPY_TAX` of the treasury over its keep and `OCCUPY_FOOD` of the
  food in store taken; the resistance grows (`RESIST_BASE` 6, +3 Defence, +2 a good town, +4 a proud people, +6 a
  wandering camp, less `RESIST_PER_GARRISON` a soldier, at least `RESIST_LEAST` 2); at 100 the town **rises** (the
  garrison as a raid begun inside the town, `startRaid` with `inside`): broken, the town is free (war with the occupier,
  the title the Liberator, the feast of liberation); else the rising is crushed (`RISING_HANGED` 2 hanged, the garrison
  +2, the resistance from nothing). An ally at war with the occupier frees the town on `ALLY_FREES` of the marching
  mornings; after `OCCUPY_DAYS_MOST` (15) the occupier, paid, marches off. Stood: held when the host breaks or
  `SIEGE_LOST_FELL` (0.35) of it falls (the Siege-breaker title, morale); else **lost**: the sack (`SACK_BURN` fires,
  `SACK_SLAIN` of those in the streets cut down) and the occupation; `SIEGES_TO_FALL` (2) sieges lost to the realm's
  powers end the town (the Great Enemy's rule, its own count kept apart). Hook: `siegeOver` from `hostOver`. A siege
  host's raid is `Raid.warSiege` and is fought out as the Enemy's last siege is (sim/tactics.ts: no clock while the field
  is held, at most `SIEGE_MAX_HOURS`). The resistance grows at least `RESIST_LEAST` (2) a day.
- **Memory** (`sim/war/memory.ts`): a death on a campaign, at the walls against a power's host, in the sack or on the
  gallows (`warFallen`, from annals.ts `recordFallen`) is one of the war dead (`w.dead`, `WAR_DEAD_MOST`); the partner
  is a war widow, the children war orphans (`Person.warLoss`, `warLossLine`); at `MEMORIAL_AT` (3) dead in one war, a
  memorial to its fallen (sim/memorials.ts `warMemorial`: an `Honoured` with `memorial` names, raised by statues.ts as
  a statue is; its card lists them, `deedsOf`). The year's chronicle tells the wars (`warYearLines`).
- **Seen.** The War tab (`panel/warPanel.ts`, to watch: sub-tabs Map, Wars, Home front, News): the map with the
  season's banner (`.war-season`), every march on it by kind (`MarchView`: a border march, a strike, a harvest raid
  dotted, the town's war party in gold led by one of its own; `drawMarks`), a province's card; the wars between known
  powers and the fallen; the campaigns (`CampaignView`: called, marching, won, lost, stayed out, sent coin, marched
  alone) with "Raise a party…" while one is open; the council's line on each power and the people's way
  (`WarWays.line`); the home front (a siege coming, the occupation and its resistance bar, sieges held and lost, the
  recap); the war dead, the widows and orphans, the memorials; the war news (`warNews`/`warLog`, `WAR_NEWS_MOST`). The
  view is `sim/war/view.ts` (`warView`, `snapshot.war`). The news bubble (mobile/notices.ts) has the siege, the
  occupation, a campaign called or marching, and the recap. The Expeditions world map shows the town's war party
  (march kind `campaign`) and a harvest raid's label.
- **Peoples' ways** (`WAR_WAYS`): orcs (join +4, proud, break their word when strong, spoils x1.3), knights (just
  wars only, proud, never break their word, spoils x0.8), nomads (harvest raids of their own, spoils x1.2), machines
  (arms to both sides, join -1), dwarves (proud, never break their word), vampires (join +1, spoils x1.2).
- **Tools.** `tools/soak.ts` takes `WAR=1` (each seed's joined, won, lost, spoils, war dead, sieges, occupation,
  fallen powers, wars, the town's provinces) and `WAR=2` (and the war news).
- **The War tab on the phone:** the map is fitted to the width, and sideways to the height (`terrainCell`), centred
  (`.war-map` fits its canvas). Checked at 393x852 and 852x393.
- **Probes (on main 0.121.0/0.122.0).** `tools/sim-hash.mjs`: every hash changes (fixture 45ba0aed2e31 ->
  9a0fffb1ba06; settlers 5aa972e69df5 -> c110ce446490; knights 8dd273d97ac8 -> 9e7b165f298c; vampire 0079254d1741 ->
  eb59b08f8018; dwarves 3859f268259d -> bdda7f36c2ee): the seasons of war run for every town with the autopilot on,
  and the War tab's border marches (their news lines take ids) shift the town's ids from the first days. 40-day soak,
  3 seeds, before -> after (people, deaths, none wiped): settlers 14.7/7.3 -> 13.3/10.0, knights 11.0/6.0 -> 11.7/4.7,
  orcs 9.3/7.7 -> 10.3/7.7 (a campaign joined on each seed, one lost in the field), machines 47.7/30.0 -> 40.3/51.3.
  An earlier round showed orcs a third down; switching the war's hourly rules off brought them back, and the deserters
  and the fit-fighters rule were changed (above). `tools/perf-sim.mjs`: step 1.68 -> 1.73 ms, snapshot 7.99 -> 8.18 ms,
  two days' catch-up 32.8 -> 35.6 s.

## The raid board's camera glides (a jerky-camera fix)

The owner's report: the camera was very jerky when the board moved to a new character. Two causes in
`tactics/tacticsView.ts`'s `render`. Between one unit's action and the next nobody was acting, so the camera's target fell
back to the middle of the board and then whipped out to the next unit; the camera now keeps the last unit it followed
(`cam.fx`, `cam.fy`) until the next one acts, and heads for the middle only before the first turn. And the easing was a
tenth of the distance a frame, so on a phone drawing fewer frames it jumped in steps; the glide is now paced by the
clock (`CAM_GLIDE_MS` 260, the time to close most of the distance), and the finger's pan fades by the clock too. Changes
the HISTORY.md section "Tactics battles". Renderer only: the sim hashes are unchanged.

## The Town and People menus redraw only for what the eye can see (changes HISTORY "The menus redone" / "Every menu in sub-tabs")

The phone's menus rebuild when their key (`panel.ts`) changes, and a rebuild under a finger loses the tap. The Town's key held the
whole `s.stock` (it changes with every haul) and the raw `s.ledger` (fractional day sums), and `craftingKey` (the crafting orders'
progress to the whole percent, every worn item) was added to it. Now:

- `buildKey` (`panel/buildPanel.ts`) drops `s.stock` and takes `ledgerKey` (the table's whole coins, as drawn).
- A new `townStockKey(s, tab)` adds the stock bits **by the open sub-tab**: Stores gets `storesKey` (the counts, the spare items, what is
  worn, the kind chip), Buildings gets the stock (its cost chips), Overview gets the food-days figure to the digit drawn plus the
  Workshops tile's order count and slots; every other tab gets none. `panel.ts` calls it with `tabKey('build')`.
- `craftingKey` (`panel/craftingPanel.ts`) is now its own part plus `storesKey`; the Market and Crafting menus keep what they had.
- Everything a button changes is still in the key (the sub-tab itself, the hide prefs, the kind chip, the direction, the powers...).
- The Town's key is now **scoped to the tab drawn** (`buildKey(s, tab)`): the powers' hourly countdown, the knights' honour and vows
  (`heritageKey`), the faith, the villages, the council's blocs and the ledger are in the key only for the tab that draws them, and the
  buildings' construction progress only for Buildings (the Buildings tab's stock is just the cost chips' "short or not": a count past the
  dearest building's cost changes nothing, `costChipsKey`). `subtabs.ts` `shownTab(menu)` is the tab the menu was last drawn on (null
  before the first draw: the whole key); `panel.ts` `keyOf()` uses it, and takes the key again after a draw so the settled tab costs no
  extra redraw. The sub-tab itself, the hide prefs, the kind chip, direction, pins, powers, laws, gods and the rest a button changes
  are still in the key of the tab that has the button.
- The People list was already patched in place (`patchTownsfolk`); it measured 0 redraws a minute before and after.

Measured on the late fixture on the phone page (393x852), the game run at 3x for 25 s a tab, redraws a minute **before -> after**:
Overview 22 -> 12, Buildings 48 -> 2, Stores 12 -> 0, Treasury 10 -> 0, People list 0 -> 0. What is left on Overview is what it draws
(the powers' "ready in Nh", the knights' tiles).

## The tactics board's mana bar (changes HISTORY "Tactics battles")

The caster's mana bar (a thin blue bar under the health, `tacticsView.ts` `drawBars`) was drawn at `y + 46..51` of the unit box, over the
"HP x/y · MP" line at `y + 48`. A box with a mana pool is now six pixels taller (`boxHeight`): the health text and the move line sit
below the bar, and the sideways layout's stacked box uses the real height. Checked on the fixture with a forced raid (a mage's turn) at 393x852 and 852x393: the bar sits between the health bar and the text,
nothing overlaps; the unit box's guild badge shows in its corner.

## The battle item pop-up in the fight view (changes HISTORY "Battle items in the townsfolk's pouches")

A drink or a throw was logged as an ordinary act (`pool: 'sp'`, cost 0), so the banner read "Ann · 0 SP" with no icon and no line.
`ExpeditionView.acts` now carries `item` (the kit item's id) and, for an item, its `text` (the line from `data/kitItems.ts`).
`fight/fightHud.ts` draws the item's icon (`itemIcon`) before its name, "Ann drinks" / "throws" / "uses" for the cost line and the item's
text under it; the banner has a `.item` look (`index.html`). A drink is quick, so the skill that follows it logged the same tick: while the
item is under 15 ticks old it keeps the banner (`fightHud.ts`). Seen with a forced skirmish at both phone sizes (Oil Flask with its icon, "Sir Aldric throws"
and its line; Healing Potion "Sir Aldric drinks", "Drunk in a fight when hurt: 40% of their health back.").

## Guild badges for the fallen, the raid bar and the raid recap (changes HISTORY "7. Guild badges in the fight HUD and the Chronicle")

- `Fallen.guild?: { role, name, lead }` is set in `recordFallen` (`sim/annals.ts`) from the guild the person is in at the moment of
  death (the guilds drop the dead at the next count). No random draws; old saves have none.
- `art/guildMarks.ts`: `fallenGuildMark(f)` and `guildMarkOrFallen(snapshot, id)` (the living guild, else the one the person fell in).
- Shown: the Chronicle's fallen cards (`panel/heroesPanel.ts`), the raid recap's defender rows (`battle/raidRecap.ts`, so a slain
  defender keeps theirs), the raid bar's fighter chips (`battle/battleHud.ts`, `hud.guilds` set per snapshot in `main.ts`) and the
  tactics board's unit boxes (`tactics/tacticsView.ts`; `guildBadge` takes a `painted` callback so the Pixi texture is refreshed once the glyph is drawn).
- Test: `test/fixes6.test.ts`.

## Culture tab with a populated town (changes HISTORY "Town personality and culture")

Checked on the late fixture with a culture of five held ways, three rising and a log (the fixture itself has none: it predates the update),
at 393x852 and 852x393, the cards opened too: no overflow (the body is never wider than the page), no empty sections, nothing to fix.

## Battle items bought in the shop; raiders drink their potions (changes HISTORY "Battle items in the townsfolk's pouches")

- `buyKit(s)` (`sim/wages.ts`, run hourly with `buyGear`, autopilot only): each grown-up with a calling (`carriesKit`) and room in the
  pouch buys the next battle item they would carry (`kitWant`, `sim/kit.ts`, the same wish list the stores' hand-out uses) that is on the
  shop's shelves, at the same local price as gear (`localPrice`), if they can pay it over `SAVINGS_KEEP`; the coins go to the treasury
  (`earn(s, 'townsfolk')`), fighters first, one a person an hour.
- `raiderPouch(s, rd)` settles once (side stream `kit:raider:<id>`, `RAIDER_POTION` 0.12) whether a raider of the people kinds carries a
  potion, and keeps it on the raider (`Raider.kit?`). `raiderDrinks` drinks it under `HEAL_BELOW` (half) health, at the raider's turn on
  the raid map (`battle.ts`) and on the tactics board (`tactics.ts`, with a heal number and the tend effect). `raiderPotions` (after the
  raid) now hands over only the potions the fallen did *not* drink, so the chance of a find is the same overall.
- Tests: `test/kit.test.ts`.

## Alignment sayings in the town's speech (changes HISTORY "Town alignment" and "Town personality and culture")

`ALIGN_SAYINGS` and `alignTone` in `data/alignment.ts`: lines by topic for a town of the light (score >= `GOOD_AT`) or the dark (<= `EVIL_AT`).
`cultureView` (`sim/culture.ts`) mixes them into `CultureView.sayings`, which the map's speech already reads
(`speech.ts` `setTownSayings`, `SAYING_SHARE`). No new draws. Test: `test/fixes6.test.ts`.

## The banner and lamp tint by alignment (changes HISTORY "Town alignment")

Checked with `__align(80, 0)` and `__align(-80, 0)` on the late fixture: the page veil is gold or violet at both phone sizes; the map's one banner takes
`fff2cb` (good) and `d4bed8` (evil) from white (read off the live sprite; it is outside the default view, so only its tint value was seen), and at
night the street lamps' glow is warm yellow (good) and pink-violet (evil) at 393x852. Nothing needed fixing.

## The trade empire's ships sail with the fleet (changes HISTORY "Trade empire" / "Seafaring and islands")

- `sim/boats.ts`: `shipKind(s)` (the best of the town's fleet, else the best the town can build, else the first age's dugout) and
  `tradeShips(s)` (the empire's ships out on a voyage as boats away). The snapshot has `tradeShips`; `main.ts` hands them to `MapBoats.update`
  with the fleet, so they sail the same lane in the same sprites (nothing is drawn where the town has no mooring).
- The world map's marches carry `boat` for a ship (`empireOnMap`); `panel/worldMapView.ts` draws that boat's art in the token
  instead of the emoji (`boatToken`).

## Gossip and diaries from the intrigue's whispers (changes HISTORY "House intrigue" and "Everyone's own story")

- New gossip kind `whisper` (`data/gossip.ts`: sayings, replies; counted as bad news). `whisperGossip` (`sim/gossip.ts`) reads the
  intrigue's live whispers as talk (newest two, within `GOSSIP_HOURS`); the snapshot's `gossip` adds them after the journal's news.
  Read from state only, nothing is added to it.
- The diary (`sim/diary.ts`): `DiaryFacts.secret` is the first of `secretsAbout(s, p)` in the keeper's own words (`secretLine`: a debt,
  a lover, a hidden crime); about half the days it is written down (salt 41 of the diary's own hash rolls).
- Test: `test/fixes6.test.ts`.

## Sim hashes (`tools/sim-hash.mjs`), before and after

| | before | after |
|---|---|---|
| fixture (7 days caught up) | 45ba0aed2e31 | 288fc7ea0f32 |
| hash-a settlers | 5aa972e69df5 | abe1f840a3eb |
| hash-b knights | 8dd273d97ac8 | 38fab81d9136 |
| hash-c vampire | 0079254d1741 | c5c3fe891d3c |
| hash-d dwarves | 3859f268259d | 79489e80e179 |

- The **fixture** moved only because `Fallen.guild` is a new field in the serialized state (written in the fallen records and the memorial copies
  of them). With that field's text taken out of the serialized state before hashing, the fixture hash is 45ba0aed2e31, the same as before: no
  random draw or rule changed in it. (With the battle-item changes left out of the tree it is 288fc7ea0f32 too: it has no raids in those days.)
- The four **new towns** are unchanged (5aa9..., 8dd2..., 0079..., 3859...) by every item except the battle-item rules (the shop's kit buying and the
  raiders drinking, with `raiderPotions` reading its draw from the new `kit:raider:<id>` side stream instead of `kit:<tick>:<id>`): with `kit.ts`,
  `wages.ts`, `battle.ts` and `tactics.ts` left out they match the old hashes exactly. That move is the new rule, with its tests, not a stray draw.

## Side rings under the fighters

The owner's ask: a flat ring under every fighter in a raid, so good and bad are easy to tell apart. Blue is the town's own
people, red the raiders and anyone attacking the town, green a third party who isn't an enemy (allied hosts, hired,
summoned, raised or tamed help, a visiting stranger fighting beside the town). Renderer only: the sim and its hashes are
untouched; the side is read from what the snapshot already has.

- `renderer/art/sideRing.ts`: `SIDE_RING` (`town` 0x4c8dff, `foe` 0xff4a4a, `friend` 0x4cd964), `SIDE_RING_ALPHA` 0.55,
  `SIDE_RING_SQUASH` 0.46, and `SideRing`, one `Graphics` ellipse with a soft dark edge and a faint fill, redrawn only when
  its side, width, downed or active state changes. A downed fighter's ring fades to a third; the unit whose turn it is gets
  a brighter ring with a thin white outline.
- `map/mapPeople.ts`: `rings` ('off' | 'fight' | 'board', default 'fight') and `activeId`. On the map a townsperson gets a
  blue ring only while fighting (`defending`, activity 'fight', or just struck/striking), a visitor green. Drawn at `z - 0.4`
  under the sprite, above the shadow.
- `map/mapRaiders.ts`: `rings` (default 'off') and `activeId`. `ally` raiders are green, the rest red; not drawn while
  lifted (flyers aloft) or swimming. `main.ts` turns it on for the raid's raiders only, not the roaming bands or penned beasts.
- `tactics/tacticsView.ts`: both sub-renderers use 'board' (a ring 44 px wide, the tile's 2:1) and the active key
  (`act.key`, else `orders.key`) picks the brighter ring.
- `fight/fightView.ts`: each figure has a ring on its ground line in `drawFight` (party blue, foes red, `conjured` or
  look-less party members green); hidden while the party marches.

Changes the HISTORY.md sections "Tactics battles", "Tower-defence raids" and "Watching a party's fights".

## The wall as one building (branch claude/wall-as-one; the owner's ask: "one large building they work on from anywhere and the whole thing goes up together as one")

**What was wrong (found before any change).** HISTORY.md's "The wall raised as one construction" (0.67.0) put every
section *in work* at once, but each section stayed its own blueprint with its own `progress` and its own `delivered`,
so the wall still rose a section at a time, three ways:
- *Builders:* `findJob` 'construct' took the first site in the building list that was buildable with a free spot
  (`blueprintsNow(s).find(...)`), so every builder walked to the same piece and then the next one along: a crew
  clustered on one stretch (a piece has only a few spots round it) and finished it before moving on.
- *Hauling:* `haulOrder` puts the sites being built (someone at it, or `progress > 0`) first, so the materials went to
  the piece being built, then the next: one piece's makings at a time.
- *The picture:* each piece drew its own progress, so the map showed one stretch scaffolded and raised while the rest
  stood as ghosts.
- Measured on `tools/wall-probe.mjs` (new, below), settlers seed `wall-0` on the old code: the first piece turned from
  blueprint to built on day 10.07 and the last on day 16.98, **6.9 days** apart; five of the six towns (settlers and
  knights, seeds 0 to 2, 40 days) never had a ring standing at all within 40 days.

**What it does now.** While a ring is going up its pieces (the blueprints of the ring's generation that are in work) are
one site, in `sim/ringWall.ts`:
- `Ring.sec` (work done, in build-seconds summed over every piece) and `Ring.pool` (materials brought for the whole
  wall): one progress, one pool. `Ring.unlaid` (pieces not yet laid, their ground uncleared, counted by `planRing`).
  `ringTotals` (cost, build-seconds of the pieces in work and of all, plans included), `ringWorkShare`,
  `ringDeliveredShare`, `ringStillNeeded`, `ringCap` (work goes no further than the makings brought, and while a piece
  is still a plan or unlaid no further than the pieces in work and `RING_OPEN_CAP` 0.97), `ringBuildable`, `ringWork`,
  `ringDeliver`.
- `syncRing` (from `Sim.step`, after the people) writes the one progress and each piece's share of the makings into every
  piece's own `progress` and `delivered`, so the map, the planner (`stillNeeded`), the queue and the tap card all read
  the wall as one without being changed. `planner.ts shelveStalled` leaves the wall alone (`ringSite`).
- `finishRing` turns every piece of the construction (walls, gates and grates) from blueprint to built in the same
  tick, when the whole is done; one notice ("The town's wall is raised, all N pieces of it together"), and a deed for
  each builder. `planRing` then marks `ring.done` and takes the older ring down, as before.
- *Builders* (`people.ts`, `ringPick`, `ringBuilderOrder`): the nearest open spot along the line to where they stand,
  each builder already within `RING_CROWD_CELLS` (3) of a piece counting that piece `RING_CROWD_PULL` (5) cells
  further off, so the crew spreads along the wall. A builder's task is still `{type: 'build', building: <the piece>,
  spot}`; the work goes to the wall's count wherever along it they stand.
- *Haulers:* `haulOrder` lists the wall once; `ringHaulTarget` takes them to the piece of it nearest to them;
  `unreserved` counts what anyone is carrying to any part of the wall against the wall's one need.
- *The picture:* every piece shows the one progress, so the scaffolding and the part-raised courses (the mask by
  progress in `mapView.updateBlueprint`) rise all round together, and the whole wall stands in one tick. A piece of the
  wall is redrawn when its progress moves a hundredth (`mapView.ts`), not every tick (a hundred pieces move at once).
  The tap card's materials line shows whole units (`main.ts`).
- *Repairs after a breach stay per piece* (a hole is a hole): `ringSite` is null once `ring.done`, so a mended
  or upgraded piece of a standing wall is its own site, as before.
- *Old saves:* a ring with no `sec` (each piece with its own progress and makings) is pooled the first time
  `ringTotals` runs (`sec` = the sum of piece progress x build time, `pool` = the sum of what they held).
- *Kept:* the shape by people (`data/ringShapes.ts`), gates and grates, castle and hold rules, no roads through the
  ring, the planner's timing (`planRing` is unchanged but for `unlaid`), prowlers (`ring.done` is false until
  the whole wall is raised, and now it is raised at once). `ringProgress` (the one figure, `snapshot.wall`) still
  counts pieces standing: it now reads 0 of N until the wall stands, with the share rising.

**Constants:** `RING_OPEN_CAP` 0.97, `RING_CROWD_CELLS` 3, `RING_CROWD_PULL` 5.

**History it changes:** "The ring wall" (one blueprint for the whole wall, `RING_AT_ONCE`), "One coordinated wall
project" and "The wall raised as one construction": the pieces stay separate cells for pathing, damage and the joined
art, but their work, makings and finishing are one. "Builders build, the rest carry" / "construction crews": a builder
at the wall takes the nearest open spot along it (the other sites are as before).

**Tests:** `test/wallAsOne.test.ts` (one progress and one pool across a hundred pieces, work capped by the pool, no piece
built before the whole and the gates with it, the builders spread along the line, the builder's order, the old save
pooled, a breach mended a piece at a time). No existing test changed: `test/ringWall.test.ts` finishes pieces by hand
between planner passes and is unaffected.

**Tool:** `tools/wall-probe.mjs [days] [seeds] [origins]` logs for each town when the ring was laid and stood, the spread
between its first and last piece turning built, the crew's spread along the line, raids, people and deaths.

## The wall under construction has its own look (the owner's ask: "treat it like one large building, with different immersion for a wall being under construction")
- A ring piece being raised is no longer drawn with the ordinary construction site (`art/constructionSite.ts`) on every
  one-cell piece. `art/wallWorks.ts` `drawWallWorks` draws each piece as one cell of one continuous work, set by the
  cell's own place on the line so the cells run on from each other, from the wall's one progress:
  - *surveyed* (progress under 2%): a shallow trench and a taut cord on pegs, a red-tipped peg every third cell;
  - *footing and scaffold*: a footing along the whole line (laid stone for stone, brick and concrete walls, driven post
    butts for a palisade), scaffold poles every other cell (steel poles from the Industrial age), a ledger at each
    lift, braces, a deck of boards at the lift the courses have reached (`LADDER_EVERY` 9: a ladder to it);
  - the finished wall's courses rise behind it all round together (the picture masked to the one progress, as before);
  - a gate under construction is a frame (two posts, braces, a lintel from 45%) round its gap.
  - Piles of timber (logs, log pile, barrels, crates) or rubble stand every `STAGING_EVERY` (8) cells along the line
    where the haulers set loads down (`mapView.ts draw`, the pack sprites of `art/choresArt.ts`, already credited).
- The scaffold itself is code-drawn: the asset packs (`../chronos-assets`) were not reachable from this cloud session, so
  no pack scaffolding could be looked at or copied in; swap in pack planks and poles if one has scaffolding that joins end to end.
- Builders at the wall hammer as they always do (the 'build' activity beside the piece); they now stand spread along
  the line (above), so the hammering is seen all round.
- Pieces of the wall redraw each hundredth of progress (`mapView.ts`), not every tick.

## Faster paths (footpaths worn in sooner, streets paved as one job)

The owner: "pathways are really slow to be built up." Measured first (`tools/paths-soak.mjs <origin|fixture> <seed> <days> <every>`: worn, planned and paved cells by day).

**Before (0.128.0).** A step added `WEAR_STEP` 2 and every hour took `WEAR_DECAY` 2, so a cell held only above 24 crossings a day; a route walked 8 times a day never showed. Streets were planned at once (a building's way to the street is planned when it is placed: day 2 in a fresh settlers town) but laid only when someone had *no* task, so paving stalled: settlers soak-a had 17 cells paved from day 10 to day 30 while 20 to 33 stood planned; knights soak-a at day 40: 166 planned, 77 paved. Wear counted every walker already (all go through `walk()`).

**What changed.**
- Footpaths (`land.ts`): `WEAR_STEP` 3; decay `WEAR_DECAY` 1 every `WEAR_DECAY_HOURS` 1 (24 a day, was 48), so a route walked about 12 times a day shows in a day and is plain in two, and an unused clear path fades over a day and a half. `decayWear(m, hour?)` skips hours not on the interval. Changes the HISTORY.md "Footpaths (done)" and "The wild grows back" (footpaths grass over twice as fast) sections.
- Streets (`streets.ts`, changes "Streets are built"): the planned cells are one job. All pavers add to one pool (`GameState.streetSec`, `streetWork`) and the cells go down in `paveOrder` (outward from the streets already laid, a cut-off plan from its lowest cell), so several cells go down at once when several hands work. The `pave` task is now just "stand at the next cell"; `taskDone` shows `streetShare`. Builders pave when there is nothing to build or mend (`findJob` construct → `paveTask`), at most `PAVERS_SHARE` 0.25 of the grown-ups (at least one) so the rest of the work isn't starved; an idle person always may (`spare`). `STREET_WEAR` 14 → 20 (the wear scale moved).
- Art: faintest worn grade alpha 0.4 → 0.5 (`WORN_ALPHA`, groundArt.ts), middle 0.7 → 0.75. The planned ghost is already one strip (dashes only on its outer sides), not a box per cell.
- Not changed: planning (already early), no roads through the ring, gate paths, bridges and their wood. There are no stone/gravel costs in paving today.

**After (day 40, 3 seeds each, before → after; worn = showing).** Settlers paved 22/213/(c) → 410/197/266, planned left 40/7/- → 2/0/0; knights paved 77 → 169/206/286, planned left 166 → 0/1/0. Worn at day 40: settlers 298/112/- → 245/316/224, knights 136 → 357/317/171; fixture day 6: 230 → 851 (the late town). People and deaths vary by seed as the sim moves (paving now takes hands): settlers people 20/12 → 16/11/5, dead 3/7 → 7/10/10; knights people 10 → 12/12/12, dead 8 → 7/6/6.

Tests: `footpaths.test.ts` (day 1 faint, day 2 plain, clear in four days; unused path outlasts a day and a half; decay interval), `streets.test.ts` (paved as one job in order; hands, quarter cap, founder paves; streets planned from the first buildings). `sim-hash` changed for all four towns and the fixture (wear and paving now differ by design).
