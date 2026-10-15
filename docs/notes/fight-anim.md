## Fights that move (fight-anim)

Extends HISTORY.md "Watching a party's fights", "Combat actions", "The flashier raid screen". Renderer only: the sim and
snapshot are unchanged (`tools/sim-hash.mjs` matches main).

**What was weak (before).** Looked at with `__skirmish` and a raid at 393x852 and 852x393: a blow was a 10 px step
for 6 ticks and a pose swap, so no wind-up and no recoil; the struck one only turned red for 3 ticks; a foe's death was
a 2 second fade to nothing and a townsperson just lay on the hurt frame; nothing flinched when a friend fell; idle
figures stood dead still; a close blow's number, flash and spark came the instant the blow began, before any lunge could
land; all motion stepped at the sim's 10 Hz.

**What it does now.** All of it is code-tweened *motion* of the packs' own frames (no new art, nothing to credit):

- `fight/fightMotion.ts` (pure, no Pixi; `test/fightMotion.test.ts`): `motionOf` turns a fighter's tick counts (since its
  action, since it was hit, down) into an offset, a lean, a squash, a flash and the corpse's alpha. A close blow:
  wind-up (step back, lean) ticks 0-1.5, lunge to its peak at `MELEE_LAND` (3), back in place by `LUNGE_TICKS` (9). A
  bow or spell: a draw (lean back, rise) then a kick as it's loosed. Struck: white flash on the first 2 ticks, red tint
  after, a knock-back away from the striker that settles over `RECOIL_TICKS` (7), a squash; a blow worth `HEAVY` (25%) of
  max health knocks harder. Down: a 2-tick hold (the death registers), then a topple away from the foes over
  `FALL_TICKS` (6) and lying; a long low body (wolf, boar: width over 1.1 x height) flattens instead. Idle: a breath and a
  weight shift, out of step by ref. A friend falling: a flinch back and dip for 6 ticks. A won fight: the party hops.
- `TickClock` smooths the sim's whole-tick counters into fractions of a tick from the wall-clock time they last changed
  and an average of how long ticks have taken, so motion is 60 fps smooth and runs at the battle speed (a faster speed
  plays it faster; it never outlasts the turn, since a new action just restarts it).
- `fight/fightView.ts`: the above applied through `moveSprite` (squash and lean about the feet). Close blows (plain ones
  by matching the striker's `sinceAction` to a foe's `sinceHit`, as `plainShots` does; skills that strike foes up close)
  make their number, flinch, spark and spell effect wait `MELEE_LAND` ticks for the lunge to land, using the existing
  `Flight` machinery. A cast gathers a glow of the spell's colour round the caster. Heavy blows pop a larger gold
  number and shake the screen a little (`hitAt`/`hitK`, smaller than an ultimate's shake); a townsperson falling shakes
  it and blinks the screen red. Numbers arc up and away from the striker. Foe corpses stay (alpha dims to 0.45 and holds,
  `corpseAlpha`) instead of vanishing; the party's lie solid. Packs' own death rows are played through, not shown at
  their end (`creatureFrame`'s new `dying` argument, `HeroState.sinceDown`, the LPC hurt row stepped by the fall).
- `map/mapRaiders.ts` (also the tactics board's raiders) and `map/mapPeople.ts` (the people of the map and the board):
  the same vocabulary at 0.6 of the size (`MOTION_K`): lunge and recoil, flash, topple, dimmed corpse (raiders). People on
  the map get only the lunge/recoil offset, not a topple (their marks and props hang off their position).

Not done / design calls: a real slow-motion "pause" on a townsperson's death is not possible without the sim (the
renderer cannot stop the ticks), so it is a 2-tick hold on the hit frame, a red blink and a shake. A guard stance when a
foe approaches is not drawn (the sim has no approach: foes stand in place); the victory hop is the end-of-fight pose.
