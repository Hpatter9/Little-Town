## Town alignment (good and evil, with a bar)

One score, -100 (wicked) to +100 (radiant), `s.align` (optional; `AlignState`). Files: `sim/alignment.ts`, `data/alignment.ts`
(constants, bands, `ORIGIN_HOME`, law/sentence weights), `data/eventAlign.ts` (a weight -4..+4 for every answer of every
choice event, in option order), `data/alignEvents.ts` (five events that only come past a threshold).

- **What moves it:** the answer to a choice event (`alignAnswered`, weight x `POINTS_PER_WEIGHT` 4; called in `answerEvent`);
  once a day the leader's and the townsfolk's natures (`leaderLean`, `NATURE_LEAN`); laws passed or repealed (`LAW_ALIGN`),
  sentences told in the trial log (`SENTENCE_ALIGN`: hanged -10, pardoned +3), sacrifices in `s.fallen` (`DEED_ALIGN`), raiders
  taken alive (+0.8 each), hungry prisoners (-0.4 a day each). The watchers read state (they don't edit politics.ts or
  prisoners.ts). Other systems call `alignPush(s, delta, why)`; not yet called by the Great Enemy tribute, deals or dynasty
  conduct (those files belong to other chats).
- **Drift:** `DRIFT_PER_HOUR` 0.002 of the way back to the people's home (`ORIGIN_HOME`; vampires -45, liches -50, knights +40,
  druids +35, orcs -15...). Runs hourly from `Sim.step` after `maybeEvent`, autopilot only.
- **Recommendation:** `recommend(s, def)` scores each answer by weight x the town's lean (alignment + leader/folk nature) plus
  `worth()` (a rough value of its effects, food counted heavier when stores are thin). `Prompt.recommended` / `why` ->
  `PromptView`. With the autopilot on the card's `defaultOption` is the recommendation, so a timed-out card takes it
  (autopilot off keeps the event's own default). Shown as a star on the answer and a line under the answers
  (`mobile/eventSheet.ts`, `.event-advice` in `mobile/index.html`; the desktop prompt card marks it too).
- **Shows:** `alignBar` (`panel/alignBar.ts`) in the Town overview and under Direction in the Plan tab; the page sky is tinted
  and a soft edge vignette laid (`#align-cast`, `mobile.ts`; never over the middle); `moodOf` gets `align` (<= -45 dark music,
  >= 60 heroic). `snapshot.align` = `alignView`.
- **Unlocks (daily, side stream `align`):** good (>= 35) pilgrims join, reputation creeps up; evil (<= -35) the Hand pays the
  treasury, reputation creeps down. `raidAlignMult`: raids 0.9x (<= -35), 0.8x (<= -60) for fear; 1.1x at >= 60 (the dark hunts
  the light). Events: `pilgrims_come`, `holy_order` (>= 60), `thieves_offer`, `dark_bargain`, `foes_treat` (<= -60).
- **Cost:** spirits +2 for the good, -3 for an evil town whose people are not dark by nature (`alignMood`, `driftMorale`).
- **Chronicle:** swings of 2+ points are logged (`a.log`), a band change is a news item, and the year's chronicle gets a line
  (`alignmentYearLines`, hooked in `annals.ts`).
- Changes `data/events.ts` (EVENTS now 558) and `raidBudget`.
