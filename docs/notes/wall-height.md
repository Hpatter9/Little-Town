## Walls and doors stand taller than the townsfolk

The owner: "The walls and doors are too short for the height of the townsfolk." A townsperson is drawn 48 px tall
(`HK_K` in `map/mapPeople.ts`; founders 55, children 34); the castle's partitions were 22 px of face and their doorways
15 px high, the curtain wall 16 to 26, the gate 32. Renderer only: the sim and its hashes are unchanged
(`node tools/sim-hash.mjs` matches main).

- `map/castleArt.ts` (the vampires' castle and the dwarves' hold): `TALL` = 64 is how far a wall face stands above its
  foot, `DOOR_H` = 54 and `DOOR` = 24 the doorway in a partition, `TALL_S` = 44 the south wall (the town is seen over
  it, so it stands lower and the hall stays in view). The pieces are drawn taller *upward* from the same foot: their
  zIndex and the footprint are as before, so paths, doorways, `wallDepth` and the clutter placement don't move. A wall
  down a column is its top shown `TALL` above the foot with the wall's end below it. Gates (castle, side gates, the
  hold's carved gate) are drawn `TALL` square (the pack's arch, doubled-ish), opening about 52 px. `TOWER_H` (keepArt)
  58 to 96 so the towers stay above the walls.
- Tall walls would hide the rooms behind them, so `CastleDrawing.walls` lists them and `MapView.seeThrough` draws a
  wall at `WALL_SEE_THROUGH` (0.3) alpha while a person's feet are behind it (eased, like the trees).
- `map/packBuildings.ts`: the ring wall's stone, brick, concrete and force tiers (`STONE_WALL`, stacked crops of the
  dungeon pack's tile) are 80 px tall (were 48, a person's height); their gates are drawn with `GATE_OVER` = 14 px of
  overhang, 1.9 times as big (opening about 28 to 54 px).
- Not changed (baked pack sprites): ordinary buildings' doors (cottage, row house, house3/4 trades 0.35 to 0.5 of a
  person; tavern, inn 0.5 to 0.6; lean-to, hide tent 0.25 to 0.3), the palisade gate's door leaf (30 px) and the single
  palisade posts (32 px), the painted homes' arches (11 to 16 px), the merfolk huts. Fixing these needs redrawn doors
  in `packDressing`.
