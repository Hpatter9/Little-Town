## Walls sort by their foot on the cell edge

The owner: "The walk paths are overlapped by the walls, so when a townsfolk walks by a wall, they look like they're
walking on the wall." Renderer only; the sim and its hashes are unchanged. Changes the "Walls and doors stand taller
than the townsfolk" section.

What was wrong: a castle or hold wall's foot (its zIndex, the line people sort against) was not on the cell edge. The
curtain wall's inside face hung 26 px into the first row of the hall, a partition's 22 px into the room below, the south
wall's 16 px out over the ground (and so tied exactly with a walker's feet one row below it). Townsfolk walk the row's
centre (16 px in), so a person in the first row beside a wall was drawn *behind* its foot, hidden or, with the fade,
a ghost on its face. The fade also fired for anyone near a column wall's tall sprite, even someone beside it.

- `map/castleArt.ts`: `FOOT` = 4. Every horizontal wall piece, gate (castle, side, hold) and tower now stands with its
  zIndex on the cell edge (`py + FOOT`; the south wall and gates `py + CELL + FOOT`; towers `cy + 6`). Heights
  (`TALL`, `TALL_S`, `TOWER_H`, door sizes) are as before, so the pieces are the same size and sit higher by the old
  face depth. Someone in the row beside a wall is drawn in front of it, someone in the row behind is behind it.
  `wallDepth` (clutter) is unchanged, so rooms keep a clear aisle under their top wall.
- The outer north wall and the hold's north rock are no longer in `CastleDrawing.walls`: only the outside lies behind
  them, so they never fade (people there are simply hidden, as behind any wall).
- `map/mapView.ts` `seeThrough`: a column wall (`texture.width <= CELL / 2`) fades only for someone in its own strip
  and north of its row; others as before (north of the foot, within the piece's width).
- Not changed: ring-wall stone tiers (a building, `zIndex` = its bottom row, already in front of anyone south of it),
  people, raiders, animals, pets, props (all sort by their feet).
- Preview: `__game` saves made with `paused: true` and people placed along both sides of walls and the gates.
