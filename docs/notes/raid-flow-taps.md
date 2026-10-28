## Raids that finish, and taps that find the right building

Four of the owner's bug reports from playing on the phone: a raid stuck after Skip, a raid stuck on its victory
screen, the "The town fights it out" banner over the fight, and taps on the iso map opening the building next door.
It changes **Pop-ups hold the town** and **Skip a raid** (HISTORY.md) and the iso view's tap test.

**How they were reproduced.** A save made headless (`newGame`, six companions added, prompts cleared) was put in
`localStorage` and the phone build (`out/web`) opened in Chromium at 393x852 and 852x393; `__raid('wolves', 30)`
started a raid; the board's Skip button was tapped; `__event('stranger')` put a question up mid-fight;
`__game.snapshot()` was read each second (tick, raid, `tactics`, prompts). For the taps, a save with eleven buildings
packed round the camp was tapped at fixed points, the old build and the new side by side.

**1. "Combat halted after clicking skip."** Reproduced: a question up during the fight (an event, a debrief), then
Skip: the tick stood still for good with the board on screen (`skip-halted-before-393x852.png`).
*Cause:* `fightOnScreen` (`sim/raidWait.ts`) answered false for a raid being skipped, so `holdOf` fell through to
'popup' for the waiting question, and the game loop's skip path (`shared/gameLoop.ts`) runs only when nothing holds:
the town, the raid with it, was held for a question the event box would not show over the board (`eventSheet.ts`
stands aside while `snap.tactics` is up).
*Fix:* a raid being skipped is still a fight on screen (`fightOnScreen` no longer excepts `s.raidSkip`), so `holdOf`
says 'fight' and the question waits for it, as for a watched fight. The skip path now runs `sim.step(holdOf(s))`,
the fight's own step (`fightStep`) flat out, and stands aside only for a real 'popup' hold (a raid with no board, a
page card up). A skipped battle now plays exactly as a watched one, only faster (it used to run the whole town's step
meanwhile).

**2. "Stuck on the victory screen after a raid."** Reproduced with Skip and without (watched, Auto on): the raid
ended, "VICTORY!" stayed up on the board, the tick stood still, and a debrief ("A raid survived") waited unseen.
*Cause:* a deadlock. `tacticsOver` keeps the board up for `END_LINGER` (4 s) by the tick (`s.tacticsEnded.until`);
the raid's end raises a debrief, which holds the town ('popup'), so the tick stops and the board never goes; the
event box and the recap (`battle/raidRecap.ts`) both wait for the board to go. It let go only after
`POPUP_MOST_TICKS` (ten minutes).
*Fix:* the lingering board counts as a fight on screen (`fightOnScreen`: `s.tacticsEnded && s.tick <
s.tacticsEnded.until`): the fight's clock runs (`fightClock`), the board goes after its moment, then the question
shows, then the recap; "Back to town" lets the game run on (checked: the tick moves again).

**3. The banner.** `#raid-skipping` (`index.html`, set in `main.ts`) sat in the middle of the board. It is now small,
at the bottom right (`right: 10px; bottom: 10px` plus the safe area), clear of the fighter's card at the left in both
orientations; the board stays in view (`skip-banner-*.png`). The skip itself now takes about a second.

**4. Taps picking the neighbour.** Two causes. *a)* `IsoView.buildingAt` took the front-most building whose picture's
**box** held the point; an iso building's box is mostly empty round its drawn shape, so a tap through the empty corner
of the one in front picked it, not the one under the finger (old: Fireside Inn; new: the Longhouse whose roof was
tapped, `tap-*-393x852.png`). *b)* Signs, graves and pets were tested before buildings by the **ground** under the
finger, and on the iso map the ground under a tall roof lies behind that building: a tap on a roof opened the
signpost behind it (`tap-*-852x393.png`).
*Fix:* `iso/artPick.ts` (pure, tested): `pickArt(pics, x, y, slop)` picks the front-most (`z`, the sprite's depth)
picture whose art is solid (`SOLID_ALPHA` 40 of 255) under the point, else the front-most solid within `TAP_SLOP` (8
view px: rings at half and all of it), else none; `solidAt` reads mirrored pictures mirrored, and counts art it can't
read as solid. `IsoView.alphaOf` reads each texture source's alpha once (a canvas, cached in a `WeakMap`).
`buildingAt` = `pickArt` over `picsNear`, then the castle's rooms. `IsoView.buildingOver(sx, sy, wx, wy)`: a
building whose art is solid exactly under the finger and drawn in front of the ground point (`standingDepth` <
its depth) — `main.ts` `hitTest` asks it before pets, graves and signs (`buildingHit` maps a daughter village's
negative ids, as before). People, raiders and the great creature still come first.

Files: `sim/raidWait.ts`, `shared/gameLoop.ts`, `renderer/index.html`, `renderer/iso/artPick.ts`,
`renderer/iso/isoView.ts`, `renderer/main.ts`. Tests: `test/raidFlow.test.ts` (a skipped raid with a question
waiting is fought to its end through the real game loop; the victory board goes with a question up, which then
holds), `test/artPick.test.ts` (art not box, front-most, slop, mirrored, unreadable, faint). Both raid tests fail on
the old code. Screenshots: `docs/notes/raid-flow-taps/`.

### For the owner
- After a raid the cards come one after another: the "Victory!" board (4 s), the story's debrief, sometimes a "first"
  reveal, then the recap. Nothing is stuck, but it is a lot of tapping; say if some should merge.
- In landscape a building's tap card runs past the right edge of the screen (seen on the Longhouse's card); it was
  like this before and is not changed here.
