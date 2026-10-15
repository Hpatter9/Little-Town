## Sea art from the packs and phone checks of the sea (claude/sea-art; changes "Seafaring and islands")

Renderer only; the sim is untouched (`tools/sim-hash.mjs` matches main).

- **Searched** every pack in `../chronos-assets` for ships, boats, sails, docks, piers, anchors and wrecks. No pack has a
  working boat: the Seabed pack's `Ship1`/`Ship2` are wrecks (already used: `packs/sb_wreck.png`) and its anchor is a
  seabed prop; the underwater and ocean packs are backgrounds; the pirate pack is characters; the tropical city pack is
  vector only. So `art/boatArt.ts` (the seven boats, their wakes in `map/mapBoats.ts`) and the boat icons in
  `art/customIcons.ts` stay painted.
- **Already pack art:** the harbour building (`packBuildings.ts` `harbour`: the Bridges pack's pier planks, crates, barrels
  and a lantern).
- **Swapped:** the war map's Harbour landmark (`panel/warMap.ts` `drawLandmark`) was a jetty of code-drawn rects; it is now
  three of the Bridges pack's pier planks (`SPRITES.pier` in `art/warSprites.ts`, `roads/pier_v.png`, credited already).
- **World map sea lanes** (`panel/panel.html` `.map-route.sea-lane`): the dotted line was lost on the map's own blue; now
  brighter, 3px, with a dark halo.
- **Phone checks** (393x852 and 852x393, Chromium): the map with a harbour, moored and sailing boats; the Harbour tab;
  the world map (lanes, colony flag); the Great Enemy card and its stage sheets for all six kinds. Nothing clipped or
  overlapping in the Harbour tab, the card or the sheets. Left alone: the world map's "The Far Isles" label (in the map
  picture) sits under the Far Isles scouting dot, and sideways the map is small (height-capped) so labels there crowd.
