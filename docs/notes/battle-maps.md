## Battle maps: varied boards, terrain rules, shots in the air

Changes the HISTORY.md sections "Tactics battles", "Weapon range" and "Combat effects" (the raid board, shooters, the
fight screens' arrows).

**The board is laid per battle** (`makeBoard` in `sim/tactics.ts`, pieces in `sim/tacticsTerrain.ts`). After the land's
own ground, the old lumps and boulders (`lieOfTheLand`) and a new `easeRelief` (no step over `CLIMB_MAX` 2 left by the
relief), `layTerrain` strews the field (columns 2 to the wall less 2) from a **side stream**
`new Rng(hashSeed(`${seed}:board:${tick}:${attempt}`))`; the town's stream is never drawn on. What and how much comes
from the land's `LOOKS[biome]` (copses, hills, outcrops, thickets, logs, pond and stream odds) plus the share of the
board the land itself makes wooded, hilly or wet. Pieces: **hills** (a flat top `HILL_RISE` 3 over flattened ground, a
ramp two tiles wide up one side in steps of one, a cliff on every other side: `TacTile.hill` `'top'`/`'ramp'`), **copses**
(`tree`), **boulder outcrops** (`block: 'rock'`), **thickets** (`bush`), **fallen logs** (`log`), a **pond** (deep middle,
shallows round it) and a **stream** across the way with one or two fords. Water laid on the field carries
`TacTile.art`, a land cell of real water whose painted ground the top borrows. `boardOk` checks every standable tile can
be walked to from the gate and back over town rules (jump 2, no deep water), none in the raiders' edge columns lost and
at most 3% strays; a layout that fails is laid again (attempt 2) and then the plain field stands. The town's own fences
and fields are already on the board as the land's painted ground; nothing extra was laid for them.

**Rules** (added to the existing ones, not beside them): `canStep` is the one step rule for `reachable` and the raiders'
`wayIn` distance field: a climb over `min(jump, CLIMB_MAX)` is a cliff (so a hill is climbed from its ramp alone, by the
town's fighters and the raiders alike, who go round), each step climbed costs `CLIMB_COST` more, a log `LOG_COST`; a drop
of more than jump + 1 is too far. `sightClear` (shooters, and single-mark spells in `bestCast` and the player's orders):
trees (2 high) and boulders (1.6) over the eye-to-mark line block a shot, hills' brows too, walls are shot over as before.
`coverChance` replaces the flat `COVER` for shots: tree 0.3, bush 0.2, log 0.2 where the target stands, +0.15 for a tree,
boulder or log beside it on the shooter's side, halved from a shooter 2+ steps above, capped 0.5 (melee keeps `COVER`
0.2 for tree and bush). `shotReach`: `HIGH_REACH` 0.7 tile a step above the mark (a hill's top reaches two further).
The defence bonus of height is the existing `blowMult` (10% a step up to three).

**Every town's raid outcomes change** (new terrain in the rules, new draws): expected. Soak figures are in the
coordinator's report.

**Shots** (renderer only; the sim resolves as before): `TacFx.shot` names what flew (`data/projectiles.ts` `shotOf`:
arrow, bolt, bullet, spear, stone, beam, ball, or `orb:<element>`), set for a shooter's blow and a tower's bolt.
`battle/projectiles.ts` `ShotPainter` flies it (stateless: age in, sprite and trail out; DawnLike `items/Ammo.png`
cells for missiles, the pixel-effects atlas `px:<element>-orb` for spells) over `flightTicks`. The tactics board
(`TacticsScene.flightOf`) delays a blow's number, its landing sheet and an area's flash until the shot arrives; a spell
at the other side flies an orb of its element (`actFx`) before its sheet plays. `fight/fightView.ts` (side view) and
`map/mapBattle.ts` use the same painter (the side view finds a plain shot's target by matching the hit's age).

**Life on the board** (`tactics/boardLife.ts`): birds (`art/birds.png`) startle from a copse when a fighter steps beside
it, trees and thickets sway, leaves (autumn, summer and spring in woodland), snow (winter or snowing), dust (desert,
steppe) or embers (ashlands) drift over, water glints, torches flicker at the gate by night, fallen logs from the wild
prop set. No new art files; sources already in `CREDITS.md`.

Tests: `test/tacticsTerrain.test.ts` (connected boards in every biome, same seed same board, hills climbed by the ramp
alone, step costs, line of sight, cover, reach, shot names). Tools: `tools/probe-board.mjs [count] [show]`.
