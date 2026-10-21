## The raid board in the isometric look

Changes "Tactics battles" (`tactics/tacticsView.ts`): with the Settings switch on (`isoViewOn`), the board's art comes
from the town's people's kit (`iso/isoKits.ts`); with it off nothing changes (`TacticsScene.iso` is null).

- `tactics/isoBoard.ts`, `IsoBoardArt`: `setKit(origin, theme)` (`kitNameFor`), `image`/`texture` (kit pieces loaded by
  URL on first ask, `arrived` counts them and goes in the board's key so it is built again as they come), `top(ground,
  road)` (`groundTile`'s tile and tint), `sidesOf` (the column's sides and lip taken from colours of the tile's own
  slab edge, so they sit under the new top).
- Tile tops: the kit's ground tile (open, bare, path) drawn onto the 64x32 diamond (clipped; a tint multiplied in for
  water, sand and rock). A tile whose kit picture hasn't loaded returns null, so the board is built again next snapshot.
- The town's wall, gate and towers on it: `pieceFor` of the wall's def (a run a tile wide, the gate over its two tiles
  at 1.3 tiles) and of the tower's building def (`defs`, from the snapshot's buildings), stood on their tile's front
  corner and sorted by `isoPiece` (`picture`). Traps, trees, boulders and logs are unchanged (no kit art placed yet).
- Not done: field tiles (the board has no field cells), pond tiles use the bare tile tinted blue.
