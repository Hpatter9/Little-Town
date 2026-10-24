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
founder's row there is the link to their tab. Seen meanwhile, and fixed on this branch (below): on the map the gold ring
stood a little below and right of the founder's feet, and the crown didn't show over their head.

The armed looks (`founder_hero+axe`, `+sword`, `founder_heroine+axe`, `+bow`; no hammer looks: a founder at a
hammer's work swings the axe, `otherTool`) are seen in `hero-upright-chop`, `hero-upright-sword`, `heroine-upright-chop`, `heroine-upright-axe`
(mining: the hammer's work done with the axe) and `heroine-upright-bow` (on the raid board, where the crown does show over the founder). A new
town's founder carries no weapon, so for those shots the founder was given a sword or a bow in the save by hand.

## The founder's marks on the isometric map

The crown over the founder's head and the gold ring at their feet (docs/notes/raid-looks.md, `iso/founderMark.ts`)
stood off to the side on the isometric map: the ring a little down and right of the feet, the crown far off (it looked
like a prop by the campfire). They were lifted on the map (the top-down y) before the iso view's `placeLoose` carried
each loose sprite onto the diamonds, so each was carried there as if it stood further north. The raid board was right
(its spots are already iso). Now each mark is a holder stood on the figure's own spot (`map/mapPeople.ts`: `d.crown`,
`d.crownRing` are Containers at the folk sprite's position), so the view carries all three alike, and the lift is the
child's, in screen px: `markLift(scale, t)` (`crownDy`, `ringDy`; `markAt` is the frame foot plus it). Right at every
zoom and on the move. On the board the crown still floats over the health bar (its lift clamped above it; the
map's bar is placed on the land apart, so there it is left alone). Test: `test/founderLooks.test.ts` (the lift, and why it must come after the projection).

## Commands checked on the phone too

The phone's worker (`shared/simHost.ts`) passed the page's commands straight to the sim; only the desktop's IPC ran
`parseCommand`. A command with a field missing (a `sendDelve` with no `dest`) threw inside the step every tick
(`isPlaceDest`: `undefined.startsWith`), and the town froze. Now the worker parses each command as the desktop does and
drops a malformed one. Test: `test/commandFuzz.test.ts`: every command type in `parseCommand`'s switch (read from the
source, so a new one is covered), each tried bare, with every field junk, with its own fields drawn from their literals
or junk (200 a type, on a seeded stream), and from a few that pass, each field in turn made junk or left out; any that
parses is applied and the town stepped, and none may throw. No other command had the hole (the fuzz finds the
`sendDelve` one if its `dest` check is taken out).
