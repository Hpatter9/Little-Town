## Thinner castle and hold walls

The castle's and the hold's walls are drawn thinner, so less of each room is hidden behind them and the floor under
each room's top wall (the space furniture and people are placed in) is larger. Only the drawing changes; the sim is the
same.

The file is `src/renderer/map/castleArt.ts`. The wall thicknesses and faces, in px:

| Constant | Was | Now | What it is |
|---|---|---|---|
| `PART_T` | 6 | 4 | a partition's walk (its top) |
| `PART_FACE` | 22 | 10 | a partition's face, seen from the room below |
| `WALL_T` | 8 | 4 | the curtain wall's walk |
| `INNER_FACE` | 26 | 10 | the curtain wall's face seen from inside |
| `ROCK_T` | 12 | 6 | a hold's rock band and side wall |
| `ROCK_FACE` | 24 | 12 | a hold's hewn rock face |
| `SIDE_T` | 10 | 6 | a partition's side run (down a column) |
| `OUTER_SIDE_T` | 10 | 6 | the curtain wall's west and east runs |

`wallDepth(mountain, outside)` (the depth a wall takes into a room, read by `map/castleClutter.ts` as `topWall`):
- partition: 28 → 14
- curtain wall from inside: 40 → 20
- hold's rock: 36 → 18

Unchanged on purpose: `TALL` (64) and `TALL_S` (44), so wall heights stay the same; `FOOT` (4) and the sort order from
0.94.0; `DOOR` and `DOOR_H`, so doorways are the same clear opening; `MERLON` (6), which the battlements in
`map/keepArt.ts` also use.

The wall picture still rises `TALL` above its foot, so a wall still covers the room behind it by the same height. What
is smaller is the depth the walls take across the room, and the thickness of the walk and face.
