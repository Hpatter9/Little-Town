## The Calamity is the Great Enemy's stirring

Changes "The Calamity" and the great-enemy note (0.99.0) in `docs/HISTORY.md`: the two arcs are one now. The Calamity is
no longer a villain with a clock, a dread of its own, armies and a siege; it is the Enemy's stirring made manifest, and
the Enemy's **plan** (`GreatEnemyState.plan`, paced days, `PLAN_AT` in `data/greatEnemy.ts`) drives it.

- **Which Calamity.** `ENEMY_CALAMITY` (`data/calamity.ts`): tower and undying bring the tyrant, plague and drowned the
  rot, brood and engine the sleeper. `enemyFit` no longer looks at the Calamity (there is only one villain to avoid
  doubling), and `calamityKindOf`, `CALAMITY_WAKES` and the daily dread are gone.
- **When it acts** (`CALAMITY_AT`, plan days): it wakes far off at 10 (the omens; the wake cutscene plays, now naming
  the Enemy), its heart opens on the board and its scar spreads at 20 (`calamity_spreading`), its cult takes root at 26
  (`calamity_cults`); the march (4) and the last siege (5) are the Enemy's own stages, told by the Enemy's scenes.
  `calamitySync` (wake, stages, told once, one Chronicle line each) and `calamityDaily` (scar, wards, cult deeds) are called
  from `enemyDaily` in `sim/greatEnemy.ts`; `forceEnemy` syncs too. `calamityHourly`, `calamityRaidOver`, the Calamity's
  own armies, siege, `STAGE_AT`/`stageOfDread`, `SIEGES_TO_FALL` and its omen roll are removed.
- **Omens.** `omen()` in `greatEnemy.ts` takes `CALAMITY_OMEN_SHARE` (0.4) of its signs from the Calamity's own lines
  (side stream `enemy:omen-calamity`, so the Enemy's own omen draws are untouched), "An omen of the Ashen Tower: a grey
  mould crept over the bread."
- **The heart.** Still `calamity:heart` on the board, but it is the Enemy's forward seat, kept by one of its
  lieutenants (`keeperOf`, by seed). Clearing it sets the plan back `HEART_SETBACK` (5 plan days, a little under a
  slain lieutenant's 6), halves the scar and closes the heart for `HEART_QUIET_DAYS`; the stage does not change and the
  story goes on. Nests left on the land quicken the plan (`NEST_HASTE` per nest level, via `calamityPace` in
  `paceToday`), ward stones slow it (`WARD_SLOW`); a nest burned out (`nestCleared`) and a "dread" event effect move the
  plan through `shiftDread`/`shiftPlan` (never into the siege on their own; frozen once the siege is warned).
- **The end.** The Enemy's peace is the win: `victory()` calls `calamityLifts` (the blight lifts, the cult scatters,
  `beaten` set). The Enemy's two lost sieges end the town (`SIEGES_TO_FALL` 2) and tribute is paid only when the treasury
  holds twice the sum, both as the Enemy already had them.
- **State.** `CalamityState` keeps `kind`, `stage`, `heart`, `scar`, `heartCleared`, `omen`; `dread` is now the plan's
  share of the way to the siege (0 to 100, for the menus). New optional `driven`; `siegeAt`/`lost` kept optional for old
  saves. `Raid.calamity` is old-save only.
- **Old saves.** `bindCalamity` (`greatEnemy.ts`, run from `greatEnemyHourly` for a Calamity without `driven`): the dread
  becomes plan days (dread/100 x `PLAN_AT.siege`, never lowering the Enemy's own), the Enemy's stage is passed quietly,
  sieges lost carry over (capped at one under the fall), a pending siege or a siege/army raid already on the land becomes the
  Enemy's (`r.enemy`), and the old avatars still count as the siege's leader when they fall. The Calamity's kind becomes the
  Enemy's. No save-version bump.
- **Menus.** One card: the Trips tab's separate "The Calamity" section and the overview tile are gone; the Enemy's card
  carries the Calamity's stage, nests, wards, cult, forward seat, blight, and the heart destination card.
  `calamityView` gained `enemy` and `keeper`. The news bubble's Calamity items are folded into the Enemy's.
- **Tests.** `test/calamity.test.ts` (rewritten: arc, pace, heart setback, no second scheduler, finale, old saves),
  `test/greatEnemy.test.ts`, `test/cutscenes.test.ts`.
