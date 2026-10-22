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

Still to make when generations allow (after the Nov 21 reset): the deaths of 16 looks (merfolk except `man_mer`,
nomads, fae, alchemists, knights; about 220 generations), and axe and hammer armed looks for the peoples' casts (so
they hold tools at work; `pl_batch.py`'s `armed()` shows how, about 40 generations a look and tool).
