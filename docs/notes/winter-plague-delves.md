## A winter to prepare for, a plague that kills, and why no town delves (claude/winter-plague-delves)

Three follow-ups from docs/notes/deaths-common.md, autopilot-guard.md and economy-balance.md (the owner's "deaths should
be common"). Changes HISTORY.md "Hard times" (docs/notes/deaths-common.md: winter, fevers), "World-dooming events"/the
plague ("Natural disasters"), "Sickbeds" (the sick lie abed), "Animal husbandry" (lean winter yields), "The ring wall"
(it leaves the firewood) and "Tactics battles" (a raid's question that held the town for good).

**The probe reaches winter** (`tools/death-probe.ts`, `node tools/death-probe.mjs <days> <seed>,...`): it now runs to
a day on the town's calendar (`clockTick`), which stands still while a fight is on screen, so a 40-day run is a whole
year, winter (days 31 to 40) and all. It also counts the hours hungry (food under 0.15), starving and sick, the food
put by a head at each season's turn, the plagues struck and the parties sent into a dungeon.

### Winter (`sim/hardship.ts`, constants in `data/hardship.ts`; all with the autopilot on, `=== false` guards)

- **Nothing harvested, little foraged, lean herds:** the fields already rested in winter. Foraging (a forager's wild
  food, the hungry scrounging berries) goes at `WINTER_FORAGE` (0.35) of its pace (`winterForage`, people.ts
  `workGather`/`scrounge`); the herds' milk, eggs and wool (`workPen`) and a hunting party's game (expeditions.ts) at
  `WINTER_YIELD` (0.4) (`winterYield`). Boats already caught half (`WINTER_CATCH`).
- **Firewood:** every winter hour the hearths burn `FIREWOOD_PER_HEAD` (0.6) a head a day (`hearths`), from the
  **woodpile** (`GameState.woodpile`), then the stores' wood, then coal; a part log is owed to the next hour
  (`hearthOwed`). From autumn on, wood in the stores is stacked on the woodpile each hour (`stackWoodpile`) until it
  holds the rest of the winter's burning (`winterNeed`: the people at home times 0.6 times the winter days to come);
  the woodpile is the hearths' alone. The planner gathers what's still wanted (`firewoodWanted`, added to the wood
  wanted in `planner.ts` `needs`), and the ring wall's haulers leave it in the stores (`people.ts` `findJob`). A
  power station (the Deep Freeze's `FREEZE_HEATERS`) warms the town for nothing, and in a Deep Freeze its own
  `keepWarm` decides. With nothing to burn the hearths go cold (`hearthsCold`, a notice, and the mood "The hearths
  have gone cold", `FREEZE_COLD_MORALE`): everyone at home is cold (`Person.cold`: no mending), losing
  `COLD_HP_PER_HOUR` (2.5) on the ground as before, `COLD_IN_BED` (0.5) of that asleep in a bed and `COLD_AWAKE`
  (0.1) up and about, half again in snow. Dies "of the cold"; the founder is laid low, never killed.
- **Food spoils** (all year, once a day at 6, `spoil`): a share of each pile of fresh food in a store rots,
  `SPOIL_DAILY` (berries and fish 8%, milk 10%, meat and kelp 6%, eggs and fruit 5%, vegetables 4%, grain 1.5%), a
  granary `SPOIL_GRANARY` (a fifth) of that, the winter's cold `SPOIL_WINTER` (half). Dried meat, bread and rations
  keep. A pile's rounding is hashed (no stream drawn), so a small pile rots now and then rather than never.
- **More sickness:** winter's squalor `FEVER_WINTER` 0.6 → 1.2 (fevers break out and spread more), and the cold or
  starving catch a fever `FEVER_WEAK` (2) times as readily.
- New optional fields: `GameState.woodpile`, `hearthOwed`, `hearthsCold`.

### The plague (`sim/doom.ts` `spreadPlague`, `plagueToll`; constants in `data/doom.ts`)

What was wrong: it took 1.3 health an hour, less than a person mends awake (4), so it rarely killed; and anyone over
it could catch it again at once, so it never ended. In the probe's towns before, a third of all the person-hours at
home were spent sick (31%), plagues running for weeks. Now, with the autopilot on (old saves' and the tests' plain
games keep the old rules):
- The plague's sickness is `sick.wasting`: no mending while it lasts (`noMending`), and the sick lie abed, a sickbed if
  one is free, else their own bed (`sickbeds.ts` `needsSickbed`/`mended`, as for a fever).
- It takes `PLAGUE_SHARE` (2.5%) of their full health an hour (some 90% over a 36-hour sickness untended), times
  `PLAGUE_OLD` (1.8; an elder 1.4), `PLAGUE_HUNGRY` (1.6, food under 0.25), `PLAGUE_CHILD` (1.3); eased in a sickbed
  (`PLAGUE_TENDED` 0.6, less again by `PLAGUE_HEALER_PER_LEVEL` (3%) a level of the infirmary's healer, at most half),
  and by a draught of herbs (`PLAGUE_HERBS` 0.75, one herbs from the stores a sickness, `sick.herbs`). The dressing
  that halves a sickness (`treatSickness`) is as it was.
- It passes to those near on the land (`NEAR_PX`, both ways: it used to be along the strip's whole width) at
  `PLAGUE_SPREAD_NEAR` (0.15) an hour, `PLAGUE_ABED` (0.4) of that from someone lying abed.
- Who got over it is spared it till that plague ends (`Doom.spared`), so it burns out.
- The founder is laid low, never killed (the owner's rule, relayed by the coordinator: sickness and cold never kill
  the founder; raids, disasters and fights can).

**Plague probe** (a plague struck at the eve of winter in a real town, 8 days played; the `wp-2` town at day 30, 13
people, three moments, and the late fixture, 37 people, two; wood added so the cold doesn't muddle it):

| | caught | most sick at once | sick-hours | dead of it | over by |
|---|---|---|---|---|---|
| main, wp-2 (×3) | 20, 22, 16 | 16, 17, 13 | 2174, 2099, 1722 | 0, 0, 0 | never (day 8) |
| main, late (×2) | 57, 55 | 44, 43 | 6814, 5987 | 2, 0 | never |
| branch, wp-2 (×3) | 1, 14, 1 | 1, 10, 1 | 13, 429, 23 | 0, 1, 0 | day 0.6, 3.5, 1 |
| branch, late (×2) | 49, 45 | 34, 37 | 1235, 1239 | 0, 1 | day 3.4, 3.3 |

(“caught” counts newcomers too.) It now sweeps a town in three or four days and is gone; one of the three wp-2 runs
was caught early (the first case lay abed alone and nobody near caught it). The deaths are few in these two towns:
both have sickbeds, a healer and herbs in store, which take its toll to about a third; the untended, the old and the
hungry are the ones it kills (`test/winterPlague.test.ts`).

### No delves in the first month: working as designed (nothing changed)

Followed in a probe town (`dd-1`, 30 days, the autopilot left out, as on the phone): the town scouted the Eastwood
(day 4) and the Northern Crags (day 5); the Gremlin Warren was on the board from day 10 and the Fey Hollow from day 15
(the Barrow Crypt waits on the Westwood and Storytelling, which no town had studied by day 30). Nothing is hidden or
locked wrongly. Two rules keep parties out:
- **Only an adventurer leads a party** (`ambitionOf(p) === 'adventurer'`), and the town had one or two, nearly always
  away or resting on the Monster Hunters' Guild's hunts (12 hunts in 30 days) and the land's caves.
- **A party goes only if it's strong enough for the worst it might meet** (`dares`, sim/parties.ts): its strength
  (health, more by level) must be `DARE` (1.15) times the place's danger, `DARE_BOLD` (0.8) for a bold leader. A
  dungeon's danger (`dangerOf`) is the heaviest of its possible bosses with their guards: the Gremlin Warren's Rat King
  (650) and two rats, 702; the Fey Hollow's, 504; the Barrow Crypt's Lich Lord and two skeletons, 420. The town's fit
  people at day 25 to 30 summed to 250 or so, and a party is at most the town's room to spare (half the grown-ups stay
  home) and five.

So a first-month town never dares one. For the owner to decide, any of these would let delves happen in the first
month: weigh a dungeon by its likeliest boss, or the one rolled as they set off, rather than the worst (`dangerOf`);
give the Gremlin Warren a boss of its size (the Rat King is the Rat Plague's raid boss); let a delve dare at the bold
leader's bar for anyone (rest camps lie on the way down); or let the founder lead the town's own parties (the founder's
quests and the muster already can).

### Found on the way: a raid that held the town for good

Two baseline towns and three of the first after-runs stood still for good at a raid: the tactics board was over
(lost) but its raiders had broken, and "They break!" was asked. While the board is up the game plays only the
fight's step (`Sim.fightStep`), which never timed out a question (`expirePrompts` is in the town's step), so the
question, the raid and the town waited forever. The raid's own questions now run out in the fight's step too and
are answered with their default (`sim/sim.ts`); `test/tactics.test.ts` (fails without it).

### Before and after

12 towns (`wp-1`..`wp-4` and `wp-9`..`wp-12` the band, tribe and supplied scenarios as named), 40 days on the
calendar each. "Before" is main (0.234.0) with only the raid fix above (wp-11 and wp-12 stood still without it); per
100 people a season is deaths over the town's person-days, times 1000.

WINTER_TABLE

Speed (`node tools/perf-sim.mjs`): PERF_LINE

Tests: `test/winterPlague.test.ts` (hearths and firewood, the woodpile, cold in bed and awake, the firewood wanted,
foraging and yields, spoilage by store and season, fevers for the weak, the plague's wasting, its toll by age, hunger,
sickbed, healer and herbs, its spread and burning out, the founder spared); `test/ringWall.test.ts` (the wall leaves
the firewood in autumn); `test/tactics.test.ts` (the raid's question). No existing test changed.

**What's left:**
- The woodpile isn't shown in the stores' readout or the menus (the sim only); worth a line by whoever owns them.
- A town that puts food by comes through winter on its stores (2 to 4 days a head at the turn of winter in these
  towns, near nothing in spring); spoilage and the lean winter take a share of it but hunger stays rare.
