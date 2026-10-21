## The build menu: the founder builds, the town picks the spot

Changes "The menus redone", pins and the planner's building (HISTORY.md "Phase 1", "Mood drives what the town builds").
The owner's ask: building is the founder's call (CLAUDE.md, Priorities).

- **The switch:** `GameState.townBuilds?` (`sim/state.ts`). Missing or false: the town lays no blueprint of its own. Tests of the
  old planner set `s.townBuilds = true`. Gated: the planner's building choices, upgrades and consolidation (`planBuilding`),
  `planHomes` (plots bought), the arena, boatyard, shrine, ranch, harbour, airship mast, Mage Tower, ward stones and statues.
  Left automatic: the seat of the town (the new age's studies wait on it), events' own blueprints, the monument.
- **Orders:** tapping Build sends `pinBuilding` (`sim/pins.ts`): `planPins` runs straight after the seat, finds the spot with
  `findSpot` and the builders put it up. Two new commands: `orderRing` (`s.ringOrder`: `planRing` and the ring's upgrades run
  until the wall stands) and `orderStreets` (`s.streetsOrder`: `streetsHourly` plans the streets and gate paths once).
- **The recommendation:** `recommendBuilding(s)` in `sim/planner.ts` (the old `wishes`, as advice): homes first when beds are
  short, for every people, then the ring wall (`ringAdvice` in `sim/ringWall.ts`: a first palisade once the town is four strong
  and raided or six; a widened or better wall only when `ringFill` of the space inside is `RING_FILL` = 0.4), then the first
  wish. In the snapshot as `recommend`, refreshed about hourly.
- **The menu** (`panel/buildPanel.ts`, `panel/buildKinds.ts`): "Being built" (orders and sites, Cancel), "The town
  recommends", "Build: Walls and streets", then cards by kind. A card: name, cost (short ones marked), what it does
  (`shortPurpose`), why (`whyOf`), Build. Headings `Build: ...` are matched in `GROUPS`. `LAYER_NAMES` is gone.
- A newly founded town knows no home until `basic_shelter` is learned, whatever its people; the recommendation waits on it.
