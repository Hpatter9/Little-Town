## The great creature

The owner's ask, after Black & White: a creature that learns, has feelings and needs, works with the townsfolk, can be
good or evil, grows, and changes colour by its nature; five kinds that every people can have, coming a little later in
the game.

**How it comes.** A second-age topic, **Great Beasts** (`great_beasts`, agriculture, medieval, after Animal Husbandry;
`CREATURE_TOPIC`), in `data/research.ts`. No people forgoes it (`data/originResearch.ts`: none lists it). Once it is
studied, `creatureArrives` (sim/creature.ts, hourly, autopilot) begins the saga **The Great Beast** (`great_beast`,
`data/creatureSaga.ts`): signs (two waits), a broken nest with five young beasts and the player's pick (`{ creature:
kind }`), its first deed (praise or scold teaches it: `{ creatureTeach }`), a test of its nature (spare a scout or let it
kill: `{ creatureAlign }`, or let it choose by its own rating), and its coming of age (a task: grown to 0.6, or dead),
ending in a title for the founder (Beast-Friend or Beast-Master) or ruin if it died. Its questions `waits` (data/sagas.ts
choice chapters gained `waits`): the game is held until they are answered, like a question on the founder's own trip.
The saga is **apart** (`SagaDef.apart`): it is begun only by its system, never drawn, is kept out of `SAGAS` (only in
`SAGA_BY_ID`), and does not count against `MAX_SAGAS` or the gap between sagas, so the other sagas go on beside it.
`{beast}` in a saga's words is the creature's name.

**The pick as a lineup** (the owner's ask: "all five in a row standing idle; when you click on one, it steps forward
out of the lineup and does an action move; the details show up below it"). The nest's question carries `beasts`
(`Chapter.beasts` → `Prompt.beasts` → `PromptView.beasts`; its options are the kinds in `CREATURE_KINDS`' order), and the
phone's event box (mobile/eventSheet.ts) draws it with `mobile/beastLineup.ts` instead of option buttons: the five stand
idle in the clearing (the question's picture) on one canvas; a tap walks one forward out of the line (`STEP_MS`, drawn
`NEARER` bigger, the rest put in the shade), then it plays its move (`MOVE_MS`: the wolf and the bull their strips' attack
rows with a lunge, the bear rears up, the golem stamps and raises dust, the ape spins and hops) and settles idle in front.
Its card shows in the box's body: name and title, two lines of what it's like (`title`, `flavour`), bars for learning,
strength, temper and appetite (`kindStats`), what it's best at and needs most (`goodAt`, `needsMost`), and Choose, then a
second step to confirm (the pick is for good) or look again. Tapping another sends the first back into line. The
pictures are the strip's own sheets, lent to the page (`__sheetOf`, main.ts), so the page carries no copies; the box is
drawn again once they're there. It holds the town like any question that waits. When the kinds' own art comes, it is
read from the same `look` and the same moves (idle, walk, attack).

**The five kinds** (`CREATURE_DEFS`, data/creature.ts): the **Ape** learns fastest (`learn` 1.8; play, healing, the
fields; craves company, steals), the **Wolf** hunts (and guards; hungry, quick tempered), the **Bear** guards and fights
(sleeps long, likes the crops), the **Bull** hauls (and ploughs and builds; short temper), the stone **Golem** builds
(eats stone, slow to learn and to anger). Each has `strengths` (a deed's weight and work multiplied), need rates
(`hunger`, `rest`, `play` a game hour), `temper`, `hp` and `attack` when huge, and `eats`.

**Its life** (sim/creature.ts, `s.creature`, optional: old saves have none). Every game hour with the autopilot on
(`creatureTick` → `creatureHourly`), on its own side stream (`${seed}:creature:${tick}`):
- needs run down (`needsHour`); neglect (a need under `NEGLECT_AT`) and hunger raise `anger`, a raid and wounds `fear`;
  `moodOf`: afraid, angry, lonely, bored or happy;
- it chooses a deed (`chooseDeed`, by `deedWeight`): the deed's `base`, its kind's strength, the mood (`MOOD_BEND`:
  angry and bored turn to misdeeds, happy to work), its needs (hungry: eat, or the crops and stores), its nature (a
  good beast leans to good deeds, a cruel one to cruel) and what it has learned: × 2^weight;
- the deed is done (`doDeed`): **haul** (wood and stone into the stores), **build** (a blueprint's progress, never past
  what's been delivered: the builders finish it), **guard** (at night: everyone's spirits), **hunt** (meat, sometimes
  hide), **farm** (a growing field's growth), **play** (the children's spirits), **heal** (a hurt person's health); or
  **eat_crops**, **steal** (eats from the stores), **scare** (someone's spirits), **eat_villager** (kills a grown-up
  who isn't the founder; only for a cruel beast, or a starving raging one, and never in a town of four or fewer);
  **eat**, **sleep** (`SLEEP_HOURS`), **wander**. Work is worth more the bigger it is (`sizeShare`).
- its good or evil rating (`align`, -100 to 100) moves by the deed (`CREATURE_DEEDS[d].align`), never by praise.
- a notable deed is asked about (`ask`): a small Praise/Scold card. Unanswered in `ASK_HOURS` (4) it counts as neither;
  asks are `ASK_GAP_HOURS` (3) apart so a card doesn't come every minute. `teachCreature`: praise moves the deed's weight
  up `LEARN_STEP` (0.5) × the kind's `learn`, scolding down, within ±`LEARN_MOST` (3); praise is attention (play),
  a scolding angers it a little.
- it grows from `BORN_SIZE` (0.1) to 1 over `GROW_PACED_DAYS` (24) paced days (`DANGER_PACE`: about sixty days of the
  game), a third as fast when hungry; health and blow by `sizeShare`. Starving it loses health (`STARVE_HP`) and dies.

**The player's part**: the command `{ type: 'creature', op: 'feed' | 'rest' | 'praise' | 'scold' }`
(sim/commands.ts). Feed takes `MEAL` food from the stores (stone for a golem); rest sends it to sleep by the camp.

**Raids** (phase 4). `creatureAllies` (from raids.ts `startRaid`, after the ranch's guards) puts it in as an ally unit
`beast_<kind>` (`CREATURE_ENEMIES`, merged into `ENEMIES`, drawn `BOARD_SCALE` 1.8× its map size: a big unit on the
tactics board), its health its own, its blow by `might` = `sizeShare`. Below `HIDE_HURT` (a quarter) of its health it
stays home. `creatureRaidOver` (from `endRaid`): it keeps the health the fight left it; beaten down it dies at
`RAID_DEATH` (0.2), else comes home at 15% and afraid. The fight is a deed (good, and asked about). While it fights the
map leaves it to the raid's drawing (`CreatureView.fighting`).

**Seen.** `snapshot.creature` (`creatureView`). `map/mapCreature.ts` draws it in the iso view's things (moved onto the
diamonds by `placeLoose`): its kind's stand-in (`CREATURE_DEFS[k].look`: the snow ape `snowmonkey` block 0, the white
werewolf `werewolf_white`, the brown bear `bear` block 0, the minotaur `minotaur_1`, the stone golem `golems` block 1; all
already in the game and credited), scaled by `drawScale(size)` (0.9 to 2.5 a person's height), tinted by
`creatureTint(align)` (white in the middle, to `TINT_GOOD` gold, to `TINT_EVIL` red-black); a good beast is also
brightened (a ColorMatrix filter, set only when it changes by a tenth) and stands in a gold aura, since a tint only
darkens. A "?" bobs over it while a deed waits on an answer. Tapping it opens its card (main.ts `creature` hover;
`map/creatureCard.ts` lines: kind, age, size, health, an evil-to-good bar, mood and doing, needs, what it has learned to
like and shun, the deed waiting) with Praise, Scold, Feed, Rest. The Praise/Scold card on the phone is on the page
(mobile/mobile.ts, `createBeastAsk` in overlayUi.ts; the strip is drawn at twice size), and stands aside while a tap card
is up; on the desktop it is in the strip. The Townsfolk menu has a section, **The great beast** (in the People tab:
`GROUPS`), with its card, bars for its needs, and the buttons.

**Its own art, later.** The PixelLab sheets go in `src/renderer/art/iso/creature/<kind>/` (ape, wolf, bear, bull,
golem), laid out like `art/iso/folk/`. To use them, swap `look` in `CREATURE_DEFS` for the new sheets (and the board
unit follows it), keeping the tint and `drawScale`.

Tests: `test/creature.test.ts` (the topic, the saga and its held pick, learning, nature and tint, growth, needs and
moods, starving, the player's commands, work, raids, old saves).

**For the owner** (decided here; say if you want them otherwise):
- The research is in the Agriculture lane after Animal Husbandry, called Great Beasts.
- The pick holds the game, and so do its two later questions (first deed, test of its nature); waiting chapters don't.
- The creature's saga runs beside the other sagas rather than blocking them.
- Asks come at most every three game hours (three minutes of play) and lapse after four.
- It eats a villager only when cruel (rating under -40) or starving and raging, never the founder or a child, and only
  in a town of more than four. In a raid it dies at one chance in five when beaten down; it can also starve.
- On the raid board it is drawn untinted (the board draws foes by kind); its colour shows on the map and its card.
- The stand-ins: a brown snow ape for the Ape and the pale werewolf for the Wolf, picked because the tint shows on
  them.

Pictures (phone sizes, 393x852 and 852x393) in `docs/notes/great-creature/`: the saga's start in the news, the pick,
the pick's lineup (upright and sideways, the wolf lunging and stepped forward with its card, the confirm step), the beast
young and good and huge and cruel on the map, side by side close up, and its card.
