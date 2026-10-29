# PixelLab scripts (the iso townsfolk)

The scripts that made the iso townsfolk (`src/renderer/art/iso/folk/`) with PixelLab (api.pixellab.ai, the owner's
subscription). The API key is a network secret of the cloud environment: requests carry no token, and none is kept
here. Run by hand from a working folder (they read and write `pl/` beside them):

```bash
mkdir -p work/pl && cp tools/pixellab/*.py tools/pixellab/*.sh work/ && cp tools/pixellab/state/*.json work/pl/ \
  && cp tools/pixellab/refs/*.png work/pl/ && cd work
```

- `pl.py`: the client (`call`, `wait`, `b64`). `pl_fetch.py`: downloads a character's zip.
- `pl_batch.py`: the settlers' 9 looks, their moves, and the armed looks (a weapon edited into the front view with
  edit-images-v2, turned with create-character-v3, then a v3 text move). State: `pl/batch_state.json`.
- `pl_people.py`: the other peoples' casts (`CASTS`): a settler front view edited into the people's dress, turned,
  then template moves (`MOVES`: walk, idle, a punch or a thrown spell, death). `MOVES_ONLY=death` makes one move only;
  `SLOTS` jobs at once (Tier 2 allows 10); `STATE=pl/people_looks_state.json` for all but the orcs
  (`pl/people_state.json`). `run_phases.sh`: walk and idle first, then attacks, then deaths.
- `assemble_folk.py <people> <repo>`: downloads each finished look and lays it out as sheets (a row per direction,
  a column per frame, centred with room for a swing: `PAD`), renaming looks to `man_`/`woman_` (`RENAME`).
- `refs/`: the edited front views each look was turned from.

Costs seen (Oct 2026): a template move is about 1.7 generations a direction; an edit is 10; turning a figure about
2; a v3 text move about 3-4 a direction.

Added Oct 23 (the God creatures, children and buildings):

- `god_body.py <kinds>`: a standing settler edited into an upright God creature (ape, wolf, bear, bull, golem), then
  turned with create-character-v3 (`refs/ref_god_*.png`). `god_anim.py <kinds>`: the 16 template moves (`MOVES`) in eight
  directions. `assemble_god.py <repo> <kinds>` lays them into `art/iso/creature/<kind>/`. State:
  `state/creature_state.json`.
- `pl_kids.py <peoples>`: a boy and a girl per people. The settler girl is edited from an adult; every other child is
  edited from her (`pl/kid_base.png` = `refs/ref_kid_settlers_girl.png`), so all share a child's size. Then walk, idle and
  death. `EDIT_ONLY=1` stops after the edits, to check them first. `assemble_kids.py <repo>` lays them into
  `art/iso/folk/<people>/child_<boy|girl>/`. State: `state/kids_state.json`.
- `pl_bldg.py`: iso building pieces in the settlers' kit style (generate-with-style-v2, 10-15 generations each), into
  `pl/bldg/`; trimmed into `art/iso/buildings/`.

Costs seen (Oct 23, Tier 3): a template move about 1 generation a direction at 108-148px; an edit 10; a create from a
reference about 10-12; a style-matched building 10-15. Background jobs stop at the 2-hour limit and the container can
restart: every script is resumable, so restart it with the same arguments.

Oct 23: `pl_armed.py` gave the peoples' casts one tool each (axe or hammer, a v3 text move at 3 generations a direction, about 45 a look); `assemble_armed.py <repo>` lays them out. A look without a tool swings its other one (folkSprite).

Still to make: the other tool for each cast look, if wanted (see
`pl_batch.py`'s `armed()` shows how).

Oct 29: the November batch, ready for the reset (docs/notes/pixellab-plan.md). `batch_nov.py` makes the settlers'
buildings with no picture that fits, lying asleep, the wheelbarrow and the push, the stockade, heaps, flame and corner
pieces, the God creatures' weak spots and the side-on card beasts: `DRY=1` prints every request and its cost,
`TEST_ONLY=1` makes one of each kind and stops, `BUDGET=` caps the run (read from the balance), `REDO=` makes an item
again. State: `pl/nov_state.json`; pictures in `pl/nov/<phase>/`. `assemble_nov.py <repo> [kinds]` drops what's finished
into the game and checks it (a building that doesn't fit its footprint is left out); `assemble_nov.py <repo> test` lays
the tests side by side in `pl/nov/test/contact.png`.

Oct 29, later: six new settler looks (farmer, smith, hunter, old man, old woman, young woman) in `batch_nov.py`'s
`looks` phase (`LOOKS`), each with the six template moves and one tool, then asleep and pushing in those phases;
`assemble_nov.py <repo> looks` lays them out and lists them in `art/iso/made.json` `looks` (docs/notes/nov-new-looks.md).
