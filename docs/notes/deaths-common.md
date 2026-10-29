## Hard times: fevers, festering wounds, the winter's cold (claude/deaths-common; the owner's "deaths should be common")

The smarter-town rules (0.224.0, docs/notes/smarter-town.md) cut the time the townsfolk spent hungry from 18% to about
1% by stopping daft behaviour, and the worry was that they made towns safer than the owner wants. They did: measured on
the same seeds, deaths fell by about a fifth, wounds' deaths most of all. They're brought back here by real danger, not
by undoing the smarter rules: a fever that spreads in a crowded, dirty town, an open wound left untended that festers,
and a winter that is cold to anyone sleeping on the ground and hungrier for everyone. New file `sim/hardship.ts`,
constants in `data/hardship.ts`. Changes the HISTORY.md sections "Deaths made common again" (the death rate) and
"Injuries, lasting harm, prosthetics and surgery" (a wound can fester), and "Gods and faith"/"Choice events" in one
point: an event's sickness now runs its course (below).

**The probe** (`tools/death-probe.ts`, run `node tools/death-probe.mjs <days> <seed>[,<seed>...]`; a seed `name/tribe`
picks the scenario, `late` is `test/fixtures/late-town.json.gz`): fresh settler towns played as smarter-town.md's
probes did (autopilot and `townBuilds` on, a question answered with its first choice, a raid's fight on screen holding
the town), to a set number of days on the game's own tick (fights' ticks and all). One JSON line a town: every death
(day, cause, the fallen record's words, whether the founder), the people at each day's end, the raids, and the
person-hours at home without a bed, with a fever, a festering wound, or cold. 24 towns: seeds `dc-1` to `dc-8` in each
of the band, tribe and supplied scenarios, 30 days (three seasons). Causes are read from the fallen record's words:
`raid` is any death while a raid is on (its blows, bleeding out, the battle board), `away` a death on a quest or out on
the land (the lost boy, the hoard cave), `fight` a duel, a murder or a beast out on the land.

**Before and after** (same 24 seeds, 30 days each; "0.223.0" is main just before the smarter-town merge, "main" is
0.225.0, the sim unchanged since 0.224.0; per 100 people a season is deaths over the town's person-days, times 1000):

| | 0.223.0 | main | this branch |
|---|---|---|---|
| deaths (a town) | 136 (5.67) | 107 (4.46) | 126 (5.25) |
| per 100 people a season | 29.5 | 24.4 | 30.7 |
| first, second, third season (per 100) | 28.0, 29.9, 30.1 | 32.6, 26.4, 18.4 | 35.3, 32.6, 26.6 |
| raids | 95 | 72 | 80 |
| disasters (quake, tornado, flood) | 16 | 21 | 15 |
| wounds: bled out / festered | 12 / - | 3 / - | 10 / 7 |
| sickness (fever / plague) | 0 | 0 / 2 | 0 / 1 |
| fights, away, other | 6, 6, 0 | 4, 5, 0 | 6, 6, 1 |
| hunger, cold, old age | 1, 0, 0 | 0, 0, 0 | 0, 0, 0 |
| founders lost / towns ended | 3 / 0 | 3 / 3 | 5 / 3 |
| people at day 0, 10, 20, 30 | 3.3, 5.3, 7.0, 9.0 | 3.3, 5.1, 6.4, 9.8 | 3.3, 5.0, 6.2, 8.0 |

By scenario (deaths a town, per 100 a season, towns ended):

| | 0.223.0 | main | this branch |
|---|---|---|---|
| band (founder and two) | 5.13, 26.1, 0 | 6.25, 49.2, 3 | 6.50, 60.5, 1 |
| tribe (six) | 6.00, 23.2, 0 | 4.13, 13.7, 0 | 5.25, 17.9, 0 |
| supplied (the founder alone) | 5.88, 48.7, 0 | 3.00, 24.9, 0 | 4.00, 36.0, 2 |

- Main lost a fifth of the deaths, and the tribes (the biggest towns) a third of theirs. Wounds' deaths fell from 12 to
  3 (the badly hurt now go to bed, and mend three times as fast), raids' from 95 to 72, hunger's from 1 to 0. The
  three towns that ended on main are lone bands whose founder died in a disaster (a tornado on day 5, earthquakes on
  days 13 and 29), with no grown heir yet. On the branch: dc-3 band to the same tornado, dc-3 supplied to a duel on
  day 25, dc-8 supplied to the plague on day 8; two more lost their founder to raids and a cave bear, with an heir to
  follow. No founder died of hardship (it can't kill them: below).
- The branch is back to the old rate a head (30.7 against 29.5), at fewer a town (5.25 against 5.67) because its towns
  are smaller by then (8.0 people at day 30 against 9.0). Hardship's own share: 7 festering and no fever in this run (3
  fevers in the run before, with faster spread), and the bleed-outs back up with the wounds that are left to fester.
- The numbers swing a lot from seed to seed (0 to 10 deaths a town); with 24 towns a mean is good to about ±0.6 a
  town, so main's drop (1.2 a town) is real but only about one and a half times the noise. The first run of the probe
  missed every death during a fight on screen (it skipped the bookkeeping on those ticks) and is thrown away.
- **The late fixture** (6 days, one town, mid-winter, the Dragon and a raid at the gate): 0.223.0 8 deaths (all
  Vermithrax), main 6 (5 Vermithrax, a drowning), the branch 7 (4 Vermithrax, 3 drowned); fever 2.8% of its
  person-hours and festering 1.2%, none fatal in the six days. An early version without immunity had 57% of the
  town's hours feverish and 3 dead of it in six days: a fever that swept the town and stopped it working (below).
- **Winter** (4 tribe towns to day 42, into winter on the calendar): main 9.25 deaths a town (16.8 per 100), the
  branch 8.00 (15.9): the same within the noise. The rules fire (fever 2.5%, festering 1.1% of hours), but nobody in
  these towns slept on the ground in winter (1.4% of hours without a bed), so the cold took nobody, and the winter
  appetite starved nobody: they had food put by. The cold is for a town short of homes, as it should be.

**What changed** (`sim/hardship.ts`, `hardshipHourly` from sim.ts after `injuriesHourly`; once an hour, only with the
autopilot on, `s.autopilot === false` off; each rule its own side stream, `${seed}:hardship-<rule>:${tick}`):
- **Fevers in a crowded, dirty town** (`fevers`): no fever in a town of fewer than `FEVER_FROM` (5) at home, nor in its
  first `FEVER_FROM_DAY` (6) days. The chance a day one breaks out is `FEVER_DAILY` (0.4) times the people over
  `FEVER_TOWN` (10) times `squalor(s)`: 1, plus `FEVER_BEDLESS` (2) times the share with no bed, plus `FEVER_NO_WELL`
  (0.6) with no well, plus `FEVER_WINTER` (0.6) in winter. One fever at a time breaks out; the fevered pass it to each
  person within `FEVER_NEAR` (2) cells at `FEVER_SPREAD` (0.015) an hour times the squalor. A fever (`Person.sick`
  with `fever: true`) lasts `FEVER_HOURS` (18–36) and takes `FEVER_HP_PER_HOUR` (2) an hour, half in a sickbed
  (`FEVER_TENDED`); a dressing halves what's left (the old `treatSickness`, as for the plague). Over it, they are spared
  another for `FEVER_SPARED_DAYS` (20; `Person.feverSpared`), so it burns out. Dies "of a fever". The Well's
  description now says clean water keeps fevers down. In a plague the plague's rules hold the sick (sim/doom.ts).
- **An event's sickness runs its course:** `sicken` from an event, a rite or a rat's bite set `Person.sick` with an
  end, but outside a plague nothing ended it, so it lasted (at `PLAGUE_WORK`) till a plague came. `fevers` now ends it
  when its time is up.
- **Festering wounds** (`fester`): an open wound (cut, bite or burn) at `FESTER_FROM` (0.3) or worse, on someone not in
  a sickbed and not downed, turns bad at `FESTER_CHANCE` (0.02) an hour, twice that with no bed (`FESTER_BEDLESS`). A
  bandage or poultice in store cleans it instead (used up). Festering (`Wound.fester`) takes `FESTER_HP_PER_HOUR` (2)
  an hour till it clears: `FESTER_CLEARS` 0.25 an hour in a sickbed, 0.06 asleep in a bed, 0.035 up and about. Dies "of
  a festering wound".
- **Winter** (`winter`): everyone at home eats `WINTER_APPETITE` (a quarter) more, so a thin store runs out sooner;
  someone asleep on the ground (`Person.cold`) loses `COLD_HP_PER_HOUR` (2.5) an hour, `WINTER_SNOW` (1.5) times that in
  snow. Dies "of the cold".
- **No mending meanwhile** (`noMending`, read by health.ts `heal`): with a fever, a festering wound, or cold on the
  winter ground, the body doesn't heal (the downed still do), so these kill the weak first: the hurt, the hungry, the
  frail.
- **The founder is laid low, never killed** (`harm`): their health stops at 1. An early run let hardship kill them,
  and seven of 24 towns ended, two on the first and third days to a fever in a tribe's camp: the player's character
  gone to a dice roll before they'd done anything. Raids and disasters can still kill the founder as before.
- Mood: "Down with a fever" (was "Sick with the plague" for any sickness).
- New optional fields (old saves load as they are): `Person.cold`, `Person.feverSpared`, `sick.fever`,
  `Wound.fester`.

Tried and dropped: `FEVER_DAILY` 0.3 with `FEVER_SPREAD` 0.04 over 3 cells and no immunity, and `FESTER_CHANCE` 0.03
(44 deaths per 100 a season, 7 towns ended, day-30 towns of 5.8 people, 11 dead of festering); the same fever with
festering at 0.02 (29.4 per 100, but the late town's fever ran through half the town).

Speed (`tools/perf-sim.mjs`, 3000 ticks of the late town): step 1.31 ms on main, 1.33 ms on the branch; two game days
flat out 4.2 s and 3.9 s (the machine's noise). Tests: `test/hardship.test.ts` (none with the autopilot off; squalor
by beds and a well; fevers in a crowded town and never in a small band; a fever's course, the strong getting over it and
the weak dying; it spreads near and not far; spared after; festering, a dressing cleaning it, no mending; the winter's
cold on the ground and not in bed, and the winter appetite; the founder laid low; no fever in a new camp's first days).
No existing test changed.

**Found on the way (not changed here):**
- CLAUDE.md says to guard a new system with `if (!s.autopilot) return;`, but `GameState.autopilot` is left out in real
  games ("On when left out"), so a system guarded that way never runs on the phone. Six do: `sim/chains.ts`,
  `sim/chase.ts`, `sim/delveFloors.ts`, `sim/kit.ts`, `sim/raidBoards.ts`, `sim/wages.ts`. The rest of the sim uses
  `s.autopilot === false`, as hardship does. The probes here and in smarter-town.md set `autopilot = true`, so they ran
  those six where the game doesn't. Worth a look by whoever owns them, and the line in CLAUDE.md.
- The calendar stands still during a fight on screen (`clockTick`), so 30 days of ticks is about 28 days of the
  calendar: a 30-day probe never reaches winter (day 31).
- The plague's 1.3 health an hour is less than an awake person heals (4), so it rarely kills; `noMending` isn't applied
  to it (plague is a disaster's own balance).

**What's left:**
- The winter's cold never fired in these towns (they house everyone). A town that grows faster than its homes would
  feel it; a probe of fast-growing towns into winter would show whether 2.5 an hour is right.
- Sickness is still a small share (no fever deaths in the final 24 towns, one plague; 7 festering). The plague's own balance (above)
  is the bigger lever if more sickness deaths are wanted.
- Leaner harvests and spoilage were not touched: no town went hungry in any run, before or after.
