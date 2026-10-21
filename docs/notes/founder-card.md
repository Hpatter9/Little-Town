## The founder's card

Step 1 of playing the founder. The player steers the founder (`GameState.mainId`) with five orders, the camera follows them, the heir rule is the owner's, and a founder who dies with no heir ends the game.

**Orders** (`sim/founder.ts`, commands in `sim/commands.ts`, applied in `sim/sim.ts`): `founderGo` (walk to a finished building), `founderWork` (a job for the day, or `null` for the town's choice), `founderRest` (home to bed for `REST_HOURS` = 6; each hour mends `REST_HEAL` of full health and lifts morale by `REST_MORALE`), `founderGive` (coins from the purse to the treasury; the card offers `GIVE_STEPS` 5, 20, 50), `founderHeir` (name a grown-up, or `null`). The state is `s.founderOrder` (optional, `FounderOrder`); `founderTick` ends a job or rest on time, and `founderTask` in `sim/people.ts` reads it in `chooseTask`, after raids, fire, wounds and eating, so the founder's needs and the town's emergencies still come first. A walk ends on arrival.

**The card**: `panel/founderPanel.ts`, panel id `founder` (`shared/ipc.ts`), key `founderKey`. Opened by the ♛ button on the phone's top bar (`ui/topBar.ts`) or by tapping the founder on the map ("The founder…" on their tap card). Go to is done on the map: a finished building's tap card has "Send the founder here". The snapshot has `founder` (`FounderView`: order text, who would lead, who could be named, the jobs).

**Camera**: `main.ts` eases the camera to the followed person (`snap.hero`), else the founder, and waits `FOLLOW_WAIT_MS` after the player pans (the old `camera.follow`). Not during a raid or after game over.

**The heir rule** (`heirOf` in `sim/health.ts`, changes "Deaths made common again"): for the leader, the named heir (`s.heirId`, set by the Name an heir action or an adoption) if alive, then the partner, then the eldest grown child (lowest id). Nobody else. A leader's heir used to be anyone grown; now a stranger leads only if named. No heir: `s.gameOver` gets `founder`, `days` and `cause` as well as the text (and the snapshot carries them).

**Game over**: `createGameOver` (`overlayUi.ts`) names the founder, the days they lasted and how they died. "Back to the main menu" calls the bridge's `endTown` (phone, `mobileBridge.ts`): the host makes the legend (`legendOf`, message `legend` in `shared/simHost.ts`), the page keeps it (`keepLegend`), drops the save and reloads to the main menu. The desktop has no `endTown`, so its button opens the New town panel as before.

**Tests**: `test/founder.test.ts`; `test/deaths.test.ts` now names a stranger heir before the second death.
