## The settlers' townsfolk art (PixelLab), and folk sheets

The settlers' iso townsfolk are drawn: 9 looks (a man, a woman and a dwarf, each plain, in leather or an apron, and in
plate), made with PixelLab from the project's own front views, each turned to 8 directions with `walk`, `run`, `idle`,
`death`, `hurt` and `cast_1h`. Each look also has six armed looks (`+axe`, `+hammer`, `+sword`, `+bow`, `+greatsword`,
`+staff`), the weapon edited into the front view, then turned, each with its own move (`chop`, `hammer`, `attack_1h`,
`attack_bow`, `attack_2h`, `cast_2h`, 9 frames). 63 folders in `src/renderer/art/iso/folk/settlers/`, 8.8 MB.

The layout changed from a file per frame to a sheet per animation (`<anim>.png`: a row per direction, a column per
frame; `rotations.png`: one row): 234 files instead of about 7,000, and half the bytes, for the phone's offline cache.
`iso/folkLoader.ts` cuts the sheets into frame textures (`cut`, `Rectangle` frames on one source); its `FolkSet` is
unchanged, so `folkSprite.ts` and `folkRules.ts` don't change. Every frame of a look, and of its armed looks, sits
centred on one canvas 24px wider each side than the turned figure (PixelLab draws an armed move on a canvas up to 48px
bigger, centred), so the feet (the sprite's anchor, bottom centre) stay put when the look changes. The layout is in `src/renderer/art/iso/README.md`.

Not yet wired into the iso view (the folk still draw the old way there); that's the next task. The other peoples'
casts (3 looks each, `walk`, `idle`, an attack (a punch, or a thrown spell for the casting peoples) and `death`) are
being made the same way.
