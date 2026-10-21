## The isometric art, first drop

The first art for the planned isometric view, added without any code using it yet (the town still draws
top-down).

- **Building kits** for all twelve peoples in `src/renderer/art/iso/kits/<people>/`, about 36 to 42 pieces each:
  buildings, walls and gates, ground tiles, roofs and props, named in each `index.json`. The sheets were drawn with
  ChatGPT, then cut, cleaned (a thin outline, the painted colours kept) and reduced to 256 colours: 6.7 MB in all.
- **One size for every people:** kits are kept at their drawn size; `kits.json` gives the `scale` that brings each
  people's cottage to 240 pixels wide, to match the townsfolk (about 88 pixels tall), which come next.
- `src/renderer/art/iso/README.md` describes the layout. Credited in `CREDITS.md`.
- The web build inlines imported PNGs as data URLs, so the isometric renderer should load these by URL.
