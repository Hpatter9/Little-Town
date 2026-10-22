## Crafting chains (the plan)

The owner's ask: better things need more, and more kinds of, resources. Chains of three or four steps (ore -> ingot ->
part -> tool), every item deepened but the first age's simple things kept to one or two steps, and the rare inputs had
from the land, quests and trade. Input quality carries into what's made, tools wear out, and the menus say what an item
needs and what's missing.

This plan fits the systems that are there. Nothing is a parallel table: the parts are ordinary `ITEMS` made at the
existing stations, the rare inputs are materials the game already has (plus one, heartwood), and the planner's own
crafting steps learn to work back down a chain.

### What a chain is

The game already has the first step of every chain: refining recipes that make a material into storage (`smelt_iron`
iron ore -> iron, `saw_lumber`, `cure_leather`, `weave_cloth`, `make_steel`, `make_alloys`...). The new step is the
**part**: an inventory item (slot `null`, flagged `part: true`) made from a refined material at a station, and used by
the finished item through its `items` field, as rope already is. Parts are items rather than materials because items
carry a quality (`s.itemQ`), which is how input quality reaches the finished piece, and they take no storage room.

So a Medieval sword is iron ore -> iron (bloomery) -> a blade blank (smithy) -> the sword (smithy): four steps from the
land. An Industrial cuirass: iron ore -> iron -> steel (steelworks) -> steel plates (steelworks) -> the cuirass.

### The parts (new entries in `ITEMS`, `data/chains.ts`)

| Part | Station | Made from | Research | Used by |
| --- | --- | --- | --- | --- |
| Blade Blank | smithy | iron 2 | iron_working | iron weapons' edges and heads, iron tools |
| Iron Plates | smithy | iron 3 | armoring | iron plate armour, shields |
| Mail Rings | smithy | iron 2 | armoring | mail |
| Iron Fittings (x2) | smithy | iron 1 | iron_working | anything else with iron (packs, lanterns, brooches) |
| Haft (x2) | workbench | lumber 1 | carpentry | spears, axes, tools |
| Bow Stave | workbench | lumber 2 | archery | bows, crossbows |
| Joinery | sawmill | lumber 2 | carpentry | furniture, carts, wares of wood |
| Leather Straps (x2) | tannery | leather 1 | leatherworking | grips, packs, straps under armour |
| Leather Panels | tannery | leather 2 | leatherworking | light armour |
| Cloth Panels | loom | cloth 2 | weaving | robes, padding, tapestries |
| Steel Blade | steelworks | steel 2 | steelmaking | steel edges |
| Steel Plates | steelworks | steel 3 | steelmaking | steel armour, shields |
| Springs and Screws (x2) | steelworks | steel 1 | steelmaking | anything else with steel |
| Gun Barrel | gunsmith | steel 2 | firearms | guns |
| Gunstock | sawmill | lumber 2 | firearms | wooden-stocked guns |
| Lens (x2) | glassworks | glass 1 | glassblowing | glass goods, scopes, goggles |
| Moulded Parts | refinery | plastic 2 | refining | plastic goods and gear |
| Alloy Plates | alloy_foundry | alloys 2 | advanced_alloys | Space-age gear |

The station that makes a part is one the town already needs for the material (the tannery for leather, the smithy for
iron), so no new building is asked for. Who works it: anyone with the Craft job, the station's job holder first, as
for every order now (`findCraft`).

### How deep an item goes (age and grade)

One function, `deepen(def)` in `data/chains.ts`, is applied to the base items, the armoury (`WEAPONS`, `ARMOUR`), the
workshops' goods and the minerals' wares as `ITEMS` is built. It reads:

- **The item's age** from the latest material in its cost (iron, lumber, leather: Medieval; steel, glass: Industrial;
  plastic: Modern; alloys: Space). A Stone Age item (wood, flint, hide, bone, fiber...) is left as it is: the first
  age stays one or two steps.
- **Its grade**: a weapon's or armour's tier against its age (`FINE` and `TOP` tiers per age), a ware's tier.

Then: a Medieval item takes one part; a fine Medieval item, or anything Industrial and later, takes two (its two main
materials' parts, or its main part and the age's fittings). The part replaces the material it's made of in the item's
cost (as many parts as the cost had material for), so the raw total stays about the same and the work grows by the
parts' own crafting. The age's **top** pieces also take one **rare input**.

Not deepened: food and fare (grain -> flour -> bread is already a chain, and the tavern must keep serving), refining
recipes, boats and airships, battle items (`kitItems`), the guild's forged armour (already made of monster parts),
magic foci (queued by `sim/magic.ts`), relics and uniques.

### Rare inputs and where they come from

Rare inputs are materials (they sit in storage and are traded like the rest):

| Rare input | Wanted by the top pieces of | From the land | From quests | From trade |
| --- | --- | --- | --- | --- |
| Silver | Medieval and Industrial metal arms and armour, Industrial guns | silver ore in cleared caves' mines (`sim/places.ts`), smelted at the bloomery | delve hoards, expedition finds | trade caravans to the crags and isles; the Blood Court's, liches' and fae caravans |
| Gems | Modern and Space metal gear, guns, trinkets, magic | the mines' last levels; the dwarves' deep veins | delve hoards, expedition finds | the far isles; the dwarves' caravans |
| Heartwood (new) | bows, crossbows, staves, fine wooden furniture | now and then from felling trees (Medieval on) | delve hoards, expedition finds | the woods' markets; the druids' and fae caravans |
| Thick pelt | the finest leathers | (the guild's hunts) | delve hoards, expedition finds | the werewolves' and nomads' caravans |
| Pearls | the finest cloth | a shore town's sea | expedition finds | the isles; the merfolk's caravans |

Rough rarity: a few a season for a town that digs, sends parties and trades; none for one that doesn't. The planner
only goes for a piece that needs a rare input when the input is in store, so a town without it makes the next best
thing, as it does now, and never stalls on it.

### Input quality to output quality

When work on a piece starts (`takeItemInputs`), its parts are taken best first, and the order remembers their mean
grade (`CraftOrder.inputQ`, optional). When the piece is finished, its rolled grade moves half the way from Common
toward the parts' grade: a Rare blade raises a Common sword a step, a Poor one drags it down. The half step is rolled
on a side stream (`chains:<tick>:<order>`), so towns without parts play out as before.

### Tool wear

Tools wear with work: each game hour someone works with a tool that helps them (`toolSpeed` above 1), it wears an hour.
A tool lasts `TOOL_HOURS` hours times its quality's worth, then breaks (a notice), and the worker picks up the best
spare, or the planner makes another (it already keeps a tool for every worker). The wear is kept on the worker
(`Person.toolWear`, optional). Only with the autopilot on.

### The planner keeps itself supplied

`sim/chains.ts` (pure) gives the planner:

- `chainMakeable(s, def)`: unlocked, its station standing, every part in turn makeable, and any rare input in store.
- `nextStep(s, def, stock)`: the order to queue now: the item itself when its parts are in hand and its materials in
  store, else the first missing part that can be made (working down the chain), else nothing.
- `chainCost(s, def)`: the raw materials of the whole chain still to make, so the gatherers are sent for them.

`bestMakeable`, `tryMake` and `makeFirst` use these, so an order is still never queued until its makings are in hand,
and the shops' gear and wares are made through their parts. An order the player queued that waits on parts is no
longer dropped as stuck: the planner queues the parts for it. The town recommends the station a wanted part needs
(`wishes`: "to make the parts for ..."); it never places it.

### What the menus show

- The item card and the crafting menu: what an item takes (materials, parts, the rare input), with what's missing
  marked, and for each part where it's made.
- The stores readout can show the parts the town holds (a pick in `storesPick.ts`).

### Save compatibility

No new required fields and no save version bump. New optional fields: `CraftOrder.inputQ`, `Person.toolWear`. A
new material (`heartwood`) is just another stock key. Old saves load as they are: an order in an old save for an item
whose recipe changed shows its parts missing; the planner queues them (or, if they can't be made, drops the order and
returns what was brought for it, as it does for any stuck order). Gear already made stays as it is.
