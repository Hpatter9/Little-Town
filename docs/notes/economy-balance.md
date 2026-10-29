## The coins balanced: battle items bought, tools that wear out, coins back to the town (claude/economy-balance)

The autopilot guard (docs/notes/autopilot-guard.md) turned on systems that had never run in a real game, and its probe
raised three questions. The owner decided all three: battle items are bought once the town has coin, a working tool
lasts about two to three weeks, and the coins should flow back to the town. Changes HISTORY.md "Battle items in the
townsfolk's pouches" and "Battle items bought in the shop" (the free hand-out stops once there is coin), the crafting
chains' tool wear (docs/notes/crafting-chains.md, `TOOL_HOURS`), and "The townsfolk's own economy" (step 1's rates of
pay, the treasury's keep, and meals paid for).

**1. Battle items are bought in a town with coin** (`sim/kit.ts` `restockKits`): the hourly free hand-out from the stores
runs only until the town uses coin (`moneyTown`, as `equipAll` hands out only treasures then). After that the battle
items in the stores are the shop's: the townsfolk buy them with their own coins (`sim/wages.ts` `buyKit`, unchanged:
fighters first, one an hour, at the local price, over `SAVINGS_KEEP`; the coins to the treasury's `townsfolk` line).
The planner still makes them while the stores and pouches hold fewer than one a fighter (`kitNeed`). The general store's
"Gear in stock" now lists the battle items on its shelves too, once there's coin (`SALE_KIT` in `sim/snapshot.ts`; the
hint says the townsfolk buy gear and battle items).

**2. Tools last two to three weeks** (`sim/crafting.ts` `TOOL_HOURS` 60 → 5). Measured with the probe: a tool wears only
in the hours its holder is at the work it helps (counted on the hour), and over fourteen towns the ones who wore a tool
at all put a median of 0.1 to 0.35 hours of wear on it a day (the hardest-working quarter 0.2 to 0.5; one woodcutting
town 1.2). So the "one to two hours a worker a day" in the autopilot-guard note was the whole town's, not a worker's,
and the 25 to 30 hours it suggested would have meant tools lasting most of a season. At 5 hours (times the quality's
worth: most tools in play are Uncommon, 1.2), a tool used every day lasts some 17 to 20 days, two to three weeks; a
heavy user's about a week; a tool that's only carried, much longer. In a town with coin a worker whose tool broke buys
another at the shop (`buyGear`); the planner keeps a tool, in store or in hand, for every worker.

**3. The coins** (`data/economy.ts`, `sim/economy.ts`, `sim/shop.ts`). What was wrong: the treasury paid for work
(gathered loads, building, study, crafters' pieces) out of everything it held above `TREASURY_KEEP` (20), and the pay
asked for was about twice what it could pay. So every coin it took in, from travellers, tax, rent and the townsfolk's
buying, went straight back into purses, and the purses kept what came in from outside (travellers' coins, bounties, a
venue's takings) with little to spend it on: a stone axe or a potion costs 5 to 7, a drink a few, the rent a coin, and
a working grown-up earned 15 or more a day. Three changes, each to something that was there:

- **Meals are paid for** (`payForMeal`, `mealPrice`, `MEAL_SHARE` 0.6): the food in the stores is the town's, bought of
  its gatherers at `GATHER_SHARE` of its worth; in a town with coin a grown-up pays the treasury for each meal they eat
  from the stores (`doEat` in `sim/people.ts`), at `MEAL_SHARE` of its worth (times the square root of the era's
  scale, as loads are; at least a coin). Short of the price they eat on the town: nobody goes hungry for want of
  coins. Children eat free. The ledger has a line of its own, "The townsfolk's meals from the stores" (`meals`).
  Autopilot only (`=== false` guard).
- **Pay rates trimmed** so they sit nearer what the treasury can pay: `GATHER_SHARE` 0.5 → 0.35, `BUILD_PER_HOUR` 2 →
  1.4, `STUDY_PER_HOUR` 1.5 → 1, `PIECE_RATE` (data/shop.ts) 0.3 → 0.2. Rent (`RENT_PER_BED`), tax (`TAX`), the guards'
  wage and the keeper's cut are as they were (a rent of 2 was tried with pay at half: most townsfolk were left with a
  few coins).
- **The treasury keeps a day's pay in hand** (`treasuryKeep(s)`: `TREASURY_KEEP` and `wageBill(s)`, `PAY_A_HEAD` 2 a
  grown-up times the era's scale). `wageBill` was already described as "the treasury's reserve against" a day's pay,
  but `payFromTreasury` kept back only the 20. Now the pay for work (`spareForPay`) and the goods it buys from
  travellers that it could do without (`buyFrom`, non-essential wants) both wait above it, so the treasury grows with
  the town and has coins for its guards (paid first, as before), what it must buy (essential goods, at 0) and the
  founder's orders. `PAY_A_HEAD` and `wageBill` moved from `sim/wages.ts` to `sim/economy.ts` (re-exported from wages).

A reserve kept for each grown-up for the pay alone (5 a head) was tried first and dropped: the treasury's other
spending (goods bought from travellers, the venues' improvements) has lower keeps, spent down to them first, and the
pay for work got next to nothing (751 of 8,688 asked in a town), purses near nil.

**Tests** (`test/economyBalance.test.ts`): battle items handed out free before coin and bought after (paid for, the
price to the treasury, off the shelf); a meal paid for (the price, the treasury, the ledger line), eaten on the town
with no coins, free for children, only with the autopilot and only with coin; eating from the stores through the sim
pays; a tool worn through in `TOOL_HOURS` of work (and `TOOL_HOURS` at the measured wear comes to two to three weeks)
and bought again at the shop. `test/economy.test.ts`'s "pay from the treasury above its keep" now keeps
`treasuryKeep(s)` back, not `TREASURY_KEEP` alone: the rule changed, so the test checks the new keep (the same 5 paid
over it). `test/castle.test.ts` "a Deep Hold grows its halls into the mountain" checked every room at day 10, built or
going up, to be all hall; but a hold's room is cut out of the rock as it is built (`digRoom`: its progress share), so a
room part-built at that moment fails it, and the new rates moved the town's timing so one was (a drying rack at 37%,
one cell of two dug). It now holds a finished room to all hall as before, and one going up to every cell in the
mountain and at least its progress share dug: the dig's own rule, so no weaker (it passes on main too). No other
test moved; the whole suite passes.

**The probe** (`tools/economy-probe.ts`, run `node tools/economy-probe.mjs <days> <seed>[,<seed>...]`, `SAVE=<dir>`
keeps each town as a save for the phone build): the autopilot-guard probe's towns (the autopilot left out, the
recommended builds on, a question answered with its first choice), every ten days the people, the dead, the treasury,
the purses, rent owed and the mood, and over the run the ledger and the tools and battle items. It also answers a
raid's own questions (a toll at the gate, "They break!": let them go), which the autopilot-guard probe didn't: a raid
waiting on one never ends, and the town stood still from then on (that probe's ap-5 and others may have been held so).
Ten towns, 40 days, before (main with the autopilot guard) and after. Each run plays out differently once anything
differs, so a town's own numbers wander (who dies in which raid); read the rows across the towns.

| | ap-1 | ap-2 | ap-3 | ap-4/tribe | ap-5/supplied | ap-6 | ap-7 | ap-8 | ap-9/supplied | ap-10/tribe |
|---|---|---|---|---|---|---|---|---|---|---|
| people at day 40 (the dead): before | 19 (6) | 7 (9) | 20 (10) | 1 (13) | 6 (7) | 14 (12) | 5 (3), ended day 13 | 15 (7) | 18 (1) | 16 (11) |
| after | 21 (7) | 14 (13) | 17 (11) | 3 (14) | 15 (5) | 8 (15) | 12 (14), ended day 36 | 11 (7) | 15 (3) | 25 (11) |
| treasury, day 20 / 40: before | 83 / 47 | 27 / 37 | 41 / 30 | 20 / 20 | 20 / 32 | 28 / 93 | – / – | 20 / 42 | 22 / 32 | 18 / 17 |
| after | 160 / 46 | 57 / 6 | 54 / 86 | 31 / 32 | 44 / 69 | 30 / 58 | 44 / – | 94 / 127 | 45 / 76 | 66 / 100 |
| all purses, day 20 / 40: before | 479 / 3731 | 493 / 700 | 506 / 2912 | 419 / 258 | 72 / 730 | 407 / 1606 | – / – | 346 / 1334 | 742 / 1146 | 359 / 1749 |
| after | 208 / 1845 | 244 / 379 | 153 / 1354 | 58 / 133 | 285 / 736 | 72 / 330 | 92 / – | 145 / 337 | 130 / 524 | 133 / 1414 |
| a grown-up's purse at day 40: median / richest: before | 135 / 1065 | 101 / 310 | 54 / 1307 | 258 / 258 | 141 / 294 | 49 / 483 | – / – | 75 / 302 | 43 / 232 | 40 / 525 |
| after | 69 / 478 | 20 / 122 | 33 / 474 | 1 / 131 | 40 / 218 | 23 / 217 | – / – | 12 / 203 | 17 / 290 | 12 / 405 |
| owing rent at day 40 (all owed): before | 7/14 (17) | 3/5 (5) | 7/16 (14) | 1/1 (4) | 1/5 (2) | 7/12 (14) | – | 6/12 (14) | 10/15 (27) | 7/15 (20) |
| after | 10/16 (35) | 8/9 (21) | 7/15 (27) | 3/3 (15) | 5/11 (16) | 5/8 (13) | – | 6/10 (14) | 6/13 (45) | 16/20 (63) |
| mood at day 40: before | 96 | 66 | 74 | 76 | 93 | 98 | – | 69 | 69 | 89 |
| after | 69 | 93 | 84 | 74 | 95 | 91 | – | 86 | 69 | 79 |
| tools broken (days the middle one lasted): before | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| after | 11 (7.8) | 3 (18.9) | 1 (7.9) | 0 | 3 (14.3) | 1 (3.1) | 2 (2.8) | 3 (13.5) | 2 (6.5) | 3 (9.3) |
| grown-ups with a tool, day 20 / 40: before | 10/10 / 11/14 | 9/11 / 4/4 | 7/7 / 15/16 | 5/5 / 1/1 | 1/1 / 5/5 | 4/5 / 9/12 | – / – | 6/6 / 6/6 | 7/7 / 7/9 | 5/5 / 9/12 |
| after | 8/13 / 5/13 | 7/9 / 3/6 | 5/6 / 13/15 | 1/1 / 1/3 | 5/6 / 10/11 | 1/1 / 4/5 | 1/3 / – | 6/7 / 7/10 | 3/6 / 7/10 | 9/11 / 12/16 |
| battle items bought (coins): before | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| after | 51 (176) | 37 (151) | 6 (36) | 0 (0) | 29 (160) | 3 (28) | 1 (16) | 33 (154) | 23 (95) | 60 (225) |
| fighters with one at the last raid: before | 9/9 | 4/4 | 10/12 | 0/3 | 0/7 | 2/4 | 0/5 | 7/11 | 0/11 | 7/7 |
| after | 6/7 | 7/10 | 3/12 | 0/1 | 8/12 | 0/7 | 1/9 | 8/9 | 10/11 | 12/15 |
| days a raid hung (see below): before | 0 | 13 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| after | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9 | 0 |

In short, over the nine towns that reached day 40 (ap-7's game ended early both times): the
purses held 14,166 coins at day 40 before and 7,052 after, with more people (116 → 129): 122 a head before, 55
after. The middle town's median purse fell from 75 to 20 coins, and its richest from 310 to 218 (the richest are still
adventurers and venue owners). The treasury at day 40, town by town, is up from a median of 32 to 69. It still spends
most of what it takes, but it now pays for more (below). Rent owed is a little higher (it builds up: arrears are never
paid down) and the mood is about the same. 242 battle items were bought, for 1,025 coins, where none were before, and
about as many fighters as before had one at the last raid. 27 tools broke where none did before, the middle one of
each town lasting 3 to 19 days, and the townsfolk bought 283 tools at the shop (317 before: tools for newcomers, and
upgrades). At ap-1's day 40 only 5 of 13 hold a tool: a strike was on (the commons' bloc) and the stores were full,
the flint for stone axes left on the ground. At day 30 it was 9 of 10.

The treasury's ledger over the 40 days, the nine towns added up (coins, before → after):

| in | before | after | | out | before | after |
|---|---|---|---|---|---|---|
| travellers at the shop | 26,408 | 31,031 | | pay for work | 27,262 | 18,845 |
| travellers at the tavern | 7,948 | 8,029 | | crafters | 5,743 | 5,379 |
| the townsfolk (gear, kit, evenings) | 4,954 | 5,827 | | guards | 1,653 | 2,136 |
| meals from the stores | 0 | 4,913 | | goods bought from travellers | 19,333 | 24,921 |
| rent, and land sold | 10,501 | 8,193 | | rooms and improvements | 2,392 | 8,056 |
| tax | 6,715 | 5,301 | | the trade house | 212 | 948 |
| events | 6,293 | 5,497 | | the realm (gifts, tribute) | 35 | 2,671 |

So the pay for work is down by a third, and the coins it no longer takes go on goods (trade), the venues' improvements
(building), the trade house and the realm: what the treasury pays for, now that it has coins in hand above its keep.
Tax and rent are a little lower because incomes and plots bought are (tax is a share of yesterday's income).

**Speed** (`node tools/perf-sim.mjs`, the late fixture, two runs each, the machine busier than for the autopilot-guard
note): before, step 2.24 and 2.28 ms, two game days 5.8 and 6.2 s; after, 2.34 and 2.25 ms, 6.4 and 6.1 s. No change
beyond noise (a meal's price is one sum; the rest are constants).

**Seen on the phone build** (`npm run web`, a probe town at day 40 loaded as the save, paused and its questions
cleared): the Town menu's Stores tab (the treasury, the tax, the guards, the ledger with its meals line) and the
general store's Trade tab (battle items in stock with the gear), upright (393x852) and sideways (852x393):
`docs/notes/economy-balance/`.

**For the owner** (seen while probing, not touched here): a Lich Lord raid can hang after its board is won. His raised
dead stand up again, nobody fights them, and the raid stays on for good (probe towns ap-2 before, day 26, and ap-9
after, day 30: the "days a raid hung" row). On screen: the general store's "Wants to buy" can show "Wood
490.00000000000114", and the party's homecoming card a line "19 undefined" (its coins, it seems).
