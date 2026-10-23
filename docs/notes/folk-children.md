## Children with their own art

The owner's complaint was "the child looks like a tiny man with a beard". PixelLab has now drawn a proper boy and girl
for every people, and the children wear them. Changes "Natural folk colours, and children" (the `CHILD_LOOKS` stand-ins
and `CHILD_SCALE` 0.72 there are gone).

**The art.** `art/iso/folk/<people>/child_boy/` and `child_girl/` for settlers, orcs, lich, druid, vampire, werewolf,
robot, merfolk, nomads, fae, alchemists and knights: the adults' layout (`index.json`, frame 148x148, the eight
facings, `rotations.png`), with `walk`, `idle` and `death` only. Drawn child-sized in the frame: about 80px tall
against a grown look's 95, with a big head and short limbs, and standing higher in the frame (feet about 40px above
its foot, a grown look's about 29).

**The looks** (`iso/folkRules.ts`). Both are in `FOLK_LOOKS` for every people. `CHILD_LOOKS` is now the boy and girl
for each people (built from `FOLK_LOOKS`'s keys); `pickLook` gives a child (`isFolkChild`) theirs by sex, and dwarf
children the settlers' (dwarves have no folder of their own). A grown person's pool drops every `child_*` look first
(`isChildLook`), so even a folder with nothing of their sex never gives them one.

**Size and footing.** `CHILD_SCALE` 0.85 (the art is already small; at 0.85 a child stands about 70% of a grown-up,
which reads as a child beside a parent without looking like a doll). `CHILD_FEET_LIFT` 11: `FolkSprite` anchors a
child's frame that many art pixels above its foot, so they stand on their spot like everyone else. The map's side-on
child shrink (`mapPeople.ts`, its own `CHILD_SCALE` 0.7) was also being applied to the iso figure's container, so a
child was drawn at 0.7 x 0.72; the iso figure now takes only the grown factors (`grown`: height, the founder) and
folkRules' own scale. The menus' full portraits crop each figure to itself, so they scale a child by `CHILD_FIGURE`
(80/95 x `CHILD_SCALE`) to stand as tall against a grown-up as on the map; head-and-shoulders portraits crop the
child's own figure, big head and all.

**Moves they lack.** `FALLBACK` already covers them: run walks faster, hurt and every work, cast and attack fall
back to idle. A child never asks for an armed look (`+axe` and so on: none drawn) and doesn't take the Moon Pack's
wolf form (`man_beast`), so no grown look ever shows on a child.

**Previews.** `tools/make-save.ts` takes `KIDS=n`: n children added after the run, each beside a grown-up (cloned
from them, beardless, alternating boy and girl). Pictures in `folk-children/`: a settlers boy beside a grown man
(`settlers-map-upright.png`, 393x852 crop), the settlers and an orc child among adults sideways (852x393), and the
People page and a child's card for both peoples (upright). The orc map upright had no child in view when shot.

Tests: `test/isoFolk.test.ts` (every people has both child looks with walk, idle and death on disk, and every
facing; a child of every people and sex, dwarves included, gets the right child look in any dress; every move a
child is asked for falls back to walk, idle or death; a grown person of any stage, dress and outfit never gets a
child look).
