## A playthrough of a new settler town (branch claude/playthrough)

The changes of 0.219.0–0.225.0 played together on the phone build (`npm run web`, `out/web` in the pre-installed
Chromium, touch on), as the owner plays: a Forest town founded from the New town screen (Maren Holt, Lone Founder,
Normal), the tutorial, the first orders, the build menu, the studies, the creature quest from its offer to the pen, raids
watched, skipped and won, a delve and a skirmish on the side-on screen, about twenty game days in all (`__game.sim.step`
between looks; developer mode from day 5 for studies and instant building). Upright 393x852 and sideways 852x393. The
save was reloaded mid-game three times (after each rebuild) and the town went on from the same tick. Screenshots in
`docs/notes/playthrough/` (`*-before`, `*-after`).

Changes HISTORY.md "Fog of war"/"Fog that matters" (exploring), "Sagas" and "The great creature" (the quest's answers),
"Founder quests, the steward", "The quest board" (watch cards), "Events told in full", "The build menu: the founder
builds", "The ring wall", "Tactics battles" (the recap), "Shops", "The phone page".

### Fixed

1. **Explore greyed out in every new town.** The founder's Orders had all eight winds disabled from day 1, and the
   rangers and hunters never scouted. *Cause:* `exploreReach` (`sim/explore.ts`) was capped at `land.open`, which starts
   at `OPEN_START` 11, while `START_EXPLORED` lifts the fog 16 cells round the camp: no fog edge lay within reach until the
   town grew past radius 16. *Fix:* the reach is the town's radius + `EXPLORE_BEYOND` (18), past the open land; the fog
   edge no longer needs the cell to be open, only walkable. Test: `fogRules.test.ts` (a new town's winds open).
   Shot: `explore-greyed-before-393x852`.
2. **The tutorial said the town picks research**, and called the spade a pickaxe (`mobile/tutorialSteps.ts`): now
   "Nothing is studied until you choose." and "The spade clears trees, rock, stumps and ruins."
3. **The Clear land banner lay under the news button and the stores readout** (upright: "and ruins" under the readout,
   the NEWS button over its left end). `#banner` in the strip now sits at `top: 44px` both ways (`renderer/index.html`),
   as it already did sideways; the question card (`#prompt`, a raid's toll) the same, its title was under the readout.
   Shots: `clear-banner-before-393x852`, `clear-banner-after-both`, `toll-card-under-readout-before`.
4. **"The standard was lost in the last raid" on day 2, before any raid.** Three events speak of the last raid
   (`w_captured_standard`, `w_veteran_tale`, `w_war_trophy`, `data/moreEvents4.ts`); they now need `raided` (new in
   `data/eventKit.ts`: a raid's recap is kept). Test: `playthroughEvents.test.ts`.
5. **"The shop's renown +2" in a town with no shop** (the `renown` effect, `sim/events.ts`): told only when there are
   shops ("the shops'" for several). Test: `playthroughEvents.test.ts`.
6. **A road question's card showed three strangers, not the party** (`panel/eventScenePlay.ts`): the cast was drawn from
   the people at home, and a party on the road is away. A question put to someone away is now played by those away with
   them (their `away`).
7. **Every party fight's card ("A battle at …") showed two orcs**, whatever was met (a boar, rival tribesmen). The
   prompt now carries its foes (`Prompt.foes`, `PromptView.foes`, `sim/watchAsk.ts`, most first) and the card plays them
   (`panel/sceneFoes.ts`, pure: `foeSheets`, `withFoes`): a foe with a pack sheet the card can play (the Craftpix and
   Legends of the Fall sheets: ogres, orcs, imps, demons, the Lich Lord…) as itself; a foe who is a person as an outsider
   in a person's look (the stranger places); DawnLike's wolves and boars keep the orcs (below). Test:
   `sceneFoes.test.ts`. Shots: `watch-card-orcs-for-a-boar-before`, `watch-card-tribesmen-as-orcs-before-852x393`,
   `watch-card-tribesmen-as-people-after`.
8. **Adopting the creature, naming it and its first night each said "Nothing more came of it."** The saga's `creature`
   and `creatureTeach` effects (`sim/sagas.ts`) said nothing, and a naming set no outcome (`sim/naming.ts`). Now: "the
   young wolf is the town's now", "it takes to keeping at the founder's side" / "it learns to leave eating crops",
   "The God creature is named Fenn." (`named`), and keeping the name "The name it has stays." Tests:
   `creatureQuest.test.ts`, `creature2.test.ts`. Shots: `creature-pick-nothing-came-before`,
   `creature-naming-nothing-came-before`.
9. **"…quick to bare its teeth.. The first night home"**: a saga's logged answer added a full stop after one
   (`answerSaga`). Test: `creatureQuest.test.ts`. Shot: `first-night-double-stop-before`. The same in the event box's
   advice line ("The council would hear them out..", `mobile/eventSheet.ts`). Shot: `advice-double-stop-before`.
10. **The creature naming card showed a watchman on a gate** (the raid warning, found by its words): a naming now plays
    the `home` scene (`panel/eventScenes.ts` `sceneFor`). Test: `eventScenes.test.ts`.
11. **A fourth card after a three-hour trip: "While you were gone. Maren Holt is home after a day. Nothing much
    changed."** (`sim/steward.ts`). A trip under a day is told in hours, and with nothing changed it is a line in the
    news, not a card. Test: `founderQuests.test.ts`. Shot: `while-you-were-gone-before`.
12. **The creature's Praise/Scold card lay over open menus, the raid board and the recap's Back to town** (the page's
    `#beast-ask`): hidden while a menu, a fight, a scene or the event box has the screen (`mobile/index.html`), and while
    a page or strip card (a recap, a reveal) is up (`mobile.ts`, `cardUp`). Shots: `recap-praise-card-over-before`,
    `recap-praise-card-after`.
13. **The creature menu's Rename box (and a building card's name box) was white** in the dark menu: given the menus'
    input colours (`panel/townsfolkPanel.ts`, `panel/cardsStyles.ts` `.bc-name-form input`). Shot:
    `creature-menu-light-input-before`.
14. **The creature stood on the raid board as "God Wolf"**, not its name (`tacticsView`, `sim/tactics.ts`). Test:
    `tactics.test.ts`. Shot: `raid-board-creature-named`.
15. **"Raise the palisade" could be ordered before the Palisades study**: the order was taken and nothing ever came of
    it (two days here). The build menu lists the wall only once the palisade is known (`panel/buildPanel.ts`, `known`),
    and the sim refuses `orderRing` with "Can't order that: the palisade isn't studied yet." (`sim/sim.ts`, `bestWall`).
    Test: `buildMenu.test.ts` (changed: the order is refused first, then taken once studied).
16. **A raid's recap missed what spells and skills did**: "1 stood against them", only Daror, after four townsfolk
    fought a cave bear. On the board only plain blows were credited; `cast` (`sim/tactics.ts`) now credits the caster
    (`credit(…, legs = false)`: counted, but a spell doesn't lame a raider's leg, which stays a blow's). Kills by spells
    now count to the caster's felled and deeds too. Test: `mana.test.ts`.
17. **"The new town is still standing" began lower-case** ("…All 3 were killed. the new town is still standing.",
    `sim/story.ts` `storyRaid`). Test: `founderQuests.test.ts`. Shots: `raid-story-lowercase-before`,
    `raid-story-capital-after`.
18. **The shop's log told fractions: "bought a Flint Knife to order… (21.832 coins)"** (market prices): the shop's and
    tavern's lines, the keepers' memories and their cut are told in whole coins (`sim/shop.ts` `paid`,
    `sim/ambition.ts`); the sums themselves are unchanged. Test: `shop.test.ts`. Shot: `shop-log-fraction-coins-before`.
19. **A tap on a building in the lower half of the screen showed no card** (upright: the right-hand longhouse, tapped
    on its roof). *Cause:* a ghost click. The tap opened the card, which comes up over the lower half, and the browser's
    own click after the touch landed on the card's ✕ now under the finger. Clicks on the card in the first 400 ms after
    it opens are dropped (`mobile.ts`, `GHOST_CLICK_MS`); any button there (Demolish… too) was at risk. Shots:
    `tap-ghost-close-before-393x852`, `tap-ghost-close-after-393x852`.
20. **A building's tap card stayed over the side-on fight screen** (a delve watched): it stands aside while a fight, a
    scene or the event box is up (`mobile/index.html`) and comes back after. Shot: `tap-card-over-fight-before`.

### Seen working
The New town screen, the tutorial's eight steps; the build counts ("1 built · 1 queued"), a queue of 13, cancelling
one by its number; research waiting for a pick with the gold dot and the notice; the creature quest on day 2 at 8 am
(offer, the road question, the nest fight watched on the side-on screen, the lineup, the pick, naming by typing, the
first night, the creature at the founder's door, the pen built from the menu and its People › Creature tab); a raid
skipped (it finished, then the story card, the "first" reveal, the recap, Back to town: the game went on), a raid
watched on Auto to Victory, a Cave Bear raid; the Legends foes (Ogre, Orc Grunts) on the side-on fight screen both ways;
taps on the packed centre (shrine behind a longhouse, the trading post's stall, the longhouses); the walled town with
its gate torches by night, the stockpile heaps, festival banners; a stump's card and "Clear it"; reloads.
Shots: `legends-foes-fight-*`, `nest-fight-side-on`, `creature-pen-night`, `town-*`, `stump-card`.

### Left (needs the owner's say, or bigger)
- **After a trip or a raid the cards pile up.** The nest trip ended in the lineup, "A quest won", "Home from the Broken
  Nest" (the same haul again), the naming, the first night and the "party is home" reveal (the haul a third time). A
  raid: "A raid survived", a "first" reveal, then the recap. Merging them is a design call.
- **Watch cards for DawnLike foes** (wolves, boars, bears) still show the orcs: the card player draws only pack sheets
  and people; drawing a DawnLike creature frame on the card's canvas is new work (the "beast" card has the same gap,
  docs/notes/map-looks.md).
- **The recap leaves out the God creature**, which often fells most of the raiders ("Daror fought best… killed one"
  when Fenn killed the rest): it isn't a person, so it has no row. A row for it is a recap design change.
- **Road and story cards' pictures don't follow the words**: "Black cloud comes down… the wind gets up" over a sunny
  meadow; "A raid survived" on the road scene.
- **Creature saga words that assume a grown town**: "trampled cabbages" with no gardens, "the children climb on it"
  with no children.
- **The developer menu's "+1000 each"** mostly vanishes in a small town: what won't fit is put in the first store, and
  the planner's `makeRoom` throws the bulk over 90% full away within the hour (stone 1036 → 36). Working as written;
  the dev fill might want to stay under the stores' room.
- **The dev tab squeezes the tab labels** upright ("STUDIE", "MARKE", "ANNAL").
- **Sideways and upright side-on fights crowd three foes at the left edge** (two orc grunts overlap, half off screen
  upright, under the DEV mark).
- **Canvas readback warning** in the console: the tap picking's alpha reads (`iso/artPick.ts` via `IsoView.alphaOf`)
  would like `willReadFrequently` on its canvas. Only a performance hint; not changed.
- **The header truncates the town's name** upright ("Chronos …, a Camp", "Shield …, a Hamlet").

**Checked:** `npm run typecheck`, `npm test`, `npm run web`; the fixes seen in the rebuilt phone page at both sizes.
