## Research offered three at a time (the Studies menu)

Changes "Research picked by hand" and "Every menu in sub-tabs": the player no longer queues research. The town is offered
three topics it can study now, and one is chosen.

- **The offer** (`sim/researchOffer.ts`, new): `OFFER_SIZE` 3 topics, drawn from what can be studied now (prerequisites
  done, era and seat reached, not forgone, refinements only from 4 people), on a side stream
  `new Rng(hashSeed(`${seed}:research-offer:${n}`))` (n = `research.offers`, offers drawn so far). `keepOffer(s)` runs
  every tick (called in `sim.ts` before the planner): draws when there is a free study slot and no offer, and again when
  any offered topic stops being studyable; with every slot busy there is no offer, and a finished topic draws three new
  ones. `chooseOffer(s, id)` queues the topic and clears the offer; any other topic, or a second tap, does nothing.
  `offerableTopics`, `drawOffer`, `offerOverdue` are exported for the planner and tests.
- **The command** `studyOffer { topic }` (`commands.ts`, `sim.ts`). `queueResearch` / `moveResearch` / `cancelResearch`
  stay in the sim (old tests, old callers) but the menu no longer sends them.
- **Hands-off:** `planResearch` (`planner.ts`) now chooses among the three once the offer has stood `OFFER_WAIT_TICKS`
  (3 game hours): the best by its old scoring (`topicScore` plus the "leads to a wanted topic" share). So that the town's
  needs still come up, the planner also stores `research.suggested`, the two topics it would study first, and swaps them
  into the offer when they are not there (`drawOffer` includes them too): two of the three are the town's suggestions, one
  is random. Without them a town drawn three at random never got to Barter and its Trading Post. Remove the suggestions
  by emptying `suggested`.
- **Save:** new optional `ResearchState` fields `offer`, `offerAt`, `offers`, `offerEmpty`, `suggested`. Old queues and
  picks load and run as before; nothing needs migrating. `orderQueue` also drops any repeat from `queue` / `picked`.
- **Snapshot:** `research.offer`, `research.offerLeft` (ticks before the town chooses).
- **The menu** (`panel/researchPanel.ts`, `.rs-*` CSS in `panel/panel.html`, `GROUPS.research` in `panel/subtabs.ts`):
  "Studying now" (each topic with its bar and who studies it), "Choose a topic" (three big cards: name, line, time, what
  it unlocks, a Study button; the same tap sent twice within 600 ms is ignored), "Stations", and an "All topics" tab with
  the read-only tech tree.
- **Functions changed in shared code:** `orderQueue` (`sim/research.ts`); `planResearch` (`planner.ts`: the queue-filling
  loop and the `REFINE_AT` constant are gone, replaced by the choice above); `researchView` (`snapshot.ts`).
- **Tests:** `test/researchOffer.test.ts`, `test/researchDupes.test.ts`; `test/helpers.ts` `overdueOffer`; the planner
  and shop tests that ran the planner once and read the queue now make the offer overdue first (and the shop test that
  expects a second topic runs a second pass).
