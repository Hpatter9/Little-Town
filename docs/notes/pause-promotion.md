## The town waits for the menu; "evolution" becomes "promotion"

**Pause while a menu is open (phone).** `mobile/mobile.ts` `holdForMenu`: opening any menu (but the founding panel)
sends `setPaused true` unless the town was already paused by the player; closing it sends `setPaused false`. State is
`heldByMenu` (`'wait'` until the snapshot shows the pause, `'on'` after). If the player presses ▶ inside the menu, the
hold is dropped and the town is left running. Uses the existing `paused` flag, so nothing new is saved.

**Promotion wording.** Only the words the player reads changed: the "ready for promotion" notice (`sim/classes.ts`
`askEvolve`), the Town menu's "Promotions: ask me / they choose" (`panel/buildPanel.ts`), the People panel's "A
promotion waits / awaits" and README. Ids and save fields (`kind: 'evolve'`, `evolveAsk`, `evolveTo`) are as they were.

**The promotion that came back (changes "Evolutions that matter").** The sim could not be made to re-ask: every
road, origin, founder line and level was run (pick, then hourly) and a question answered was always gone and never put
again. Two gaps that could strand it were closed: `roadEvents.ts` `answerPrompt` now takes the town's own choice
(`defaultOption`) for a promotion answered with an index that names no option, instead of returning with the question
left standing; and the phone's event sheet (`mobile/eventSheet.ts`) marks every answered question `read`, so a snapshot
that lags behind the answer cannot open the same question again after "Continue". Test: `test/evolutions.test.ts`
("a promotion answered is done").
