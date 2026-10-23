## Townsfolk in their own colours

The owner's ask: "Can you go through and re color townsfolks to add more variety to the town." Changes "Natural folk
colours, and children" (the tint) in HISTORY.md: the six gentle hue-turn variants are gone; every townsperson now
wears their own skin, hair and dyed cloth on the isometric looks, on the map and in the portraits alike.

**What a person wears** (`iso/folkTint.ts`, `tintOf`). Their sim look already carried natural colours
(`data/people.ts`: `SKINS`, pale to deep brown; `HAIR_COLORS`: black, browns, auburn, ginger, blondes, ash; children
inherit both from their parents in `sim/social.ts`; the founder's are the player's pick), so the iso looks now use
them: `skin` is `look.skin`, `hair` is `look.hairColor` (each snapped to the nearest list entry, so the cache holds
one recolour per entry, not per stray hex). The old are grey or white (`OLD_HAIR`; all of the `old`, about half the
`elder`s by id), and a grey rolled for an elder recruit (or handed down to a child) is a colour of youth until they
are old (`GREYS`, `YOUNG_HAIR`). `cloth` is a dye from the people's own list (`DYES`: madder, woad, weld, green,
russet, undyed, grey, black, walnut for the settlers; greens and browns for the druids; indigo, madder, saffron for the
nomads; purples and teals for the alchemists; heraldic colours for the knights) by `idHash(id, 11)`; a founder dressed
in one of the `CLOTH_COLORS` keeps it. `cloth2` (breeches, a skirt) is from `PLAIN_DYES` by `idHash(id, 13)`. All
independent, so a town has thousands of combinations. `FIXED_CASTS` (orcs, lich, vampire, werewolf, robot, merfolk,
fae) get no tint (`tintOf` returns null): their casts keep their own colours, cloth too (their dress is part of the
look: a vampire's crimson, the fae's petals, and none of it reads as village cloth). The werewolf's wolf form is
never tinted.

**Telling hair from cloth** (`tools/folk-roles.py`, run by hand; writes `roles.json` beside each look's `index.json`).
The old rule recoloured by hue ranges, so hair and a brown tunic moved together. The sheets have a different palette
per animation (even a look's armed copies share no exact colours), so a palette-index map would not do. The tool
labels every pixel of every sheet (the five tinted peoples, ~430 sheets) by its colour (per-look boxes, `LOOKS`)
and its place in its frame (`place`: hair and beards only near the head, so a brown boot of the hair's colour isn't
hair; at the `crown` hair is tried before skin), keeps skin and cloth only in pieces of 10 pixels or more
(`components`: a fleck of skin colour on leather is a highlight), and marks `blend` the face-shadow tones the art
shares with stubble and the hair's edge, beside the skin. Where one colour paints two things, the fewer pixels get a
colour one unit of blue off (`settle`), so in the sheet each colour paints one thing and the game's lookup is exact;
that is the only change to the art (at most 2 in the blue channel, invisible; the sheets stay palette PNGs). The
armed looks use their bare look's boxes and `ref`, so a person keeps their colours when they pick up a tool, and a
child's look is tinted from the same sim look. Hoods, turbans, veils and headscarves are not hair: those looks have
no hair role (nomads, the druid warden, the alchemist's apprentice); the nomad girl's and woman's headscarves are
the colour of their skin, so their skin stays as drawn; the great-helmed knight has none.

**Recolouring** (`folkTint.ts`). `sheetMap(roles, sheet, tint)` gives each labelled colour its new colour by
`shade`: the colour's offset from the look's own average for that role (`ref`) is laid on the target (hue half as far,
saturation in proportion, lightness scaled to fit the ramp), so the art's shading and folds stay. `blendOf` puts the
blend halfway between skin and hair but never lighter than the skin's own shadow. `recolour(data, map)` is one map
lookup a pixel. Cache: `folkLoader.ts` `loadFolkSet(path, tint)` and `folkPortrait.ts` `folkFigure(path, tint)`,
keyed by `tintKey`; `iso/folkRoles.ts` `loadRoles` fetches a look's labels once. `FolkWho` now has `tint` and
`variant` (the key, a string). Cost: building a sheet's map is under 1 ms and recolouring a 912x1216 sheet about
8 ms on a desktop (the old per-colour HSL rule took 12 ms); a sheet is still recoloured only when someone first plays
it. Textures are now per person rather than per one of six variants; in a town under ~50 people that is about what it
was (6 variants times a town's looks already exceeded the head count), in a big town it grows with the townsfolk.

**For later:** an eviction of tints nobody wears any more (a dead person's sheets stay cached until a new town).

Tests: `test/isoFolk.test.ts` (each person's tint comes from their look and their people's dyes, is stable, the
young never grey, every target natural; recolouring keeps each role near its target and the ramp's order, across every
look's labelled colours and every target; every tinted look and sheet labelled, armed copies sharing the bare look's
`ref`; the fixed casts untinted and unlabelled; armour and tools never change a person's tint),
`test/folkPortrait.test.ts` (portrait and map share the tint).

**Tools.** `tools/folk-roles.py` takes about a quarter of an hour over every sheet (`--bare` for the still frames
only, `--qa out.png --only settlers` paints the roles flat to check the boxes by eye: pink skin, yellow hair, blue
cloth, cyan second cloth, orange blend). `tools/make-save.ts` takes `FOLK=n`: n more grown townsfolk, each a fresh
`randomLook`, gathered round the first (a crowd to look at).

Pictures in `folk-variety/`, before on the left (or top), after on the right (or below): `settlers-map-upright.png`
(393x852) and `settlers-map-sideways.png` (852x393), a settlers town of 27 zoomed in on the camp; `settlers-people.png`,
the People page; the same three for a knights town (`knights-*`). `<people>-before.png` / `<people>-after.png`: a
crowd of each tinted people (settlers, knights, nomads, druid, alchemists), every figure drawn from its look's still
frame by the game's own recolour code, with children, elders and armour among them.
