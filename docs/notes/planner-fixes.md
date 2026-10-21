## Planner fixes: knights' homes, every people researches and builds, the wall waits for a full inner area

Changes the HISTORY.md sections "Research picked by hand" (the planner's topic scores) and "The ring wall".

- **Knights built no homes.** Their start list has `palisades` and `drill_yard` but not `basic_shelter`, and the planner
  reached the first home by the long road: Fire Keeping, then Oral Tradition (longhouse), because a prerequisite
  inherits most of the worth of the topic behind it (`LEADS_SHARE`). Until then the knights built pitches and a wall
  but no beds. `Needs.noHome` (`sim/planner.ts`) is true while no housing building is unlocked; then a topic with no
  prerequisites that opens a home scores 80 (not 30) for "the town needs more beds", so Basic Shelter comes first.
- **`test/originPlanner.test.ts`**: for every origin, a town with the autopilot on runs 8 days and must finish a
  topic and have a finished home. It caught only the knights.
- **The wall waits for a full inner area.** `ringFull(s)` and `RING_FULL` (0.6) in `sim/ringWall.ts`: the share of
  the ground inside the ring (fields and the wall itself aside) under buildings. `planRing` widens the ring only when
  `ringFull`, and the planner's upgrade loop leaves a done wall piece (palisade to stone, say) alone until then. No ring
  means true. The first ring is unchanged. Test in `test/ringWall.test.ts`; the widening test now fills the ring first.
