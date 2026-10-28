## The founders' hammers and the children's run

The founder's two own looks (`founder_hero`, `founder_heroine`, see "The founder's own look") get a hammer look each
(`art/iso/folk/settlers/founder_hero+hammer/`, `founder_heroine+hammer/`, the `hammer` move in eight facings), so
building, mining, tilling and crafting no longer borrow the axe's chop (`folkSprite`'s `otherTool` fallback still covers
a look without one). The settler boy and girl (`child_boy`, `child_girl`) get a `run` (six frames, the
`running-6-frames` template), so a running child no longer plays its walk at 1.5 times the speed (`play` in
`iso/folkRules.ts` picks `run` once the look has it). The dwarf children have no run: they show only in dwarf towns.

Made with PixelLab: `tools/pixellab/pl_armed.py founder:founder_hero:hammer` (an edit, a turn and eight v3 text
moves: 36 generations a look) and `MOVES_ONLY=run pl_kids.py settlers` (the template run, 8 a child; `pl_kids.py` now
takes `MOVES_ONLY`). Cleaned by hand: the hero's south row lost a cyan magic flash and an anvil (frames 3, 7 and 9 copy
their neighbours); the heroine's west row, where the hammer turned into an axe, is her east row mirrored; a grey shadow
was cleared from the girl's north run. The founders' sheets keep no `roles.json`, so they are never recoloured.
