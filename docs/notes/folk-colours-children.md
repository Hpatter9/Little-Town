## Natural folk colours, and children that read as children

The owner's report: "The settlers are odd colors. And the child looks like a tiny man with a beard." Changes the
"Isometric townsfolk" and "The peoples' own casts" sections of HISTORY.md (the tint and the look pick).

**Colours** (`iso/folkTint.ts`). The old table turned every non-skin pixel's hue by up to 300 degrees (green skin
and pink hair were hair-and-skin pixels caught by the "not skin" rule). Now each kind of pixel stays in its family:
skin keeps its hue and only gets a little lighter or darker (`skin`); warm browns (hue 0 to 56: hair, leather)
turn a few degrees and stay brown (`warm`, clamped to 0..56); other cloth turns at most 25 degrees and loses a
little saturation (`cloth`, `sat`); greys (metal plate, bone) and outlines are untouched. `recolourOne` is the
per-pixel rule. `VARIANTS` is 6 (was 8), gentle ones. The peoples with a colour of their own (`FIXED_CASTS`: orcs,
lich, vampire, werewolf, robot, merfolk, fae) get variant 0 always: `variantOf(id, people)`. The map
(`folkSprite`) and the menus' portraits (`folkPortrait`) share `folkWho`, so both follow.

**Children** (`iso/folkRules.ts`). `isFolkChild` (the snapshot's `lifeStage === 'child'`; `FolkState` and
`PortraitWho` carry `lifeStage`/`growsUpIn`, `folkKnow` keeps them). `pickLook` gives a child a look from
`CHILD_LOOKS` (a boy and a girl pool per people: beardless, never plate, never `dwarf_*`), whatever dress they wear.
Boys are the youngest-looking beardless male look (settlers `man_leather`, knights `man_squire`, fae `man_sprite`,
nomads `man_herder`...); the Moon Pack's boys wear `woman_huntress` (its man is bearded). Dwarf children wear the
settlers' child looks. Drawn at `CHILD_SCALE` (0.72) on the map and in full-figure portraits (`FolkWho.child`).
I chose the PixelLab looks over the old paper doll: they match the adults around them and read well small.
Not done (cheap version only): a larger head against the body.

**For PixelLab after Nov 21:** a proper boy and girl per people, in the people's own dress (settlers, dwarves,
and each cast), same frame size and animations as the adults, with a head about a third of the figure's height,
short limbs, no beard, hair kept simple; then drop `CHILD_SCALE` to about 0.85 and fill `CHILD_LOOKS` with them.

Tests: `test/isoFolk.test.ts` (tints stay within their ranges over a hue/saturation/lightness sweep; fixed casts
never recoloured; a child never gets a bearded, armoured or dwarf look). Pictures: `folk-colours-children/`
(`tints-before.png`, `tints-after.png`: adults, boy, girl, orc, knight across the variants). A full in-game
phone-size screenshot could not be taken (the town view would not zoom in headless), so the sheets are rendered
from the same recolour code and art.
