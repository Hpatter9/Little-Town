## The map's looks: feet on the ground, live fires, the stockpile filling, the stockade, sleeping rough, the event cards

Six of the owner's notes from playing on the phone. Renderer only: no rule of the simulation changed, nothing new in
`GameState`. Changes the HISTORY.md sections "Isometric townsfolk", "The isometric view, begun" / "The iso town, filled
in" (props, lights), "Stockpiles that match the stores" (in "The town comes alive"/"work you can see"), "Sleeping
rough", "Real light" / "Light that's stopped" (the flicker), "The soundscape" and "Events told in full" (the cards'
scenes). No PixelLab generations were spent; no new pack sprites were copied in except one crop (below).

**1. Feet on the ground ("are they walking up off the ground? I see a shadow down low").** The PixelLab sheets are
padded round the figure (`tools/pixellab/assemble_folk.py` `PAD`), so a grown look's feet stand 29 px up its 156 or
148 px frame, a child's 36; the map anchored the sprite at the frame's foot, so everyone stood about 16 world px above
their shadow (the raid board alone had the old `BOARD_FEET` drop). `iso/folkRules.ts`: `FOLK_FEET` (29),
`CHILD_FEET_LIFT` (now 7, was 11), `feetAnchor(frameH, child)`; `iso/folkSprite.ts` anchors at the feet, and
`map/mapPeople.ts` drops `BOARD_FEET` (the same anchor now serves the board). The founder's crown and ring follow:
`iso/founderMark.ts` `markOverFeet` (lifts from the feet; the ring on the spot). The God creature was already right
(`map/mapCreature.ts` `SHEET_FEET` 0.82 = 28 px up, measured 28). Test: `test/folkFeet.test.ts` decodes the sheets
themselves and checks the feet against the constants. Close-up: `map-looks/closeup-feet.png`.

**2. Crackling fires ("a crackling fire with a flickering light").** `iso/fireLook.ts` (pure): a hearth's painted flame
is cut out of its own kit piece (`FLAME_BOX`, `flameBox`: the settlers' campfire measured, others guessed from the
piece's upper middle) and laid back over it, stretched, narrowed, leaned and brightened on the flicker's smooth noise
(`tongueAt`), with a warm additive glow that wavers by day and more by night (`hearthGlow`) and `EMBERS` (4) rising
off it (`emberAt`, `EMBER_LIFE`, `EMBER_RISE`). `iso/isoView.ts` `setHearth`, `animateHearth` (`DrawnBuilding.hearth`,
faded with the picture by see-through). The campfire is now the `hearth` role (`iso/isoKits.ts` `ROLES`; it was drawn
as a stockpile, with crates beside it and no flame light), so it also gets the flickering night light. Sound:
`isoSounds.ts` `HEARTH`, `hearthLevel`: every finished campfire, storyteller's circle, bonfire or brazier crackles where
it stands (louder near the middle of the view and after dark), on the existing fire bed and crackle in `ambience.ts`
(before, only the camp itself in view did). Test: `test/fireLook.test.ts`.

**3. The stockpile.** Why the built one changed: once finished, `map/mapStockpile.ts` hid the iso piece (`artHidden`)
and drew the old top-down heaps (the chores pack's barrels, carts and crates) in its place. That class is gone; the
iso view keeps the kit's `stockpile` shelter and lays the settlers kit's own `woodpile`, `rocks`, `hay_bales`,
`barrels` and `crates` beside it by what it holds (`iso/isoTown.ts` `stockHeaps`, `heapCount`, `fillOf`,
`STOCK_HEAPS` 6: none empty, one at the first unit, one more per sixth full; kinds by `map/workSeen.ts` `stockPiles`;
spots `HEAP_SPOTS` along its front faces). Any `storage` building drawn as a stockpile gets them; redrawn when the
heaps change (the building key). Test: `test/stockHeaps.test.ts`. Shots: `cmp-upright-day-camp.png`, `*-stockpile.png`.

**4. The stockade.** The prisoners' Stockade (`data/prisons.ts`) was drawn as one `palisade_run` stretched over its
3x2 footprint. No kit has a fitting pen (the orcs' `warg_pen` has wolves and war banners in it; the others are animal
pens and fences), so it is now built from the settlers' own palisade: role `stockade` (`iso/isoKits.ts`), a run on each
cell of each edge on a thin strip (`iso/isoTown.ts` `penSides`, `PEN_EDGE` 0.4) at a wall cell's height (`isoView.ts`
`PEN_CELL`), and the `palisade_gate` on the front's middle cell (`penScale`, matched to a run's height), the middle
left open. Its build-menu picture is the gate. Test in `test/stockHeaps.test.ts`. Shots: `*-stockade.png`. A purpose-made
piece would still be better (below).

**5. Sleeping on the ground.** `iso/folkRules.ts` `sleepsOut` (asleep, not indoors, on their feet, still), `SLEEP_DIRS`
/ `sleepDir` (south or south-east by id: those falls end lying calmly), `breathAt` (`BREATH_S` 4: the figure rises a
little from the ground with each breath); `iso/folkSprite.ts` `sleep` holds the look's death sheet's last frame and
carries its own "z"s (the 5000 Pixel Effects `zzz` emote, over where they lie); `map/mapPeople.ts` hides the standing
emote then, and the founder's crown comes down to just over them (`founderMark.ts` `markLying`, `LYING_UP`). Tested in
`test/folkFeet.test.ts`. Shots: `*-night-sleepers.png`.

**6. Event cards.** Checked: the cards' scenes already draw the townsfolk (and the outsiders) in their iso PixelLab looks
(`art/folkCanvas.ts`; the Himeko doll only for the moment a look is loading), the foes from the Legends sheets, pack
props and painted backdrops, and the Great Creature pick from the God creature's own sheets. What was still
code-drawn were the particles; the ones that are things now use pack art (`panel/scenePlayer.ts` `FX_ART`, `fxArt`):
birds from `art/birds.png`, bats from DawnLike's black bat (`art/fx_bat.png`, a 144x96 crop of `creatures/bats.png`,
credited), smoke and steam from the pvfx puffs (`art/effects/smoke.png`). Rain, snow, embers, sparks, dust and the like
stay as pixel dots. Shot: `cmp-event-cards.png` (before above, after below; the bats on "shady").

All 567 events by scene (a settlers town can draw from all but the other peoples' `o_*` ones): the scenes with no
fitting art yet:
- **dragon** (`dragon`, `dragon_hoard`): the dragon is played by the Himeko demon lord, flying; no pack-layout dragon
  exists for the cards (the map's Vermithrax is DawnLike's wyvern, recoloured in Pixi).
- **machine** (41 events: `railway`, `radio_call`, `drone_crash`... late ages): a Robot Warfare infantryman beside a
  bench; fine for the machines, odd for a settlers railway or radio.
- **beast** (`wolves_livestock`, `bear`, `revenge_hunt`...): a black werewolf for every beast, wolves and bears alike.
- **battle** (`war_comes`): orc grunts whatever the foe.
- **ghost**, **cult**, **calamity**, **omen**: backdrops and props only for what is strange (a wisp, the Himeko ghost).

**Checked:** `npm run typecheck`, `npm test` (all pass), `npm run web`; shots at 393x852 and 852x393 (taken at twice
the pixels, saved at half) in `docs/notes/map-looks/`: `before-*`/`after-*` for the camp by day, the stockpiles (empty,
40%, full), the stockade, and the sleepers at night, and `cmp-*` side by side.

### For PixelLab next month
- A lying-asleep sheet for each look (and the children), 8 directions, a slow breathing loop: to replace the held death frame.
- A purpose-made stockade (a square pen of sharpened stakes with a gate and a prisoner's post), in the settlers kit's style, 3x2.
- Stockpile heap pieces in the kit's style: sacks of grain, a stack of planks/lumber, an ore heap (the hay bales stand in for food sacks now).
- A side-on dragon sheet (walk, fly, attack) for the event cards, and a wolf and a bear for the "beast" card.
- A small animated flame (4 to 6 frames) to sit on braziers, torches and lamp posts in the kits' style.
