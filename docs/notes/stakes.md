## The stakes: an expedition is a bet, a fateful choice is remembered (changes HISTORY "Sending a party yourself", "Expedition stakes", "Fateful events", "Events told in full")

The two levers the player has, made weighty. No new controls: the existing send flow and the event box are richer.

**The stake card** (`src/shared/sim/stakes.ts`, drawn by `panel/musterPanel.ts`). On the sheet for raising a party,
above the roster: the odds in words, the party's portraits (the leader in gold), "They seek" (the errand, likely finds,
a bounty, a quest on the place), "The town risks" (the lives with their levels, the pieces of gear that go with them,
the food packed, any purse) and how long they'll be gone, then one warning line. `musterView().stake` is the card
(`stakeCard`). The odds are worked out, never drawn: `homeShare(ratio)` is the share of the party expected home, a
logistic in the party's strength over the place's danger (`HALF_AT` 0.7, `STEEPNESS` 3.2; a bold trip counts the danger
`BOLD_DANGER` 1.25 times, as `oddsLine` already did); the words are the bands of that share (`ODDS_WORDS`: Sure to come
home, Likely to return, A hard road: some may fall, Half may not come home, Most may not come home, They go to their
deaths; a place with nothing to fight reads "Nothing to fear but the road"). `oddsWordFor` is the only place a word is
chosen, and `test/stakesCard.test.ts` checks the word is only said inside its band at every ratio. The warning
(`warningFor`): the founder goes, else a favourite goes (`favouritesOf(s)` reads `s.favourites?: number[]` from
claude/favourites if present; none is added here), else the leader. The leader's own quote (`oddsLine`, `ODDS`) is
unchanged.

**The homecoming** (`sim/muster.ts` `debrief`, `Prompt.debrief`, `PromptView.debrief`). The result prompt now carries
`Debrief`: who came back (with a word on how: a level, wounds, carried in), who did not, and the haul. The title says
how many came home ("The Ruined Keep: 3 of 4 came home"). `mobile/eventSheet.ts` `debriefBlock` leads with "Came
home" (portraits), then "Did not come home" (a red panel with ✝), then "What they brought". **The haul sits in
`.debrief-haul` with `data-slot="loot-reveal"`: that is the place for claude/reveals' item-by-item reveal**; for now
it lists the haul plainly. `comeHome` (sim/expeditions.ts) sets `s.homecoming` for a commanded or watched party, and
`snapshot.homecoming` makes `main.ts` centre the camera on the gate they come in at, once (`homecomingSeen`), when
the player is not on a watch screen.

**Fateful events, rarer and bigger** (`data/fatefulEvents.ts`). `FATEFUL_GAP_DAYS` 4 to 10 and `FATEFUL_WEIGHT` 6 to 3
(about one fateful event in ten, a town meets one every couple of weeks). Five new events, each with a delayed
consequence (`later`): `stranger_at_the_gate` (a stranger named heir, `s.heirId`, who `heirOf` prefers; hunters
follow, then a lord pays), `hollow_tithe` (good years, and a life at the end: `later` kill of the event's person),
`shrine_in_the_wood` (a god's favour moved, a wayside shrine laid down, a blessing lands), `warlords_oath` (a peace
now, a call on the town's coin and young later), `the_deep_well` (learning and gems, then sickness). New effects in
`eventKit.ts`/`sim/events.ts`: `adopt(type)` and `favour(god | 'all', by)`. `FATE_LATER_DAYS` (21) is how long a
fateful consequence may take to land (the all-answers test waits that long for fateful events, 3 days for the rest).
`EventDef.remember` is how the Chronicle names a choice.

**Remembered** (`sim/fates.ts`, `s.fates?: Fate[]`, at most `FATES_KEPT` 40). `answerEvent` records a fateful answer
(day, title, the answer, what came of it at once: the effects' lines plus notes and deaths) with `recordFate`; a
`later` met under it carries `fate` (the tick answered) and `fateLanded` adds the consequence line. A fateful answer
is resolved on its own stream `new Rng(hashSeed(`${seed}:fates:${tick}`))` (`fateRng` in sim/events.ts), so it draws
nothing from the town's. `snapshot.annals.fates` feeds a "Fateful choices" section at the top of the Chronicle's
Heroes tab (`panel/heroesPanel.ts`; folded by `foldSections`, its entries keyed into the Chronicle's redraw key in
`panel.ts`): "Day 34: the night you let the stranger in", the answer, the result, and "Later: ..." (or "the
consequence has not landed yet").

**The event box** (`mobile/eventSheet.ts`, `mobile/index.html`). `Prompt.fateful`: `#event-sheet.fateful` has a frame
2.4 cuts thick (the 0.133.0 `--ui-cut` variable, with the `ui-frame-big` class on the body), a vignette on the picture,
a centred title, and a reveal: the title, then the telling a paragraph at a time (300 ms apart, each step 380 ms), then
the answers, which cannot be tapped until they're there. Nothing moves with reduced motion.

Tests: `test/stakesCard.test.ts` (odds words in their bands, a bold trip reads worse, the card, the result's parts, the
fateful rate constant, fate recording and its own stream, the bargain and the shrine); `test/events.test.ts` (the event
count is 567; the all-answers test waits `FATE_LATER_DAYS` for fateful events; the let-it-burn test varies the seed,
since a fateful answer no longer takes its dice from the stream passed in).

**Checks.** `tools/sim-hash.mjs`, before to after. 6 days: the late-town fixture 9803566bfd19 (unchanged: it runs with no events), settlers 41304b3d20b4 to 96ba0eda5025, knights e92bb1b03214 (unchanged), vampire 9844858b381f to 8e33bd79c9d1, dwarves 3db54df8a874 to 9d60d32c0266. 20 days: fixture unchanged; settlers 267ab49a06cd to 9bdcb177f697, knights de8465d020e3 to 3606de46d237, vampire 1a3b3ebe1de3 to fb5ff738fdde, dwarves d3ec56f098b9 to 637712daf992. The moves are the fateful events' rate (a fateful event now comes later, so the town's events differ from the first one on) and their stream (a fateful answer no longer draws from the town's). `tools/soak.mjs 40 2 settlers,vampire`, before to after: settlers deaths 7.0 to 10.5 (people 13.0 to 8.0), vampire deaths 6.5 to 5.5 (people 6.5 to 8.0), none wiped out: the deaths did not collapse. Phone screenshots (393x852 and 852x393): `docs/notes/stakes-shots/` (the fateful box, the stake card, the homecoming).
