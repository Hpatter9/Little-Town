## Cards, fights and the phone page polished (branch claude/cards-fights-polish)

Nine of the "Left" items of the playthrough of a new settler town (docs/notes/playthrough.md), fixed. Not done: the
cards piling up after a trip or a raid (the owner's call). Changes HISTORY.md "A recap after every raid" and "The great
creature" (the recap), "Sagas" (the creature saga's words), "Events told in full" and "Watching a party's fights" (the
cards' pictures, the side-on line-up), "The phone page" (the tabs, the header), "Developer mode" (the fill). Shots in
`docs/notes/cards-fights-polish/` (`*-before`, `*-after`, at 393x852 and 852x393).

### The God creature in the raid recap
- The creature fights as an ally raider (`Raider.creature`), so its blows were never tallied: "Daror fought best…
  killed one" when Fenn felled the rest. Now its blows are credited under its own tally key, `CREATURE` (-2, beside
  `TOWERS`), in `sim/raidRecap.ts`: `creditAlly(s, a, was)` at each place an ally strikes (the board's raider-on-raider
  blow and its spells, `sim/tactics.ts`; the plain raid's `allyAct`, `sim/raids.ts`; the trail, `sim/battle.ts`). Only
  counted: its blows lame no raider (`credit(..., legs = false)`), so fights play out as before.
- `RaidTally.felled` (kinds felled, the creature's only) and `RaidTally.from` (its health going out, `beastOut` from
  `creatureAllies`) give the recap's `BeastRow`: `name` ("Fenn the Wolf"), `dealt`, `kills`, `taken` (its wounds:
  health lost), `felled` in words (`felledWords`: "two bandits and a bandit archer"), `fell`, `died`. On
  `RaidRecap.beast`, with `beastBest` when it did more than any townsperson (by the same worth, harm + 25 a kill).
  `recap.best` stays the best townsperson (deeds, diaries and the dynasty read it). No row when it went out and never
  came to blows (a band that turned back).
- Told (`tellRaid`): "Fenn the Wolf fought best. It killed two bandits and a bandit archer and did 140 damage." then
  "Of the townsfolk, Daror fought best…"; or "Fenn the Wolf fought beside them, and…"; and its wounds: killed, beaten
  down and limped home, or "took 40 damage and stayed on its feet".
- The recap card (`battle/raidRecap.ts`): its row under the defenders (★ when best, "fell"/"slain"), a line of what it
  felled, a chip, and the strip's turning point ("Fenn the Wolf felled 5, and the line held.").
- Test: `beastRecap.test.ts` (the row, the words, fought best and not, beaten down, and a real raid on the board).

### Creature saga words that fit the town
- Saga text may hang words on the town as it is: `[[gardens:with them|without]]`, `[[children:…|…]]`
  (`sim/sagas.ts` `TOWN_HAS`, read in `sagaText`): gardens are a done field (`CROPS`) or any garden building; children
  are a `type: 'child'`. `data/creatureSaga.ts`: the first deed's "trampled cabbages" (and its three answers) become
  "churned mud and torn-up turf" without gardens; "the children climb on it" becomes "{founder} rides on its back",
  and the grown ending's "The children ride it on feast days" "It lets anyone ride it on feast days".
- Test: `sagaFit.test.ts`.

### Watch cards and the beast cards draw the beasts themselves
- A foe on a creature sheet (the wolves, boars and bears, the 48 px RPG Maker sheets; DawnLike's menagerie, `dawn`)
  now plays itself on a card instead of the scene's orcs or black werewolf. `panel/sceneFoes.ts` `creatureWho` gives
  the actor `cr:<sheet>:<block>:<scale>` (or the PixelLab side-on sheet for its kind when that is in: `MADE_FOR`,
  `pl_wolf` for the wolves and wild dogs, `pl_bear`, `pl_dragon` for the drakes and the wyvern); `parseCreatureWho`
  reads it back. The wyvern (recoloured only in Pixi) still can't be drawn on a card.
- `art/creatureSheets.ts` `sheetFrame`: where a frame lies on its sheet, side-on, and whether to mirror it (no Pixi;
  the same places `creatureFrame` cuts). `panel/scenePlayer.ts` loads the sheet and draws it at `CREATURE_CARD` times
  its fight-screen scale (as much bigger as the card's townsfolk are), feet on the ground (`SheetDef.feet`).
- The `beast` and `bear` scenes (`panel/eventScenes.ts` `WOLF`, `BEAR`) are the wolf and the brown bear from the
  creature sheets until the PixelLab sheets come.
- Test: `sceneFoes.test.ts` (rewritten: wolves and boars were "no card sheet draws" and kept the scene's own);
  `pixellabWiring.test.ts`'s bear check now expects the sheet's bear as the stand-in, not the werewolf.

### Card pictures follow their words
- `panel/sceneWords.ts` (pure): `skyOfWords` reads a card's title and text for the time of day (`TIMES`; the first
  named counts, and a night gone by, "in the night", "last night", is not now) and the weather (`WEATHERS`, the
  strongest first: storm, snow, rain, fog, wind, clear). `fitScene` sets them on the scene: a dusk or night backdrop
  (`BACK_TIME`, looked over one by one) traded for the same land by day (`BY_DAY`: forest_2 for forest_3...) when the
  words say morning; a wash (`WASH`) for dusk or night over a day one, and for the weather; what the weather hides
  taken out (`GONE`: no birds in a storm or at night) and what it brings added (`BRINGS`: rain, a flash, snow, mist,
  leaves and dust in the wind). Indoors (`set:`), the caves and the deep are left alone. Played in
  `panel/eventScenePlay.ts` for every event, road and watch card, on the title and the card's whole telling
  (`p.story`, which opens with the event's scene line, "A clear spring morning; the dew is still on the grass").
- Every line the events set their scene with (`data/eventScenes.ts` `sceneLine`) reads as its own hour and weather.
- The founder's story cards ("Maren's story: A raid survived", kind `debrief`) are pictured by their title
  (`debriefScene`, `DEBRIEF_SCENES`, the founder's name left out): a raid at the new `aftermath` scene (the palisade
  standing, the last smoke, the townsfolk at the gate), a marriage at the wedding, a child at the birth, a death or a new
  leader at the funeral, a title at the feast, a shop at the market, the founding at home; the rest on the road.
- Test: `sceneWords.test.ts`.

### Side-on fights: the foes' line-up
- `fight/fightView.ts` `drawFight`: the foes stand between the front, `FOE_FRONT` (0.42) of the width, and `FOE_EDGE`
  (26 px) in from the left edge, the spacing fitted to how many (40 px at most), two staggered rows without the extra
  half step (a crowd of more than 8 keeps its rows). Upright, where only 170 px show across, three orc grunts no longer
  pile at the left edge half off the screen under the DEV mark.

### The phone page
- **Tabs:** with the Dev tab the bottom bar has eight; upright their names were cut ("STUDIE", "MARKE", "ANNAL").
  `#tabs.many` (set with the Dev tab, `mobile/mobile.ts` `showDev`) makes the names 9 px with no side padding
  (`mobile/index.html`).
- **The header:** the town's name has its line to itself and shrinks to fit it (`ui/topBar.ts` `fitName`, down to
  `NAME_LEAST` 11 px, then wraps); the rank moved to the day's line ("Day 4 · Spring · a Camp"). Upright and sideways
  the whole name shows ("Chronos Settlement", was "Chronos …, a Camp").

### Developer mode's fill
- `sim/dev.ts` `fill`: the coins in full, but of food, wood and stone each only what the stores have room for, up to
  `FILL_UP_TO` (85%) of their room, under the line where the planner's `makeRoom` (90%) throws bulk goods away. Full
  stores get none ("the stores are full"). The ☰ list's button says "Fill the stores (+1000, what fits)".
- Test: `devMode.test.ts` (the old fill test given room for it all; a new one for the room).

### The canvas readback warning
- Not changed: the tap picking's canvases (`IsoView.alphaOf`, `baseOf`) already ask for `willReadFrequently` (since
  the iso taps change). A probe of the page (load, the town, taps on buildings) found no canvas read twice without it;
  the only console warning left is the headless GL driver's "GPU stall due to ReadPixels", during the main menu's
  art, from canvases read once each.

**Checked:** `npm run typecheck`, `npm test`, `npm run web`; the phone page at 393x852 and 852x393 before (the
playthrough branch's build) and after: `tabs-header-*`, `fight-*` (three orc grunts), `card-beast-*` (the wolves card
on a spring morning: the werewolf in a dusk wood before, a wolf in the wood by day after), `card-story-*` ("A raid
survived": the road before, the aftermath after), `card-storm-*` (the road's black cloud: sunny before, dark and
raining after).
