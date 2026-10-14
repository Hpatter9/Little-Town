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
