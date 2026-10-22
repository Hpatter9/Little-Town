## Iso pictures in the menus and cards

With the isometric view on (`littletown.iso`), the build menu, In town, the info cards and the phone's tap card show the
kit piece the map draws for that building and people, not the top-down picture. Off the iso view nothing changes.

- `art/isoPicture.ts` (`isoPicture(defId, origin, theme, boxW, boxH)`): the piece is `pieceFor(kitOf(kitNameFor(...)), defId)`
  (iso/isoKits.ts, so fields show the kit's field tile and walls/gates their run/gate piece), loaded by URL
  (`kitUrl`, once each, through `loadImage`), cropped to its visible pixels, scaled whole pixels up (never smoothed) to fit
  the box, and cached per (kit, piece, box). Null until the image is in.
- `main.ts` `__picture({ building })` (the strip's hook that `panel/structure.ts` `thumb()` and the phone's `cardArt` use)
  returns the iso picture when iso is on; until its image has arrived it returns an unsettled copy of the old picture,
  so `thumb()` asks again (it retries, and keeps only settled pictures). Box sizes are unchanged.
- Not done: the seat/castle/hold pieces (iso/isoCastle.ts) are not used: a seat shows its kit's longhouse, as the map draws it.
  The desktop's own-window menu (no strip beside it) still draws the old pictures.
