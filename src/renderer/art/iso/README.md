# Isometric art

The art for the isometric view (being built; the top-down view is still the game's view).

## kits/<people>/

One folder per people (settlers, knights, dwarves, bloodcourt, liches, druids, fae, machines, moonpack, orcs,
merfolk, nomads). Each sprite is one piece of the people's building kit, named in `index.json` (`id`, `w`, `h`, and
`src`, where it was cut from the source sheet). The pieces are drawn in a 2:1 isometric view, lit from the upper left.

- **Sizes differ by people.** Each kit is kept at the size it was drawn, never scaled up. `kits.json` gives each
  people's `scale`: draw that kit's sprites at `scale` so every people's cottage comes out 240 pixels wide, the
  size the townsfolk sprites are made for (a grown townsperson is about 88 pixels tall).
- **`scale_tile`** is a flat ground diamond drawn with the kit, for working out the kit's tile size.
- Common ids: `cottage`, `longhouse`, `stockpile`, `workshop`, `tavern`, `well`, `chapel`, `granary`, wall runs,
  corners and gates, `watchtower`, ground tiles (`grass_tile`, `dirt_tile`, `cobble_tile`, `field_tile`...), roofs,
  and props (fences, lamps, carts, barrels, crates, trees, bushes, rocks). Each people has its own extras (the
  liches' `mausoleum`, `bone_wall_run`...): read the people's `index.json`.
- PNGs are paletted (256 colours) to keep them small. The web build inlines every PNG it imports, so load these by
  URL rather than importing them all, or the phone app grows by megabytes.
