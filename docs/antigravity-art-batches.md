# Art batches for Antigravity

The owner hands these to Antigravity one batch at a time. Each batch is a self-contained task: paste **the shared brief** and
then the batch. Antigravity makes the images and puts them in a staging folder on its own branch. The coordinator (Claude)
then cuts, checks and wires them into the game, so **Antigravity never edits the game's code or its existing art**.

---

## The shared brief (paste before every batch)

You are making pixel-art assets for **Chronos Settlement**, a cozy isometric town game played on a phone. You are working
in its repo (hpatter9/little-town).

**Before anything else:** read `CLAUDE.md` (the "Rules that are easy to break" and "Art" parts),
`docs/notes/grid-audit.md` (the grid rules) and `docs/notes/pixellab-plan.md` (what each asset is for).

**Where to work:**
- Start a branch from the latest `main` named `gemini/art-<batch name>`. Never push to `main`.
- Put **only** new image files and one `manifest.json` in `art-inbox/<batch name>/`.
- Don't change any other file, except one line in `CREDITS.md` saying the batch's images were generated with Gemini in
  Antigravity for this project.
- Never touch `../chronos-assets`.
- Commit and push the branch when the batch is done.

**Match the existing art exactly.** Before drawing, open these references and copy their pixel style, palette,
outline and light:
- `src/renderer/art/iso/kits/settlers/` (the town pieces: `cottage.png`, `workshop.png`, `longhouse.png`, `tavern.png`,
  `watchtower.png`, `woodpile.png`, `crates.png`, `palisade_run.png`, `stone_wall_run.png` and the rest; their sizes are
  in its `index.json`);
- `src/renderer/art/iso/folk/settlers/<look>/` (the townsfolk: `rotations.png` shows a look in all 8 facings, and
  `walk.png` and `idle.png` show the frame layout).

**Rules for every image:**
- PNG with a **fully transparent background**. No ground, floor, shadow, backdrop, border, text, numbers or watermark,
  unless the batch asks for ground.
- **Crisp pixel art:** hard edges, no anti-aliasing, blur, gradients, glow or soft shadows. Use the references' palette.
- **The view:** the same isometric "low top-down" view as the references. The light falls from the upper left.
- **Pixel size:** at the same scale as the references. Never draw bigger and shrink, or smaller and stretch; draw at the
  size the batch gives.

**The grid** (from `docs/notes/grid-audit.md`). A map cell is a diamond **96 px wide and 48 px tall** in the art's own
pixels (the game draws the art at half size). A building with a footprint of `w × h` cells stands on a diamond of grass
`(w+h)×48` px wide and `(w+h)×24` px tall: a 2×2 sits on a 192×96 diamond, a 3×2 on a 240×120 diamond. **Nothing may
reach past that diamond's left or right corner, or onto the ground in front of it.** Roof eaves may overhang the sides by
at most a quarter cell (12 px); tall parts may rise as high as they like.

**Townsfolk frames:**
- Each frame is a square cell: **156×156** for men, founders and dwarves; **148×148** for women and children.
- The feet sit **29 px above the bottom** of the cell (children's 36 px), centred left to right, and stay on that exact
  spot in every frame. The figure must not drift or change size.
- Facings, as in the game: `south` (toward the viewer), `south-east`, `east` (to the right), `north-east`, `north` (away).
  You only need these five; the game mirrors them for the other three.
- Save each move in each facing as one horizontal strip: `art-inbox/<batch>/<look>/<move>_<facing>.png`, with the
  frames left to right, no gaps.

**`manifest.json`:** one entry for each file, giving the file, what it is (building id, look, move, facing), its frame
size and frame count, and anything you couldn't get right. Be honest: a frame that drifted is better flagged than hidden.

**Quality check before you push:** lay each strip next to the reference and check:
- the same face, hair, clothes and colours as the reference;
- the same size;
- the feet on the same spot in every frame;
- loops loop;
- nothing outside the cell or diamond.

Redo anything that fails. If a look can't be kept identical across frames, flag it in the manifest instead of changing
the look.

---

## Batch 1: `sleep` (the most wanted)

**The move.** Lying asleep, **6 frames**, a seamless slow breathing loop:
- The figure lies flat on their back on the ground the whole time, eyes closed, arms at their sides.
- Only the chest slowly rises and falls.
- They never sit up or move their limbs.
- The body lies along the facing direction, with the head toward that side.
- The figure stays inside the cell, its middle on the cell's foot spot.

**Looks** (one folder each; frame size in brackets):
- **Men (156):** `man_base`, `man_leather`, `man_plate`
- **Women (148):** `woman_base`, `woman_leather`, `woman_plate`
- **Dwarves (156):** `dwarf_base`, `dwarf_apron`, `dwarf_plate`
- **Founders:** `founder_hero` (156), `founder_heroine` (148)
- **Children (148):** `child_boy`, `child_girl`

**Files:** `sleep_<facing>.png` for the five facings, in each look's folder.

## Batch 2: `barrow` (the wheelbarrow and pushing it)

**1. The barrow.** A small wooden wheelbarrow with one front wheel and two handles, in the town kit's style, about
**52 px long**:
- two views: going **down-right** (`barrow_down_<load>.png`) and going **up-right** (`barrow_up_<load>.png`);
- five loads: `empty`, `logs`, `stone` (grey stones), `sacks` (brown grain sacks), `crates` (wooden crates).

That's 10 files.

**2. Pushing.** A **6-frame walking loop**:
- leaning slightly forward, both arms held low and forward, hands gripping invisible handles at waist height;
- **don't draw the barrow**, the game adds it;
- for the grown looks only: `man_*`, `woman_*`, `dwarf_*`, `founder_hero`, `founder_heroine`;
- files: `push_<facing>.png`, five facings.

## Batch 3: `pieces` (small town pieces)

Each is a single still image (except the flame), in the settlers kit's style, standing on its grass diamond as the kit
pieces do:
- `stockade.png`, footprint **3×2**: a square pen of sharpened stakes, a gate in the front-left side, a prisoner's post
  inside.
- Stockpile heaps, footprint **1×1** each, as wide as the kit's `woodpile.png`:
  - `grain_sacks.png`: a stack of brown sacks;
  - `planks.png`: a stack of sawn planks;
  - `ore_pile.png`: a heap of dark ore with rust-coloured bits.
- Wall corners, **1×1** each:
  - `stone_corner_tower.png`: a short round stone tower that joins two `stone_wall_run` walls at a corner, the same
    stone and height as the run;
  - `palisade_corner_post.png`: a thick sharpened corner stake that joins two `palisade_run` runs;
  - `fence_corner_post.png`: a corner post that joins two `fence` runs.
- `training_dummy.png`, **1×1**: a straw-stuffed sack dummy on a wooden post with a crossbar.
- `flame.png`: a small fire for torches and braziers. A horizontal strip of **6 frames, each 16×24 px**, a seamless
  flicker loop. Orange and yellow tongues on a red base, with the base fixed and only the tongues moving. No glow.

## Batch 4: `buildings-first` (16 first-age buildings)

Each is a building in the settlers kit's style, **drawn for its own footprint** on its grass diamond (see the grid rules
above). Look at what it does (in brackets) so the picture says it. Save each as `<id>.png`. Hard rule: nothing past the
diamond's left or right corner, or onto the ground in front.

| id | name | footprint | what it is |
|---|---|---|---|
| lean_to | Lean-to | 2×2 | a rough one-room shelter of poles and bark; houses 1 |
| healers_hut | Healer's Hut | 2×2 | a small hut with herbs drying and a fire; for the hurt |
| workbench | Workbench | 2×2 | an open-sided shed over a big workbench with tools |
| tanning_rack | Tanning Rack | 2×2 | wooden frames with hides stretched on them |
| drying_rack | Drying Rack | 1×2 | a long rack with fish and meat drying |
| smokehouse | Smokehouse | 2×2 | a small log hut with smoke from its roof |
| kiln | Kiln | 2×2 | a clay dome kiln with a stack of pots |
| basketry | Basket Weaver's | 2×2 | a hut with baskets and reed bundles |
| bone_carver | Bone Carver's Hut | 2×2 | a hut with antlers and bone tools hung outside |
| fireside_inn | Alehouse | 3×2 | a plain one-room alehouse with a barrel by the door |
| trading_post | Trading Post | 3×2 | a log trading post with a counter and goods |
| graveyard | Graveyard | 3×2 | a fenced plot of grave markers |
| wayside_shrine | Wayside Shrine | 2×2 | a small roofed shrine with candles |
| quarry | Quarry | 3×2 | a cut stone pit with blocks and a hoist |
| monster_guild | Monster Hunters' Guild | 3×2 | a sturdy lodge with trophies and a notice board |
| militia_post | Militia Post | 1×1 | a small guard booth with a spear rack |

## Batch 5: `buildings-medieval` (29 buildings)

The same rules as batch 4: `<id>.png`, each drawn for its footprint.
- **Crafts, 3×2:**
  - `smithy` (a forge with an anvil and chimney);
  - `sawmill` (a water- or saw-pit mill with logs);
  - `bakery` (an oven chimney, bread on a sill);
  - `windmill` (a tower mill with sails);
  - `mine` (a timbered mine entrance with a cart);
  - `tannery` (vats and hides);
  - `brewery` (barrels and a copper);
  - `coal_mine` (like the mine, but with coal);
  - `glassworks` (a furnace and glass);
  - `gunsmith`;
  - `cannery`;
  - `print_shop` (a printing press);
  - `bathhouse`;
  - `cement_works`.
- **Crafts, 2×2:**
  - `bloomery` (a small iron furnace);
  - `cooper` (barrel making);
  - `loom` (a weaver's shed);
  - `tailor`;
  - `dyeworks` (dye vats in bright colours);
  - `chandlery` (candles);
  - `jeweller`;
  - `apothecary` (the Stillroom: a still with herbs);
  - `clockmaker`.
- **Shops, 3×2, each a shopfront with its goods shown:**
  - `market` (Marketplace: several stalls round a little square);
  - `weapon_store` (Weapon Shop);
  - `armour_store` (Armour Shop);
  - `furniture_store` (Furniture Shop);
  - `apothecary_shop` (Apothecary).
- **Defence, 1×1:** `guard_tower` (Archer Tower), `ballista`, `catapult`.
- **Other:** `siege_workshop` 4×2.

## Batch 6: `buildings-late` (22 later-age buildings)

The same rules again:
- `deep_shaft` (Shaft to the Deep), 2×2;
- `arcane_library`, 3×2;
- `arcane_academy`, 3×3;
- `resurrection_shrine`, 2×2;
- `phylactery`, 1×2;
- `oil_derrick`, 2×2;
- `radio_tower`, 1×2;
- 1×1 defences: `cannon`, `gun_nest`, `land_mine` (a small mound with a pressure plate), `gun_turret`, `flame_turret`,
  `mortar_pit`, `laser_turret`, `tesla_coil`;
- 3×2: `bio_lab`, `deep_mine`, `nanoforge`, `battery_plant`;
- `launch_site`, 8×4 (a rocket on a launch tower with a gantry, drawn upright and along the grid).

The later ages may look more modern, but use the same pixel style and palette family.

## Batch 7: `cards` (side-on beasts for the event cards)

These are **side view**, not isometric. The beast faces **right**, in the pixel style of
`src/renderer/art/creatures/packs/werewolf_black.png`. Each frame is **128×96 px**, the feet on the bottom 8 px.
- `wolf_walk.png` (6 frames), `wolf_attack.png` (6, a lunging bite), `wolf_idle.png` (4).
- `bear_walk.png` (6), `bear_attack.png` (6, rearing, then a swipe), `bear_idle.png` (4).
- `dragon_fly.png` (6, wings beating; this is also its walk), `dragon_attack.png` (6, a short burst of fire breath:
  fire is allowed here), `dragon_idle.png` (4, hovering).

## Batch 8: `god-fixes` (the God creature's weak spots)

The creatures are in `src/renderer/art/iso/creature/<kind>/`, 156×156 cells, rows in the order
south, south-east, east, north-east, north, north-west, west, south-west. Match each creature exactly.
- **Wolf:** `wolf/death_north.png`, 7 frames. Its north-facing death goes pale in the current sheet; keep its full grey.
- **Bear:** `bear/walk_<facing>.png`, 6 frames, all five facings. Its walk is paler than its other moves.
- **Golem:** `golem/punch_<facing>.png` (6 frames) and `golem/miracle_<facing>.png` (8 frames, arms raised), five
  facings each. It slims down in those moves; keep its full boulder bulk.

---

**After each batch:** tell the owner the branch name. The coordinator merges the images in, cut to the grid, and checks
them on the phone.
