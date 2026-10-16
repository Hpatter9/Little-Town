## Building pictures off the map are the map's pictures

Changes the HISTORY.md sections "Every building from the packs" and "More buildings from the packs" (where the cards still painted) and 0.131.0's thumbnails and 0.132.0's tap and building cards.

- `renderer/art/pictureSource.ts`: `pictureSource(defId, look)` is a pure lookup (no DOM): `seat`, `plot` (a field or pen), `campfire`, `pack` (a PICKS picture in that look, `pickCovered`) or `painted` (the fallback, only where PICKS has nothing).
- `renderer/art/buildingPicture.ts`: `buildingPicture(defId, look, boxW, boxH)` draws it as the map does: the seat from `seatPack`, a field or pen from `fieldArt` (ripe crop, the orchard in fruit; a pen over grass green), the pack picture with a lone wall shown straight, else `topDownArt`. Whole-pixel scaled, cached per building, look and size once its pack pictures have loaded (`dataset.settled`); never drawn on a redraw.
- The bug: `__picture({ building })` in `main.ts` skipped `fieldArt`, so an orchard, field or pen card fell to the painter. It now calls `buildingPicture` with the town's look. Everything that borrows `__picture` (the phone's tap card, `panel/buildingCard.ts`, the news feed) follows.
- `panel/structure.ts` `thumb(defId, size, s)`: cached by building and look (`lookOf(s)`); on the desktop, whose menu has no strip beside it, it draws the picture itself (dynamic import of `buildingPicture`, `loadFieldTiles`). A stand-in is looked at again, not kept.
- `panel/buildPanel.ts`: thumbs on the Building book cards, the "Being built" rows and the "Last decided" line; `townOverview.ts` passes the snapshot.
- Painted only (no pack has them, so a pack pass can follow): gun_nest, gun_turret, laser_turret, launch_site, boiling_oil, ballista, catapult, flame_turret, mortar_pit, tide_pool_trap, acid_sprayer; the merfolk's stilt huts.
- No building pictures on the reveal, milestone or New Town screens (they show none). Test: `test/buildingPicture.test.ts`.
