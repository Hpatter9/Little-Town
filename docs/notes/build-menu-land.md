## The build queue, counts, stumps and ruins, research by hand, the wheelbarrow (branch claude/build-menu-land)

The owner's asks from playing on the phone. Changes HISTORY.md "The build menu: the founder builds", "A simpler build
menu", "Research offered three at a time", "Land clearing by hand" and docs/notes/iso-buildings.md (the archery range).

- **How many of each building** (`panel/buildPanel.ts` `countOf`): each row of the build list says what the town has of
  it under its cost, e.g. "2 built · 1 going up · 4 queued" (`.brow-count` in `panel/panel.html`); nothing when none.
- **A longer build queue** (`sim/pins.ts`): `PINS_MOST` 5 -> 20, and the same building can be ordered again (three
  lean-tos): the "Already wished for" refusal is gone. Each order has its own `Pin.id` (from `s.nextId`; older saves'
  orders have none), and `pinBuilding { def, on: false, id }` cancels just that one (without `id`, every order of that
  building, as before). Orders are still built in the order given: `planPins` (planner.ts) takes the first that can be
  placed when a building slot frees (one held back for want of materials or room lets the next go ahead). An order
  waiting its turn (`SLOT_WAIT`, every slot busy) is never given up after `PIN_WAIT_HOURS`, and its clock restarts
  while it waits; only time stuck on something else counts. The town's recommendation skips a building already
  ordered. **The menu:** a line "Your orders: 7 of 20, 5 waiting their turn. Built in this order as building slots (3)
  free up." over the numbered orders ("1. Lean-to ... next up", the rest "in line", a site its progress); an order
  still in line has no progress bar, so a long queue stays short. Snapshot `pins[]` gains `id` and `site`.
- **Stumps and ruins cleared** (`sim/landClutter.ts`, new): the Clear tool (and a tap's card, "Clear it") now takes
  clutter on open ground as well as wild land. A **stump** is a felled wood's cell still in `LandMap.regrow` (was
  'forest'); a **ruin** is a starting valley's landmark (`sim/startValleys.ts`: old walls, ruins, pillars, the statue,
  the well, boulders, bones, the cart, the signpost; never the reeds or flowers) on the ground the valley laid, not
  yet cleared. `markClear` gives it a pool (`clutterPool`: a stump 2 wood, a wall or ruin 4 stone, the rest 3 stone,
  bones 2 bone, a cart or signpost 3 wood) and the gatherers work it like a wild cell (`CLUTTER_WORK`: a stump is
  chopped at 8 s a unit, a ruin broken up at 10 s, `workGather` in people.ts). Worked out (`clearCell` ->
  `clearClutter`): the stump's regrowth is dropped, so no wood grows back there; the ruin's cell goes into the new
  `LandMap.cleared` and the map stops drawing it (`iso/isoView.ts`). Unmarked before it's done, the pool goes again.
  `landmarksOf(valley, land)` and `clutterAt(land, marks, i)` are pure, so the map's Clear tool asks the same
  (`clearableCell` in main.ts). The banner reads "Drag over trees, rock, stumps and ruins".
- **The "castle walls" on a new Forest town** were the Old Ruin starting valley's landmarks (docs/notes/hand-made-maps.md "The starting
  valleys, drawn by hand", `maps/start-valleys.ldtk`): a ring of tumbled walls drawn by hand, picked for forest, steppe, highlands,
  desert, ashlands and taiga towns 60% of the time with the other forest valley. They were drawing only, never seen by
  the rules, so nothing could take them away. They are kept where the valley puts them, and now cleared as above.
- **Two icons from the Free Mining Pixel Icons pack** (`src/renderer/ui/art/`): the Underground button
  (`mobile/undergroundSwitch.ts`, `#ug-btn`) shows the pack's pickaxe (`pickaxe.png`, Icon31_01) and Clear land
  (`main.ts`, `#clear-land`) its spade (`shovel.png`, Icon31_05), where both were the ⛏ emoji. Credited in CREDITS.md.
- **Research waits for the player** (`sim/researchOffer.ts` `townPicksResearch`): the planner's choice from an overdue
  offer (`planResearch`) now only runs for the old hands-off town, `GameState.townResearches` (new, optional) or
  `townBuilds`, which tests set. A player's town studies nothing until a topic is picked. To keep it from stalling
  unseen: a fresh offer (not one redrawn under a standing one) posts the key notice "Choose what to study next: three
  topics wait in the Studies menu." (autopilot on, not the hands-off town), and the Studies tab carries a pulsing gold
  dot (`#tabs button.waiting::before`, `mobile.ts`) while an offer stands with a study slot free. The Studies menu
  says "Tap Study on one. Nothing is studied until you choose." (the countdown is gone; `offerLeft` is still in the
  snapshot). Old saves load as they are. Tests that leaned on the town's own pick set `townResearches`
  (`originPlanner`, `researchPicks`, `researchOffer`'s hands-off test).
- **The archery range lies on its cells** (`training.ts`, `art/iso/buildings/index.json`, `iso/isoMath.ts`
  `groundFit`): its footprint was 3 by 1 (from the old top-down strip) under a PixelLab picture of a plot about 3 by 2
  drawn steeper than the diamonds, so it hung across the cell lines. It is now 3 by 2 (`depth: 2`), and the index
  carries its plinth's corners (`ground`: left, front, right in px). A shared piece with `ground` is laid with
  `groundFit`: across scale, a squash of the heights and a slant (x' = a x, y' = b x + d y), so the plinth's corners
  land on the footprint's and the targets and posts stay upright (the sprite's `setFromMatrix`). An archery range
  already standing in an old save takes one more row of cells. The quoits pitch (3 by 1, `along_y`) may want the same
  if it looks off.
- **The wheelbarrow as a study** (`data/research.ts`): "The Wheelbarrow" (`wheelbarrows`), a Neolithic logistics
  topic after Woodcutting, 210 s, +5 carry for everyone (`carryCapacity`). The Wheelbarrow pack item (Carts, +12) and
  the barrow drawn under heavy loads (`map/haul.ts`) are unchanged.
- **Tests:** `test/landClutter.test.ts` (a stump marked, grubbed out for wood, no regrowth; unmarked again; an Old Ruin
  wall worked for its stones and gone), `test/pins.test.ts` (repeat orders, cancel by id, the 20 limit, orders in line
  never given up), `test/researchOffer.test.ts` (a player's town never chooses; told once per fresh offer),
  `test/wheelbarrow.test.ts`, `test/groundFit.test.ts`.
- Screenshots (393x852 and 852x393) in `docs/notes/build-menu-land/`: the queue and the counts, the Studies menu
  waiting with the tab's dot, ruins marked for clearing with the spade lit, the archery range, and the two icons.
