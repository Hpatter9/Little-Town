## New town: pick, then Accept

The 7-step "New town" wizard (`panel/newGamePanel.ts`) no longer opens a pop-up sheet when a tile is tapped. Tapping a tile
(`tileGrid` in `panel/newTownTiles.ts`, which now just calls `onChoose`) picks it and frames it; the sticky footer
(`.wizard-foot` in `panel/panel.html`) shows the picked option's name and its text lines (`.nt-details`, scrolls past
26vh, 24vh sideways) above Back / **Accept**. Accept moves on; Back keeps the earlier pick. The last step's button reads
"Accept: found ..." and founds the town. `stepTiles` holds each step's tiles so the footer can read the picked one.

Wording: step 0 now says you play the founder and order every building yourself (the town lives on its own); the
summary's "A world of N realms" line shows only while `CONQUEST.on`; Normal's text is "The intended balance of raids and
disasters." (`data/biomes.ts`); Lost Tribe says "Keep everyone fed." (`data/founding.ts`). The old bottom-sheet styles
(`.nt-back`, `.nt-sheet*` in `newTownStyles.ts`) and `Tile.scene` are now unused.
