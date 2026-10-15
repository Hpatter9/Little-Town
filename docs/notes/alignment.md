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

### The extras (second axis, the Enemy, visitors, titles, arcs)

- **Order to chaos:** `s.align.order` (-100..100), its own home per people (`ORIGIN_ORDER_HOME`), `orderPush`, weights per answer in
  `data/eventOrder.ts` (and `ALIGN_EVENT_ORDER` for the alignment events). Moved by laws (`LAW_ORDER`), sentences, intrigue crimes,
  houses at feud, the leader's and folk's natures (`ORDER_LEAN`). It tilts the recommendation too. Orderly (>= 35): work x1.03, watch
  x1.05; unruly (<= -35): work x0.97, fighting x1.05, travellers x1.1 (daily marks, `marks`). Two bars in the Town overview (`panel/alignBar.ts`);
  the Direction block no longer repeats it.
- **Inputs read from state:** intrigue crimes (`CRIME_ALIGN`), Great Enemy tribute paid (-2) or refused (+2), the ruling house's scandal,
  charity in famine (poor relief while the stores run low +1 a day, else -0.3). For the trade chat: broken deals call
  `alignPush(s, -3, 'A broken deal')` (and `orderPush(s, -2, ...)`).
- **The Great Enemy (hooks in `greatEnemy.ts`, each marked "alignment hook"):** `paceToday` adds `alignEnemyPace` (a good town draws its hate:
  +0.08 at 35, +0.15 at 60); `warnSiege` first calls `alignPact`: a town at -35 or below is offered terms as a prompt (`kind: 'ways'`,
  `ways.system = 'align'`, answered in `roadEvents.answerPrompt` -> `answerAlignPrompt`): a pact (40 days, 4% of the treasury a day), service as its
  lieutenant (90 days, 8% a day, a grown-up taken every 12 days, never the founder, raids x0.7), or refuse (the siege goes on). While a pact stands
  `enemyDaily` sends no host and asks no tribute (`alignPacted`).
- **Visitors and terms:** `alignArrivalMult` (wanderers x1.2/1.4 for good, x0.85/0.7 for dark), `alignArrival` (kind/pious nature for a good
  town's wanderers, greedy/stern/proud for a dark one's: `maybeArrive`); daily 'prices' (x1.05 / x0.95) and 'travellers' marks.
  Refugees and paladins as separate types are not added (no such types exist).
- **The title:** `titleOf` ("the Merciful", "the Just", "the Cruel", "the Dread", "the Steadfast"...); `snapshot.townTitle` shows on the phone
  page's header; `titledName` is carried by the legend (`legacy.ts` `town`) and the year's chronicle line.
- **Falls and redemptions:** the score is sampled every ten days; from >= 20 to <= -35 inside 60 days is `fall_reckoning` (then `fall_exodus`),
  from <= -20 to >= 35 is `redemption_penance` (then `redemption_shadow`): once each, put as an ordinary event (never by chance, `when: () => false`).
- **Cast:** `MapView.setCast` tints the venues' banners (gold / dim violet), `StreetLamps.setCast` the lamp glow; both pack sprites tinted, no new art.
- Preview helpers: `__align(score, order)` and `__event(id)` in the phone page's console (`simHost` DEBUG).
