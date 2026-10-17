## Cliffs that join, and the evening shadow of the high ground (changes "The hills and mountains", 0.155.0)

Two leftovers of the hills and mountains, renderer only (no sim change).

- **Cliff edges on the autotile** (`map/reliefArt.ts` `paintRelief`). A cliff face (the cell below a `HIGH` cell) now takes its
  arms with `maskOf`/`pieceOf`/`armsOf` from `art/autotile.ts`: N is always set; E and W are set where the neighbour is high
  ground or has high ground above it (the cliff runs on). A side with no arm is an end: the dark rim of the shelf above runs on down
  the face, tapering at its foot, so the face turns away like the brow above it instead of being cut square. The Undead
  overhang (`art/under/cliff.png`) is now taken in order along the cliff (`(x*2 + half) % 31` slices of 16 px) instead of a
  random slice per half cell, so neighbouring cells carry on where each other stopped.
- **The evening shadow** (`reliefArt.ts` `shadeKey`, `paintShade`, `shadeAmount`; `mapView.ts` `syncShade`, `setSun`). High ground
  (`SHADE_HIGH` 2.5 cells) and ranges/mountain (`SHADE_RANGE` 4) throw a soft dark band onto the lower ground to their east (the sun
  low in the west), a gradient per row, painted once per chunk into its own sprite in a `shade` container above the ground (not
  into the ground's chunk, so the hour never repaints a chunk). A chunk has a sprite only if a caster lies within its cells or
  the four to its west; it is painted again only when that shape changes (`shadeKey`). `setSun` sets the container's alpha
  from `shadeAmount(hour, daylight)`: nothing before 14:30, full by 18:00, gone with the daylight (by 20:00), in sixteenths so
  the alpha moves in steps. Only lands with relief have it.
- Checked at 393x852 and 852x393 (highlands settlers, seed hill1) by day and at 17:30.
