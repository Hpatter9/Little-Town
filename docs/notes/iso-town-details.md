## The iso town, filled in

Builds on "The isometric view, begun" (`docs/notes/iso-view.md`). Still behind the Settings switch; the simulation is untouched.

- **Pure rules** (`src/renderer/iso/isoTown.ts`, tested in `test/isoView.test.ts`): `wallMaskAt`/`wallShape` (a one-cell wall
  is a run along x, a run along y (the sprite flipped) or a corner, by which of its four neighbours are wall; a tee or
  cross takes the corner), `gateFlip` (a gate taller than wide is flipped), `wallPieceFor` (the kit's run, corner or
  gate made of what the wall is: `stone_wall` takes `stone_wall_run`, else the first), `sceneryFor` (trees on woods,
  rocks on stone, bushes on marsh and hills, from whatever the kit has; dead or pine trees in dry or cold biomes),
  `propFor` (a barrel, crate, cart, lamp, woodpile or hay bales beside a working building, picked from its id),
  `cellHash` (the deterministic 0..1 hash these use), `BIOME_GROUND`/`mulTint` (the biome's tile and tint).
- **The view** (`isoView.ts`): walls and gates draw the joined piece (`syncBuildings` collects the wall cells first);
  `paintCells` lays a tile on every cell of a street (path tile), a worn footpath (bare tile, faded by wear) and a field
  (field tile), over the block tiles, and puts trees, bushes and rocks on wild cells in view (a pooled sprite each in
  `things`, depth `x + y` of the jittered spot; felled or rubbled cells (`regrow`, `rubble`) are bare); `setProps`
  puts a prop beside each finished working building. `setBiome(next.biome)` (one line in `main.ts`) tints the open
  ground (`groundTile(..., biome)`): desert and ashlands the bare tile, tundra pale, jungle and swamp deeper green.
- **Assumptions**: the kits' runs lie along the land's x (down-right on the screen) and their corners point their
  front at the viewer, joining -x and -y; a corner for other joins is approximate. Streets still planned (`plannedRoads`)
  are not drawn.
