## Crafting chains

The owner's ask: better things need more, and more kinds of, resources; chains of three or four steps; every item
deepened but the first age's simple things kept to one or two steps; rare inputs from quests, the land and trade. The
plan is `docs/plans/crafting-chains.md`; this is what was built. It changes the rules of "The armoury", "Three orders
a station", "More buildings and crafting stations", "Minerals" and "A real trade economy" (see each part below).

**Parts** (`data/chains.ts` `PARTS`, merged into `ITEMS`): inventory items (`part: true`, slot `null`) made from one
refined material at the station that already works it, and used by finished things through `items`, as rope always
was. Eighteen: Blade Blank, Iron Plates, Mail Rings, Iron Fittings (x2) at the smithy; Steel Blade, Steel Plates,
Springs and Screws (x2) at the steelworks; Gun Barrel at the gunsmith; Alloy Plates at the alloy foundry; Haft (x2) and
Bow Stave at the workbench; Joinery and Gunstock at the sawmill; Leather Straps (x2) and Leather Panels at the tannery;
Cloth Panels at the loom; Lens (x2) at the glassworks; Moulded Parts at the refinery. `yields` (new on `ItemDef`) is how
many one piece of work makes. So a Medieval sword is iron ore -> iron (bloomery) -> blade blank (smithy) -> the sword:
four steps; an Industrial cuirass five.

**Depth by age and grade** (`deepen`, applied in place as `ITEMS` is built to the base items, `WEAPONS`, `ARMOUR`,
`WORKSHOP_ITEMS` and `MINERAL_ITEMS`): an item's age is its latest material's (`ageOf`, `MATERIAL_AGE`); its grade its
tier against the age (`FINE`, `TOP`, `ARMOUR_TOP`) or its ware tier. First-age things, and things of fewer than
`SIMPLE_BELOW` (3) materials, are left alone. A plain Medieval piece takes one part, a fine one or anything later two
(its two main materials' parts, or the age's `FITTINGS`); a part replaces the material it's made of (up to
`MAX_OF_A_PART`, 2), so the raw total stays about the same. The age's best pieces (`grade` 2) take one rare input
(`rareFor`): silver for Medieval and Industrial metal, gems later and for magic and trinkets, heartwood for bows, a
thick pelt for the finest leathers, pearls for the finest cloth. Not deepened: food and fare, refining recipes, boats
and airships, battle items, the guild's forged armour, magic foci, relics and uniques. About 260 items take parts.

**Rare inputs** (`RARE_INPUTS`: silver, gems, heartwood, thick pelt, pearls; `heartwood` is a new material, worth 12,
drawn with the lumber picture):
- The land: felling (`fellHeartwood`, `HEARTWOOD_CHANCE` 1 in 80 a unit of wood, Medieval on, from `gatherUnit` in
  `sim/people.ts`); the mines already give silver ore, gold and gems.
- Quests: `rareFind` (`RARE_FINDS` by trip kind, e.g. hunts 25% a thick pelt or heartwood, delves 50%, legendary trips
  80% and two), from `comeHome` in `sim/expeditions.ts`, into the party's loot.
- Trade: the Westwood's and Eastwood's markets sell heartwood (`REGION_MINERALS`); the druids' and fae caravans
  heartwood, the werewolves' and nomads' thick pelts (`FACTION_GOODS`).
Both rolls use their own side streams (`<seed>:heartwood:...`, `<seed>:rarefind:...`) and run only with the autopilot on.

**The planner keeps itself supplied** (`sim/chains.ts`): `chainMakeable` (unlocked, station standing, rare inputs in
store, parts in hand or makeable), `nextStep` (the thing itself once its parts are in hand, else the first missing
part not already on order, down the chain), `chainCost` (the raw materials still wanted down the chain, for the
gatherers). `bestMakeable`, `tryMake`, `makeFirst` and the battle-item step in `sim/planner.ts` use them; the shops'
gear and line stock now take things made of parts (`plain`) where before they skipped anything with `items`. An order
waiting on parts the town can make is no longer dropped as stuck: the planner queues its parts. A piece that needs a
rare input is only chosen when the input is in store, so a town without it makes the next best thing. `wishes`
recommends the station a wanted part needs (`partStationWishes`: "to make the leather straps for the iron sword").

**Quality carries through** (`sim/crafting.ts`): `takeItemInputs` takes parts best first and keeps their mean grade on
the order (`CraftOrder.inputQ`, optional); `pulledGrade` adds `INPUT_PULL` (half) a step to the crafter's roll for each
step the parts are above Common (Rare parts: a step up; Poor: down), the leftover fraction rolled on
`<seed>:chains:<tick>:<order>`.

**Tools wear** (`wearTools`, from `hourlyItems`, autopilot only): each hour someone works with a tool that helps them
(`toolSpeed` above 1; building counts for a hammer) wears it an hour; at `TOOL_HOURS` (60) times its quality's worth it
breaks with a notice and they pick up the best spare. The wear is kept on the worker (`Person.toolWear`, optional) and
carries over a swap. Relics and uniques never break.

**Menus**: the item card (`panel/itemCard.ts` `takesBody`) has "What it takes": each material, part (tappable, where
it's made and from what) and rare input (where it comes from) with what the town has, and what's missing. The recipe
cards (`panel/craftingPanel.ts`) show parts with their icons and a "Missing:" line naming the missing part's station or
the rare input's sources; the Stores have a Parts tab. The stores readout (`mobile/storesPick.ts` `readoutItems`, now
given the items) shows a held rare input first, then the parts held summed, then the stage materials.

**Saves**: no version bump. New optional fields only (`CraftOrder.inputQ`, `Person.toolWear`); an old order for a
recipe that gained parts waits for them (the planner queues them) or is dropped with what was brought returned.

Tests: `test/chains.test.ts` (chains resolve, depth by age and grade, ore to axe, rare inputs gate the best pieces,
quality carries, tools wear, the planner makes a blade before the tool, rare finds, an old save), and a readout case in
`test/storesReadout.test.ts`. One test changed because the design changed it: `test/operators.test.ts` queues an iron
axe, which now takes a blade blank and a little lumber, so its town is given those (the test's point, that only the
smith takes the order, is unchanged). The sim's speed (`tools/perf-sim.mjs`) is the same as before (step about 1.9 ms).

### For the owner

- Food and fare are not deepened (the tavern must keep serving; grain -> flour -> bread is already a chain). Say if
  you want, say, pastry or cheese as parts for pies and tarts.
- Tool wear is kept on the worker, not on each tool, so swapping tools doesn't reset it. Weapons and armour don't wear.
- The best pieces need their rare input in store before the town will make them; travellers' shops don't sell rare
  inputs yet beyond the caravans named above.
- Parts are made one order at a time per part, so a busy smithy may take a while to arm a town in a hurry.
