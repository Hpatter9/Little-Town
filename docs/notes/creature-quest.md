## The God creature comes sooner: a quest the founder leads

The owner's ask: "How do I get the creature? Should it be an explore quest? I want him to come sooner", and, asked
whether a quest or an earlier research topic, "a quest would be better for earlier access to him." Changes HISTORY.md
"The great creature" (how it comes, where it sleeps before its pen, what the research does) and the pen of "The God
creature, round two" (docs/notes/great-creature.md, god-creature-2.md). Files: `sim/creature.ts`, `data/creature.ts`,
`data/creatureSaga.ts`, `data/sagas.ts`, `sim/sagas.ts`, `sim/founderQuests.ts`, `sim/state.ts`, `sim/dev.ts`,
`data/research.ts`, `panel/buildPanel.ts`.

**When it comes.** `creatureArrives` (sim/creature.ts, hourly, autopilot only) no longer waits for the research or a
pen: from eight in the morning of the second day (`QUEST_DAY` 1, `QUEST_HOUR` 8, by the calendar: about 25 game hours,
25 minutes of play, into a new town), with the founder at home and no raid on, it begins the creature's saga (still
`great_beast`, apart from the others, once). A side stream (`${seed}:creatureQuest:${tick}`) picks the land the nest
lies in from `HOLLOW_FOES` (data/creatureSaga.ts: the Westwood, the Northern Crags, the Eastwood, the Southern Ridges),
kept in the new optional `GameState.creatureQuest` (`CreatureQuest`: `region`, `began`); `{wild}` in a saga's words is
that land's name (`sagaText`).

**The quest** (the saga's new first chapters, data/creatureSaga.ts):
- `call`: a trapper's word of a broken nest of the old God creatures in {wild}, the beasts of the woods circling it.
  "{founder} sets out to find it" (sets the flag `quest`) or "Not yet: ask again tomorrow" (`later`, 20 hours, then
  `call` again). The offer does not hold the game: it is not the founder's quest until they take it up, and a town left
  to itself must go on (a held offer stalled every hands-off test town on its second day). Unanswered in
  `SAGA_ASK_HOURS` (12) it is "not yet" (`default: 1`). The questions after it (the road's, the lineup, the first night)
  do hold the game.
- `search`: a trip chapter to **The Broken Nest** (a `clear` place on the board, `saga:<run>`), its foes the land's
  (`HOLLOW_FOES`: one wolf, one boar or one giant rat: a new town is often the founder alone, and two wolves beat a
  founder alone four times in six), `out` 75 s, 6 days. It is the founder's: trip chapters gained `lead`
  (data/sagas.ts), and `leadSagaTrip` (sim/sagas.ts) raises a party with the founder at its head (`leadTo`, the body of
  `leadQuest` pulled out in sim/founderQuests.ts) as the chapter opens, or the first hour after that the founder is home
  and on their feet. Its road questions wait for the player (`holdForFounder`), as on any trip the founder is on.
  Won: `nest`. Beaten: `beaten` (24 hours) and the quest is put again. Nobody went in 6 days: `later`.
- `nest`: the lineup of the five, as before (its words now follow the fight), the pick adopting the creature
  (`adoptCreature`) and the naming question. Picked on the quest (`quest` flag): `first_night`, a second choice that
  waits: sit up with it by the fire (nature +8, a lesson to follow the founder), tie it in the yard (nature -6, a lesson
  to guard), or let it roam (a lesson to wander). Then `young`, and the saga runs on as it did (its first deed, the test
  of its nature, its coming of age).
Played through on ten new towns, answering every question with its first option: home on the second day in six (the
trip takes about five game hours), the rest after a lost fight or two, by day 6.

**The pen** (`CREATURE_PEN`): open from the start, with no research (`research` dropped), and cheaper (24 wood and 8
stone; it was 30 wood, 12 stone, 4 hide) so a new town can raise it once the creature is home. Why from the start and
not with the quest or a topic: the creature is home on the second day, so a gate would stand for hours at most and only
add a rule; and a creature that dies before its pen must be able to get one. The build menu lists it only once the town
has its creature (`buildRows`, `!!s.creature` in `buildKey`), so a new town's menu isn't cluttered with it; the sim
takes the order at any time. The town still never lays it out itself.

**Before the pen** (`bedOf`): it sleeps on straw at the founder's door (the front of the founder's bed building),
or by the camp while the founder has no home, and comes there when it is adopted; its first notice says to build it a
pen (Build, Town). The player's Rest sends it there too.

**The research.** God Creatures (`great_beasts`, kept where it was) no longer brings it: studied, the creature grows
`TOPIC_GROW` (1.5) times as fast and a praise or scolding teaches it `TOPIC_LEARN` (1.25) times as much (its `unlocks`
line says so).

**Old saves.** A town whose creature came, or whose creature saga is under way or done, is left as it was. An old run
at `signs` or `trail` still reaches the lineup and goes straight on to `young` (no `quest` flag, so no first night). An
old town that studied the topic but never built a pen gets the quest now. `creatureQuest` is optional; without it
`{wild}` reads "the wild". The developer menu's "creature saga" begins the quest without learning the topic.

Tests: `test/creatureQuest.test.ts` (when it is offered, and that the offer doesn't hold the game, the founder leading the party, a
founder who can't go at once, "not yet", finishing it: the lineup, the naming, the first night, its bed without a pen,
the pen orderable at once; a lost fight; the research's growth; old saves; a new town played through with the creature
home by day 3). `test/creature.test.ts`, `creature2.test.ts` and `devMode.test.ts` changed where they said the research
and the pen bring it.

**For the owner** (decided here; say if you want them otherwise):
- The quest is put at 8 in the morning of the second day; the founder leads it, alone if nobody else will come. The
  offer itself doesn't pause the game (left 12 hours it is "not yet" and comes again the next day); the questions once
  the founder is out do.
- One beast guards the hollow; losing sends the founder home hurt and the quest is put again the next day.
- The pen is in the build menu once the creature is home, with no research, at 24 wood and 8 stone.
- The God Creatures study is kept, now for faster growth and better lessons.

Screenshots in `docs/notes/creature-quest/` (393x852 `-tall`, 852x393 `-wide`): the quest offered (`1-quest-offer`),
a road question on the founder's trip (`2-road-choice`), the lineup (`3-lineup`, `4-lineup-picked`), the first night
(`5-first-night`), the naming (`6-naming`) and the creature at home (`7-creature-home`).
