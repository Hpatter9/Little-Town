## Foes and bosses from Legends of the Fall

The owner's ask: "Bring over any assets we can use" from the sister game Legends of the Fall
(`hpatter9/legends-of-the-fall`, cloned read-only beside this repo; nothing in it was changed). Most of its art is the same
Craftpix and DawnLike packs Chronos already draws from (47 files byte-identical, see `docs/notes/art-audit.md`, "Legends
of the Fall: what Chronos could use"), so only what Legends generated itself with PixelLab was weighed. No PixelLab
generations were spent. No rule of the simulation changed; this changes the pictures in HISTORY "The bestiary" and
"Rival origins" (the Lich Lord), and "The Calamity" (the Ashen Tyrant's picture).

**What came over** (16 sheets, `src/renderer/art/creatures/packs/`, copied as they are; their layouts copied from Legends'
`src/art/units/sheets.json` into `art/creatures/packs.json`, the figure heights into `data/packSheets.ts`):

| Sheet | Was | Foes drawn with it |
|---|---|---|
| `hk_orc_grunt`, `hk_orc_archer`, `hk_orc_brute`, `hk_orc_warlord` | Himeko Sutori orc body in barbarian gear (4 walk, 2 attack, 1 dying frame) | Orc Grunt, Orc Archer, Orc Brute, Gorbag the Warlord (the orc warband raid, `rival_orcs`) |
| `hk_imp` | Himeko imp | Red Imp |
| `hk_demon`, `hk_demon_lord` | Himeko large demon | Brute Demon, Gorrath the Gate Warden; "Malphas, Prince of the Pit", the Demon of the Ring |
| `hk_ogre`, `hk_ogre_horned` | Himeko blue ogre | Ogre (the Warband raid), Hill Ogre |
| `boar_king`, `devil_leader`, `shaman_king` | Craftpix top-down boss creatures (chibi, seen from above) | The Boar King; Azgoroth the Devil Lord, the Forge Lord; the Shaman King, the Wyrm Priest |
| `forest_boss_1..3` | Craftpix Free Forest Bosses (small, 36-44 px) | Thornmaw; the Mossback Brute, the Cave Troll; the Gilded Idol |
| `lich_king` (new) | (the Lich Lord was the Himeko Tyrant tinted green) | The Lich Lord (the barrow dungeon, the lich portal, the rival lich army's lord) |

The same sheets are also the pictures in the event cards and raid recaps (`panel/sceneScripts.ts`: orc raiders, the
imp, the ogre, the Boar King), the war sprites (`art/warSprites.ts`), the Bestiary's thumbnails, and some callings'
combat forms (orcs, fae, alchemists, druids: peoples not playable now).

- The Legends sheets are the same format as Chronos's (`w`, `h`, `perRow`, `rows`, `counts`, `figure`, `facesRight`),
  larger and with more frames (5 to 8 a row, the last dying frame lying flat). The orcs, imp, demons and ogres have no
  hurt row; `creatureFrame` (`art/creatures.ts`) already falls back to the walk or attack frame then.
- Display heights are unchanged: each foe's `packSprite(sheet, height)` scales from the sheet's figure height, so the
  new figures come out the size the game already asked for. The event-card and recap pictures (`panel/scenePlayer.ts`)
  size an actor by the whole frame instead, and the Legends figures fill more of their frames (the grunt 94% against
  78%), so there they stand about a fifth taller than before.
- `tools/compose-sheets.cjs` no longer builds those sheets (their specs are taken out, with a note; their
  `packs.json` entries are kept as the tool keeps any it doesn't build), so a re-run can't put the old ones back.
- `data/enemies.ts`: the Lich Lord is `packSprite('lich_king', 92)`, its green tint dropped (the sheet has its own colours).

**One knock-on change (the owner's say):** the Himeko Tyrant sheet lost its only foe (the Lich Lord), and
`test/bestiary.test.ts` holds that every pack sheet is used by some foe. It now draws **the Ashen Tyrant** (the
Calamity's avatar, `data/calamity.ts`), which was Tiny RPG's 48 px Dark Knight blown up twice (a 46 px figure, a
person's size): `pack('hk_tyrant', 92)`, the size the Tyrant was drawn as the Lich Lord, its ashen tint and look kept.
The Dark Knight stays the Black Knight. If the owner would rather keep the Dark Knight there, the Tyrant needs another foe.

**Left out, and why**
- **The class heroes (`cls_*`) and the hero remakes (`hero_*`):** the side-on screens now draw townsfolk in their own
  PixelLab looks (`art/folkSide.ts`), so a hero sheet would only fit as a calling's combat form, and changing those is
  the open question 1 in `docs/notes/art-audit.md` (the owner's call).
- **The Oni King:** no oni in Chronos (the yokai night parade has no boss); it would be new content.
- **The satyr remakes (`satyr_1..3`):** Chronos's are the Craftpix originals with longer animations (12 walk frames);
  the remakes are smaller (66 px against 74-88) and not plainly better.
- **The golems:** figures from batareya's Golems pack, not generated, and the pack has no licence file.
- **The tavern pieces (`src/art/tavern`), the summoning hall and the library:** side views. Chronos's interiors and the
  tavern window are seen from above and use the hand-made rooms (`docs/notes/venue-hand-rooms.md`), so nothing
  code-drawn is left for them to replace.
- **The PixelLab icons (`ui/tab-*`, `ui/ic-*`, `talent/*`):** Chronos's menus use pack icons and text marks, with no
  code-drawn icons to replace; swapping its menu marks for these would be a new look (the owner's call).
- **The effects (`fx/vfx`):** the 5000 Pixel Effects pack, which Chronos already has.

**Checked:** `npm run typecheck`, `npm test` (all pass), `npm run web`. Screenshots in `docs/notes/legends-assets/`, at
393x852 and 852x393 (taken at twice the pixels, a developer-mode raid of the kind asked for): the orc warband raid on
the raid board (`orcs-raid-tall.png`, `orcs-raid-wide.png`, the close-up `orcs-close.png`), the Bestiary with the Lich
Lord's card picked (`bestiary-tall.png`, `bestiary-wide.png`), and every changed foe's Bestiary card in one sheet
(`bestiary-cards.png`). Before and after, sheet by sheet (Chronos's old idle, attack and dying frames on the left,
the Legends ones on the right): `before-after.png`. Not caught on screen: the event-card and recap pictures, and the
side-on fight screens of a party's delve or hunt (no quick way to stage one); they draw the same sheets through the
same `packs.json` layout as the raid board and the Bestiary. A Warband raid this early in a save brings no ogre, so the
ogres are seen in the Bestiary only.
