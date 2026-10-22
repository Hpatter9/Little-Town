## Isometric townsfolk, wired in

In the isometric view (`littletown.iso`) the townsfolk are now drawn with the PixelLab looks (`iso/folkSprite.ts`)
instead of the top-down figures. Changes `docs/HISTORY.md` "Isometric townsfolk (new, not yet wired in)": it is wired now.

- `map/mapPeople.ts`: `isoFolk` (set by `main.ts` when the iso view is on). Each frame, for a person who is not
  indoors, swimming, a werewolf in its form, in a people's combat form or in a beast shape, `render` makes (once) a
  `FolkSprite` (`Drawn.folk`) in the same layer, puts it where the top-down sprite stood (`FOLK_SCALE` 0.55 times the
  person's size) with the same `zIndex`, calls `update(view, x, y, seconds, dt)` and hides the old sprite and its
  harm marks. The iso view's `placeLoose` then carries it onto the diamonds like any loose child, so sorting among
  buildings, tapping (`personAt` works on world px), shadows, rings, bubbles and the founder marker are unchanged.
  Off the iso view nothing changes (`isoFolk` false).
- `iso/folkRules.ts`: `FOLK_LOOKS.settlers` lists the nine looks. `dressOf(weight)` gives `plate` (heavy body
  armour), `leather` (light or medium) or `base`; `pickLook(st, looks, dress)` picks by that dress and the person's sex,
  stable by id. Dwarves (`origin` `dwarves`) get the `dwarf_*` looks, everyone else the human ones. A people with no
  folder of its own uses `settlers`. Colour variety is `folkTint.variantOf(id)`, baked once per look.
- `iso/folkSprite.ts`: reads the body armour's weight for the dress.
- `build.mjs`: copies `art/iso/folk` to `out/renderer/iso/folk` (the web build copies `iso/` whole; the service worker
  already fetches `iso/` in the background).
- Test: `test/isoFolk.test.ts` (dwarf looks, plate, stable pick).

Checked in a phone-size preview (12-day settlers town): figures draw, walk and face the right way. The software
renderer used for previews is too slow to give a true frame rate; the cost per person is one sprite and a texture swap.
