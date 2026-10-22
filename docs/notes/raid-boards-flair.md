## The raid boards dressed, their walls the right way

The owner's ask, after the hand-made raid boards (0.187.0): "The walls in the new raid maps are sideways. And these maps
seem pretty basic, add flair to them like we had on our maps you made. Trees, rocks, hills, etc." This changes HISTORY
"Hand-made raid boards, drawn in LDtk" (docs/notes/raid-boards-ldtk.md), "The raid board in the isometric look" and, for
two kits' stone walls, "The isometric view, begun" (the town's walls). The fight's rules are unchanged except where new
props and heights stand on the boards.

**Walls and fences along their runs.** The kits' pictures don't all lie the same way: most wall runs lie along x
(down-right on the screen), but every kit's fence, and the settlers' and knights' stone wall runs and the settlers'
stone gate, lie along y (measured from the pictures: `ALONG_Y`, `liesAlongY` in `iso/isoKits.ts`). The board drew every
piece as it was drawn, so the town's wall down the board's column and the fences along its rows stood across their
lines. Now `tactics/boardDress.ts` `runParts(join, lone, pic)` picks, for each tile of a run, the picture as it is or
mirrored so it lies along the neighbours of the same piece (`joinOf`): a straight run along them, an end along the one it
has, a corner or a tee a half picture toward each neighbour (`IsoBoardArt.half`), a piece on its own along `lone` (a
fence across the board, a fallen wall down it like the town's). The town's wall and gate on the board (tacticsView.ts)
and the hand-made boards' fences and fallen walls go through it. The town map's walls (`iso/isoView.ts`) keep their own
joins (`wallShape`), but a run or gate whose picture lies along y is now mirrored the other way: the settlers' and
knights' stone walls stood sideways on the town map too. Palisades and every other kit's walls are as before.
`docs/notes/raid-boards/fence-before-after.png` shows a fence run in Hedge End before and after.

**The dressing (LDtk).** `maps/raid-boards.ldtk` has a new entities layer, **Decor** (entity `Decor`, field `kind`,
enum `Decor`): `grass`, `tallgrass`, `reeds`, `flowers`, `stump`, `branch`, `mushrooms`, `fern`, `pebbles`, `shrub`,
`thorns`, `bones`, `skeleton`, `pillar`, `dune`, `drift`, `floe`, `snowrock` (`DECOR_KINDS` in `sim/raidBoards.ts`), one
a cell. None of it is in the rules: nobody is stopped, slowed or hidden by it (the test builds each board with and
without it and finds every tile otherwise the same). The converter (`tools/ldtkBoards.ts`) writes it as each board's
`decor: [u, v, kind][]`, `makeHandBoard` puts it on `TacTile.decor`, and the wall clears it from the wall's line. The
eight boards are dressed (15 to 55 bits each): reeds along every bank and boardwalk, grass, tall grass and flowers in the
meadows and along the hedges, stumps, ferns and mushrooms at the wood's edge and under the trees, pebbles on the dirt and
the ridge, drifts on the Frozen Mere's snow and floes on its ice, sand mounds, broken pillars, dry shrubs, a few bones and
a dragon's skeleton in the Sunken Court, thorns and fallen branches in the Fenwalk's mud.

**New props and cover, real height.** `PROP_KINDS` gains `ruins` (a ruined arch), `boulder`, `statue`, `wagon` (the
nomads' covered wagon), `campfire`, `hut` (the settlers' cottage) and `mill` (the town's windmill); like the other props
nobody crosses them and they're never on the town's side of the wall. `THING_PIECE` may now name another kit's piece as
`kit/piece`. Placed: Mill Ridge's mill with its barrels and woodpile and a cart; Hedge End's hut and well; Greenwood's old
statue in the clearing; boulders on the Ford and the Frozen Mere; the Sunken Court's ruined arch and wagon. More trees
(lone ones and clumps, the town's back corners), bushes, and heights in the Height layer: a rise on the Ford's west bank
and its south bank, a knoll in Mill Ridge's field, rises at Hedge End's corners, the wood on a bank either side of
Greenwood, a slope up to the Narrows' mouth, the Frozen Mere's shores banked above the ice, dunes along the Sunken
Court's edges, a rise at the Fenwalk's dry corner. Every step is one; the tests' every-spot-reaches-the-fight check
passes on all eight.

**The drawing (iso look only).** `tactics/boardDress.ts` (pure, `test/boardDress.test.ts`):
- `FLORA`: each land's trees, bushes and rocks from the iso kits, several of each, picked by the tile (`pickOf`,
  `cellRoll`): oaks, birches and pines in the forest; pines and small pines in the taiga; snowy pines and bare trees in
  the tundra; acacias on the steppe; palms and mangroves in the jungle; mangroves, gnarled and dead trees in the swamp;
  burnt and dead trees on the ashlands; palms and acacias in the desert. In winter the green lands' trees are the snowy
  ones (`floraOf`). The board's trees, bushes and boulders (hand-made and generated boards both) are drawn with these
  instead of the flat view's pack props, as the iso town draws its own; a log is the packs' fallen trunk.
- `DECOR_ART`: each dressing's pictures, width and count (grass tufts and flowers are strewn several to a tile), the
  tall ones (`DECOR_TALL`: reeds, tall grass, fern, thorns, shrubs) kept under a tile's height so they never hide
  anyone; reeds and tall grass sway. A drift is painted (no pack has one): a blue lee shadow and two or three white lumps.
- `generatedDecor`: a generated board (no `TacticsView.board`, a new optional field) gets a little of the same strewn
  over its open ground by the land cell: reeds by water and in marsh, stumps, mushrooms and ferns beside trees, grass and
  flowers in the open, drifts in the cold, dunes and dry shrubs on sand, pebbles on rock. Never on a road, the wall,
  cover, a prop or a trap.
- Props are drawn wider where they're big (`PROP_WIDE` in tacticsView.ts: the hut, the mill, the arch, the wagon).
- The board's key (when it's rebuilt) now holds the land, the season, the board's name and the dressing.

**The art.** `src/renderer/art/iso/kits/wild/` (41 small PNGs, 180 KB), copied and trimmed from the Craftpix packs by
`tools/compose-board-wild.py` (its `index.json` names each one's source); credited in `CREDITS.md`. The built kits folder
carries it to the phone (`iso/kits/wild/`). The iso kits supply the trees, bushes, rocks, boulders, the wagon, the hut and
the fire. PixelLab and OpenAI's image API were both out of credit, so nothing new was drawn for this; a proper iso snow
drift, sand dune and lily pads would need drawing (or the next PixelLab month).

**Tools.** `tools/compose-ldtk-atlas.cjs` has the new props and the dressing in the editor's tileset (rows 4 to 7;
`maps/raid-boards-tiles.png` is now 256x256), and `tools/ldtk-preview.cjs` draws the Decor layer under the things. For
previews, `__raidBoard('land')` makes every raid's board the land's own (a generated one).

**Screenshots** (`docs/notes/raid-boards/`): every hand-made board in a raid at 393x852 (`*-tall.png`) and 852x393
(`*-wide.png`), in a land it's drawn for (forest for the Ford, Mill Ridge, Hedge End and Greenwood; highlands for the
Narrows; tundra, desert and swamp for the rest); `generated-swamp-wide.png` a generated board; `ldtk-*.png` the LDtk
previews with the dressing.
