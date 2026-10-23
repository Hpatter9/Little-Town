## Raids in the townsfolk's own looks

The owner's call: "No switching sprites, they need to be consistent." In a raid a fighting townsperson used to be
redrawn as a Craftpix hero (a knights' town defended as red samurai), on the map and on the raid board; now everyone
fights in their own PixelLab look and colours (`iso/folkWho.ts`) wherever they are. This changes HISTORY.md's
"Classes and levels" and "Class paths" (the combat forms), "Each people's own base callings, and the mythic
callings" (`roadForm`), the Shapeshifter's beast form on the map and fight screen, the werewolves' Craftpix wolf
form on the fight screen, and docs/notes/art-audit.md "Still to do" item 1 and docs/notes/god-creatures.md "The raid
board is unchanged". Renderer only: no rule of the simulation changed, and saves are untouched.

**The map in a raid** (map/mapPeople.ts). The combat-form branches are gone: the calling's hero (`heroSheet`, held the
whole raid by `inCombat`), the founder's hero (`founderSheet`), the Craftpix werewolves (`WOLF_FORMS`), a people's
calling form (`roadForm`: the Bonewright's skeleton, the Gearwright's robot) and the Shapeshifter's beast. `folkOn` is
now just the iso view, not hidden, not swimming. A defender plays their look's own sheets:
- the blow their weapon's armed look strikes (iso/folkRules.ts `wantedAnim`: `+sword` `attack_1h`, `+staff` `cast_2h`,
  `+bow` `attack_bow`, `+greatsword` `attack_2h`; bare hands punch, or throw a spell for a people drawn casting);
- new: between blows, a fighter on the move runs or walks to the foe (`closing`) rather than swinging as they slide;
- hurt and death from the bare look's sheets. The armed looks are drawn with their one move only (no walk, hurt or
  death), so iso/folkSprite.ts now plays the armed look only when it has the move wanted (or a fallback other than
  idle: a hammer for a chop), and the bare look's own sheets for everything else. Before, a struck fighter stood
  still and a fallen one was the standing frame turned on its side.
- The fallbacks (`FALLBACK`) now never leave a fighter idle when their look has any attack: `cast_1h`/`cast_2h` fall
  to the punch (`attack_1h`, `attack_2h`), and `attack_bow` to the punch, then the thrown spell (a lich archer).
- A werewolf townsperson still wears the Moon Pack's wolf-headed `man_beast` look under the full moon and in fights
  (a PixelLab look of their own people, not a pack sprite); the fight screen now does the same (below).

**The raid board** (tactics/tacticsView.ts, map/mapPeople.ts, map/mapRaiders.ts, new iso/boardRules.ts, pure).
- Each frame tacticsView hands `MapPeople.boardPose` and `MapRaiders.boardPose` each unit's turn as the board has it:
  its grid facing, whether it is walking its path (`act.stage === 'move'`), and whether its last act was a cast
  (`lastAct`, kept past the turn so the spell's blow still plays as one; cleared when the board closes).
- Townsfolk: `boardFolkAnim(st, moment, family)` gives death when down, `hurt` within `HURT_TICKS` of a hit, the
  weapon's blow (or `cast_1h`, `cast_2h` with a staff, for a spell) within `BLOW_TICKS` of acting, `walk` on their
  move, else `idle` (standing ready: on the map a defender swings on and off all raid, but the board's turns are slow).
  They face `boardFacing(u.facing)` (`BOARD_FACING`: 0 +u south-east, 1 +v south-west, 2 -u north-west, 3 -v
  north-east; the sim turns a unit to each step and to its target). `FolkSprite.update` takes it as a new `board`
  argument, armed all fight.
- Their feet now stand on the tile: the looks were anchored at the frame's foot, 30px below a grown look's feet
  (`BOARD_FEET`, scaled by `FOLK_SCALE`), so on the board they floated about half a tile above their rings.
- The God creature (`beast_<kind>`, `unitKind`) is drawn from its own sheets (`loadCreatureSet`) once they load, the
  old stand-in meanwhile: `boardCreatureMoves(r, moment, blows)` gives `death` when down, `hit` when just struck, a
  `punch` and an `uppercut` by turns for its blows (`blows` counted as `sinceAction` drops), `miracle` for a spell,
  `walk` on its move, else `idle`; played with `creaturePlay` and `turnFrame` as on the map. It keeps its nature's
  gentle tint (`gentleTint` of the snapshot's `creature`, handed in as `MapRaiders.creature`; main.ts does the same
  for a map raid), anchored at its feet (`SHEET_FEET`, now exported from map/mapCreature.ts with `SHEET_SCALE`), a
  shadow and ring for its figure rather than its wide frame. Size on the board: `SHEET_SCALE` times its growth held
  between `BOARD_GROWTH_MIN` 1.3 and `BOARD_GROWTH_MOST` 1.8 (a person's height is 1), big enough to stand out, small
  enough to leave the tiles round it in sight on a phone. On the map it is its growth's size, as map/mapCreature.ts.
- Enemies keep their own art.

**The side-on screens.** The fight screen (fight/fightView.ts) drew a party member in their calling's form
(`roadForm`), a werewolf as a Craftpix werewolf, and a Shapeshifter as a beast; now a townsperson is always their look
(`folkSideById`), a werewolf in their form wearing `man_beast` (art/folkSide.ts: new `SidePose.wolf`, uncoloured and
bare-handed), and the beast form is kept only for fighters with no look of their own (the foes). The Craftpix hero
fallback for townsfolk is gone: until the look loads, the same person's paper doll, then their LPC figure. Duels and
the arena are fought through the fight screen and the map; the Deep, the mine, the trip pane, cutscenes and the
Underdark already used the looks and swap nothing.

**Leftovers.** art/combatPoses.ts keeps only the LPC blows (`fightAnim`, `fightPose`, `SHOOT_TICKS`), the fallback
while a look loads; `heroFrame`, `heroScale`, `HERO_HEIGHT`, `skeletonSheet`, `WOLF_FORMS` and `WOLF_SCALE` are gone.
art/heroForms.ts keeps `HERO_FORM` (test/mythic.test.ts checks the mythic callings' forms against it) and
`FOUNDER_ID`; `heroSheet`, `roadForm`, `founderSheet`, `heroImage` and `drawHeroIdle` are gone. The Craftpix hero
sheets themselves stay: bosses, strangers and foes use them. The `form` field on the callings' data
(data/originCallings.ts, `formOf`) is now unused by the renderer, kept for saves and the tests.

**The founder's marker** (the owner's choice, "a marker over the head", no new art; new iso/founderMark.ts, pure, and
map/mapPeople.ts). The founder (the snapshot's `mainId`: `MapPeople.founderId`, set by main.ts and now by tacticsView
too) wears a small gold crown floating over their head and a soft gold ring on the ground at their feet, always, on the
map and on the raid board. The crown is DawnLike's (the Hat sheet's `CROWN` glyph, `['Hat', 26]` in data/emblems.ts,
the same the class emblems wear: already in `src`, so nothing new copied and CREDITS.md unchanged), at `CROWN_SCALE`
1 (16 world px, under a third of a person's height, bobbing `CROWN_BOB`; over the health bar when one shows) so it reads at phone size and hides nobody. Placed by
`markAt` from the look's frame (`HEAD_UP` 127, `FEET_UP` 30 of 156); the ring is `RING_W` 26 world px across, under the
figure. `wearsMark` hides it indoors and away on a trip. The crown is marked as a walker (`markWalker`), so a roof in
front of it fades as one in front of them does. The founder's existing origin-coloured aura stays. The camera is
untouched (no founder follow).

**Tools.** tools/make-save.ts takes `CREATURE=wolf` (the town given its God creature after the run, with no naming
question waiting) for previews of it fighting.

**Tests** (test/raidLooks.test.ts): the board's animation for each action and weapon, the fallbacks for looks without
the weapon's move, the board facings, the God creature's board moves, the map's fighter running in between blows, and
that a townsperson's look and colours are the same in the town and as tacticsView hands them to the board (settlers,
dwarves, orcs, lich, vampire, knights), and who wears the founder's marker and where it goes.

Screenshots in `docs/notes/raid-looks/` (393x852 and 852x393): each town as the raid is called (`*-map`, the
founder's crown among the defenders) and a wolf pack raid on the board for knights (with the God wolf), settlers (the
God bear), dwarves, orcs, lich and vampire towns; and before (`before-knights`: the red samurai).

### For the owner
- **The Shapeshifter's beast and the Moon Pack's wolf.** A Shapeshifter now fights in their own look (no beast). A
  werewolf townsperson still turns into the Moon Pack's wolf-headed PixelLab look under the full moon and in fights
  (on the fight screen too, now, instead of the Craftpix werewolf). Say if that should go as well.
- **Armed looks are few** (as the art audit found): orcs have no `+sword` or `+bow`, so an orc with a sword punches
  and an orc archer punches too; the lich and druid looks only cast, so their bow-carriers throw a spell.
