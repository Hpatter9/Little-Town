## Origin answers on the choice events

Existing choice events (HISTORY "Choice events", "Events with purpose") now carry one extra answer for a single
people, shown only in a town of that people and always last, so the common answers keep their numbers. Each ties into
that people's own system and says what it does in the brackets on the button.

- `data/originOptions.ts`: `ORIGIN_OPTIONS` (people -> event id -> `EventOption`) and `originOptions(origin, eventId)`.
  The shorthands are written out in the file (importing `eventKit` there makes an import cycle with `sim/events.ts`).
- `sim/events.ts`: `optionsOf(s, def)` is the event's answers in this town (used by `startEvent`, `answerEvent`,
  `costOf`, `coinsLine`, and the later effects). Two new effects in `data/eventKit.ts`: `{ ways, by }` (a people's own
  measure: grove/Court favour, Order honour, horde fury, pack renown, foundry power, Great Work progress, settler
  wagons; nothing happens in another people's town) and `{ captives }` (prisoners into the free cells).
- `test/originOptions.test.ts`.

By people (event: answer):
- Blood Court: refugees (blood farm captives + blood), sick_traveller (drain), deserter (thrall), captive_raider (farm).
- Liches: refugees (raise them), dead_walk, w_pilgrim_dies, w_old_battlefield (raised dead join).
- Druids: wildfire, bumper_crop, drought, l_wolf_pup (grove favour).
- Fae: fairy_ring, wishing_well, stranger, comet (Court favour).
- Alchemists: sick_traveller, fever_home, hermit_tome, sinkhole (Great Work progress).
- Knights: refugees (sworn to service), deserter, tribute (single combat), mercenaries (honour).
- Machines: stranger, l_gale, l_lightning_tree, broken_axle (colony power).
- Settlers: refugees, stranger, bumper_crop, wild_horses (wagons, claims, horses).
- Moon Pack: wolves_livestock, l_wolf_pup, bear, monster_lair (pack renown).
- Nomads: wild_horses, horse_trade, drought, tribute (herds and the road).
- Merfolk: flood, l_gale, plague_ship, refugees (the reef's fish, kelp, pearls).
- Dwarves: cave, w_cave_in, dragon, w_ruin_map (ore, gold, gems; doors barred).
- Orcs: refugees (thralls), captive_raider, tribute, scouts (fury).

The town's recommendation (`recommend`) and its default when nobody answers come from the common answers only: the extra answer is the player's call. Deterministic: the
existing event stream; no new fields in the save (`captives` uses `s.prisoners`, the rest the people's own state).
