## The isometric view, begun

The town can be drawn isometrically, behind a switch: the ☰ menu's (and the main menu Settings') "Isometric view (in
progress)", off unless turned on, kept in `localStorage` under `littletown.iso` (`iso/isoSetting.ts`: `ISO_KEY`,
`isoViewOn`, `setIsoView`). The strip reads it as it starts, so turning it saves the town (`bridge.suspend`) and loads
the page again, back into the town (`switchIso` in `mobile/mobile.ts`). Off, nothing about the game changes. Only the
drawing differs: the simulation is untouched.

- **The geometry** (`src/renderer/iso/isoMath.ts`, pure, tested in `test/isoView.test.ts`): a 2:1 diamond grid,
  `ISO_TW` 48 by `ISO_TH` 24 a cell. `tileToIso`/`isoToTile` (cells, fractions kept, to the view's px and back),
  `worldToIso`/`isoToWorld` (the sim's world px, `CELL` 32 a cell), `isoOrigin` (the land's top corner, so the land
  sits at x >= 0), `isoBounds` (the camera's bounds), `cellsInView` (the cells a view can touch). Draw order:
  `pointDepth` (x + y), `footDepth` (a building by its front corner), and `standingDepth`, which lifts someone just
  over a building they stand in front of (past its far x or y edge). `footBase` is where a building's picture stands
  (across its footprint's middle, down at its front corner), `footWidth` its diamond's width.
- **The kits** (`src/renderer/iso/isoKits.ts`, pure): the people's kits in `art/iso/kits/` (see its README).
  `kitNameFor(origin, theme)` picks the kit (the alchemists borrow the settlers'; a lich town is the liches').
  `kitOf` reads the kit's `index.json` (imported: small) and its `scale` from `kits.json`; its four ground tiles are
  the pieces ending `_tile` after `scale_tile`, in order (open ground, bare ground, path, field), and `tileCells`
  how many cells one covers (`kitTileCells`: the `scale_tile` at the kit's scale times `ISO_ART`, in cells).
  `roleOf(def)` sorts the game's buildings into parts (`cottage`, `longhouse`, `stockpile`, `workshop`, `tavern`,
  `well`, `chapel`, `granary`, `watchtower`, `wall_run`, `gate`, `market`; a crop's or a herd's footprint is a
  field, drawn as field tiles in the ground), by the `ROLES` table and then rules on the id and the def;
  `pieceFor(kit, def)` finds the part's piece in the kit (`ROLE_PIECES`: the kits name some their own way, the
  dwarves' `ale_hall`), a piece named as the building itself first (the knights' `barracks`), else `cottage`.
  `groundTile` gives a cell's tile and a tint for grounds the kits have no tile of (water is the bare tile in blue).
  Every piece is drawn at the kit's `scale` times `ISO_ART` (0.5: the cells are half the kits' size, so a 3x2
  cottage is 120 px, the townsfolk keep their top-down size), shrunk only to fit a footprint much smaller than it
  (`OVERHANG` 1.25); walls and gates (`fitted`) are fitted to their footprint.
- **The view** (`src/renderer/iso/isoView.ts`, `IsoView`): `syncLand`, `setKit`, `syncBuildings` each snapshot;
  `setCamera` draws only the ground in view (a pool of tile sprites, one per block of `tileCells` cells, back to
  front, painted again only when the view crosses a cell or the land or a picture changes). The buildings are
  sprites in `things` (sortable), anchored at their base, a blueprint at 0.45 alpha. The townsfolk are the top-down
  view's own: `main.ts` makes `MapPeople` draw into `iso.things`, and `placeLoose` (each frame, after
  `people.render`) moves whatever it set in world px onto the diamonds and gives it a depth, keeping its order among
  its own (a bubble over everyone, a horse under its rider). `buildingAt` picks the front-most picture under a
  screen point; `worldOf`/`screenOf` stand in for the map's.
- **Wiring** (`main.ts`): with the switch on, `iso.root` goes into `map.root` beside the hidden `map.world` and
  `map.lights` (the top-down map still keeps its state: its hit tests, and the layers not drawn in iso yet);
  `map.worldOf`/`map.screenOf` are the iso view's, so the tap card, the hover and the overheads follow; the camera is
  made over the iso bounds and `MapCamera.project` (new, optional) turns the points it centres on or follows from
  world px; `isoPersonAt` tries the ground a little below a tap, since the tap lands on a body above its feet. The
  pan, the phone's pinch zoom (the page scales the strip) and the tap card work unchanged.
- **The art by URL**: the PNGs are never imported (the web build would inline megabytes). `build.mjs` copies
  `art/iso/kits` to `out/renderer/iso/kits` (the PNGs only), `tools/build-web.mjs` on into `out/web/iso`, and the
  view loads each piece with `loadImage(kitUrl(kit, piece))` the first time it draws it. The offline service worker
  keeps each piece as it is first fetched (like the townsfolk's layers: `iso` is left out of the install list, so a
  phone doesn't download a dozen peoples' kits, 6.7 MB, to play one).

Left for later: walls joined into runs and corners, streets as streets, props, trees and rocks, the lights and the
night, the weather, raiders and the other map layers (not drawn in iso), biome tints, and the iso townsfolk sprites
(8 ways, 96 px frames). The depth sort is per point and per footprint, not a full topological sort, so a long
building can still overlap wrongly at its ends.
