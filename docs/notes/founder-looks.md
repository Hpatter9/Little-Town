## The founder's own looks

The owner wants the founder (the player's character) to stand out. The founder now wears a look of their own,
by sex, everywhere a townsperson is drawn in their isometric look: `founder_hero` for a man (a young adventurer, sandy
hair, a green gold-trimmed tunic with an hourglass crest, a hood and a long green cape) and `founder_heroine` for a
woman (a red-braided huntress in tribal leathers and a fur mantle, the same crest). PixelLab art, in the settlers'
folder (`art/iso/folk/settlers/founder_hero*`, `founder_heroine*`), laid out as every other look (`index.json`,
`rotations.png`, a sheet a move, `+axe` and `+hammer`, `founder_hero+sword`, `founder_heroine+bow`). Renderer only:
no rule of the simulation changed, and saves are untouched. This adds to HISTORY.md's "Isometric townsfolk" (the look
rule) and keeps docs/notes/raid-looks.md's crown and ring (`iso/founderMark.ts`) as they were.

**The one rule** (`iso/folkRules.ts`, `iso/folkWho.ts`). `FOUNDER_LOOKS` (`{ m: 'founder_hero', f: 'founder_heroine' }`)
and `isFounderLook`. `pickLook` takes an optional `founder` on its `FolkState` (also on `PortraitWho`): a grown founder
whose folder is the settlers' (not a dwarf: they keep the dwarf looks; the other peoples keep their own casts) wears the
founder look of their sex, if `looks` has it; a child founder keeps the child look; nobody else ever draws a founder
look (they're left out of everyone's pool). `folkWho` decides who the founder is: the `founder` flag where a caller says
it outright, else whether the id is the founder's as of the last snapshot (`setFolkFounder`, set from `mainId` by
main.ts on every snapshot and the first, and by panel.ts). So every view that goes through `folkWho` gets it without a
change of its own: the map and the raid board (`iso/folkSprite.ts`), the fight and side-on screens and cutscenes
(`art/folkSide.ts`), the portraits, the People list and the founder tab (`art/folkPortrait.ts`, townsfolkPanel), the
moving pictures (`art/folkCanvas.ts`). An heir who takes over (`heirOf`) is the new `mainId`, so they wear the founder
look of their own sex from the next snapshot; the old founder's pictures go back to an everyday look.

**No tint.** The founder's look is a signature costume: `folkWho` gives it `tint: null` (as the peoples with colours of
their own), so the same sheets serve every founder and no roles.json is needed. The armed copies follow (`+axe` to fell,
`+hammer` to build, `+sword` or `+bow` to fight, as anyone's: `armedSuffix`); an armed look that isn't drawn (the hero
with a bow) falls back to the bare look's own moves, as for anyone (`iso/folkSprite.ts`, `art/folkSide.ts`).

**Found, not listed** (`iso/founderArt.ts`, `findFounderArt`). The founder looks aren't in `FOLK_LOOKS`: each look's
`index.json` is asked for once (by URL, relative to the page, as `folkLoader.ts`), and a look that's there joins
`FOLK_LOOKS.settlers`. So a build without the art (or with only one of the two) dresses the founder as before. main.ts
waits for it with the loading screen's other art, so the founder wears theirs from the first frame; panel.ts redraws
the menus when found; the phone page's event pictures (`panel/eventScenePlay.ts`) look for it too, and flag the founder
in their cast outright. The New town screen's founder tiles and their little scenes (`panel/newGamePanel.ts`) pass
`founder: true`.

Tests: `test/founderLooks.test.ts` (the look by sex and nobody else's, the child and the dwarf, a stub `looks` with a
look missing, the armed paths, untinted, `mainId` and an heir, and the art's moves once it's in).

**Seen in the game** (`docs/notes/founder-looks/`, at 393x852 upright and 852x393 sideways, a man and a woman: the map,
the founder tab, the People list, a raid board, and a party's fight at the Bear Cave; sideways, the party's walk home
from it). The art (frames 156 and 148, as the everyday looks) stands at the settlers' height with its feet on the same
spot; drawn as made, the same on every founder. The People list leaves the founder out as before (`listedFolk`): the
founder's row there is the link to their tab. Seen meanwhile, and not this change's (the same with the founder's art
taken out): on the map the gold ring stands a little below and right of the founder's feet, and the crown over their
head didn't show.
