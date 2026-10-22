## Top-down view removed (0.188.0)

The isometric view is the only view. This changes HISTORY.md's "made the default" and "Phone speed" sections.

**What went**
- The Settings switch ("Isometric view") and `iso/isoSetting.ts` (`isoViewOn`, `setIsoView`, the `littletown.iso` and `littletown.isoDefault` keys). `main.ts`, `art/isoPicture.ts` and `tactics/tacticsView.ts` simply use iso; the old off branches in `main.ts` are gone. The two localStorage keys are left in old phones' storage, harmless.
- `art/buildings.ts` (1,600 lines of painted top-down building art, nothing called `buildingArt`) and `art/farWall.ts` (nothing imported it). `CropLook` moved to `art/farmland.ts`.
- In `map/mapView.ts`: the ground chunk painter (`chunks`, `paintDue`, `groundOf`, `repaint`, `DueChunk`, the dark chunk), the evening-shade sprites (`syncShade`, `shades`), the see-through trees and castle walls (`seeThrough`, with its call in `main.ts`), the trees' sway, the cloud shadows, the fireflies, and the view's culling in `setCamera`. All of them drew into containers the iso view hides (`map.world`, `map.lights`). The file went from 1,868 to about 1,490 lines.
- `tactics/tacticsView.ts`: the classic (non-iso) wall, gate and tower branches, `MapView.wallPicture`, `WALL_TALL`, `GATE_TALL`.

**Size** (`npm run web`, `out/web`): 85 MB before and after (to the megabyte); `renderer.js` 17,413,453 to 17,392,327 bytes. No art folder could be dropped, so `tools/build-web.mjs` and `CREDITS.md` are unchanged: nothing in the art folders was loaded only by the removed code. The old view's bulk was already off the phone's download or still in use (below).

**Kept, because something still uses it**
- `map/mapView.ts` itself: the iso view keeps it for hit tests and layers (`under`, `over`, `things`, `lights`, `festival`, `workFx`, `smokeColumns`, `artFor`, `buildingAt`-style lookups, `fronts`, `standingAt`), and the raid board draws the town's own building pictures (`buildingPicture`), trees and boulders (`propOf`, `propKind`) and ground (`clearGroundOf`, via `groundArt.ts` `paintChunk`) from it.
- `art/topDown.ts` (painted buildings), `map/packBuildings.ts` (pack picks), `art/buildingPicture.ts`: the menus' building pictures, `seatArt.ts`, the castle and the raid board still use them.
- The paper doll (`art/hkFolk.ts`, `hkTexture.ts`, `art/himeko/`, `art/lpc/`, 1.6 MB `lpcData.json`): the fights, the deep, the portal, cutscenes, interiors, the town and shop panels, the expedition pane and the new-game panel draw people with it. `MapPeople` and `MapRaiders` still use it for folk hidden from iso folk (swimming, forms, fights on the map).
- The desktop strip runs the same renderer, so it is iso too (iso was already the default there).

**Left for later** (not proven invisible, so not touched): `MapView.draw`/`updateBlueprint` still build a full sprite, glows, windows, sails, wheels and shutters for every building in the hidden `things`, though only the picture and rectangle are read. `turnMachinery`, `fadeWindows` and the shutters work only on those hidden sprites. `syncCastle` and `syncPlaces` draw the top-down castle and places into `under`/`things`; `under` is shown by iso, so these need a castle save to check before cutting. Boats and airships are given `map.things` (hidden), so they may not show in iso: worth a look.

**Checked:** `npm run typecheck`, `npm test`, `npm run web`; a phone-size preview (393x852 and 852x393) of the town, the event card with a people's portrait, a raid on the tactics board (ground, trees, props, unit cards), no console errors. The town screenshots match the pre-change ones except for moving figures and speech bubbles.
