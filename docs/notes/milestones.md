## Town ranks, milestones and generations (visible progress)

Three things that make a long game read as progress at every timescale, with nothing for the player to do. All of it is
off with the autopilot (`s.autopilot === false` returns), and none of it draws a number or takes an id from the town.

- **Town tiers** (`sim/tiers.ts`, data in `data/tiers.ts`). Seven rungs: Camp, Hamlet, Village, Market Town, Walled Town,
  Town, City (`DEFAULT_TIERS`), with ladders of their own for the dwarves, vampires, nomads, knights, orcs, liches and
  machines (`TIER_NAMES`, keyed by people; the rest use the default). `TIER_RULES[k]` asks for people, buildings standing
  (not ring-wall pieces), the day, and a done market (rung 3+), the ring closed (4+; a hold, castle or camp on the move
  has no ring, so it needs `NO_RING_EXTRA` more buildings instead) and the seat at a stage (5: 2, 6: 3). `tierOf(s, held)`
  rises to the highest rung met in full and falls only when the held rung is missed even at `TIER_SLACK` (80%), so one
  death does not flicker it. `tiersHourly` (from `sim.ts`, after `annalsHourly`) keeps `s.rank` (`Rank`: tier, best,
  since, founders, founder name and nature, generation, last change). A rise past the best so far, or any fall, is told:
  `tell` lines (news + journal, key) and `rank.last` (a `RankChange` with a card key, the line, and the founder's
  remembered word from their nature: `lineFor(nature, 'work' | 'mourn', tier)`, no draw). A rung regained is only noted.
  An older save starts at the rung it holds, uncelebrated. Snapshot: `rank` (`RankView`: tier, name, "a Market Town",
  since, last). The top bar (`ui/topBar.ts`) shows "Name, a Market Town" (the name is cut with an ellipsis, the rank is
  not; the alignment title moved to the mark's tip). `mobile.ts` no longer writes `#top-title` (the bar owns it).
- **Milestones** (`sim/milestones.ts`, `MILESTONES` in `data/tiers.ts`): wall closed, first child, first death, first
  wedding, first harvest home, first caravan, first raid won, first raid lost, first mythic, first unique, hundredth day,
  founders gone, first daughter village. `s.milestones?: { id, day }[]` (once each, `markMilestone`). Events that fire
  once in the sim call it where they happen (`tallyRaid` in `annals.ts`, `harvestHome` in `farming.ts`); the rest the
  state already shows and `milestonesHourly` finds them. `s.milestonesFrom` is the day recording began: an older save
  records from then, and the Milestones section says so in one line.
- **`tell(s, text, key)`** (`milestones.ts`): the news line these use. It takes its id as a fraction between the last id
  given out and `nextId` (`s.tellAt`), never from `nextId` itself: a `notify` here moved every later id and changed who
  was born when, so towns played out differently (found with `tools/sim-hash.mjs`).
- **Generations** (`generationNow`, `generationLines` in `tiers.ts`): the highest generation of grown folk alive, from
  `lineGroups` (`sim/lineage.ts`); a new high is told ("The third generation now works the fields."). The founders are
  those living with no parents when the rank is first reckoned (`rank.founders`); "None who founded the town still live."
  is the `generation` milestone and a Chronicle line.
- **Cards** (renderer): `mobile/milestoneCards.ts` reads the snapshot (`annals.milestones`, `rank.last`), takes the first
  snapshot's cards as seen, and shows each new key once through `showReveal` (`mobile/revealCard.ts`, tone `gold`, key
  `m:<id>` or the rank change's key). Icons are DawnLike/GUI marks by name (`ui/icon.ts`).
- **Chronicle tab:** a "Milestones" filter (`panel/milestonesPanel.ts`, wired in `panel/journalPanel.ts`) lists the
  generation lines and the firsts, "n of 13". The journal panel's redraw key (`panel/panel.ts`) includes the milestones
  count and the generation lines.
- Tests: `test/tiers.test.ts`. Sim-hash: with the new fields, notices and journal stripped, all four towns and the late-town
  fixture hash the same as before.
- Changes sections of HISTORY.md: "The annals" (annals.ts now notes the first raid won/lost), "Phase 4, more farming"
  (the harvest home notes the first), "The phone made smoother" (top bar title), "Every menu in sub-tabs"/"The menus
  redone" (the Chronicle's filter row).
