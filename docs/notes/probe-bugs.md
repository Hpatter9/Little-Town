## The probe's three bugs (a raid that never ended, raw floats, "19 undefined")

Three bugs the economy probe found (docs/notes/economy-balance.md, "For the owner"), each found at its root and fixed,
with a test. Changes HISTORY.md "Tactics battles" (the board's `tidy`), "Rival origins" (the Lich Lord's Raise the
Fallen), "Sending a party yourself" (the homecoming card) and "Summary cards".

**A raid that never ended after its board was won (the Lich Lord's raids).** A raider struck down on the tactics
board is taken off it (`tidy` in `sim/tactics.ts`) but keeps its board place, `rd.bt`. The Lich Lord's Raise the
Fallen (`sim/rivals.ts` `cast`, `raise`) stands the fallen up again: `down` false, half its health. `tidy` only
brings on raiders with no `bt`, so the risen never came back on the board. `updateRaid` (`sim/raids.ts`) skips any
raider whose `bt` is not `out` (it's the board's business), so it never moved, fought or fled. Once the rest were down
the board was won (no foes on it, none waiting), but the raid ends only when every raider is down, gone or an ally:
it stayed on for good, the town held. Two fixes:
- `tidy`: a raider standing, not an ally, with a board place that isn't `out`, not on the board and not waiting, goes
  back in `t.waiting` and comes on again with the next wave (from the edge, as reinforcements do).
- `updateRaid`: once the board is over (`r.tactics.phase === 'done'`), a raider still standing off it is let on to
  the map (`rd.bt.out = true`): it fights in the town or leaves on the raid's clock, as one that got through does. A
  safety net for anything else that stands a raider up after the board's last turn.

Tests (`test/tactics.test.ts`): a raider struck down on the board and raised comes back on (waiting or on the board)
and the raid ends; a raider left standing off a finished board is let on to the map and the raid ends. Both fail
without the fix.

**Raw floats in the menus ("Wood 490.00000000000114").** Stores hold fractions (food, the burn of fuel, a party's
share), and adding them up drifts (`0.1 + 0.2`). The shop's "Wants to buy" is demand less stock
(`planner.ts` `shoppingList`), shown as it was.
- One formatter, `amount(n)` (`src/shared/format.ts`): a whole number, or one decimal under ten when the fraction is
  a tenth or more (2.5 bone; 490, not 490.00000000000114; 0.3, not 0.30000000000000004). Used wherever a store or trade
  amount is put in words: the shop's Spare to sell and Wants to buy (`shopPanel.ts` `stockRow`), the crafting stores
  (`craftingPanel.ts`), a material's card (`details.ts`, "In store", and `stockLine`), the build menu's "needs"
  (`buildPanel.ts`), the bag (`townsfolkPanel.ts`), the expeditions' lists (`expeditionsPanel.ts`), the tap card's
  stores and "Throw out" (`main.ts`), the caravan's offers (`tradePanel.ts`), the fight's spoils (`fightHud.ts`), the
  raid recap (`battle/raidRecap.ts`), info cards (`infoCards.ts`), the building card's orders (`buildingCard.ts`) and
  the homecoming card's haul (`mobile/eventSheet.ts`).
- In the sim, only the drift is taken off: `tidyAmount` (`sim/state.ts`, rounds to a millionth) in `addStock`, and on
  `shoppingList`'s shortfall and `forSale`'s spare. A real fraction stays as it was.
- One sim line put the treasury's coins in words unrounded: a trade house gone bust (`sim/markets.ts` `goBust`), now
  whole. (The shop's "left disappointed (66.414 coins)" in older saves' logs was written before `paid` was rounded;
  the line is whole today.)

Test (`test/haulNames.test.ts`): `amount` on the drifted and real cases.

**"19 undefined" on the homecoming card.** A party at a place with nothing to gather (a guild hunt, the Dragon, a
village to free, a portal: `loot: {}`, they bring home what they win) still did its work there
(`sim/expeditions.ts`, the `work` phase), and each unit of it drew from the empty table: `rng.weighted({})` returns
undefined, so `addStock(e.loot, undefined, 1)` put a kind called "undefined" in the haul. The card wrote it as
"19 undefined", and the haul went into the stores with it (where it took up room).
- The work phase gathers only when the place's table has a weight above nought.
- The haul is told only in kinds with a name: the debrief's `haul` and `loot` (`sim/muster.ts`), the card
  (`mobile/eventSheet.ts` `debriefBlock`) and the chest (`mobile/reveals.ts` `haulOrder`).
- An older save loads without it: `parseSave` (`sim/save.ts`) drops any key that isn't a material from the stores and
  the parties' hauls (no version bump).

Tests (`test/haulNames.test.ts`): every material has a name, and every table loot is drawn from (the destinations,
the foes, the rare finds) holds only named ones; the chest names every line and leaves out a kind with none; a guild
hunt at work brings home nothing without a name (fails without the fix: `brought 1 of "undefined"`); an older save
with one loads without it.

**The sweep.** A late town's snapshot (`test/fixtures/late-town.json.gz`, five game hours) has no "undefined" or "NaN"
in its words and no drifted store amounts. Seen on screen at 393x852 and 852x393 (the fixture with a homecoming
card whose haul held drift and an unnamed kind, and the trading post short of wood): `docs/notes/probe-bugs/`.

**Not reproduced live.** Ten probe towns (`tools/economy-probe.ts`'s set-up, 40 days) ran to between day 30 and day 40 without a
Lich raid hanging (ap-2 met one at day 29, and it ended). Each run plays out differently once anything differs; the
mechanism is shown by the tests.
