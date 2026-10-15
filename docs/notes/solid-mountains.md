## Solid mountains

The owner's ask: the mountain's rock is solid. Nobody walks on it (couriers, caravans, travellers, townsfolk, raiders, the
envoy), and a hold's rooms are dug from the doorway inward, by diggers standing on open or already-dug ground. This
changes the "The dwarves' hold" and "Walls that hold" sections of HISTORY.md (a room was carved whole when laid).

- **Rock was already `Infinity` in `stepCost`** (`sim/land.ts`); the holes were the goal cell (`findPath` always allows
  the goal, so a face to cut or a room's middle put the walker *in* the rock), the straight-line fallback of
  `walk` when no way is found, an edge spawn on a spur of rock, and the envoy / courier riding straight.
- **`standFor(m, from, to)` (`sim/walk.ts`):** a goal inside rock is moved to the open or dug ground beside it (the side
  nearest the walker, four sides before corners, else the nearest open cell within 8). `walk` and `pathTo` both apply it.
- **`straightShort`:** with no way found a walker goes straight at the goal only as far as the first cell of rock.
- **Digging a room (`sim/castle.ts`):** `placeBlueprint` and `upgrade` no longer carve a hold's room. `digOrder(s, rect)`
  lists the rock left in a room: it begins at the cell of rock a walker can step into through the castle's walls
  (`castleStep`, so through a doorway) nearest the camp, then spreads cell by cell through the footprint (breadth-first,
  ties by row and column). `digRoom(s, b, progress)` cuts as many cells as the build's progress is of the whole (all at 1);
  the `build` task calls it every tick. `digStand` is the cell a digger stands on: open or dug ground beside the next
  cell to cut, reached through the walls.
- **`buildSpot` / `goToB` (`sim/people.ts`):** for a hold's room still being cut, builders and haulers go to `digStand`
  (a done room or the hall may be stood in); other builders' spots never lie on rock. A room with no rock left falls back
  to the old spots.
- **Arrivals:** `edgeXY` (`sim/state.ts`) moves an edge spot on rock to the nearest open cell with a way to the camp
  (`openEdge`, remembered while the land's cells are the same); band members strung out behind the first stay off rock
  (`strung`, `sim/bands.ts`); the wagon doesn't roll onto rock (`rollWagon`); the envoy rider (`sim/factions.ts`
  `envoyTick`) now `walk`s instead of riding straight. The renderer's couriers (`map/mapCourier.ts`) never start on rock
  or water and try bearings all the way round the fog's edge for a way in (no straight-in fallback any more).
- **Caches:** `walk.ts`'s failed and found-ways caches are keyed on `land.cells` and forget only the ways whose
  searches looked at a changed cell, so a dug cell (it changes the string) clears exactly the ways that saw it.
- Tests: `test/solidMountain.test.ts` (paths never cross rock, a face is worked from beside it, sealed goals stop at the
  rock, edge spots, a courier from the walled-in north, dig order from the doorway, a 5-day hold run with nobody on
  rock); `test/castle.test.ts` (room ground cut as it is built, not when laid). `tools/probe-mountain.mjs` scans a
  dwarves town for anything standing on rock.

### Hallways (the dwarves' hold as a dug network)

The owner's ask: hallways for the rooms to sprout off, like a real mountain town. A change to "The dwarves' hold" /
"The castle as one body of rooms" in HISTORY.md: a hold's rooms used to join any cell of the castle (the hall, a room,
a gallery dug for ore).

- **`hold_hallway`** (`data/buildings.ts` `HOLD_HALLWAY`, dwarves only, 2 wide and 4 deep, 3 stone, 30 s): a castle
  room that is only a passage. It is cut like any room (the dig above) and drawn as bare floor: the dungeon pack's
  flagstones under every room (`castleArt.ts`), no furniture (`mapView.ts` `hallBare`; `test/packCoverage` skips it).
- **The rule (`sim/castle.ts` `hallCells`, used by `canPlace` and the planner's `roomSpot`):** a hold's new room, hallway
  or not, must share a wall with the entrance hall or a hallway, never with another room or a gallery. New rooms carry
  `halled`; `offHall` in `castleLayout` drops the doorway between a `halled` room and any room that isn't the hall, a
  hallway or the seat (the seat's hall lies over the entrance hall's cells), so a room opens only onto a hall.
- **Older saves:** rooms already built stay as they are (no `halled` flag, their doorways kept). A hold with no hallway
  that `hallSpot` can't cut one for (its hall walled in on every side) still grows rooms the old way.
- **The planner (`sim/planner.ts`):** `hallSpot(s)` (cached by building count, land version and open radius): the main
  hallway runs north into the rock from the middle of the entrance hall's top wall (`trunkSite`, kept clear of rooms
  till it's cut), up to three lengths deep; then side halls branch off it and off one another, nearest the camp first.
  `tryHall` cuts the main one once three rooms stand, and another whenever a room finds no hallway frontage; one at a
  time. Hallways sit within the known land, so a long trunk waits for the land to open.
- Test: `test/solidMountain.test.ts` ("every new room of a hold opens off the entrance hall or a hallway, and the
  hallways join the entrance"). `tools/hold-map.mjs [days]` prints a hold as a map.
- Soak (dwarves, 20 days, 6 seeds): people 4.2 before, 4.0 with solid rock and hallways (3.8 with solid rock alone),
  one town of six lost its last founder to lightning on day 20. Settlers, orcs and knights (2 seeds) unchanged.
