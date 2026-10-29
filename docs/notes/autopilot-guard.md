## Systems that never ran in a real game: the autopilot guard (claude/autopilot-guard)

`GameState.autopilot` is on when left out, and a real game leaves it out (only the tests' `plainGame` sets it to
false). Eight guards read it as `!s.autopilot` (or `if (s.autopilot)`), which treats unset as off, so these systems ran
only in tests that set the autopilot to true, never on the phone. Each now reads `s.autopilot === false` (or
`!== false`), like the 133 guards that were already right. Changes the HISTORY.md sections "Battle items in the
townsfolk's pouches", "Battle items bought in the shop", "Giving chase", the crafting chains (docs/notes/crafting-chains.md:
heartwood, rare finds, tool wear), and the hand-made maps (raid boards, delve floors): what they describe now happens in
play.

- `sim/wages.ts` `buyKit`: townsfolk buy battle items off the shop's shelves with their own coins.
- `sim/kit.ts` `restockKits`: the stores' battle items handed out into the fighters' pouches, by the hour.
- `sim/raidBoards.ts` `boardsFor`: a raid is fought on a hand-made board that fits it `HAND_BOARD_SHARE` (0.75) of the time.
- `sim/chase.ts` `noteFugitives`: raiders who got away are offered for a chase (the raid recap's "Give chase!" button).
- `sim/chains.ts` `fellHeartwood` and `rareFind`: heartwood from old trees, rare inputs from quests (Medieval age on).
- `sim/delveFloors.ts` `pickFloor`: a delve goes down a hand-made floor that fits it 0.75 of the time.
- `sim/crafting.ts` `hourlyItems` → `wearTools`: tools wear with work and break after `TOOL_HOURS` (60) hours of it.

**Tests** (`test/autopilotGuard.test.ts`): a text check of every source under `src/shared` that fails on any
`.autopilot` read that isn't `=== false` / `!== false` (it lists all eight guards above against the old code), and a test
that a state with the autopilot left out runs each system (a hand-out, a buy, an hour of tool wear, a chase offered,
boards to fit, heartwood and a rare find, a drawn floor). The whole suite passes with the systems on; no balance test's
window had to move.

**The probe** (`tools/autopilot-probe.ts`, run `node tools/autopilot-probe.mjs <days> <seed>[,<seed>...]`; `name/tribe`
picks the scenario): fresh towns with the autopilot *left out*, as on the phone, the town's recommended builds on, a
question answered with its first choice, a raid's fight on screen holding the town, and a chase given every time one
is offered. Six towns (`ap-1`..`ap-3` and `ap-6` band, `ap-4/tribe`, `ap-5/supplied`), 40 days each:

| | ap-1 | ap-2 | ap-3 | ap-4 tribe | ap-5 supplied | ap-6 |
|---|---|---|---|---|---|---|
| people at day 40 | 11 | 23 | 28 | 8 | 13 | 3 |
| raids fought on the board / on a hand-made one | 12 / 7 | 9 / 4 | 8 / 3 | 11 / 3 | 13 / 7 | 11 / 7 |
| chases offered | 16 | 18 | 16 | 15 | 25 | 13 |
| battle items in pouches at the end | 19 | 25 | 26 | 12 | 2 | 3 |
| battle items bought at the shop | 0 | 0 | 0 | 0 | 0 | 0 |
| heartwood felled | 19 | 42 | 33 | 13 | 17 | 8 |
| delves (down a drawn floor) | 0 | 0 | 0 | 0 | 0 | 0 |
| tools broken | 0 | 0 | 0 | 0 | 0 | 0 |
| grown-ups with a tool, day 20 / 40 | 7/8 / 7/10 | 5/8 / 16/16 | 9/9 / 19/20 | 1/4 / 3/4 | 4/5 / 7/7 | 7/7 / 2/2 |
| treasury, day 20 / 40 (coins) | 35 / 20 | 31 / 7 | 37 / 46 | 31 / 40 | 29 / 26 | 20 / 20 |
| the townsfolk's purses, day 20 / 40 | 322 / 3153 | 422 / 1610 | 640 / 4004 | 52 / 1464 | 259 / 1297 | 733 / 520 |

What each does now that it runs:

- **Raid boards:** 31 of 64 raids (about half) were fought on a hand-made board. The rest have no board to fit (a big
  raid's size, the land, the raid's kind) or lost the 0.75 roll. Nothing to fix.
- **Chases:** offered after nearly every raid (a raider almost always gets away). Checked on the phone build
  (`npm run web`, a save made by the probe just after a raid with the autopilot left out): the recap's "Give chase!
  (1 fled)" button shows at 393x852 and 852x393. Sideways the recap scrolls to reach it. A founder's story card about
  the raid comes up first, and it holds the town, so the three hours the trail stays warm don't run out under it.
  Nothing to fix.
- **Pouches:** filled from the stores (2 to 26 items a town by day 40). Nothing to fix.
- **Buying battle items:** nothing bought in any town. The hourly hand-out (`restockKits`, before `updateWages` in the step)
  empties the stores' battle items into the pouches first, so the shop's shelves never hold any for `buyKit`. Left
  as it is: see the owner's questions below.
- **Chains:** heartwood comes in steadily from the Medieval age (8 to 42 a town). The rare-find rolls weren't counted by
  the probe; the test covers them.
- **Delve floors:** no town sent a delve in 40 days, so the probe never saw a floor. `test/delveFloors.test.ts` and the new
  test cover the pick.
- **Tool wear:** no tool broke in any town. Wear is counted by the hour, only while the holder is at work the tool helps
  with. Sampled each hour over 16 days of `ap-6`, the tool holders were walking (270 hours), asleep (152), building (67)
  or studying (29), and chopping, mining, reaping or tilling for only about 30 hours. That's roughly one to two hours of
  wear a worker a day, so a Common tool (`TOOL_HOURS` 60) lasts some 40 to 60 days, a season or more. The town keeps up
  easily: the planner keeps a tool for every worker, and in a town with coin a worker buys a new one at the shop. It
  works as written, but slowly. Left as it is: see below.

**Speed** (`node tools/perf-sim.mjs`, the late fixture, two runs each): before, step 1.50 and 1.54 ms, two game days
4.1 and 4.0 s; after, 1.55 and 1.55 ms, 4.1 and 4.1 s. No change beyond noise.

**For the owner to decide** (not guessed at):

1. **Battle items free or bought?** In a town with coin, gear is bought at the shop, but battle items are still handed
   out free from the stores, so the shop never sells one (and the treasury never gets those coins: it hovers at
   20 to 100 coins while the purses grow to thousands). Should the free hand-out stop in a town with coin, as it does
   for gear (`equipAll` hands out only treasures there), so the townsfolk buy their potions?
2. **How long should a tool last?** At 60 hours of work, a Common tool lasts more than a season and none broke in
   40 days. If tools should be a steady drain on the smithy, `TOOL_HOURS` could come down (15 would mean about every
   ten days).
3. **The purses pile up** (up to 4000 coins against a treasury under 100). That comes from the economy's wages
   (`sim/economy.ts`) rather than these guards, which never covered the pay, but it shows up in the same numbers.
