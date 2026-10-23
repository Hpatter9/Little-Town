## The art audit, and Legends of the Fall's art

The owner's two asks: "make a pass through to double check that all sprites and assets are consistent in all
locations, that we're using the right ones", and "pull assets from Legends to use" (a survey only, nothing copied yet).
Pictures: `docs/notes/art-audit/` (before and after, phone size 393x852, made from `tools/make-save.mjs` towns of each
people).

### What the audit found

The map, the People list, the tap card, the founder tab, the annals' faces, the shop windows and the God creature's
lineup and card already used the current art: the PixelLab townsfolk (`art/iso/folk`, through `iso/folkWho.ts` and
`art/folkPortrait.ts`) and creatures (`art/iso/creature`). The side-on screens did not: they still drew everyone as the
old Himeko paper doll (`art/hkFolk.ts`), the same plain doll for every people. So a knights' town fought, walked and
celebrated as blue-hatted settlers, a lich town's skeletons as living villagers, and the vampires as farmhands.

### Fixed: the townsfolk in their own looks everywhere

- **`art/folkSide.ts` (new):** `folkSide(sprite, who, pose, x, feetY, height)` and `folkSideById` set a Pixi sprite to
  someone's isometric look turned side-on (east or west; `facing` up and down for the screens seen from above),
  animated from the look's own sheets: `walk`, `idle`, `hammer` for work, the armed look's `attack_1h`/`attack_bow`/
  `attack_2h`/`cast_2h` for a blow, `hurt`, and `death` held lying. It answers false while the look loads, and the
  caller draws the paper doll meanwhile (the paper doll stays as the fallback everywhere). The feet sit at `FEET`
  (0.815 of the frame) and a grown figure is `FIGURE` (0.62 of the frame) tall: measured across the peoples' looks.
- **`art/folkCanvas.ts` (new):** `drawFolk(g, who, anim, dir, t, cx, feetY, height)`, the same for a 2D canvas (the
  menus' moving pictures): a look's sheets load by URL when first wanted, recoloured once per person's colours.
- **Wired in** (each one the paper doll's place, the doll kept while the look loads):
  - the fight screen (`fight/fightView.ts`): the party walking and fighting (a merfolk on their tail keeps the doll,
    whose waist the tail is cut to);
  - the trip pane (`town/expeditionPane.ts`): walking, working the site, fighting;
  - the mine (`fight/mineView.ts`), the Deep (`deep/deepView.ts`) and the Underdark (`underdark/underdarkView.ts`;
    the townsfolk only: those met below keep the doll);
  - cutscenes (`cutscene/cutsceneView.ts`);
  - the event cards' pictures and the raid recap (`panel/scenePlayer.ts` takes a `folk` list beside the dolls,
    `panel/eventScenePlay.ts`, `battle/raidRecap.ts`; outsiders wear a settler's look);
  - the New town scenes (`panel/newGamePanel.ts` `folkOf`: the founders in their people's looks, as their tiles);
  - the interiors (`interior/interiorView.ts`: working at the station facing away, at a desk, idling);
  - the shop window's walking customers (`panel/shopPanel.ts`: they step east or west instead of sliding face-on);
  - the lookouts on the watchtowers (`map/mapTownLife.ts`, `main.ts` passes the townsperson as `who`);
  - the raid board (`tactics/tacticsView.ts` sets `isoFolk` and the new `board` flag on its `MapPeople`; `board`
    turns the board's iso screen spots back into grid steps for the looks' facing, `map/mapPeople.ts`).
- No rule of the simulation changed; renderer only. `npm run typecheck`, `npm test` (1679 pass) and `npm run web`.

### Still to do (needs the owner's call or new art)

1. **Combat forms over the looks.** In a raid, on the map and the raid board, a fighting calling still takes a
   Craftpix hero's form (`heroSheet`, `roadForm`, `mapPeople.ts` `inCombat`): a knights' town defends as red
   samurai, and so does everyone else. The PixelLab looks have their own attack animations now. Recommend: keep the
   looks in a fight for the five playable peoples (a calling's form only for the mythic or beast forms), but it
   reverses an earlier design, so it's the owner's call.
2. **Armed looks.** Only the settlers (and dwarves) have every weapon look (`+axe`, `+sword`, `+bow`,
   `+greatsword`, `+staff`, `+hammer`). Knights, liches, vampires and orcs have one tool each (`+axe` or `+hammer`),
   so a knight with a sword swings an axe or punches, and an archer of those peoples has no bow. A missing look is
   also asked for once (a harmless 404, e.g. `knights/man_squire+axe`). Needs PixelLab art: at least `+sword` and
   `+bow` for knights, orcs, vampire and lich.
3. **The build menu's pictures share pieces.** In a lich town the lean-to, the longhouse and the Bone Altar show the
   same kit cottage (`panel/structure.ts` `thumb`, the kits' `pieceFor`). Each people's kit needs more distinct pieces
   (a lean-to, a seat), or the menu should use the building's own iso piece where one exists.
4. **Statues** (`map/statueArt.ts`) are carved from the paper doll's silhouette. They'd want the iso look's
   silhouette instead (a small change, but it changes the look of every statue: the owner's call).
5. **The loading screen** (`loading/stripLoad.ts`) waits for each townsperson's paper-doll layers, which the map no
   longer shows; it should wait for (or warm) their iso looks instead. The title screen's town is top-down pack art
   and the goat; fine as a title, but not the iso town.
6. **The Underdark's strangers and the event cards' outsiders** have no people's own look: the strangers keep the
   doll, the outsiders wear settlers' looks. New PixelLab casts would fix both (dark folk, a herald, a priest).
7. **Foes on the fight screens** are mixed: Craftpix side-view sheets, PixelLab remakes, and the old Himeko orcs
   (`creatures/packs/hk_orc_*`). Now that orcs are a people, those Himeko orcs stand out. Legends has better ones
   (below).
8. **Orcs:** their looks are in and drawn as made (no recolouring, `FIXED_CASTS`). The shaman is grey-skinned and
   white-haired, so a crowd of shamans reads as undead rather than orc: worth a greener shaman.

### Legends of the Fall: what Chronos could use (a survey; nothing copied)

Cloned read-only beside this repo (`../legends-of-the-fall`). Contact sheet: `docs/notes/art-audit/legends-candidates.png`
(numbers below). Every Legends character sheet is a **side view facing right**, in the same sheet format as Chronos's
`creatures/packs.json` (`w`, `h`, `perRow`, `rows`, `counts`, `figure`, `facesRight`). So they drop into the fight
screens, the raid recap, cutscenes and the war sprites with a `packs.json` entry each, but **none fits the iso map**
(that needs 8-facing art, as Chronos's own PixelLab folk and creatures are).

**Already in Chronos** (47 files are byte-identical): the music, the Craftpix side-view heroes and monsters (knights,
samurai, ninjas, wizards, skeletons, werewolves, gorgons, minotaurs, satyrs, robots, yokai), the effects (5000 Pixel
Effects), the rocks, grass and the goat, the backdrops (same Craftpix packs), the DawnLike icons, and the castle, camp
and calmap pieces (Chronos's own iso kits shrunk). Nothing to take there.

| Group | What | Where in Chronos | Fit | Source |
|---|---|---|---|---|
| Orc warband (1-4) | `units/hk_orc_grunt`, `_archer` (figure 64px), `_brute` (91), `_warlord` (101); walk 5, attack 5, idle, death 5 + lying | Replace the Himeko `creatures/packs/hk_orc_*` (orc foes, orc callings, war sprites, cutscenes) | Good on the fight screens; far better than the Himeko orcs (1 v 30). No hurt row | PixelLab (the owner's Legends project) |
| Demons, imp, ogres (5-9) | `hk_imp`, `hk_demon`, `hk_demon_lord`, `hk_ogre`, `hk_ogre_horned` (61-123px) | Same-named Chronos foes: raid foes, bosses, the Calamity | Good; same names and format | PixelLab |
| Bosses (10-16) | Lich King (126px), Oni King, Boar King, Devil Leader, Shaman King, forest bosses, golems (forge titan...) | Boss fights; the Lich King for the liches' stories; golems for the Deep | Good side view, hurt rows, 8-frame walks | PixelLab; **the golems are batareya's Golems pack figures (no licence file): check before any public release** |
| Calling heroes (17-22) | `cls_*_1-3` (8 callings x 3 grades, ~66px), treant, 16 `hero_*` (paladin, druid, juggernaut, kraken mate, mummy...) | Fight forms for callings, the merfolk, undead foes | Fight screens only; same size as the Craftpix knights | PixelLab |
| Scenes (23-24, 28) | tavern walls and hearth, summoning hall, library, the home castle (side view) | Event-card or cutscene pictures | Side view: clashes with Chronos's top-down interiors and iso map; flat pictures only | PixelLab |
| UI (25-27) | 32x32 tab and crown icons; stone and iron frames; three chests | Icons for founder titles and trophies; a loot chest | The icons fit; the slate frames don't match Chronos's menus | PixelLab; Legends' own; Craftpix chest tinted |
| Tiles | side-on column tops (64x64) | little | Mismatch with the iso kits | Craftpix |

**Top recommendations** (the owner chooses):

1. **The orc warband (1-4)** for the orcs' fight sheets: the very files Chronos's orc foes and callings name
   (`hk_orc_*`). Needs new `packs.json` entries (no hurt row: idle or attack frame 1 stands in) and the figure heights
   in `data/packSheets.ts` (the grunt is 64px, not 76).
2. **The ogres, demons and imp (5-9):** same-named drop-ins for Chronos's raid and boss foes.
3. **The Lich King (10):** a ruler or boss for the liches' cutscenes and the raid board.
4. **The remade Craftpix bosses (12-15):** full hurt rows and steady heights; compare beside Chronos's originals first.
5. **Calling heroes (18-22)** as fight forms (paladin, druid, warlock, ranger), the merfolk's kraken mate, mummies.
6. **The 32x32 icons (25)** for founder titles and trophies.
7. **The tavern and summoning hall (23-24)** only as flat pictures for event cards or cutscenes.
8. **Skip** the effects, music, backdrops, DawnLike icons and the castle, camp and calmap pieces: Chronos has them.

For the iso map, Legends' PixelLab prompts (`tools/pixellab/spec.py`, `foes/`, `heroes/` there) could be reused to
make matching 8-facing orc warriors. Anything taken over is credited to PixelLab (the owner's Legends project) in
`CREDITS.md`.
