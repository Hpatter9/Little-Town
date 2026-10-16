## The war map as an island (claude/war-island; the owner's ask: "an island surrounded by water so the whole thing is on the map to be viewed. Clean the map up and make it more readable")

Changes HISTORY "Seasons of war with the realm" (its **Seen** and **The War tab on the phone** lines: the map's
drawing) and "The Conquest update" (the painted map, `panel/warMap.ts`). Renderer only: the sim, its saves and
`tools/sim-hash.mjs` are untouched (the realm's world is still `sim/conquest/world.ts` `makeWorld`, made from the seed
on every load; nothing else, not the Expeditions world map nor `map/wideWorld.ts`, shares its positions).

- **Why not in the sim.** The world is rebuilt from the seed whenever a save opens and the save keeps only who holds
  which province, so a new generation would reshape every older realm under its save (province ids, neighbours and
  holdings with them). Its land fills 62% of the square (`LAND_SHARE`), so it ran to the grid's edges (a fifth to a
  third of the border), the provinces seeded far apart sat on those edges, and it stood in two to five pieces joined by
  harbours.
- **The island** (`panel/warIsland.ts`, pure, no DOM: `islandOf`, `piecesOf`, `islandMargin`): the map draws the world
  through a projection. A ring of open sea `islandMargin` cells wide (a tenth of the side, at least 6) round the grid;
  land at the old edge grown out into the ring by noise (0.4 to 3.2 cells, the corners rounded by distance; a
  mountain meets the sea as shore), so the coast is ragged, never the grid's straight edge; then each piece apart from
  the biggest joined to it across the narrowest water by a strip of shore two cells wide (`joinPieces`), each half
  given to the province at its end. Every province keeps its cells and its place, shifted by the ring. Cached by the
  world's cells. The province's card still says "on the sea" from the sim's own coast.
- **The sea**: the painted ground's depth shades and foam (`art/warTerrain.ts` `paintGround`, as before) with the
  Top-Down Seabed pack's weed, shells and stones faint in the shallows (`props/sea.png`, already in the game; the
  drowned statues left out), as the town's own shore does (`map/groundArt.ts`). The wild props are thinned to half
  (`densityMult` 0.5), so the marks read over them.
- **One mark a place** (`warMap.ts` `drawMarks`, `placeKind`, `MARK`): the town, a power's seat, a realm's hold or free
  ground; a disc in the holder's colour (the town's ringed gold, free ground dark) under the one pack building that
  stands for it (by the holder's people and the tier: keep or castle for a seat, house, longhouse or gabled house for a
  hold; tents for the nomads, the carved gate and a mine for the dwarves; a lair's cave on free ground), a banner on a
  seat and the town, an occupier's garrison badge. Gone: the clusters of three to five buildings a province, the
  landmarks beside them, the captains and their big flags on the march, and the compass (all overlapped).
- **Roads**: a thin line between every pair of neighbours; a sea lane (the harbours' strait) dotted white.
- **Hosts**: a dashed line in the host's colour to where it marches (a harvest raid dotted, the town's war party
  gold), and an arrowhead on it pointing the way (`marchAt`, `marchColour`). A place a host marches on has a red ring.
- **Labels** (`mapLabels`, `placeLabels`): every place's name and every host's strength asks for a spot below its
  mark, then above, right, left; the most important first (the town 100, a seat 80, a host 60, a hold 40, free 10; +30
  under attack, +200 the place picked, + its tier); one that fits nowhere clear of the labels already placed, of the
  other marks and inside the view is left out (the town's may lie over a mark, `MUST_RANK`, so it is always named). 11 CSS px at least (12.5 the town's, a seat's and the picked); zoomed
  in, the pass runs again at the new scale, so more names show.
- **Tap**: the place whose mark is within 16 CSS px of the finger, else the province the ground is of.
- **The key** under the map (`mapLegend`, `.war-key` `.ui-chip`s, `--ui-fs-small`): each realm's colour and count,
  free land, a seat, a host on the march, and (with hosts out) under attack (`icon('raid')`).
- **Fit** (`terrainCell`): upright the island takes the menu's width; sideways it fits the menu's own height less
  the sub-tabs' row that stays over it (`#body`'s height, not the window's: the map was cut off under the tabs), no
  sideways scroll. The zoom's buttons moved from over the map's corner (they hid names) to the end of the key's row.
  Seen at 393x852 (map 340 px) and 852x393 (213 px) on the late-town fixture and a young town. The text sections stay under the map; the map paints only on a
  redraw, which comes only when `warKey` changes.
- **Tests** (`test/warIsland.test.ts`): on the fixture and on worlds of 2, 5, 9 and 12 realms from four seeds, every
  land cell and province is kept where it was, every province's place stands on its own land, two cells of sea at
  every edge, one landmass; on the fixture with four hosts, at 393 px wide (dpr 3 and 2.75), zoomed 2.5x and on a
  desktop width, no two labels overlap, none is under 11 px, all inside the map, the town is named.
