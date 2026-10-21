## Titles that take longer, come in many kinds and say how they were earned (branch claude/titles)
Changes the HISTORY.md section "Titles from deeds" (raids and deeds): the ladders there now ask for more, and there
are many more titles beside them.

- **Slower.** `DEED_STEPS` (data/deeds.ts) names how many of each deed every ladder title takes, about two and a half
  times what it did (raids defended 2/6/15 -> 5/15/40, buildings raised 5/15/40 -> 12/40/100, pieces made 10/30/80 ->
  25/80/200, lives tended 3/10/25 -> 8/25/60, topics learned 3/8/20 -> 8/20/45, bosses 1/3/6 -> 2/5/10, dungeons
  1/3/6 -> 2/5/10, sagas 1/3 -> 2/5, beasts 3/10/25 -> 8/25/60, bouts 1/4/10 -> 3/10/25, sneaks caught 2/6/15 ->
  5/15/35, campaigns 1/3/6 -> 2/5/10). `ORIGIN_TITLE_AT` (sim/annals.ts) lifts the origin titles (Redfang, Paragon...)
  from 3/8 raiders felled or 5/12 trips to 10/30 and 15/40. Titles already held are kept (nothing takes one away).
  Measured on `test/fixtures/late-town.json.gz` for 10 days (`node tools/titles-rate.mjs 10`): before, 52 new titles
  across 53 people (5.2 a day, 14 kinds, mostly "Wall of the Town", "Raiser of Halls", "Shield Bearer"); after, 20
  across 37 people (2.0 a day). The two runs part ways early (titles feed `famous`, house strength and line renown,
  so the town's course changes), so read it as the rate, not a like-for-like. The fixture's people carry no tallies
  yet, so the new character titles barely show in it; they build up in towns played from here on.
- **Many more kinds.** `data/titles.ts` (`TITLE_RULES`, about 90): each rule is a `when` over `TitleFacts` and a `why`
  line. Fighting by foe kind (Wolfbane/Packbreaker, Bandit-Breaker, Gravewarden, Beastslayer, Ratcatcher, Drakeslayer,
  Giantfeller, Rustbreaker, Spellbreaker, Warbreaker; the Slayer, the Reaper), the body (Ironhand for a fitted
  prosthetic hand or arm, the One-Eyed, the Blind, Peg-Leg, the Armless, the Scarred), harvests (Green-Fingered,
  the Harvester, Lord of the Furrow), mixed crafts (Jack of All Trades, the Bookworm, Hammer and Tongs, Wound-Binder),
  roads (Far-Walker, the Wayfarer), love (the Twice-Wed, the Thrice-Wed, the Widowed), and misfortune and failings:
  the Unlucky, the Battered, Nine Lives, Death-Dodger, Sticky-Fingers, the Cutpurse, Knuckles, the Vandal, Bloodhands,
  the Jailbird, the Pardoned, the Sulker, the Sot, the Hothead, the Runaway, and from traits and natures the Coward,
  the Idler, the Glutton, the Hermit, the Grudging, the Miser, the Dreamer, the Faithful, the Merry, the Bold, the
  Gentle, the Rich, the Stay-at-Home. Each people has its own, gated on `s.origin`: Truesworn / Paragon of Vows /
  Oathbreaker (knights), the Returned / Grave-Walker (liches), Bloodletter / Night-Stalker / the Pale (Blood Court),
  Greenwarden / Beast-Whisperer (druids), Trickster / Glamour-Spun (fae), Transmuter / Burnt-Sleeves (alchemists),
  Prime Unit / Faulty Unit (machines), Stonewright / Ironbeard (dwarves), Tide-Walker, Far-Rider, Moon-Scarred /
  Fang-and-Claw, Skull-Taker / Warlord's Bane, Homesteader. All thresholds are in `TITLE_AT`; no one holds more than
  `TITLE_MOST` (8) of these, and the young are forgiven the unflattering ones (`TITLE_AT.lived`, a level).
- **Built from what they did.** `Person.tally` (new, optional) is counted by `tally(p, key, n)` (sim/deeds.ts) where it
  happens: `slain:<foe kind>` (raidRecap `credit`), `wounds` (`woundPerson`), `downed` (health.ts), `wed` / `widowed`
  (social.ts), `crime:<kind>` and `pardoned` (politics `trial` and its sentence), `break:<kind>` (breaks.ts), `reaped`
  (farming.ts), `vows` / `vowsBroken` (chivalry.ts), `risen` (`tryRevive`), `gathered:<kind>` (a feast, rite... via
  `gather`). Lost parts, fitted prosthetics and scars are read from the body.
- **How it was earned.** `Person.titleWhy` (title -> a sentence) is written when a title is won, for the new ones, the
  deed ladders ("Buildings raised: 12.") and the origin titles. `PersonView.titleWhy`; the person card shows the latest
  one under the chips and the Background tab lists every title with its line.
- **Rules.** `sim/titles.ts`: `titleFacts`, `earnedTitles`, `awardCharacterTitles` (hourly, from `annalsHourly`; only
  with the autopilot on; no dice, so the same record earns the same titles). Old saves just have no tallies. Tests:
  `test/titles.test.ts`. `test/planner.test.ts` now runs seed `lone-1` (the old `lone-6` town, a chaotic single run,
  fell to one person once the early honours came later; 1, 2, 4, 7 and 8 all still grow).
- Tool: `tools/titles-rate.ts` (run by `tools/titles-rate.mjs`) counts titles won in the late-town fixture.
