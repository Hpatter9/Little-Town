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

## folk/<people>/<look>/

The townsfolk, one folder per look (a build in an outfit with a hairstyle, e.g. `settlers/woman_leather`), made
with PixelLab from the project's own front views.

- `index.json`: the frame size (`frame`, 96x96 for now), the 8 `directions` (south, south-east, east, north-east,
  north, north-west, west, south-west: the way the person faces on screen) and each animation's frame count.
- `rotations/<direction>.png`: standing still, facing each way.
- `<animation>/<direction>/<n>.png`: the frames, from 0. Animations: `walk`, `run`, `idle`, `death`, `hurt`,
  `cast_1h`. Armed looks (`<look>+axe`, `+hammer`, `+sword`, `+bow`, `+greatsword`, `+staff`) have their own folder
  with `chop`, `hammer`, `attack_1h`, `attack_bow`, `attack_2h` or `cast_2h`.
- Only `settlers/woman_leather` (standing and walking) is here so far; the rest of the settlers follow.
