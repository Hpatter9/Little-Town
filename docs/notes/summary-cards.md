## One summary card for each trip and each raid

The owner's decision: after a trip or a raid, the cards that pile up are merged into one summary card for each. Before,
the creature's nest trip ended with the lineup, "A quest won", "Home from the Broken Nest" (the haul again), the naming,
the first night and "The party is home" (the haul a third time); a raid with "A raid survived", a "first" card, then
the recap (docs/notes/playthrough.md, "Left"). Changes HISTORY.md "Founder quests, the steward" (the story's trip and
raid chapters, the steward's card), "Sending a party yourself" (the debrief), "A recap after every raid", "The town's
rank and its firsts" (the milestone cards) and the reveals' haul chest ("Reveals").

**The trip's summary** is the commanded party's debrief (`debrief`, sim/muster.ts), which already told who came home
and how, who did not, and the haul. It now also carries (all optional on `Debrief`, sim/state.ts, so older saves'
debriefs read as before):
- `trip`: the expedition's id. The page's haul chest ("The party is home", mobile/revealCard.ts) stands aside for any
  party whose summary is in the snapshot's prompts: the haul is told once, on the summary, each kind with its icon
  (`loot`, drawn with `stockIcon` in mobile/eventSheet.ts `debriefBlock`). A unique found on the way still has its own
  card (a major moment). The town's own parties, with no debrief, keep their chest as their one card.
- `chapter`: the founder's chapter ("Maren's story: A quest won"). `storyTrip` (sim/story.ts) still writes it to the
  Story tab, quietly, and returns its heading, shown as one line: Written in Maren's story: "A quest won".
- `firsts`: the firsts it earned (`FirstLine`: title, line, icon), shown as gold lines on the card.
- `home`: the steward's "While you were gone" news (sim/steward.ts `homeAgain`). While the founder's trip card is still
  to be read (`founderTripCard`), the news joins it, under its own heading, instead of a card of its own; it goes in the
  news log too. The card is drawn again when it joins (`shownHome`).
The box's first lines are now where and how long (the debrief's first line) and the win ("The Broken Nest is
cleared."), above who came home.

**The raid's summary** is the recap (battle/raidRecap.ts). `storyRaid` writes its chapter quietly and returns the
heading; `endRaid` (sim/raids.ts) puts it and the firsts the raid earned on `RaidRecap.chapter` and `.firsts`. The card
now shows the outcome and the four panels with the highlight chips (who fought best, the God creature among them, who
fell, who rose a level), then the toll and the loot (Lost, Wounded, Spoils, Prisoners, Taken from us; the God creature
counted in Lost or Wounded), the firsts and the chapter line; the story told and the full tally (each defender's row,
the creature's, the towers') are a tap away on **Full recap ›** (`full`, part of the redraw key; reset for a new raid).

**Firsts folded** (sim/summaries.ts): `firstsSoFar` counts the town's firsts before the moment, `foldFirsts` takes the
ones recorded since, marks them `folded` (optional on `GameState.milestones` and in the snapshot's
`annals.milestones`) and returns them as lines. `marksNow` records the firsts a trip's or a raid's end earns at once
rather than at the next hourly look: the first death (someone lost), the first unique. The page's milestone cards
(mobile/milestoneCards.ts `cardsOf`) pass a folded first by. Every first is still in the news and the annals as before.

**Choices still wait.** The creature's lineup, its naming and its first night are their own steps. The event box keeps
the one it shows; otherwise a trip's summary goes before any other waiting question (mobile/eventSheet.ts), so the
summary leads into them in order: the nest trip is now the summary, the lineup, the naming, the first night (four cards,
three of them choices; it was six). A delve the founder led: one card (it was three). A raid: the recap alone (the
debrief card is gone, and the first raid's card with it).

**The hold.** No new hold: the story's raid card no longer exists to wait behind the victory board (the deadlock in
docs/notes/raid-flow-taps.md is unchanged: the board's clock runs, then the recap shows). The trip's summary holds the
town as any debrief did.

**Determinism.** Nothing draws a number. A chapter or a "While you were gone" card that is now folded still takes the
id its card used to (`s.nextId++`), so every town plays out as before (a long hold test, castle.test.ts, moved without
it). Milestones may be marked a little sooner (the first death at the raid's or trip's end), which changes no rule.

Files: `sim/summaries.ts` (new), `sim/story.ts`, `sim/muster.ts`, `sim/steward.ts`, `sim/raids.ts`, `sim/raidRecap.ts`,
`sim/state.ts`, `sim/snapshot.ts`, `mobile/eventSheet.ts`, `mobile/index.html`, `mobile/revealCard.ts`,
`mobile/milestoneCards.ts`, `battle/raidRecap.ts`, `renderer/index.html`. Tests: `test/summaryCards.test.ts` (a trip the
founder led: one card with who died, the chapter, the first death folded, the news from home joined, the haul told
once; a trip without the founder; a raid won: the chapter and the first raid on the recap, no story card; a raid with a
death: the dead on the recap, the first death folded once; autopilot off: none of it). Screenshots before and after,
upright and sideways: `docs/notes/summary-cards/`.
