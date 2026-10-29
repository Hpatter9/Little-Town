## Six new settler looks, ready for the November batch

The owner wanted the townsfolk to differ by more than their colours: new hair, clothes and builds. Six new settler
looks are added to the 21 November PixelLab batch (pixellab-plan.md), and wired into the game behind a check, so
nothing changes until their art is in. **No generations were spent** (only the balance may be read). Changes the
HISTORY.md section "Isometric townsfolk, wired in" (the looks and `pickLook`), and the notes folk-variety.md (the tints,
`folkTint.ts`) and pixellab-plan.md (the November batch: its table and total).

**The looks** (`tools/pixellab/batch_nov.py` `LOOKS`: base look, the edit's prompt, the character's description, its
tool). Each is an edit of a settler look's south view (`base_south`: the first frame of its `rotations.png`, the sheet's
`FOLK_PAD` 24 taken off), so the size and style match; the hair, skin and main cloth are recoloured per person in the
game, so the prompts set the shape:

| look | from | what | build | tool |
|---|---|---|---|---|
| `man_farmer` | `man_base` | wide straw hat, long undyed smock belted with rope, rolled breeches | lean, weathered | axe |
| `man_smith` | `man_leather` | heavy leather apron over a grey shirt, sleeves rolled, short black hair, stubble | stocky, broad | hammer |
| `woman_hunter` | `woman_leather` | hooded mottled green-brown cloak, hood up, quiver strap, soft boots | slim, wiry | axe |
| `man_elder` | `man_base` | long grey beard, brown wool robe, knotted walking stick in the left hand | stooped | hammer |
| `woman_elder` | `woman_base` | linen headscarf over grey hair, knitted shawl, long dark dress, apron | small, bent | hammer |
| `woman_maiden` | `woman_base` | two long golden braids, bright red laced bodice dress, white blouse | slender | axe |

**The batch.** A new phase, `looks`, after `bld_first` (`PHASES`). Per look (`look_jobs`): the edit (`look_<look>_edit`,
10), the character turned from it (`look_<look>`, create-character-v3, 8 facings, 12), the six template moves
(`LOOK_MOVES`: walk, idle, run, hurt, death, cast_1h, 8 each), then the tool as `pl_armed.py` did it: edited into the
character's own south view (`src_char`: `south_of` reads it from the character's zip), turned (12), and its v3 move
(`TOOLS`: chop or hammer, 24). About 116 a look, **696** for the phase. Asleep and pushing cover every look, so the six
join those phases (`SLEEPERS_NEW`, `PUSHERS_NEW`, each waiting on its look: `after`): 144 and 48 more. In all the six
cost about **888**. The test phase makes the farmer's edit (`test_look_edit`, 10). A phase's jobs now run in waves
(each wave the jobs whose input is done, at once), so a look's moves run side by side once it is turned.
`DRY=1 python3 batch_nov.py looks`: 66 jobs, about 696.

The batch's total is now **2,476** (about 2,720 with a tenth for pictures made again), so `BUDGET`'s default went from
1,800 to 2,750. The owner's guess was about 100 a look (600); the 888 is higher because each tool is its own turned
character (22 of a look's 116) and the looks also sleep and push (32 a look). Leaving out the tools and the sleep would
bring it near 500.

**The assembly** (`tools/pixellab/assemble_nov.py looks`, run before `sleep` and `push`: laying a look lays its folder
afresh). A look goes in only when every one of its jobs is done (`new_looks`): its sheets into
`art/iso/folk/settlers/<look>/` and `<look>+<tool>/` (`assemble_folk.lay`), its colours labelled (`tools/folk-roles.py`,
first-guess boxes for the six in its `LOOKS`: check them with `--qa` once the art is in), then its name into
`art/iso/made.json` `looks`. Tried on stand-in pictures in a scratch copy (fetch stubbed, no PixelLab): all six laid
out, labelled and listed.

**In the game** (renderer only; nothing new in `GameState`):

- **`iso/folkRules.ts`**: `FITTED_LOOKS`; a look joins `FOLK_LOOKS.settlers` only once `made.json` lists it.
  `fittedLook(st)`: the look a grown settler is meant for: `man_elder`/`woman_elder` in the elder and old stages;
  else by what they came to town as (`typeName`, fixed for life: a Gatherer man the farmer, a Crafter man the smith, a
  Hunter woman the hunter); else, by a stable hash of their id, `SHARE_OF` 6 slots a sex, two of them a new look (the
  farmer and smith for men, the maiden and hunter for women): about a third of the rest. `pickLook` gives it to a
  grown settler in everyday dress (not in plate or leather; not dwarves, children or the founder) once it is drawn;
  the fitted looks are kept out of everyone else's pool, so the art's arrival moves only the folk it is for, and
  everyone else keeps the look they had. The pick rests only on the id, sex, what they came as and their stage of life,
  never on their job or what they're doing, so it never switches; the one change is turning elder, like growing up.
- **`iso/folkTint.ts`**: `LOOK_DYES` (the maiden's dress bright, the hunter's cloak the woods' greens and browns, the
  farmer's and smith's work cloth plain, the elders' sober), taken from the person's own fitted look once it is drawn
  (`ownFittedLook` in folkRules.ts), not from the look worn: so in armour their colours stay theirs, and before the art
  nobody's colours change. Only the main cloth's dye changes; skin, hair and the second cloth are as before. The
  elders' grey hair is drawn, and left unlabelled (`hair: []`, as the druid elder's), so it stays grey.
- **`FolkState.typeName`**, and `PortraitWho.typeName` kept by `folkKnow` (`art/folkPortrait.ts`), so the cards wear
  the map's look. (A memorial's face, drawn from the annals, has no `typeName`: a smith or farmer remembered there wears
  an everyday look.)

**Tested:** `test/fittedLooks.test.ts`: none is picked while its art is missing (and the list follows `made.json`);
once drawn each goes to its folk; a person's pick is the same however often it is asked and whatever they're doing,
and anyone not meant for a new look keeps their old one; the maiden's dyes are hers, the same in plate. With the
stand-in art laid into the repo (and taken out again), the whole `npm test` passed too: it first caught a grey-hair box
read as skin, and dyes that changed with armour, both fixed.
