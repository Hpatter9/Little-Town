## Iso buildings: their own pieces for the last cottages

The 21 buildings that the isometric view still drew as a small cottage ("Left for the coordinator" in
`docs/notes/iso-tidy.md`) now have their own pieces, in every people's town and in the menus' pictures. Changes the
pieces' choice in "The isometric view, begun" / "The iso town, filled in" (`pieceFor`) and "Iso pictures in the menus and
cards". Visual only: the simulation is untouched.

- **The art:** `src/renderer/art/iso/buildings/<id>.png` (PixelLab, the settlers' kit style, 256 colours) and its
  `index.json`: `village_green`, `quoits_pitch`, `sparring_yard`, `drill_yard`, `archery_range`, `pleasure_garden`,
  `bandstand`, `boatyard`, `harbour`, `fishing_jetty`, `statue`, `victory_monument`, `ward_stone`, `portal_arch`,
  `ai_core`, `clone_vat`, `cryo_pod`, `drone_hub`, `shield_generator`, `launch_site`, `mission_control`. Every id is a
  building in `BUILDINGS`. Each piece stands on a plinth of ground drawn as its footprint. Two fields were added to the
  index by hand, measured from the pictures: `soil` (px of the soil, or the harbour's and jetty's water block, below the
  plinth's front corner: 28 for the quoits pitch, 21 the harbour, 20 the jetty, 3 to 6 for the thin slabs, none for the
  rest) and `along_y` (the quoits pitch, archery range and cryo pod are long pieces lying along y). Credited in
  `CREDITS.md`; described in `art/iso/README.md`.
- **The choice** (`iso/isoKits.ts`): `SHARED_PIECES` (the index), `sharedPiece(kit, piece)` (the shared piece when a
  people's kit has none of that name; a kit that isn't a people's, the land's `wild/`, keeps its own `statue`).
  `pieceFor` is now: a kit's own piece named after the building, then the shared piece, then the role's, then the cottage.
  `kitUrl(kit, piece)` serves a shared piece from `iso/buildings/<id>.png`, so every caller (the map, the menus'
  `art/isoPicture.ts`, the raid board's `tactics/isoBoard.ts`) gets it without change. `build.mjs` copies the folder
  (PNGs only) to `out/renderer/iso/buildings` (the web build carries it with the rest of `iso/`, fetched later by the
  service worker).
- **On the map** (`iso/isoView.ts` `syncBuildings`): a shared piece is fitted to its footprint's width
  (`footWidth(foot) / width`, as walls are; the plinth is the footprint), not drawn at the kit's `scale` × `ISO_ART`,
  since one set serves kits of different scales. Its bottom `soil` px are cut off (`trimmedOf`, a frame over the same
  texture, as `surfaceOf` does for ground tiles), so the plinth's top sits on the ground and no soil block hangs under
  it. An `along_y` piece is mirrored on a footprint longer along x. No cottage barrels (`setProps`) or cottage door and
  windows (`setDoor`) are put on it.
- **Tests** (`test/isoView.test.ts`): every id in `buildings/index.json` is a real building with its PNG and a small
  `soil`; each of the 21 buildings gets its own piece in every kit, served from the kit if it has one of that name, else
  from `iso/buildings/`; every building's piece in every kit has a PNG at its `kitUrl`.
- **Previews:** `tools/make-save.ts` takes `BUILD=statue,harbour,...` (those buildings put up, finished, after the run,
  round the camp, clearing wild land; so the town can't pull them down) and `UNLOCK=1` (every building in the build
  menu). Screenshots in `docs/notes/iso-buildings/`: a settlers town upright and sideways, a knights town upright (the
  launch site) and sideways (pleasure garden, shield generator, portal arch), a merfolk town sideways, the build menu
  (settlers upright, merfolk sideways) and In town's pictures. Made with
  `UNLOCK=1 BUILD=<the 21> ORIGIN=settlers BIOME=steppe RELIEF=0 EXPLORE=40 node tools/make-save.mjs save.txt 1`.
- **Left for later:** a one-cell statue, ward stone or monument is fitted to one cell, so it stands about as tall as a
  townsperson; the pieces' plinths are square diamonds, so on a long footprint (the launch site's 8 by 4, the 3 by 1
  pitches) the plinth reaches a little past the footprint's ends; the shared pieces are grass-and-stone in every people's
  town (a sand or snow town shows a green plinth).
