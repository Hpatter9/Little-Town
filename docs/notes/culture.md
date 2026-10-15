## Town personality and culture

Over months the town grows its own customs, drawn from what happened to it, and it shows. Autopilot only; own side
stream ('culture'); nothing drawn from the town's stream; no manual controls.

- **Files:** `src/shared/data/culture.ts` (20 traits, `CULTURE_TRAITS`, dishes merged into `ITEMS` as `CULTURE_ITEMS`),
  `src/shared/sim/culture.ts` (`cultureHourly`, `cultureDaily`, `readSignals`, `fashionName`, `cultureView`),
  `src/renderer/panel/culturePanel.ts` (the Chronicle's **Culture** tab), `test/culture.test.ts`.
- **Earning:** once a day (hour 5) the town's history is read as 16 signals (hunger, plague, raidWon, raidLost, peace,
  sea, trade, deaths, disaster, plenty, learning, festive, elders, justice, war, births). A trait's strength is
  `strength * DECAY (0.96) + weight * signal`, capped at `STRENGTH_MOST` 40. It is taken up at `WIN` 12, let go below
  `LOSE` 5; the town holds `HELD_MOST` 5, and a newcomer must beat the weakest by `DISPLACE` 4. Old fallen are read from
  `s.fallen` by the last key seen (`CultureState.seen`), raids from `s.yearRaids` deltas.
- **Showing:** a custom on day `CUSTOM_DAY` 2 of the trait's season at `CUSTOM_HOUR` 18 (the dish `cult_<id>_dish` is
  ordered at the fire on the season's first days; eaten at the custom; morale mark `CUSTOM_MARK` + `DISH_MARK` with the
  dish made); sayings (`CultureView.sayings`, read by `speech.ts` `setTownSayings`, `SAYING_SHARE` 0.35 of lines);
  a pennant colour at every gathering (`setCultureColour` in `mapFestival.ts`); three props of a festival kit by the camp
  (`MapFestival.syncProp`); the festival song takes the strongest trait's mode and lead (`setCultureMotif` in
  `musicScore.ts`); visitors' remarks as journal lines every `REMARK_DAYS` 6 while a band is by.
- **Names:** `fashionName` (called by `social.ts` `welcomeChild`) gives `FASHION_SHARE` 0.6 of children a name from the
  fallen, from heroes, or from the pantheon, by the strongest held trait with a fashion. The base name still comes from
  the town's stream, so nothing else shifts. The tavern's sign (the strongest trait's `sign`) shows only on the card.
- **State:** optional `GameState.culture` (`CultureState`). Absent in old saves; created on first use.
