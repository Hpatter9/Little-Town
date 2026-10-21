## The castle and hold pieces (art only)

Twelve isometric pieces for the Blood Court's castle and the dwarves' hold, in `src/renderer/art/iso/castles/`
(`index.json` lists ids and sizes), drawn by PixelLab's style-matching tool (`generate-with-style-v2`) with four of
each people's kit pieces as the style, then trimmed and reduced to 256 colours (412 KB). Credited in `CREDITS.md`.
No code uses them yet, and `build.mjs` copies only `art/iso/kits`: the chat that draws them adds the copy.
