## Faster start-up, the townsfolk sheets

Changes "Faster first paint" (0.154.0) and the townsfolk art (the Himeko paper doll and the LPC recolour). Renderer only; the look is unchanged.

A CPU profile of the late-town fixture on the phone build (headless Chromium, 393x852, from navigation to the loading screen's reveal) showed two big costs left: `atlas` in `art/lpc/lpcCompose.ts` (1.5 s) and `isBlank` in `art/hkFolk.ts` (1.2 s).

- **`isBlank`** no longer reads any sheet's pixels at start-up. `src/renderer/art/himekoBlank.json` holds, for each of the 608 sheets in `art/himeko/`, one number with a bit per cell (`row * 8 + column`) saying whether the cell is blank. `tools/make-himeko-blank.cjs` makes it (it decodes the PNGs' alpha itself; run it by hand when the sheets change). It follows the old rule exactly (fewer than 8 of the pixels sampled every second row and column have any alpha); checked against the old runtime reads for all 608 sheets, 0 differences. A sheet missing from the table falls back to reading one row of it back, once, cached by `key|row`.
- **`atlas`** (the LPC recolour) now recolours one 64px row of a sheet when that row is first drawn, not the whole sheet per colour (`tinted` holds `{ c, rows }`; `atlas(id, hex, mode, row, facing)`). The lightness reference (`lightRef`) is still the whole sheet's, read once per sheet, so the colours are the same: checked byte for byte on 57 sheet and tint combinations, 0 differences.

Fixture, from navigation to the reveal: 10.8 s to 6.9 s; `atlas` self time 1526 to 413 ms, `isBlank` 1155 to 0 ms. Left: `uploadImageWebGL2` (about 0.7 s), `weathered` and `snowCapped` (about 0.2 s each; cached per picture already) and the sheet-wide `lightRef` read.
