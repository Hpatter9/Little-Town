## The God creature: its own art, and its new name

The owner's ask: the town's creature (HISTORY.md "The great creature"; docs/notes/great-creature.md) drawn like the
creatures in Black & White, upright on two legs with many moves, from PixelLab sheets for all five kinds; and it is now
called the **God creature**. The wolf's sheets came first (`src/renderer/art/iso/creature/wolf/`); the ape, bear, bull
and golem follow in the same layout as `art/iso/creature/<kind>/`, and plug in with no code: a kind whose folder has no
`index.json` yet keeps its old stand-in everywhere.

**The sheets.** The iso folk's layout (`index.json`: frame 156x156, the eight facings in order, frames a move;
`rotations.png`; a sheet per move, a row a facing and a column a frame). Moves: walk, run, idle, pickup, throw, push,
pull, eat, punch, uppercut, hit, death, getup, miracle, sad, and joy (a jump; still coming). `build.mjs` copies
`art/iso/creature` to `iso/creature` beside the page (`CREATURE_ROOT`, iso/creatureRules.ts), fetched by URL like the
folk, so the phone app doesn't grow.

**The loader** (iso/folkLoader.ts): the folk loader made generic (`SheetSet<A>`, `build(base, variant)`), with
`loadCreatureSet(kind)` beside `loadFolkSet`: the still rotations load at once, each move's sheet the first time it is
played. Resolves null while the kind has no `index.json`.

**The moves** (iso/creatureRules.ts, pure, tested in test/creatureArt.test.ts). `creatureMoves(view, seen)` gives the
moves to play in turn (`turnFrame` plays each through once, then the next):
- dead: `death` (held); hurt (its health dropped in the last `HURT_SHOW` 0.7 s): `hit`; asleep: `death` held (it lies
  down), then `getup` for `GETUP_SHOW` when it wakes;
- moving: `walk`, or `run` from `CREATURE_RUN` (70 px/s) or on its way to a hunt, a fight, a scare or a kill;
- praised in the last `JOY_SHOW` (2.5 s): `joy`;
- at its deed's spot (`AT_WORK`): haul pickup→throw, build push→pull, farm pull, hunt and fight punch→uppercut, play
  throw→pickup (it tosses the children), heal `miracle`, eat / eat_crops `eat`, steal pickup→eat, scare punch,
  eat_villager uppercut→eat; guard, wander and the rest idle;
- idle, or `sad` when lonely or afraid or below `SAD_HURT` (30%) of its health.
`creaturePlay` falls back when a sheet lacks a move (joy → miracle → idle; run → a faster walk; uppercut ↔ punch...).
The facing is the folk's (`facingFromVector` on its step on the map). Praise is seen through a new optional record:
`CreatureState.praisedAt` (set by `teachCreature` on praise; no rule reads it) and `CreatureView.praisedAgo` (ticks
since, left out if never). Hurt and waking are seen by the map itself (its health dropping, `asleep` turning off).

**The map** (map/mapCreature.ts). With its sheets, it is drawn at the folk's scale (`SHEET_SCALE` 0.55, like
mapPeople's `FOLK_SCALE`: the figure is a person's height in its frame) times its growth (`scale`, `drawScale`), feet at
`SHEET_FEET` of the frame, on a wider shadow. The tint is gentler (`gentleTint`: `GOOD_TINT_SHARE` 0.35 of the way to
its nature's tint when good, `EVIL_TINT_SHARE` 0.6 when cruel), and no brightening filter (on the sheet's frames it
drew black blotches in the browser), so a good wolf is still a grey wolf with a warm cast and the gold halo, a cruel
one darker and red. A death seen as it
happens is played and lies there `DEAD_SHOW` (8 s), then fades. Taps reach as high as it is drawn. Without sheets:
the old stand-in, as before.

**The lineup** (mobile/beastLineup.ts): a kind with sheets is drawn from them, facing you (row 0): idle in the line,
its walk as it steps forward, its action move once (`LINEUP_MOVE`: the ape and the bear throw, the wolf and the bull
punch, the golem works a miracle), then idle in front; drawn `OWN_TALLER` (1.35) a person's height. The rest keep the
stand-ins and their old moves.

**The card**: the Townsfolk menu's section (panel/townsfolkPanel.ts `creaturePortrait`) shows its south-facing still
from `rotations.png`, tinted by its nature with a CSS filter, only once the picture has loaded (none for a kind
without sheets). The tap card is text only, and stays so.

**The raid board is unchanged**: its units are drawn by map/mapRaiders.ts from the creature-sheet sprite kinds
(`sheet`, `still`, `machine`, human), with no folk-style sheet kind; giving it one (eight facings, attack and hurt
moves) is a larger change to MapRaiders, left for later. The board still shows the stand-in (`CREATURE_ENEMIES`).

**The name.** Player-facing text says God creature: the research **God Creatures** (id `great_beasts` kept), the saga
**The God Creature** (id `great_beast` kept) and its lines and moods, the board unit **God Wolf** etc.
(`CREATURE_ENEMIES` names), the Townsfolk menu's section **The God creature** (its `GROUPS` pattern in
panel/subtabs.ts). Code names are unchanged. The Moon Pack's "Great Beast" (sim/pack.ts) is another thing, and kept.

Screenshots in `docs/notes/god-creatures/` (393x852 and 852x393): the lineup, the wolf stepping out and punching, and
the wolf on the map walking, hauling, healing, eating, hunting, asleep, young, good and cruel; and its card in
the Townsfolk menu.
