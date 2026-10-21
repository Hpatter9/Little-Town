## The castle and the hold in the isometric view

With the iso switch on, a Blood Court town's castle and a dwarves' hold are drawn from `art/iso/castles/` instead of
the kit's generic pieces (off: nothing changes). The pure plan is `iso/isoCastle.ts`; `iso/isoCastleView.ts` draws it.

- `planCastle(shape, rooms, landW)` turns the snapshot's `castle` (core, gate, side gates) and its finished rooms into
  `Placed` pieces on footprints (cells), each with `depth` = `footDepth`, so they sort with the buildings and the folk.
  The hall's ground is the `keep`; each room one of `hall`, `cellar`, `forge`, `brewery` by `roomPiece(defId)` (a small
  regexp table, falling back to the hall); a `tower` at every outer corner; `wall` runs (`WALL_RUN` cells, `WALL_T`
  thick, flipped along y) on the outer edges; a `gate` (`GATE_SPAN` cells) at the main gate and the side gates, their
  wall cells left clear.
- `PIECE_ID` maps pieces to each people's picture ids (`castlePeopleOf`: `hold` 'castle' = bloodcourt, 'mountain' =
  dwarves); `pieceScale` sizes them (towers by height, walls and gates to their span, the rest to the kit's scale, capped
  by footprint and height). `castleUrl` is where they are served.
- `IsoView.setCastle` (called from `main.ts` each snapshot) feeds `IsoCastleView`; finished castle rooms are no longer
  drawn as kit buildings (blueprints still are), and `buildingAt` finds a room under a tap.
- `build.mjs` copies `art/iso/castles` to `out/renderer/iso/castles` (PNGs only). `tools/build-web.mjs` already puts
  `iso/` in the art manifest as background-downloaded art, so it is cached for offline play (docs/notes/offline-play.md).
- Test: `test/isoCastle.test.ts`. Builds on docs/notes/iso-castles-art.md (the art) and iso-view.md.
