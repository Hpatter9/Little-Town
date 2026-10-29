## The November PixelLab batch, ready to run

The allowance resets on 21 November (9,839 generations). Everything for the month's first batch is ready so it can start
that morning: the requests, the reference pictures, the run order, a dry run, a cheap test of each kind, and the wiring
that takes the finished art into the game. **No generations were spent** making it (only the balance was read). Changes
the HISTORY.md sections "The isometric art", "Isometric townsfolk", "The God creature" (god-creatures.md), "Stockpiles
that match the stores", "Sleeping rough", "Events told in full", and the grid's waiting list (grid-audit.md).

### How to run it

From a work folder set up as `tools/pixellab/README.md` says (the scripts, and `pl/` holding the state files):

```bash
DRY=1 python3 batch_nov.py           # every request and its estimated cost; sends nothing
TEST_ONLY=1 python3 batch_nov.py     # the cheap test of each kind (about 56), then it stops
python3 assemble_nov.py <repo> test  # the tests side by side: pl/nov/test/contact.png. Look before going on.
python3 batch_nov.py                 # the rest, in the order below, skipping what's done (BUDGET=1800 by default)
python3 assemble_nov.py <repo>       # drop what's finished into the game; then typecheck, npm test, npm run web
REDO=kiln python3 batch_nov.py bld_first   # make a picture again (the old one kept as kiln.old.png)
```

- **`tools/pixellab/batch_nov.py`**: every item (`BLD_FIRST`, `BLD_MEDIEVAL`, `BLD_LATE`, `BLD_YARD`, `SLEEPERS`,
  `PUSHERS`, `BARROW_VIEWS`/`BARROW_LOADS`, `PIECES`, `FLAME_FRAMES`, `GOD_FIX`, `CARD`), its prompt and references, by
  phase (`PHASES`, `OPTIONAL`). Resumable: `pl/nov_state.json` (a move's done directions kept one by one, as the older
  scripts do); pictures in `pl/nov/<phase>/`. The balance is read before and after each job (`pl/nov_spend.log`); the
  state's `start` is the run's first balance and `BUDGET` counts from it, the jobs still running counted at their
  estimates (`inflight`). An item's own cost (`spent`) is kept only with `SLOTS=1`. `DRY=1` prints each request with
  its pictures as their sizes; `TEST_ONLY=1` runs phase `test` only; `ONLY=` some items; `SLOTS=` jobs at once
  (default 4). Before and after each move it notes the character's moves (`anim_names`: its zip's metadata, a GET), so
  the one it added can be told from the rest.
- **`tools/pixellab/assemble_nov.py <repo> [kinds]`**: lays each finished kind into the game (below) and checks it.
- **`tools/pixellab-defs.mjs`** (`.ts`): writes `out/pixellab-defs.json`, the settlers' buildings drawn with a borrowed
  picture (`awaiting`, `yard` or `borrowed`), with footprint, part and purpose: where the lists below came from.

### The references

- **Buildings and the stockade** (`generate-with-style-v2`): the first picture is a **plinth guide** (`plinth_guide`):
  the building's footprint drawn as the kit draws its ground (the kit's own grass on a slab of soil, w x h cells, its
  front corner low in the middle of a square canvas). It sets the canvas size and tells the picture what ground to
  stand on; `tools/grid-recut.py` measures that plinth and bakes the picture to its cells. Then two of the settlers'
  kit pieces closest to it (`refs`: the workshop and cottage for a craft, the watchtower for a turret...). The canvas is
  `canvas_for` (the footprint's width plus room above, 128 to `MAX_SIDE` 320 px, half again for a tall one): the
  6x4 and 8x4 footprints are drawn at 320 and baked up a little.
- **Kit pieces** (heaps, corner posts, barrow): the nearest kit piece composited on the canvas, then the others.
- **The flame**: the campfire and the lamp post; frames 2 to 6 are edits of the first (`edit-images-v2`).
- **The moves** (lying asleep, pushing, the God creature fixes): the characters already made (`pl/looks.json`,
  `people_looks_state.json`, `founder2_state.json`, `kids_state.json`, `creature_state.json`, copied from
  `tools/pixellab/state/`).
- **The card beasts**: the packs' sheets the cards draw now (`werewolf_black`, `boar_king`, `hk_demon_lord`, first walk
  frame) for the look; then a character from the reference (`create-character-v3`, `view: 'side'`, four facings) and
  its moves facing east as v3 text moves.

### The items, the run order and the cost

Costs as seen (README): a style-matched building 10-15 (estimated 10 at 160 px or less, 11 to 224, 13 to 288, 15
above), an edit 10, a create 12, a template move 1 a direction, a v3 text move 3 a direction.

| order | phase | what | requests | about |
|---|---|---|---|---|
| 1 | `test` | one of each kind: the lean-to, a sleep (man, south), a push (man, south-east), a loaded barrow, grain sacks, the flame's first frame, the card wolf's reference, the wolf's death facing north | 8 | 56 |
| 2 | `bld_first` | the 16 first-age buildings waiting for art: lean-to, healer's hut, workbench, tanning and drying racks, smokehouse, kiln, basketry, bone carver, fireside inn, trading post, graveyard, wayside shrine, quarry, monster guild, militia post | 16 | 174 |
| 3 | `sleep` | lying asleep, 8 facings, a slow breathing loop (v3, 8 frames): the 9 settler looks, the founder's two, the 4 children | 15 x 8 | 360 |
| 4 | `barrow` | the wheelbarrow in two views (going down-right, up-right; mirrored for the left) with four loads (logs, stone, sacks, crates), and the 11 grown looks pushing (the mannequin's `pushing` template) | 8 + 11 x 8 | 168 |
| 5 | `pieces` | the stockade (3x2: stakes, a gate, a prisoner's post), grain sacks, a stack of planks, an ore heap, the stone wall's corner tower, the palisade's and the fence's corner posts, the flame (6 frames) | 13 | 131 |
| 6 | `bld_medieval` | the 29 Medieval buildings waiting (the coal mine shares the mine's picture, the armour store the weapon store's: one arms shop) | 28 | 316 |
| 7 | `god` | the wolf's death facing north, the bear's walk, the golem's punch and miracle (templates again, under new names) | 4 | 25 |
| 8 | `cards` | a side-on wolf (walk, attack, idle), bear (the same) and dragon (fly, walk, attack) | 15 | 94 |
| 9 | `bld_late` | the 22 Industrial, Modern and Space buildings waiting, the launch site drawn the right way at last | 22 | 254 |
| | | **in all** | | **1,578** |
| | | with about a tenth more for pictures made again (`REDO`) | | **about 1,750** (`BUDGET` 1,800) |
| 10 | `bld_yard` (optional) | the 47 drawn with a borrowed picture that fits or with a yard (hide tent, hunters' lodge, lookout, the traps, barracks, school, factory, cathedral...); five share: the alloy foundry the steelworks', the appliance plant and the chip fab the electronics plant's, the robot workshop the garage's | 42 | 603 |

So the month's planned run is about a sixth of it; with the optional phase, about a quarter.

The prompts are in `batch_nov.py` (each item's `desc`, then `GROUND` for a building: a w by h grass plinth like the
first picture, nothing past its edges, no text, no people; `STYLE` as the style description). Lying asleep (`SLEEP`):
"lies flat on the back on the ground the whole time, eyes closed, arms at the sides; only the chest slowly rises and
falls with each breath ... never sits up or stands; a seamless loop". The God creature fixes are the same templates
again (`GOD_FIX`); `GOD_KEEP` is the wording for v3 moves if the templates come out pale or thin again.

### What drops in where (assemble_nov.py), and what the game does meanwhile

| kind | where it goes | the game until then |
|---|---|---|
| buildings, stockade | `art/iso/buildings/<id>.png` and `index.json`, cut by `tools/grid-recut.py`; a picture whose plinth isn't its footprint, or that reaches past its sides by more than a few stray px (`clip_sides`) or onto the cells in front, is **left out** and said so | the borrowed picture, smaller (`AWAITING_ART`) |
| heaps | `art/iso/kits/settlers/` + its `index.json`, as wide as the kit piece beside them; cut as loose pieces (`MADE_LOOSE`) | hay bales for grain, rocks for ore, logs only |
| corner pieces | `stone_corner_tower`, `palisade_corner_post`, `fence_corner_post` in the kit folder (not its index), baked to one cell; cut as `stone_wall_post`, `palisade_post`, `fence_post` (`MADE_POSTS`) | the pier cut from the stone gate; the half runs meeting |
| flame | `art/iso/kits/settlers/flame.png` (a strip, `FLAME_PX` 12 tall), `art/iso/made.json` `flame` | the torch's flame drawn by code |
| barrow | `barrow_<view>_<load>.png` beside the kit (`BARROW_W` 52 px long), `made.json` `barrow` | the side-on barrow and its painted heap |
| sleep, push | `art/iso/folk/settlers/<look>/sleep.png`, `push.png` + the look's `index.json`, their colours labelled for the tints (`tools/folk-roles.py`); only the frames lying down are kept for sleep (`lying`), a facing with too few holds its fall's last frame | the fall held at its end, breathing by a stretch; walking |
| God creature fixes | the new frames laid over the old rows of `art/iso/creature/<kind>/<move>.png` | the old frames |
| cards | `art/creatures/packs/pl_<kind>.png` + `packs.json` (rows walk, attack, idle; the dragon's fly is its walk and idle, its ground walk kept as `stride`) | the black werewolf; the demon lord as the dragon |

The wiring, all renderer (no rule of the simulation; nothing new in `GameState`):

- **`iso/gridRules.ts`**: `AWAITING_ART` is now `stillWaiting(WAITING, ...)`: a building leaves the list by itself once a
  shared piece of its name, cut to its footprint, is in (`hasOwnPicture`); the test still checks the list is exactly
  the ones drawn smaller. `ownPlan`: a building's own picture where it fits; `gridPlan` gives the stockade its own
  once there is one (else null, as before). `penCorners`.
- **`iso/isoView.ts`**: the stockade drawn by its own picture when it has one; `cornerPosts`: a post on each corner of
  a pen's fence and the stockade's stakes when the kit has one (`wallPost`); the torches' flame from the strip
  (`lampFlames`, played in `animate`).
- **`iso/fireLook.ts`**: `FLAME_URL` (null until `made.json` says the flame is in, so nothing is asked for that isn't
  there), `FLAME_FPS` 9, `stripFrames`, `flameFrame`.
- **`iso/isoTown.ts`** `HEAP_PIECES`: grain sacks first for food; every other heap of wood a stack of planks, where
  the kit has them (the ore heap was already looked for, as `ore_pile`).
- **`iso/folkRules.ts`**: `sleep` and `push` moves (`FPS` 3 and 8; a look without push walks). `sleepPose`: the look's
  sleep loop in any facing, breathing in its own frames; else the fall held, as before. `wantedAnim(..., hauling)`.
  **`iso/folkSprite.ts`**: `hauling`, `facing`, `sleep` by `sleepPose`.
- **`map/haul.ts`**: `BarrowLoad`, `barrowLoad`, `barrowPlace` (the view, mirrored to the left, the step ahead on the
  map), `isoBarrowUrl` (null until made), `ISO_BARROW_AHEAD` 11, `ISO_BARROW_SCALE`. **`map/mapPeople.ts`**: the iso
  barrow ahead of whoever pushes it, in front when it goes down the screen, behind going up; the old barrow otherwise.
- **`panel/eventScenes.ts`** `made(id, stand)`: the beast scene's wolf, the new **bear** scene (data/eventSceneIds.ts;
  the `bear` and `l_bear_tracks` events name it) and the dragon use `pl_wolf`, `pl_bear`, `pl_dragon` once in.
- **`art/iso/made.json`**: which of the flame and barrow pictures are in (assemble_nov.py sets it).
- **`tools/grid-recut.py`**: `MADE_LOOSE`, `MADE_POSTS`, each cut only once its picture is in.

**Tested:** `test/pixellabWiring.test.ts` (the waiting list, the stockade's own picture, corners, the sleep pose, the
push, the barrow's place and loads, the flame's frames, the heaps, the card beasts and the bear scene); its checks
hold before the art and after. Tried end to end on stand-in pictures in a scratch copy (no PixelLab): seven buildings
went in and cut to their footprints, a windmill with a sail past its sides was left out, and the heaps, corner posts,
flame, barrow, a sleep and a push (their colours labelled), the wolf's death row and a card wolf went in; with them,
`npm run typecheck` and the whole `npm test` passed. That try found three tests that took today's stand-ins for
granted (`test/stockHeaps.test.ts`'s hay bales and the stockade's gate, `test/isoView.test.ts`'s smithy as the
workshop): each now expects the new piece once it is in, and the old one until then.

### For the owner before the run

- **The wheelbarrow**: as planned, a barrow picture (two views, four loads, about 80) and a pushing move for the grown
  looks (about 88). The barrow alone (no push; they walk behind it) would halve it.
- **Shared pictures**: the coal mine with the mine, the armour store with the weapon store (an arms shop); in the
  optional set, five more (above). Each could have its own for about 11 more.
- **Lying asleep** is the biggest item (360). A v3 move starts from the standing figure, so it may lie down first: the
  test shows it, and the assembly keeps only the frames lying down. Four facings instead of eight would halve it.
- **The big footprints** (5x3 and up) are drawn on a 320 px canvas and baked up to their cells, so their pixels come out
  a little bigger than the kit's. A larger canvas (`MAX_SIDE=384`) may cost more a picture; worth trying on the test day.
- **The flame**: the packs (the pvfx and Craftpix magic effects) may already have a small fire that fits, which the
  owner prefers to PixelLab art; if one does, the `pieces` phase can skip it (`ONLY=`), saving 60.
- **The card beasts** are the one step not tried before: a character from a side view (`view: 'side'`, four facings) of
  a beast on four legs. The test makes only the wolf's reference; the character is the first thing to watch on the day.
- **The optional 47** (`bld_yard`, about 600): run this month, or keep the month spare?
